"""
Course Models - 课程相关数据模型
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean,
    DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class CourseCategory(Base):
    __tablename__ = "course_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False)
    slug = Column(String(50), unique=True, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    courses = relationship("Course", back_populates="category")


class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cover_url = Column(String(500), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("course_categories.id"), nullable=True)
    content_type = Column(String(20), nullable=False, default="article")  # video / article
    external_url = Column(String(500), nullable=True)  # 视频课程跳转链接（小鹅通等）
    content_markdown = Column(Text, nullable=True)  # 长文课程内容
    tags = Column(JSONB, default=list)
    feishu_doc_id = Column(String(100), nullable=True)
    is_published = Column(Boolean, default=False)
    is_free = Column(Boolean, default=False)  # 是否免费可见
    recommended_by = Column(String(50), nullable=True)  # "K博士推荐" / "Bing Dad 推荐"
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("CourseCategory", back_populates="courses")
    progress_records = relationship("UserCourseProgress", back_populates="course")


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("course_categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    nodes = relationship("LearningPathNode", back_populates="path", order_by="LearningPathNode.node_order")


class LearningPathNode(Base):
    __tablename__ = "learning_path_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    path_id = Column(UUID(as_uuid=True), ForeignKey("learning_paths.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    node_order = Column(Integer, default=0)
    is_milestone = Column(Boolean, default=False)

    path = relationship("LearningPath", back_populates="nodes")
    course = relationship("Course")


class UserCourseProgress(Base):
    __tablename__ = "user_course_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True)
    status = Column(String(20), default="not_started")  # not_started / in_progress / completed
    progress_percent = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    course = relationship("Course", back_populates="progress_records")
