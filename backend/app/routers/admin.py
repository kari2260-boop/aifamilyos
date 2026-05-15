"""
Admin Router - 管理后台接口
仅 role=admin 的用户可访问
"""
from uuid import UUID
from typing import List
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.utils.auth import require_admin
from app.models.models import (
    User, Family, ChildProfile, Conversation, Message, RiskFlag,
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
    """家庭列表"""
    families = db.query(Family).order_by(Family.created_at.desc()).limit(100).all()
    result = []
    for f in families:
        owner = db.query(User).filter(User.id == f.owner_user_id).first()
        children_count = db.query(func.count(ChildProfile.id)).filter(
            ChildProfile.family_id == f.id
        ).scalar() or 0
        conv_count = db.query(func.count(Conversation.id)).filter(
            Conversation.family_id == f.id
        ).scalar() or 0

        result.append(AdminFamilyItem(
            id=f.id,
            family_name=f.family_name,
            city=f.city,
            owner_phone=owner.phone if owner else "未知",
            children_count=children_count,
            conversations_count=conv_count,
            created_at=f.created_at,
        ))
    return result


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
