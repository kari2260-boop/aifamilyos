"""
Article Models - 文章相关数据模型
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    summary = Column(Text, nullable=True)
    content_markdown = Column(Text, nullable=True)
    cover_url = Column(String(500), nullable=True)
    author = Column(String(100), nullable=True)
    category = Column(String(50), nullable=True)
    tags = Column(JSONB, default=list)
    feishu_doc_id = Column(String(100), nullable=True)
    is_published = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    is_free = Column(Boolean, default=False)
    recommended_by = Column(String(50), nullable=True)
    view_count = Column(Integer, default=0)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
