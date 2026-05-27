"""
Report Router - 月度成长报告接口
POST /reports/generate  生成报告
GET  /reports           报告列表
GET  /reports/{id}      报告详情
"""
from uuid import UUID
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import get_current_user
from app.models.models import User, Family, ChildProfile, GrowthReport
from app.schemas.report import ReportGenerateRequest, ReportResponse, ReportListItem
from app.services.report_service import generate_monthly_report

router = APIRouter(prefix="/reports", tags=["成长报告"])


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    req: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成月度成长报告"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=400, detail="请先创建家庭档案")

    # 确定月份
    month = req.month or datetime.utcnow().strftime("%Y-%m")

    # 确定孩子
    child_id = None
    if req.child_id:
        child = db.query(ChildProfile).filter(
            ChildProfile.id == req.child_id,
            ChildProfile.family_id == family.id,
        ).first()
        if not child:
            raise HTTPException(status_code=404, detail="孩子档案不存在")
        child_id = str(req.child_id)
    else:
        # 默认取第一个孩子
        first_child = db.query(ChildProfile).filter(
            ChildProfile.family_id == family.id
        ).first()
        if first_child:
            child_id = str(first_child.id)

    report = await generate_monthly_report(
        family_id=str(family.id),
        child_id=child_id,
        month=month,
        db=db,
    )
    return report


@router.get("", response_model=List[ReportListItem])
def list_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取报告列表"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return []

    reports = db.query(GrowthReport).filter(
        GrowthReport.family_id == family.id
    ).order_by(GrowthReport.month.desc()).limit(12).all()
    return reports


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取报告详情"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    report = db.query(GrowthReport).filter(
        GrowthReport.id == report_id,
        GrowthReport.family_id == family.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report
