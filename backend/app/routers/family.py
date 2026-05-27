from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Family, ChildProfile
from app.models.models import GrowthTag
from app.schemas.family import (
    FamilyCreate, FamilyUpdate, FamilyResponse, FamilyDetailResponse,
    ChildCreate, ChildUpdate, ChildResponse,
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/families", tags=["家庭档案"])


@router.post("", response_model=FamilyResponse)
def create_family(data: FamilyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # 检查是否已有家庭
    existing = db.query(Family).filter(Family.owner_user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="已创建过家庭档案")

    family = Family(
        owner_user_id=user.id,
        family_name=data.family_name,
        city=data.city,
    )
    db.add(family)
    db.commit()
    db.refresh(family)
    return family


@router.get("/me", response_model=FamilyDetailResponse)
def get_my_family(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.owner_user_id == user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="尚未创建家庭档案")
    return family


@router.put("/{family_id}", response_model=FamilyResponse)
def update_family(family_id: str, data: FamilyUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.id == family_id, Family.owner_user_id == user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在或无权限")

    if data.family_name is not None:
        family.family_name = data.family_name
    if data.city is not None:
        family.city = data.city

    db.commit()
    db.refresh(family)
    return family


# 孩子档案
@router.post("/children", response_model=ChildResponse)
def create_child(data: ChildCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.owner_user_id == user.id).first()
    if not family:
        raise HTTPException(status_code=400, detail="请先创建家庭档案")

    child = ChildProfile(
        family_id=family.id,
        name=data.name,
        age=data.age,
        grade=data.grade,
        interests=data.interests,
        learning_challenges=data.learning_challenges,
        parent_expectations=data.parent_expectations,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.get("/children", response_model=List[ChildResponse])
def get_children(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.owner_user_id == user.id).first()
    if not family:
        return []
    return db.query(ChildProfile).filter(ChildProfile.family_id == family.id).all()


@router.put("/children/{child_id}", response_model=ChildResponse)
def update_child(child_id: str, data: ChildUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.owner_user_id == user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    child = db.query(ChildProfile).filter(
        ChildProfile.id == child_id, ChildProfile.family_id == family.id
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="孩子档案不存在或无权限")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(child, field, value)

    db.commit()
    db.refresh(child)
    return child


@router.get("/children/{child_id}/tags")
def get_child_tags(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取孩子的成长画像标签"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    child = db.query(ChildProfile).filter(
        ChildProfile.id == child_id, ChildProfile.family_id == family.id
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="孩子不存在")

    tags = db.query(GrowthTag).filter(GrowthTag.child_id == child_id).all()
    return [
        {
            "id": str(t.id),
            "tag_name": t.tag_name,
            "tag_category": t.tag_category,
            "confidence": t.confidence,
            "source": t.source,
        }
        for t in tags
    ]


@router.post("/children/{child_id}/tags/refresh")
async def refresh_child_tags(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """重新分析孩子的成长标签"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    child = db.query(ChildProfile).filter(
        ChildProfile.id == child_id, ChildProfile.family_id == family.id
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="孩子不存在")

    from app.services.tag_service import analyze_child_tags
    try:
        tags = await analyze_child_tags(child_id, db)
        return {"tags": tags}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
