"""
Analytics Router - 数据分析接口
GET  /admin/analytics/weekly     获取/触发周报分析
GET  /admin/analytics/overview   快速概览
GET  /admin/analytics/families   家庭健康度看板
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
    from app.models.models import Message, Conversation, Family, KnowledgeChunk, ChildProfile

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 本周对话
    weekly_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.created_at >= week_ago
    ).scalar() or 0

    weekly_messages = db.query(func.count(Message.id)).filter(
        Message.created_at >= week_ago,
        Message.role == "assistant",
    ).scalar() or 0

    # 今日对话
    today_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.created_at >= today_start
    ).scalar() or 0

    # 本月新增家庭
    new_families_this_month = db.query(func.count(Family.id)).filter(
        Family.created_at >= month_start
    ).scalar() or 0

    # 反馈统计（只统计有反馈的，避免 0% 误导）
    useful = db.query(func.count(Message.id)).filter(
        Message.created_at >= week_ago,
        Message.feedback == "useful",
    ).scalar() or 0

    not_useful = db.query(func.count(Message.id)).filter(
        Message.created_at >= week_ago,
        Message.feedback == "not_useful",
    ).scalar() or 0

    total_feedback = useful + not_useful
    satisfaction_rate = round(useful / total_feedback * 100, 1) if total_feedback > 0 else None

    # 知识库规模
    total_chunks = db.query(func.count(KnowledgeChunk.id)).scalar() or 0

    # 活跃家庭（本周有对话）
    active_families = db.query(func.count(func.distinct(Conversation.family_id))).filter(
        Conversation.created_at >= week_ago,
    ).scalar() or 0

    total_families = db.query(func.count(Family.id)).scalar() or 0

    # 孩子画像完整度（有 ai_profile 的孩子数 / 总孩子数）
    total_children = db.query(func.count(ChildProfile.id)).scalar() or 0
    children_with_profile = db.query(func.count(ChildProfile.id)).filter(
        ChildProfile.ai_profile.isnot(None)
    ).scalar() or 0

    # 平均每活跃家庭本周对话次数
    avg_conv_per_family = round(weekly_conversations / active_families, 1) if active_families > 0 else 0

    return {
        "period": "本周",
        "weekly_conversations": weekly_conversations,
        "weekly_ai_replies": weekly_messages,
        "today_conversations": today_conversations,
        "new_families_this_month": new_families_this_month,
        "feedback_useful": useful,
        "feedback_not_useful": not_useful,
        "total_feedback": total_feedback,
        "satisfaction_rate": satisfaction_rate,  # None 表示暂无反馈
        "knowledge_chunks": total_chunks,
        "active_families": active_families,
        "total_families": total_families,
        "total_children": total_children,
        "children_with_profile": children_with_profile,
        "profile_completion_rate": round(children_with_profile / total_children * 100) if total_children > 0 else 0,
        "avg_conv_per_active_family": avg_conv_per_family,
    }


@router.get("/families")
async def get_family_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """家庭健康度看板"""
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from app.models.models import Conversation, Family, ChildProfile, RiskFlag

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    families = db.query(Family).order_by(Family.created_at.desc()).limit(50).all()

    result = []
    for f in families:
        # 本周对话数
        weekly_conv = db.query(func.count(Conversation.id)).filter(
            Conversation.family_id == f.id,
            Conversation.created_at >= week_ago,
        ).scalar() or 0

        # 最近活跃时间
        last_conv = db.query(Conversation).filter(
            Conversation.family_id == f.id,
        ).order_by(Conversation.created_at.desc()).first()

        last_active = last_conv.created_at.strftime("%m-%d %H:%M") if last_conv else None

        # 孩子数 + 画像完整度
        children = db.query(ChildProfile).filter(ChildProfile.family_id == f.id).all()
        children_with_profile = sum(1 for c in children if c.ai_profile)

        # 未处理风险
        unhandled_risks = db.query(func.count(RiskFlag.id)).filter(
            RiskFlag.family_id == f.id,
            RiskFlag.handled == False,
        ).scalar() or 0

        # 活跃状态
        is_active = weekly_conv > 0

        result.append({
            "family_id": str(f.id),
            "family_name": f.family_name,
            "subscription_plan": f.subscription_plan,
            "children_count": len(children),
            "children_with_profile": children_with_profile,
            "weekly_conversations": weekly_conv,
            "last_active": last_active,
            "is_active": is_active,
            "unhandled_risks": unhandled_risks,
        })

    # 按活跃度排序：有风险 > 不活跃 > 活跃
    result.sort(key=lambda x: (
        -x["unhandled_risks"],
        0 if x["is_active"] else 1,
        -(x["weekly_conversations"]),
    ))

    return result

