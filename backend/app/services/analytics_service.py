"""
数据回流分析引擎
每周/每月自动运行，分析：
1. 知识块有效性（命中率 × 满意度）
2. Agent性能对比（各Agent满意度/追问率）
3. 知识缺口（高频未命中问题）
4. 用户行为模式（活跃度/偏好/流失预警）
"""
import json
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case

from app.models.models import (
    Message, Conversation, Family, ChildProfile,
    KnowledgeChunk, KnowledgeDoc, GrowthTag, UsageLog,
)
from app.services.llm_service import chat_completion


async def run_weekly_analysis(db: Session, weeks_back: int = 1) -> dict:
    """运行每周数据分析，返回结构化报告"""
    since = datetime.utcnow() - timedelta(weeks=weeks_back)
    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "period": f"最近{weeks_back}周",
        "knowledge_effectiveness": analyze_knowledge_effectiveness(db, since),
        "agent_performance": analyze_agent_performance(db, since),
        "knowledge_gaps": analyze_knowledge_gaps(db, since),
        "user_behavior": analyze_user_behavior(db, since),
    }
    return report


def analyze_knowledge_effectiveness(db: Session, since: datetime) -> dict:
    """分析知识块有效性：命中率 × 用户反馈"""
    # 统计有反馈的消息中，知识块命中情况
    messages_with_feedback = db.query(Message).filter(
        Message.created_at >= since,
        Message.role == "assistant",
        Message.feedback.isnot(None),
    ).all()

    total_with_feedback = len(messages_with_feedback)
    useful_with_rag = 0
    not_useful_with_rag = 0
    useful_without_rag = 0
    not_useful_without_rag = 0

    chunk_scores = {}  # chunk_id -> {useful: 0, not_useful: 0}

    for msg in messages_with_feedback:
        has_rag = bool(msg.retrieved_chunks)
        if msg.feedback == "useful":
            if has_rag:
                useful_with_rag += 1
                # 记录哪些知识块被认为有用
                if msg.retrieved_chunks:
                    for chunk in msg.retrieved_chunks:
                        cid = chunk.get("chunk_id", "")
                        if cid not in chunk_scores:
                            chunk_scores[cid] = {"useful": 0, "not_useful": 0}
                        chunk_scores[cid]["useful"] += 1
            else:
                useful_without_rag += 1
        else:
            if has_rag:
                not_useful_with_rag += 1
                if msg.retrieved_chunks:
                    for chunk in msg.retrieved_chunks:
                        cid = chunk.get("chunk_id", "")
                        if cid not in chunk_scores:
                            chunk_scores[cid] = {"useful": 0, "not_useful": 0}
                        chunk_scores[cid]["not_useful"] += 1
            else:
                not_useful_without_rag += 1

    # 识别低效知识块（被引用但评价差）
    low_quality_chunks = [
        {"chunk_id": cid, "useful": s["useful"], "not_useful": s["not_useful"]}
        for cid, s in chunk_scores.items()
        if s["not_useful"] > s["useful"] and (s["useful"] + s["not_useful"]) >= 2
    ]

    return {
        "total_feedback_messages": total_with_feedback,
        "useful_with_rag": useful_with_rag,
        "not_useful_with_rag": not_useful_with_rag,
        "useful_without_rag": useful_without_rag,
        "not_useful_without_rag": not_useful_without_rag,
        "rag_satisfaction_rate": round(useful_with_rag / max(useful_with_rag + not_useful_with_rag, 1) * 100, 1),
        "low_quality_chunks_count": len(low_quality_chunks),
        "low_quality_chunks": low_quality_chunks[:10],
    }


def analyze_agent_performance(db: Session, since: datetime) -> dict:
    """分析各Agent性能对比"""
    agents = ["xuexue", "chuangchuang", "tantan", "banban"]
    results = {}

    for agent in agents:
        # 该Agent的对话数
        conv_count = db.query(Conversation).filter(
            Conversation.agent_type == agent,
            Conversation.created_at >= since,
        ).count()

        # 该Agent的消息反馈
        agent_convs = db.query(Conversation.id).filter(
            Conversation.agent_type == agent,
            Conversation.created_at >= since,
        ).subquery()

        useful = db.query(Message).filter(
            Message.conversation_id.in_(agent_convs),
            Message.feedback == "useful",
        ).count()

        not_useful = db.query(Message).filter(
            Message.conversation_id.in_(agent_convs),
            Message.feedback == "not_useful",
        ).count()

        total_feedback = useful + not_useful
        satisfaction = round(useful / max(total_feedback, 1) * 100, 1)

        # 该Agent的总消息数
        total_messages = db.query(Message).filter(
            Message.conversation_id.in_(agent_convs),
            Message.role == "assistant",
        ).count()

        results[agent] = {
            "conversations": conv_count,
            "total_replies": total_messages,
            "useful_count": useful,
            "not_useful_count": not_useful,
            "satisfaction_rate": satisfaction,
        }

    return results


def analyze_knowledge_gaps(db: Session, since: datetime) -> dict:
    """分析知识缺口：哪些问题没有命中知识库"""
    # 找到没有RAG命中的用户消息
    no_rag_messages = db.query(Message).join(Conversation).filter(
        Message.created_at >= since,
        Message.role == "user",
    ).all()

    # 对应的AI回复中没有retrieved_chunks的
    gap_questions = []
    for msg in no_rag_messages:
        # 找到紧跟的AI回复
        ai_reply = db.query(Message).filter(
            Message.conversation_id == msg.conversation_id,
            Message.role == "assistant",
            Message.created_at > msg.created_at,
        ).order_by(Message.created_at.asc()).first()

        if ai_reply and not ai_reply.retrieved_chunks:
            gap_questions.append({
                "question": msg.content[:100],
                "agent_type": db.query(Conversation.agent_type).filter(
                    Conversation.id == msg.conversation_id
                ).scalar(),
                "time": msg.created_at.isoformat(),
            })

    # 按频率统计（简化：取前20个）
    return {
        "total_no_rag_questions": len(gap_questions),
        "sample_questions": gap_questions[:20],
    }


def analyze_user_behavior(db: Session, since: datetime) -> dict:
    """分析用户行为模式"""
    # 活跃家庭数
    active_families = db.query(func.count(func.distinct(Conversation.family_id))).filter(
        Conversation.created_at >= since,
    ).scalar() or 0

    # 总家庭数
    total_families = db.query(func.count(Family.id)).scalar() or 0

    # 每个家庭的对话数
    family_activity = db.query(
        Conversation.family_id,
        func.count(Conversation.id).label("conv_count"),
    ).filter(
        Conversation.created_at >= since,
    ).group_by(Conversation.family_id).all()

    # 流失预警：有账号但最近没活跃的家庭
    all_family_ids = set(f.id for f in db.query(Family.id).all())
    active_family_ids = set(fa.family_id for fa in family_activity)
    inactive_families = all_family_ids - active_family_ids

    # Agent使用分布
    agent_usage = db.query(
        Conversation.agent_type,
        func.count(Conversation.id),
    ).filter(
        Conversation.created_at >= since,
    ).group_by(Conversation.agent_type).all()

    return {
        "active_families": active_families,
        "total_families": total_families,
        "activity_rate": round(active_families / max(total_families, 1) * 100, 1),
        "inactive_family_count": len(inactive_families),
        "agent_usage": {agent: count for agent, count in agent_usage},
        "avg_conversations_per_family": round(
            sum(fa.conv_count for fa in family_activity) / max(len(family_activity), 1), 1
        ),
    }
