"""
Consultation Router - 咨询记录管理
管理员：上传逐字稿、录入总结、制定方案、完成咨询
用户：查看自己的咨询记录和方案
"""
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import (
    User, Family, ChildProfile, Booking, Consultant,
    ConsultationRecord, GrowthTag,
)

router = APIRouter(prefix="/consultation", tags=["咨询记录"])


# ============ Schemas ============

class RecordCreate(BaseModel):
    booking_id: UUID
    child_id: Optional[UUID] = None

class TranscriptUpload(BaseModel):
    transcript: str

class SummaryUpdate(BaseModel):
    summary: str
    key_findings: Optional[List[str]] = None

class PlanUpdate(BaseModel):
    plan_json: dict  # {goals: [], milestones: [], recommendations: []}

class RecordResponse(BaseModel):
    id: UUID
    booking_id: UUID
    family_id: UUID
    child_id: Optional[UUID]
    consultant_name: str
    booking_date: str
    topic: Optional[str]
    transcript: Optional[str]
    summary: Optional[str]
    key_findings: Optional[list]
    plan_json: Optional[dict]
    status: str
    created_at: datetime


# ============ 管理员接口 ============

@router.post("/admin/records")
def create_record(
    data: RecordCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建咨询记录（咨询完成后）"""
    booking = db.query(Booking).filter(Booking.id == data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    # 检查是否已有记录
    existing = db.query(ConsultationRecord).filter(
        ConsultationRecord.booking_id == data.booking_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该预约已有咨询记录")

    record = ConsultationRecord(
        booking_id=booking.id,
        family_id=booking.family_id,
        child_id=data.child_id,
        consultant_id=booking.consultant_id,
    )
    db.add(record)

    # 更新预约状态为已完成
    booking.status = "completed"
    db.commit()
    db.refresh(record)

    return {"status": "ok", "id": record.id}


@router.put("/admin/records/{record_id}/transcript")
def upload_transcript(
    record_id: UUID,
    data: TranscriptUpload,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """上传逐字稿"""
    record = db.query(ConsultationRecord).filter(ConsultationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    record.transcript = data.transcript
    db.commit()
    return {"status": "ok"}


@router.put("/admin/records/{record_id}/summary")
def update_summary(
    record_id: UUID,
    data: SummaryUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """录入咨询总结"""
    record = db.query(ConsultationRecord).filter(ConsultationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    record.summary = data.summary
    if data.key_findings:
        record.key_findings = data.key_findings
    db.commit()
    return {"status": "ok"}


@router.put("/admin/records/{record_id}/plan")
def update_plan(
    record_id: UUID,
    data: PlanUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """制定规划方案"""
    record = db.query(ConsultationRecord).filter(ConsultationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    record.plan_json = data.plan_json
    db.commit()
    return {"status": "ok"}


@router.put("/admin/records/{record_id}/complete")
async def complete_record(
    record_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """完成咨询记录（触发数据回流：标签+逐字稿入知识库）"""
    record = db.query(ConsultationRecord).filter(ConsultationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    record.status = "completed"

    # 数据回流1：从 key_findings 提取标签更新学生画像
    if record.child_id and record.key_findings:
        for finding in record.key_findings[:10]:
            tag = GrowthTag(
                child_id=record.child_id,
                tag_name=finding[:50],
                tag_category="consultant_insight",
                confidence=0.9,
                source="consultant",
            )
            db.add(tag)

    # 数据回流2：逐字稿脱敏后切片入知识库
    if record.transcript and record.summary:
        try:
            from app.services.knowledge_ingestion import ingest_content
            # 用总结作为入库内容（已脱敏），不用原始逐字稿
            content = f"咨询总结：{record.summary}"
            if record.key_findings:
                content += f"\n关键发现：{'、'.join(record.key_findings)}"
            await ingest_content(
                db=db,
                content_id=f"consultation-{record.id}",
                title=f"咨询记录-{record.id}",
                content_text=content,
                category_name="parenting",
                tags=["咨询记录", "专家建议"],
                source_type="consultation",
            )
        except Exception:
            pass  # 入库失败不阻塞完成操作

    db.commit()
    return {"status": "ok"}


@router.get("/admin/records")
def admin_list_records(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员查看所有咨询记录"""
    records = db.query(ConsultationRecord).order_by(
        ConsultationRecord.created_at.desc()
    ).limit(100).all()

    result = []
    for r in records:
        booking = db.query(Booking).filter(Booking.id == r.booking_id).first()
        consultant = db.query(Consultant).filter(Consultant.id == r.consultant_id).first()
        family = db.query(Family).filter(Family.id == r.family_id).first()
        child = db.query(ChildProfile).filter(ChildProfile.id == r.child_id).first() if r.child_id else None

        result.append({
            "id": r.id,
            "booking_id": r.booking_id,
            "family_name": family.family_name if family else "",
            "child_name": child.name if child else "未指定",
            "consultant_name": consultant.name if consultant else "",
            "booking_date": booking.booking_date if booking else "",
            "topic": booking.topic if booking else "",
            "has_transcript": bool(r.transcript),
            "has_summary": bool(r.summary),
            "has_plan": bool(r.plan_json),
            "status": r.status,
            "created_at": r.created_at,
        })
    return result


# ============ 用户端接口 ============

@router.get("/records")
def my_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取我的咨询记录"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return []

    records = db.query(ConsultationRecord).filter(
        ConsultationRecord.family_id == family.id,
        ConsultationRecord.status == "completed",
    ).order_by(ConsultationRecord.created_at.desc()).all()

    result = []
    for r in records:
        booking = db.query(Booking).filter(Booking.id == r.booking_id).first()
        consultant = db.query(Consultant).filter(Consultant.id == r.consultant_id).first()

        result.append({
            "id": r.id,
            "consultant_name": consultant.name if consultant else "",
            "booking_date": booking.booking_date if booking else "",
            "topic": booking.topic if booking else "",
            "summary": r.summary,
            "key_findings": r.key_findings,
            "plan_json": r.plan_json,
            "created_at": r.created_at,
        })
    return result


@router.get("/records/{record_id}")
def get_record_detail(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取咨询记录详情"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    record = db.query(ConsultationRecord).filter(
        ConsultationRecord.id == record_id,
        ConsultationRecord.family_id == family.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    booking = db.query(Booking).filter(Booking.id == record.booking_id).first()
    consultant = db.query(Consultant).filter(Consultant.id == record.consultant_id).first()

    return {
        "id": record.id,
        "consultant_name": consultant.name if consultant else "",
        "booking_date": booking.booking_date if booking else "",
        "topic": booking.topic if booking else "",
        "summary": record.summary,
        "key_findings": record.key_findings,
        "plan_json": record.plan_json,
        "status": record.status,
        "created_at": record.created_at,
    }
