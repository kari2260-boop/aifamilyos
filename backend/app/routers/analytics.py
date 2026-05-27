"""
Analytics Router - 数据分析接口
GET  /admin/analytics/weekly     获取/触发周报分析
GET  /admin/analytics/prompt-suggestions/{agent_type}  获取prompt优化建议
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_admin
from app.models.models import User
from app.services.analytics_service import run_weekly_analysis
from app.services.prompt_optimizer import generate_prompt_suggestions

router = APIRouter(prefix="/admin/analytics", tags=["数据分析"])


@router.get("/weekly")
async def get_weekly_analysis(
    weeks: int = 1,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """获取周度数据分析报告"""
    report = await run_weekly_analysis(db, weeks_back=weeks)
    return report


@router.get("/prompt-suggestions/{agent_type}")
async def get_prompt_suggestions(
    agent_type: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """获取指定Agent的prompt优化建议"""
    if agent_type not in ("xuexue", "chuangchuang", "tantan", "banban"):
        return {"error": "无效的agent_type"}

    result = await generate_prompt_suggestions(agent_type, db)
    return result


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """快速概览（管理后台首页用）"""
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from app.models.models import Message, Conversation, Family, KnowledgeChunk

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    # 本周数据
    weekly_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.created_at >= week_ago
    ).scalar() or 0

    weekly_messages = db.query(func.count(Message.id)).filter(
        Message.created_at >= week_ago,
        Message.role == "assistant",
    ).scalar() or 0

    # 反馈统计
    useful = db.query(func.count(Message.id)).filter(
        Message.created_at >= week_ago,
        Message.feedback == "useful",
    ).scalar() or 0

    not_useful = db.query(func.count(Message.id)).filter(
        Message.created_at >= week_ago,
        Message.feedback == "not_useful",
    ).scalar() or 0

    # 知识库规模
    total_chunks = db.query(func.count(KnowledgeChunk.id)).scalar() or 0

    # 活跃家庭
    active_families = db.query(func.count(func.distinct(Conversation.family_id))).filter(
        Conversation.created_at >= week_ago,
    ).scalar() or 0

    total_families = db.query(func.count(Family.id)).scalar() or 0

    return {
        "period": "本周",
        "weekly_conversations": weekly_conversations,
        "weekly_ai_replies": weekly_messages,
        "feedback_useful": useful,
        "feedback_not_useful": not_useful,
        "satisfaction_rate": round(useful / max(useful + not_useful, 1) * 100, 1),
        "knowledge_chunks": total_chunks,
        "active_families": active_families,
        "total_families": total_families,
    }
