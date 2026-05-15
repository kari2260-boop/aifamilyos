import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False, default="parent")  # parent / admin / consultant
    status = Column(String(20), nullable=False, default="active")  # active / disabled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="owner", uselist=False)


class Family(Base):
    __tablename__ = "families"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    family_name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=True)
    membership_level = Column(String(20), default="free")  # free / basic / premium
    monthly_quota = Column(Integer, default=100)  # 每月对话次数上限
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="family")
    children = relationship("ChildProfile", back_populates="family")
    conversations = relationship("Conversation", back_populates="family")


class ChildProfile(Base):
    __tablename__ = "children_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    age = Column(Integer, nullable=True)
    grade = Column(String(20), nullable=True)
    interests = Column(Text, nullable=True)  # 兴趣爱好
    learning_challenges = Column(Text, nullable=True)  # 学习卡点
    parent_expectations = Column(Text, nullable=True)  # 家长期待
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="children")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=True)
    agent_type = Column(String(20), nullable=False)  # xuexue / chuangchuang / tantan / banban
    title = Column(String(200), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user / assistant / system
    content = Column(Text, nullable=False)
    model_name = Column(String(50), nullable=True)
    tokens_input = Column(Integer, nullable=True)
    tokens_output = Column(Integer, nullable=True)
    retrieved_chunks = Column(JSONB, nullable=True)  # RAG检索到的知识片段
    risk_level = Column(String(20), nullable=True)  # none / low / medium / high
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # learning / project / talent / parenting
    source_type = Column(String(20), nullable=True)  # pdf / md / txt
    file_path = Column(String(500), nullable=True)
    raw_text = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending / processing / completed / failed
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship("KnowledgeChunk", back_populates="doc")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_docs.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # learning / project / talent / parenting
    tags = Column(ARRAY(String), nullable=True)
    embedding = Column(Vector(1536), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    doc = relationship("KnowledgeDoc", back_populates="chunks")


class RiskFlag(Base):
    __tablename__ = "risk_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False)
    risk_type = Column(String(50), nullable=False)  # self_harm / violence / bullying / abuse
    risk_level = Column(String(20), nullable=False)  # medium / high / critical
    content_snapshot = Column(Text, nullable=False)
    handled = Column(Boolean, default=False)
    handler_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    handled_at = Column(DateTime, nullable=True)


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action_type = Column(String(50), nullable=False)  # chat / upload / search
    agent_type = Column(String(20), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    cost_estimate = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
