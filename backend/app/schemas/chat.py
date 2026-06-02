from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime


class Attachment(BaseModel):
    type: Literal["image", "audio", "file"]
    url: str
    name: Optional[str] = None
    mime: Optional[str] = None


class ChatSendRequest(BaseModel):
    agent_type: str  # xuexue / chuangchuang / tantan / banban
    message: str
    conversation_id: Optional[UUID] = None  # 为空则新建对话
    child_id: Optional[UUID] = None  # 关联的孩子
    # 结构化附件：图片/音频/文件，统一进消息管道
    # 图片附件会先由 vision model 识别成文字摘要，再注入当前智能体上下文。
    attachments: Optional[List[Attachment]] = None


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
