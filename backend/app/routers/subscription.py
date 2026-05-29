"""
订阅管理路由

权限判断规则：
- 统一看 family.subscription_plan
- monthly_quota = NULL 表示不限
- 到期后自动降回 free

GET  /subscription/plans         获取套餐列表
GET  /subscription/current       获取当前订阅状态和用量
POST /subscription/admin/grant   管理员手动开通套餐
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models.models import User, Family, UsageLog
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/subscription", tags=["订阅"])

# ============ 套餐定义 ============
# monthly_quota = None 表示不限

PLANS = {
    "free": {
        "name": "免费体验",
        "price": 0,
        "duration_days": None,
        "monthly_quota": 5,        # 5次/月
        "assessment_quota": 0,
        "report_quota": 0,
        "features": ["每月5次AI对话", "免费文章阅读"],
        "description": "注册即可使用，感受AI家庭教育系统",
        "content_access": ["articles"],
    },
    "trial_9_9": {
        "name": "3天体验包",
        "price": 9.9,
        "duration_days": 3,
        "monthly_quota": 10,       # 10次（3天内）
        "assessment_quota": 1,     # 轻测评1次
        "report_quota": 1,         # 简版报告1次
        "features": [
            "3天有效期",
            "1门体验课程",
            "轻测评1次",
            "AI对话体验额度",
            "简版报告1次",
            "体验群/体验陪跑",
        ],
        "description": "3天体验包：含1门体验课、轻测评、AI体验和简版报告，帮助家庭快速感受系统价值，并决定是否升级。",
        "content_access": ["articles", "trial_courses"],
    },
    "community_3480": {
        "name": "社区年课",
        "price": 3480,
        "duration_days": 365,
        "monthly_quota": 200,      # 200次/月
        "assessment_quota": 99,    # 正式测评不限
        "report_quota": 99,        # 月度报告不限
        "features": [
            "小鹅通正式课程",
            "直播/回放",
            "正式测评",
            "月度成长报告",
            "团体答疑",
        ],
        "description": "主力标准产品，持续使用、标准交付，让家庭形成成长节奏。",
        "content_access": ["articles", "trial_courses", "community_courses", "live", "replay"],
    },
    "pilot_9800": {
        "name": "领航年课",
        "price": 9800,
        "duration_days": 365,
        "monthly_quota": None,     # NULL = 不限
        "assessment_quota": 99,
        "report_quota": 99,
        "features": [
            "全部课程+专属内容",
            "完整测评包",
            "月报+专属方案",
            "Kari/专家1v1咨询",
            "三天两夜亲子营",
            "智能体陪练",
        ],
        "description": "深度交付产品，做案例、做口碑、做复购和转介绍。",
        "content_access": ["articles", "trial_courses", "community_courses", "live", "replay", "exclusive"],
    },
}


def get_effective_plan(family: Family) -> str:
    """获取家庭当前有效套餐，自动处理到期降级"""
    plan = family.subscription_plan or "free"
    if plan == "free":
        return "free"
    # 检查是否到期
    if family.subscription_expires_at and datetime.utcnow() > family.subscription_expires_at:
        return "free"
    return plan


def apply_plan(family: Family, plan_id: str):
    """将套餐权益写入 family 对象（调用方负责 commit）"""
    plan = PLANS[plan_id]
    family.subscription_plan = plan_id
    family.membership_level = plan_id   # 兼容旧字段同步更新
    family.subscription_started_at = datetime.utcnow()
    family.monthly_quota = plan["monthly_quota"]  # None = 不限
    family.assessment_quota = plan["assessment_quota"]
    family.report_quota = plan["report_quota"]
    if plan["duration_days"]:
        family.subscription_expires_at = datetime.utcnow() + timedelta(days=plan["duration_days"])
    else:
        family.subscription_expires_at = None


def downgrade_to_free(family: Family):
    """到期降回 free（调用方负责 commit）"""
    family.subscription_plan = "free"
    family.membership_level = "free"
    family.monthly_quota = PLANS["free"]["monthly_quota"]
    family.assessment_quota = 0
    family.report_quota = 0


# ============ 接口 ============

@router.get("/plans")
def get_plans():
    """获取套餐列表（不含 content_access 内部字段）"""
    return [
        {"plan_id": k, **{kk: vv for kk, vv in v.items() if kk != "content_access"}}
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
        return {
            "plan": "free",
            "plan_name": PLANS["free"]["name"],
            "quota": 5,
            "used": 0,
            "remaining": 5,
            "unlimited": False,
            "expires_at": None,
            "assessment_quota": 0,
            "report_quota": 0,
            "features": PLANS["free"]["features"],
        }

    effective_plan = get_effective_plan(family)

    # 到期自动降级
    if effective_plan == "free" and (family.subscription_plan or "free") != "free":
        downgrade_to_free(family)
        db.commit()

    # 当月已用对话次数
    current_month = date.today().strftime("%Y-%m")
    used = db.query(func.count(UsageLog.id)).filter(
        UsageLog.family_id == family.id,
        UsageLog.action_type == "chat",
        func.to_char(UsageLog.created_at, "YYYY-MM") == current_month,
    ).scalar() or 0

    quota = family.monthly_quota  # None = 不限
    unlimited = quota is None
    plan_info = PLANS.get(effective_plan, PLANS["free"])

    return {
        "plan": effective_plan,
        "plan_name": plan_info["name"],
        "quota": quota,
        "used": used,
        "remaining": None if unlimited else max(0, quota - used),
        "unlimited": unlimited,
        "expires_at": family.subscription_expires_at.isoformat() if family.subscription_expires_at else None,
        "started_at": family.subscription_started_at.isoformat() if family.subscription_started_at else None,
        "assessment_quota": family.assessment_quota or 0,
        "report_quota": family.report_quota or 0,
        "features": plan_info["features"],
        "description": plan_info["description"],
    }


class AdminGrantRequest(BaseModel):
    family_id: UUID
    plan_id: str
    note: Optional[str] = None


@router.post("/admin/grant")
def admin_grant_plan(
    req: AdminGrantRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员手动为家庭开通套餐"""
    if req.plan_id not in PLANS:
        raise HTTPException(
            status_code=400,
            detail=f"无效的套餐: {req.plan_id}，可选: {list(PLANS.keys())}"
        )

    family = db.query(Family).filter(Family.id == req.family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    apply_plan(family, req.plan_id)
    db.commit()

    plan_info = PLANS[req.plan_id]
    return {
        "status": "ok",
        "family_id": str(family.id),
        "family_name": family.family_name,
        "plan": req.plan_id,
        "plan_name": plan_info["name"],
        "monthly_quota": family.monthly_quota,
        "unlimited": family.monthly_quota is None,
        "started_at": family.subscription_started_at.isoformat(),
        "expires_at": family.subscription_expires_at.isoformat() if family.subscription_expires_at else None,
        "note": req.note,
    }


class AdminRenewRequest(BaseModel):
    family_id: UUID
    note: Optional[str] = None


@router.post("/admin/renew")
def admin_renew_plan(
    req: AdminRenewRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员续费：同一套餐按时间延长，不改 subscription_plan"""
    family = db.query(Family).filter(Family.id == req.family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    plan_id = family.subscription_plan
    if not plan_id or plan_id == "free":
        raise HTTPException(status_code=400, detail="该家庭没有付费套餐，请先开通")

    plan_info = PLANS.get(plan_id)
    if not plan_info:
        raise HTTPException(status_code=400, detail=f"套餐 {plan_id} 不存在")

    duration = plan_info.get("duration_days")
    if not duration:
        raise HTTPException(status_code=400, detail="该套餐无有效期，无需续费")

    now = datetime.utcnow()

    # 未过期：在原到期时间基础上延长；已过期：从当前时间重新计算
    if family.subscription_expires_at and family.subscription_expires_at > now:
        family.subscription_expires_at = family.subscription_expires_at + timedelta(days=duration)
    else:
        family.subscription_expires_at = now + timedelta(days=duration)

    # 重新写入配额（subscription_started_at 保留首次开通时间，不覆盖）
    family.monthly_quota = plan_info["monthly_quota"]
    family.assessment_quota = plan_info["assessment_quota"]
    family.report_quota = plan_info["report_quota"]

    db.commit()

    return {
        "status": "ok",
        "family_id": str(family.id),
        "family_name": family.family_name,
        "plan": plan_id,
        "plan_name": plan_info["name"],
        "started_at": family.subscription_started_at.isoformat() if family.subscription_started_at else None,
        "new_expires_at": family.subscription_expires_at.isoformat(),
        "note": req.note,
    }
