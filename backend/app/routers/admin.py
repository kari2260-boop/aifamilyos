"""
Admin Router - 管理后台接口
仅 role=admin 的用户可访问
"""
from uuid import UUID
from typing import List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.utils.auth import require_admin
from app.models.models import (
    User, Family, ChildProfile, Conversation, Message, RiskFlag, UsageLog,
)
from app.schemas.admin import (
    AdminStats, AdminFamilyItem, AdminConversationItem,
    AdminRiskItem, RiskHandleRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def get_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理后台首页统计"""
    total_families = db.query(func.count(Family.id)).scalar() or 0
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0

    today = date.today()
    today_conversations = db.query(func.count(Conversation.id)).filter(
        func.date(Conversation.created_at) == today
    ).scalar() or 0

    risk_unhandled = db.query(func.count(RiskFlag.id)).filter(
        RiskFlag.handled == False
    ).scalar() or 0

    return AdminStats(
        total_families=total_families,
        total_conversations=total_conversations,
        today_conversations=today_conversations,
        risk_flags_unhandled=risk_unhandled,
    )


@router.get("/families", response_model=List[AdminFamilyItem])
def list_families(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """家庭列表（优化：单条SQL，避免N+1）"""
    from sqlalchemy import text
    sql = text("""
        SELECT f.id, f.family_name, f.city, f.created_at,
               u.phone as owner_phone,
               (SELECT COUNT(*) FROM children_profiles cp WHERE cp.family_id = f.id) as children_count,
               (SELECT COUNT(*) FROM conversations c WHERE c.family_id = f.id) as conv_count,
               f.subscription_plan,
               f.subscription_expires_at
        FROM families f
        JOIN users u ON u.id = f.owner_user_id
        ORDER BY f.created_at DESC
        LIMIT 200
    """)
    rows = db.execute(sql).fetchall()
    return [
        AdminFamilyItem(
            id=row[0],
            family_name=row[1],
            city=row[2],
            owner_phone=row[4],
            children_count=row[5],
            conversations_count=row[6],
            created_at=row[3],
            subscription_plan=row[7],
            subscription_expires_at=row[8],
        )
        for row in rows
    ]


@router.get("/families/{family_id}")
def get_family_detail(
    family_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """家庭详情（含孩子信息）"""
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    owner = db.query(User).filter(User.id == family.owner_user_id).first()
    children = db.query(ChildProfile).filter(ChildProfile.family_id == family.id).all()
    conv_count = db.query(func.count(Conversation.id)).filter(
        Conversation.family_id == family.id
    ).scalar() or 0

    return {
        "id": str(family.id),
        "family_name": family.family_name,
        "city": family.city,
        "membership_level": family.membership_level,
        "subscription_plan": family.subscription_plan,
        "monthly_quota": family.monthly_quota,
        "subscription_started_at": family.subscription_started_at.isoformat() if family.subscription_started_at else None,
        "subscription_expires_at": family.subscription_expires_at.isoformat() if family.subscription_expires_at else None,
        "assessment_quota": family.assessment_quota or 0,
        "report_quota": family.report_quota or 0,
        "owner_phone": owner.phone if owner else "未知",
        "conversations_count": conv_count,
        "created_at": family.created_at.isoformat() if family.created_at else None,
        "children": [
            {
                "id": str(c.id),
                "name": c.name,
                "age": c.age,
                "grade": c.grade,
                "interests": c.interests,
                "learning_challenges": c.learning_challenges,
                "parent_expectations": c.parent_expectations,
            }
            for c in children
        ],
    }


@router.get("/conversations", response_model=List[AdminConversationItem])
def list_conversations(
    agent_type: str = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """对话列表"""
    query = db.query(Conversation)
    if agent_type:
        query = query.filter(Conversation.agent_type == agent_type)
    conversations = query.order_by(Conversation.updated_at.desc()).limit(100).all()

    result = []
    for c in conversations:
        family = db.query(Family).filter(Family.id == c.family_id).first()
        msg_count = db.query(func.count(Message.id)).filter(
            Message.conversation_id == c.id
        ).scalar() or 0
        has_risk = db.query(Message).filter(
            Message.conversation_id == c.id,
            Message.risk_level.isnot(None),
        ).first() is not None

        result.append(AdminConversationItem(
            id=c.id,
            family_name=family.family_name if family else "未知",
            agent_type=c.agent_type,
            title=c.title,
            messages_count=msg_count,
            has_risk=has_risk,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    return result


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """查看对话详情"""
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "model_name": m.model_name,
            "tokens_input": m.tokens_input,
            "tokens_output": m.tokens_output,
            "risk_level": m.risk_level,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.get("/risks", response_model=List[AdminRiskItem])
def list_risks(
    handled: bool = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """风险记录列表"""
    query = db.query(RiskFlag)
    if handled is not None:
        query = query.filter(RiskFlag.handled == handled)
    risks = query.order_by(RiskFlag.created_at.desc()).limit(100).all()

    result = []
    for r in risks:
        family = db.query(Family).filter(Family.id == r.family_id).first()
        result.append(AdminRiskItem(
            id=r.id,
            family_name=family.family_name if family else "未知",
            risk_type=r.risk_type,
            risk_level=r.risk_level,
            content_snapshot=r.content_snapshot,
            handled=r.handled,
            handler_notes=r.handler_notes,
            created_at=r.created_at,
        ))
    return result


@router.put("/risks/{risk_id}")
def handle_risk(
    risk_id: UUID,
    req: RiskHandleRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """处理风险记录"""
    risk = db.query(RiskFlag).filter(RiskFlag.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="风险记录不存在")

    risk.handled = req.handled
    risk.handler_notes = req.handler_notes
    risk.handled_at = datetime.utcnow()
    db.commit()

    return {"status": "ok"}


@router.get("/usage/summary")
def usage_summary(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """用量总览"""
    total_tokens_input = db.query(func.coalesce(func.sum(UsageLog.tokens_input), 0)).scalar()
    total_tokens_output = db.query(func.coalesce(func.sum(UsageLog.tokens_output), 0)).scalar()
    total_cost = db.query(func.coalesce(func.sum(UsageLog.cost_estimate), 0)).scalar()
    total_chats = db.query(func.count(UsageLog.id)).filter(UsageLog.action_type == "chat").scalar() or 0

    # 各 Agent 使用占比
    agent_usage = db.query(
        UsageLog.agent_type,
        func.count(UsageLog.id).label("count"),
    ).filter(
        UsageLog.agent_type.isnot(None)
    ).group_by(UsageLog.agent_type).all()

    # 活跃家庭数
    active_families = db.query(func.count(func.distinct(UsageLog.family_id))).scalar() or 0

    return {
        "total_tokens_input": total_tokens_input,
        "total_tokens_output": total_tokens_output,
        "total_tokens": total_tokens_input + total_tokens_output,
        "total_cost": round(float(total_cost), 4),
        "total_chats": total_chats,
        "active_families": active_families,
        "agent_usage": [
            {"agent_type": a[0], "count": a[1]} for a in agent_usage
        ],
    }


@router.get("/usage/daily")
def usage_daily(
    days: int = 30,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """每日对话趋势"""
    start_date = date.today() - timedelta(days=days)

    daily_data = db.query(
        func.date(UsageLog.created_at).label("day"),
        func.count(UsageLog.id).label("count"),
        func.coalesce(func.sum(UsageLog.tokens_input + UsageLog.tokens_output), 0).label("tokens"),
    ).filter(
        func.date(UsageLog.created_at) >= start_date
    ).group_by(
        func.date(UsageLog.created_at)
    ).order_by(
        func.date(UsageLog.created_at)
    ).all()

    return {
        "days": [
            {
                "date": str(d[0]),
                "count": d[1],
                "tokens": int(d[2]),
            }
            for d in daily_data
        ],
    }
