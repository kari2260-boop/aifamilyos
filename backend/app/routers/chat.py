"""
Chat Router - 对话接口
POST /chat/send  发送消息并获取AI回复
GET  /chat/conversations  获取对话列表
GET  /chat/conversations/{id}/messages  获取对话历史
"""
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import get_current_user
from app.models.models import User, Family, Conversation, Message, UsageLog, RiskFlag
from app.schemas.chat import (
    ChatSendRequest, ChatSendResponse,
    ConversationListItem, MessageItem,
)
from app.services.llm_service import chat_completion
from app.services.agent_prompts import get_agent_prompt
from app.services.rag_service import retrieve_context
from app.services.safety_service import check_risk, CRISIS_RESPONSE

router = APIRouter(prefix="/chat", tags=["chat"])

VALID_AGENTS = {"xuexue", "chuangchuang", "tantan", "banban"}


@router.post("/send", response_model=ChatSendResponse)
async def send_message(
    req: ChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送消息给AI Agent并获取回复"""
    # 验证 agent_type
    if req.agent_type not in VALID_AGENTS:
        raise HTTPException(status_code=400, detail=f"无效的agent_type: {req.agent_type}")

    # 获取用户的家庭
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=400, detail="请先创建家庭档案")

    # 获取或创建对话
    if req.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == req.conversation_id,
            Conversation.family_id == family.id,
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="对话不存在")
    else:
        conversation = Conversation(
            family_id=family.id,
            child_id=req.child_id,
            agent_type=req.agent_type,
            title=req.message[:50],
        )
        db.add(conversation)
        db.flush()

    # 保存用户消息
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    db.flush()

    # 构建消息历史（最近10轮）
    history = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.asc()).all()

    # 系统提示词
    system_prompt = get_agent_prompt(req.agent_type)

    # RAG 检索知识库
    agent_category_map = {
        "xuexue": "learning",
        "chuangchuang": "project",
        "tantan": "talent",
        "banban": "parenting",
    }
    category = agent_category_map.get(req.agent_type)
    rag_context, retrieved_chunks = await retrieve_context(req.message, category, db)

    if rag_context:
        system_prompt += f"\n\n## 参考知识\n以下是与用户问题相关的专业知识，请在回答时参考（但不要生硬引用）：\n{rag_context}"

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history[-20:]:  # 最多取最近20条
        messages.append({"role": msg.role, "content": msg.content})
    # 加上当前用户消息
    messages.append({"role": "user", "content": req.message})

    # 调用大模型
    reply_content, tokens_in, tokens_out, model_used = await chat_completion(messages)

    # 风险检测
    risk_level, risk_type = check_risk(req.message)
    if risk_level == "high":
        reply_content += CRISIS_RESPONSE
        risk_flag = RiskFlag(
            family_id=family.id,
            message_id=user_msg.id,
            risk_type=risk_type or "self_harm",
            risk_level=risk_level,
            content_snapshot=req.message[:500],
        )
        db.add(risk_flag)
    elif risk_level == "medium":
        risk_flag = RiskFlag(
            family_id=family.id,
            message_id=user_msg.id,
            risk_type=risk_type or "self_harm",
            risk_level=risk_level,
            content_snapshot=req.message[:500],
        )
        db.add(risk_flag)

    # 保存AI回复
    ai_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=reply_content,
        model_name=model_used,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        retrieved_chunks=retrieved_chunks,
    )
    db.add(ai_msg)

    # 记录用量
    usage = UsageLog(
        family_id=family.id,
        user_id=current_user.id,
        action_type="chat",
        agent_type=req.agent_type,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
    )
    db.add(usage)

    db.commit()

    return ChatSendResponse(
        conversation_id=conversation.id,
        reply=reply_content,
        model_used=model_used,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
    )


@router.get("/conversations", response_model=List[ConversationListItem])
def list_conversations(
    agent_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的对话列表"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return []

    query = db.query(Conversation).filter(Conversation.family_id == family.id)
    if agent_type:
        query = query.filter(Conversation.agent_type == agent_type)

    conversations = query.order_by(Conversation.updated_at.desc()).limit(50).all()
    return conversations


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageItem])
def get_messages(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取某个对话的消息历史"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.family_id == family.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()
    return messages
