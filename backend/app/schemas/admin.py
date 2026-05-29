from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class AdminStats(BaseModel):
    total_families: int
    total_conversations: int
    today_conversations: int
    risk_flags_unhandled: int


class AdminFamilyItem(BaseModel):
    id: UUID
    family_name: str
    city: Optional[str]
    owner_phone: str
    children_count: int
    conversations_count: int
    created_at: datetime
    subscription_plan: Optional[str] = None
    subscription_expires_at: Optional[datetime] = None


class AdminConversationItem(BaseModel):
    id: UUID
    family_name: str
    agent_type: str
    title: Optional[str]
    messages_count: int
    has_risk: bool
    created_at: datetime
    updated_at: datetime


class AdminRiskItem(BaseModel):
    id: UUID
    family_name: str
    risk_type: str
    risk_level: str
    content_snapshot: str
    handled: bool
    handler_notes: Optional[str]
    created_at: datetime


class RiskHandleRequest(BaseModel):
    handled: bool = True
    handler_notes: str = ""
