"""
Resource Router - 资料库接口
GET  /resources              资料列表
POST /admin/resources        创建（管理员）
PUT  /admin/resources/{id}   更新（管理员）
DELETE /admin/resources/{id} 删除（管理员）
"""
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_admin
from app.models.models import User
from app.models.resource import Resource
from app.schemas.resource import ResourceResponse, ResourceCreate, ResourceUpdate

router = APIRouter(tags=["resources"])


@router.get("/resources", response_model=List[ResourceResponse])
def list_resources(
    category: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """获取资料列表（置顶优先）"""
    query = db.query(Resource)

    if category:
        query = query.filter(Resource.category == category)
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)

    resources = query.order_by(
        Resource.is_pinned.desc(),
        Resource.sort_order,
        Resource.created_at.desc(),
    ).all()
    return resources


# --- 管理员接口 ---

@router.post("/admin/resources", response_model=ResourceResponse)
def create_resource(
    data: ResourceCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建资料（管理员）"""
    resource = Resource(**data.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.put("/admin/resources/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: UUID,
    data: ResourceUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新资料（管理员）"""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资料不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(resource, key, value)

    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/admin/resources/{resource_id}")
def delete_resource(
    resource_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除资料（管理员）"""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资料不存在")

    db.delete(resource)
    db.commit()
    return {"detail": "资料已删除"}
