from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# 家庭
class FamilyCreate(BaseModel):
    family_name: str
    city: Optional[str] = None


class FamilyUpdate(BaseModel):
    family_name: Optional[str] = None
    city: Optional[str] = None


class FamilyResponse(BaseModel):
    id: UUID
    family_name: str
    city: Optional[str] = None
    membership_level: str
    monthly_quota: int
    created_at: datetime

    class Config:
        from_attributes = True


# 孩子档案
class ChildCreate(BaseModel):
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    interests: Optional[str] = None
    learning_challenges: Optional[str] = None
    parent_expectations: Optional[str] = None


class ChildUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    grade: Optional[str] = None
    interests: Optional[str] = None
    learning_challenges: Optional[str] = None
    parent_expectations: Optional[str] = None


class ChildResponse(BaseModel):
    id: UUID
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    interests: Optional[str] = None
    learning_challenges: Optional[str] = None
    parent_expectations: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# 完整家庭信息（含孩子列表）
class FamilyDetailResponse(BaseModel):
    id: UUID
    family_name: str
    city: Optional[str] = None
    membership_level: str
    monthly_quota: int
    children: List[ChildResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
