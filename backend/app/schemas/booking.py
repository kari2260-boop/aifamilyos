from uuid import UUID
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


# --- Consultant ---

class ConsultantResponse(BaseModel):
    id: UUID
    name: str
    title: Optional[str] = None
    bio: Optional[str] = None
    specialties: Optional[str] = None
    avatar_url: Optional[str] = None
    price_per_session: int = 0
    session_duration: int = 40
    is_active: bool = True

    model_config = {"from_attributes": True}


class ConsultantCreate(BaseModel):
    name: str
    title: Optional[str] = None
    bio: Optional[str] = None
    specialties: Optional[str] = None
    avatar_url: Optional[str] = None
    price_per_session: int = 0
    session_duration: int = 40


class ConsultantUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    specialties: Optional[str] = None
    avatar_url: Optional[str] = None
    price_per_session: Optional[int] = None
    session_duration: Optional[int] = None
    is_active: Optional[bool] = None


# --- Schedule ---

class ScheduleResponse(BaseModel):
    id: UUID
    consultant_id: UUID
    weekday: int
    time_slots: List[str]
    is_active: bool = True

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    weekday: int  # 0=周一, 6=周日
    time_slots: List[str]  # ["09:00","10:00","14:00"]


# --- Booking ---

class BookingCreate(BaseModel):
    consultant_id: UUID
    booking_date: str  # "2026-05-20"
    time_slot: str  # "14:00"
    topic: Optional[str] = None
    notes: Optional[str] = None


class BookingResponse(BaseModel):
    id: UUID
    family_id: UUID
    consultant_id: UUID
    booking_date: str
    time_slot: str
    duration: int
    topic: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    consultant_name: Optional[str] = None

    model_config = {"from_attributes": True}


class BookingStatusUpdate(BaseModel):
    status: str  # confirmed / cancelled / completed
    notes: Optional[str] = None
