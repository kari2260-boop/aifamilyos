from uuid import UUID
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel


class ReportGenerateRequest(BaseModel):
    child_id: Optional[UUID] = None
    month: Optional[str] = None  # "2026-05"，不填则取当月


class ReportResponse(BaseModel):
    id: UUID
    family_id: UUID
    child_id: Optional[UUID] = None
    month: str
    summary: Optional[str] = None
    content_json: Any
    conversation_count: int = 0
    generated_at: datetime

    model_config = {"from_attributes": True}


class ReportListItem(BaseModel):
    id: UUID
    month: str
    summary: Optional[str] = None
    conversation_count: int = 0
    generated_at: datetime

    model_config = {"from_attributes": True}
