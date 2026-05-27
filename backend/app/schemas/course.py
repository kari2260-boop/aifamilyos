"""
Course Schemas - 课程相关 Pydantic 模型
"""
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


# --- Category ---

class CourseCategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    sort_order: int = 0

    model_config = {"from_attributes": True}


class CourseCategoryCreate(BaseModel):
    name: str
    slug: str
    sort_order: int = 0


# --- Course ---

class CourseResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    category_id: Optional[UUID] = None
    content_type: str = "article"
    external_url: Optional[str] = None
    tags: List[str] = []
    is_published: bool = False
    is_free: bool = False
    recommended_by: Optional[str] = None
    sort_order: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CourseDetailResponse(CourseResponse):
    content_markdown: Optional[str] = None
    feishu_doc_id: Optional[str] = None


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    category_id: Optional[UUID] = None
    content_type: str = "article"
    external_url: Optional[str] = None
    content_markdown: Optional[str] = None
    tags: List[str] = []
    feishu_doc_id: Optional[str] = None
    is_published: bool = False
    is_free: bool = False
    recommended_by: Optional[str] = None
    sort_order: int = 0


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    category_id: Optional[UUID] = None
    content_type: Optional[str] = None
    external_url: Optional[str] = None
    content_markdown: Optional[str] = None
    tags: Optional[List[str]] = None
    feishu_doc_id: Optional[str] = None
    is_published: Optional[bool] = None
    is_free: Optional[bool] = None
    recommended_by: Optional[str] = None
    sort_order: Optional[int] = None


# --- Learning Path ---

class LearningPathNodeResponse(BaseModel):
    id: UUID
    course_id: UUID
    node_order: int
    is_milestone: bool = False
    course_title: Optional[str] = None
    progress_status: Optional[str] = None

    model_config = {"from_attributes": True}


class LearningPathResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    sort_order: int = 0
    nodes: List[LearningPathNodeResponse] = []

    model_config = {"from_attributes": True}


# --- Progress ---

class CourseProgressUpdate(BaseModel):
    status: str  # not_started / in_progress / completed
    progress_percent: int = 0


class CourseProgressResponse(BaseModel):
    id: UUID
    user_id: UUID
    course_id: UUID
    status: str
    progress_percent: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
