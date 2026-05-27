"""
Resource Schemas - 资料库 Pydantic 模型
"""
from uuid import UUID
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ResourceResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    url: str
    resource_type: str
    category: Optional[str] = None
    is_pinned: bool = False
    sort_order: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    url: str
    resource_type: str = "other"
    category: Optional[str] = None
    is_pinned: bool = False
    sort_order: int = 0


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    resource_type: Optional[str] = None
    category: Optional[str] = None
    is_pinned: Optional[bool] = None
    sort_order: Optional[int] = None
