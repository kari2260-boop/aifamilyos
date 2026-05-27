"""
Resource Models - 资料库数据模型
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime
)
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String(1000), nullable=False)
    resource_type = Column(String(30), nullable=False, default="other")  # feishu_doc / tencent_doc / questionnaire / video / other
    category = Column(String(50), nullable=True)
    is_pinned = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
