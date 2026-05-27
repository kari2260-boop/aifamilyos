"""
订阅管理路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date

from app.database import get_db
from app.models.models import User, Family, Subscription, UsageLog
from app.utils.auth import get_current_user

router = APIRouter(prefix="/subscription", tags=["订阅"])

PLANS = {
    "free": {"name": "免费版", "quota": 30, "price": 0, "features": ["每月30次对话", "4位AI导师", "基础成长报告"]},
    "basic": {"name": "基础版", "quota": 200, "price": 4900, "features": ["每月200次对话", "4位AI导师", "月度成长报告", "成长画像分析", "专家咨询1次/月"]},
    "premium": {"name": "高级版", "quota": 999, "price": 9900, "features": ["无限对话", "4位AI导师", "周度成长报告", "深度画像分析", "专家咨询4次/月", "优先客服"]},
}


@router.get("/plans")
def get_plans():
    """获取套餐列表"""
    return [
        {"plan_id": k, **v}
        for k, v in PLANS.items()
    ]


@router.get("/current")
def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前订阅状态和用量"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return {"plan": "free", "quota": 30, "used": 0, "remaining": 30}

    # 当月已用次数
    current_month = date.today().strftime("%Y-%m")
    used = db.query(func.count(UsageLog.id)).filter(
        UsageLog.family_id == family.id,
        UsageLog.action_type == "chat",
        func.to_char(UsageLog.created_at, "YYYY-MM") == current_month,
    ).scalar() or 0

    quota = family.monthly_quota
    plan = family.membership_level

    return {
        "plan": plan,
        "plan_name": PLANS.get(plan, {}).get("name", plan),
        "quota": quota,
        "used": used,
        "remaining": max(0, quota - used),
    }


@router.post("/upgrade")
def upgrade_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """升级套餐（MVP阶段：直接升级，后续接入支付）"""
    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="无效的套餐")

    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="请先创建家庭档案")

    plan_info = PLANS[plan_id]
    family.membership_level = plan_id
    family.monthly_quota = plan_info["quota"]
    db.commit()

    return {"status": "ok", "plan": plan_id, "quota": plan_info["quota"]}
