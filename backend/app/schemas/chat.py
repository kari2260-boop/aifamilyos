from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ChatSendRequest(BaseModel):
    agent_type: str  # xuexue / chuangchuang / tantan / banban
    message: str
    conversation_id: Optional[UUID] = None  # 为空则新建对话
    child_id: Optional[UUID] = None  # 关联的孩子


class MessageItem(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSendResponse(BaseModel):
    conversation_id: UUID
    reply: str
    model_used: str
    tokens_input: int
    tokens_output: int
    remaining_quota: Optional[int] = None

    model_config = {"protected_namespaces": ()}


class ConversationListItem(BaseModel):
    id: UUID
    agent_type: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
