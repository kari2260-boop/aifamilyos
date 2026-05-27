"""
Article Schemas - 文章相关 Pydantic 模型
"""
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class ArticleResponse(BaseModel):
    id: UUID
    title: str
    summary: Optional[str] = None
    cover_url: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    is_featured: bool = False
    is_free: bool = False
    recommended_by: Optional[str] = None
    view_count: int = 0
    published_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleDetailResponse(ArticleResponse):
    content_markdown: Optional[str] = None
    feishu_doc_id: Optional[str] = None
    is_published: bool = False
    updated_at: Optional[datetime] = None


class ArticleCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    content_markdown: Optional[str] = None
    cover_url: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    feishu_doc_id: Optional[str] = None
    is_published: bool = False
    is_featured: bool = False
    is_free: bool = False
    recommended_by: Optional[str] = None
    published_at: Optional[datetime] = None


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content_markdown: Optional[str] = None
    cover_url: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    feishu_doc_id: Optional[str] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_free: Optional[bool] = None
    recommended_by: Optional[str] = None
    published_at: Optional[datetime] = None
