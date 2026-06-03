"""
错题本相关的 Pydantic schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class WrongQuestionCreate(BaseModel):
    """创建错题记录"""
    child_id: Optional[UUID] = None
    conversation_id: Optional[UUID] = None
    message_id: Optional[UUID] = None
    subject: Optional[str] = None
    grade: Optional[str] = None
    question_text: Optional[str] = None
    image_url: Optional[str] = None
    knowledge_points: Optional[List[str]] = None
    mistake_reason: Optional[str] = None
    ai_explanation: Optional[str] = None
    similar_questions: Optional[str] = None


class WrongQuestionUpdate(BaseModel):
    """更新错题记录"""
    subject: Optional[str] = None
    grade: Optional[str] = None
    knowledge_points: Optional[List[str]] = None
    mistake_reason: Optional[str] = None
    status: Optional[str] = None  # new / reviewing / mastered


class WrongQuestionItem(BaseModel):
    """错题列表项"""
    id: UUID
    child_id: Optional[UUID]
    subject: Optional[str]
    grade: Optional[str]
    question_text: Optional[str]
    image_url: Optional[str]
    knowledge_points: Optional[List[str]]
    mistake_reason: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class WrongQuestionDetail(BaseModel):
    """错题详情"""
    id: UUID
    family_id: UUID
    child_id: Optional[UUID]
    conversation_id: Optional[UUID]
    message_id: Optional[UUID]
    subject: Optional[str]
    grade: Optional[str]
    question_text: Optional[str]
    image_url: Optional[str]
    knowledge_points: Optional[List[str]]
    mistake_reason: Optional[str]
    ai_explanation: Optional[str]
    similar_questions: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WeaknessSummary(BaseModel):
    """薄弱点总结"""
    total_count: int
    subject_distribution: dict  # {"数学": 10, "英语": 5}
    top_weak_points: List[dict]  # [{"knowledge_point": "二次函数", "count": 5, "recent_mistakes": [...]}]
    suggestions: str  # AI 生成的改进建议
