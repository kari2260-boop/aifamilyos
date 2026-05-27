"""
Booking Router - 咨询预约接口
- 用户端：查看专家、查看可用时段、创建预约、取消预约
- 管理端：管理专家、管理预约
"""
from uuid import UUID
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import User, Family, Consultant, ConsultantSchedule, Booking
from app.schemas.booking import (
    ConsultantResponse, ConsultantCreate, ConsultantUpdate,
    ScheduleResponse, ScheduleCreate,
    BookingCreate, BookingResponse, BookingStatusUpdate,
)

router = APIRouter(prefix="/booking", tags=["咨询预约"])


# ========== 用户端接口 ==========

@router.get("/consultants", response_model=List[ConsultantResponse])
def list_consultants(db: Session = Depends(get_db)):
    """获取所有活跃专家列表"""
    return db.query(Consultant).filter(Consultant.is_active == True).all()


@router.get("/consultants/{consultant_id}", response_model=ConsultantResponse)
def get_consultant(consultant_id: UUID, db: Session = Depends(get_db)):
    """获取专家详情"""
    consultant = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not consultant:
        raise HTTPException(status_code=404, detail="专家不存在")
    return consultant


@router.get("/consultants/{consultant_id}/schedules", response_model=List[ScheduleResponse])
def get_consultant_schedules(consultant_id: UUID, db: Session = Depends(get_db)):
    """获取专家的可用时段配置"""
    return db.query(ConsultantSchedule).filter(
        ConsultantSchedule.consultant_id == consultant_id,
        ConsultantSchedule.is_active == True,
    ).all()
# PLACEHOLDER_PART2


@router.get("/consultants/{consultant_id}/available-slots")
def get_available_slots(consultant_id: UUID, date: str, db: Session = Depends(get_db)):
    """获取某天的可用时段（排除已被预约的）"""
    from datetime import datetime as dt
    # 解析日期获取星期几
    try:
        d = dt.strptime(date, "%Y-%m-%d")
        weekday = d.weekday()  # 0=周一
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")

    # 获取该专家该星期几的时段配置
    schedule = db.query(ConsultantSchedule).filter(
        ConsultantSchedule.consultant_id == consultant_id,
        ConsultantSchedule.weekday == weekday,
        ConsultantSchedule.is_active == True,
    ).first()

    if not schedule:
        return {"date": date, "slots": []}

    all_slots = schedule.time_slots or []

    # 查询该天已被预约的时段
    booked = db.query(Booking.time_slot).filter(
        Booking.consultant_id == consultant_id,
        Booking.booking_date == date,
        Booking.status.in_(["pending", "confirmed"]),
    ).all()
    booked_slots = {b.time_slot for b in booked}

    available = [s for s in all_slots if s not in booked_slots]
    return {"date": date, "slots": available}


@router.post("/bookings", response_model=BookingResponse)
def create_booking(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建预约"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=400, detail="请先创建家庭档案")

    # 检查专家是否存在
    consultant = db.query(Consultant).filter(Consultant.id == data.consultant_id).first()
    if not consultant or not consultant.is_active:
        raise HTTPException(status_code=404, detail="专家不存在或已停用")

    # 检查时段是否已被占用
    existing = db.query(Booking).filter(
        Booking.consultant_id == data.consultant_id,
        Booking.booking_date == data.booking_date,
        Booking.time_slot == data.time_slot,
        Booking.status.in_(["pending", "confirmed"]),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该时段已被预约")

    booking = Booking(
        family_id=family.id,
        consultant_id=data.consultant_id,
        booking_date=data.booking_date,
        time_slot=data.time_slot,
        duration=consultant.session_duration,
        topic=data.topic,
        notes=data.notes,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return BookingResponse(
        id=booking.id,
        family_id=booking.family_id,
        consultant_id=booking.consultant_id,
        booking_date=booking.booking_date,
        time_slot=booking.time_slot,
        duration=booking.duration,
        topic=booking.topic,
        notes=booking.notes,
        status=booking.status,
        created_at=booking.created_at,
        consultant_name=consultant.name,
    )


@router.get("/bookings", response_model=List[BookingResponse])
def my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取我的预约列表"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return []

    bookings = db.query(Booking).filter(
        Booking.family_id == family.id
    ).order_by(Booking.created_at.desc()).limit(50).all()

    result = []
    for b in bookings:
        consultant = db.query(Consultant).filter(Consultant.id == b.consultant_id).first()
        result.append(BookingResponse(
            id=b.id,
            family_id=b.family_id,
            consultant_id=b.consultant_id,
            booking_date=b.booking_date,
            time_slot=b.time_slot,
            duration=b.duration,
            topic=b.topic,
            notes=b.notes,
            status=b.status,
            created_at=b.created_at,
            consultant_name=consultant.name if consultant else None,
        ))
    return result


@router.put("/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取消预约"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.family_id == family.id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="预约不存在")
    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail="该预约无法取消")

    booking.status = "cancelled"
    db.commit()
    return {"status": "ok"}


# ========== 管理端接口 ==========

@router.post("/admin/consultants", response_model=ConsultantResponse)
def admin_create_consultant(
    data: ConsultantCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建专家"""
    consultant = Consultant(
        name=data.name,
        title=data.title,
        bio=data.bio,
        specialties=data.specialties,
        avatar_url=data.avatar_url,
        price_per_session=data.price_per_session,
        session_duration=data.session_duration,
    )
    db.add(consultant)
    db.commit()
    db.refresh(consultant)
    return consultant


@router.put("/admin/consultants/{consultant_id}", response_model=ConsultantResponse)
def admin_update_consultant(
    consultant_id: UUID,
    data: ConsultantUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新专家信息"""
    consultant = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not consultant:
        raise HTTPException(status_code=404, detail="专家不存在")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(consultant, field, value)

    db.commit()
    db.refresh(consultant)
    return consultant


@router.post("/admin/consultants/{consultant_id}/schedules", response_model=ScheduleResponse)
def admin_set_schedule(
    consultant_id: UUID,
    data: ScheduleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """设置专家可用时段"""
    consultant = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not consultant:
        raise HTTPException(status_code=404, detail="专家不存在")

    # 覆盖同一天的配置
    existing = db.query(ConsultantSchedule).filter(
        ConsultantSchedule.consultant_id == consultant_id,
        ConsultantSchedule.weekday == data.weekday,
    ).first()

    if existing:
        existing.time_slots = data.time_slots
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    schedule = ConsultantSchedule(
        consultant_id=consultant_id,
        weekday=data.weekday,
        time_slots=data.time_slots,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/admin/bookings", response_model=List[BookingResponse])
def admin_list_bookings(
    status: str = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理端：查看所有预约"""
    query = db.query(Booking)
    if status:
        query = query.filter(Booking.status == status)
    bookings = query.order_by(Booking.created_at.desc()).limit(100).all()

    result = []
    for b in bookings:
        consultant = db.query(Consultant).filter(Consultant.id == b.consultant_id).first()
        result.append(BookingResponse(
            id=b.id,
            family_id=b.family_id,
            consultant_id=b.consultant_id,
            booking_date=b.booking_date,
            time_slot=b.time_slot,
            duration=b.duration,
            topic=b.topic,
            notes=b.notes,
            status=b.status,
            created_at=b.created_at,
            consultant_name=consultant.name if consultant else None,
        ))
    return result


@router.put("/admin/bookings/{booking_id}")
def admin_update_booking(
    booking_id: UUID,
    data: BookingStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理端：更新预约状态（确认/拒绝/完成）"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    booking.status = data.status
    if data.notes:
        booking.notes = data.notes
    db.commit()
    return {"status": "ok"}
