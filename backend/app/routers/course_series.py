"""
Course Series Router - 课程系列/单元/课节三级结构
管理员：创建系列、添加单元、管理课节归属
用户：按系列浏览课程
"""
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import User

router = APIRouter(prefix="/course-series", tags=["课程系列"])


# ============ Schemas ============

class SeriesCreate(BaseModel):
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    sort_order: int = 0
    is_published: bool = False

class ModuleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    sort_order: int = 0

class LessonAssign(BaseModel):
    course_id: UUID
    lesson_order: int = 0


# ============ 用户端 ============

@router.get("")
def list_series(db: Session = Depends(get_db)):
    """获取所有已发布的课程系列（含单元和课节数）"""
    sql = text("""
        SELECT cs.id, cs.title, cs.description, cs.cover_url, cs.sort_order,
               (SELECT COUNT(*) FROM course_modules cm WHERE cm.series_id = cs.id) as module_count,
               (SELECT COUNT(*) FROM courses c WHERE c.series_id = cs.id) as lesson_count
        FROM course_series cs
        WHERE cs.is_published = true
        ORDER BY cs.sort_order, cs.created_at DESC
    """)
    rows = db.execute(sql).fetchall()
    return [
        {
            "id": row[0], "title": row[1], "description": row[2],
            "cover_url": row[3], "sort_order": row[4],
            "module_count": row[5], "lesson_count": row[6],
        }
        for row in rows
    ]


@router.get("/{series_id}")
def get_series_detail(series_id: UUID, db: Session = Depends(get_db)):
    """获取系列详情（含所有单元和课节）"""
    # 系列信息
    sql = text("SELECT id, title, description, cover_url FROM course_series WHERE id = :sid")
    series = db.execute(sql, {"sid": str(series_id)}).fetchone()
    if not series:
        raise HTTPException(status_code=404, detail="系列不存在")

    # 单元列表
    sql = text("""
        SELECT id, title, description, sort_order
        FROM course_modules WHERE series_id = :sid
        ORDER BY sort_order
    """)
    modules = db.execute(sql, {"sid": str(series_id)}).fetchall()

    # 每个单元下的课节
    result_modules = []
    for m in modules:
        sql = text("""
            SELECT id, title, content_type, external_url, is_free, lesson_order, duration_minutes
            FROM courses WHERE module_id = :mid AND is_published = true
            ORDER BY lesson_order
        """)
        lessons = db.execute(sql, {"mid": str(m[0])}).fetchall()
        result_modules.append({
            "id": m[0], "title": m[1], "description": m[2], "sort_order": m[3],
            "lessons": [
                {"id": l[0], "title": l[1], "content_type": l[2], "external_url": l[3],
                 "is_free": l[4], "lesson_order": l[5], "duration_minutes": l[6]}
                for l in lessons
            ],
        })

    # 不属于任何单元的课节（独立课节）
    sql = text("""
        SELECT id, title, content_type, external_url, is_free, lesson_order, duration_minutes
        FROM courses WHERE series_id = :sid AND module_id IS NULL AND is_published = true
        ORDER BY lesson_order
    """)
    standalone = db.execute(sql, {"sid": str(series_id)}).fetchall()

    return {
        "id": series[0], "title": series[1], "description": series[2], "cover_url": series[3],
        "modules": result_modules,
        "standalone_lessons": [
            {"id": l[0], "title": l[1], "content_type": l[2], "external_url": l[3],
             "is_free": l[4], "lesson_order": l[5], "duration_minutes": l[6]}
            for l in standalone
        ],
    }


# ============ 管理员 ============

@router.get("/admin/all")
def admin_list_all_series(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员获取所有系列（含未发布）"""
    sql = text("""
        SELECT cs.id, cs.title, cs.description, cs.cover_url, cs.is_published, cs.sort_order,
               (SELECT COUNT(*) FROM course_modules cm WHERE cm.series_id = cs.id) as module_count,
               (SELECT COUNT(*) FROM courses c WHERE c.series_id = cs.id) as lesson_count
        FROM course_series cs
        ORDER BY cs.sort_order, cs.created_at DESC
    """)
    rows = db.execute(sql).fetchall()
    return [
        {
            "id": row[0], "title": row[1], "description": row[2], "cover_url": row[3],
            "is_published": row[4], "sort_order": row[5],
            "module_count": row[6], "lesson_count": row[7],
        }
        for row in rows
    ]


@router.post("/admin/series")
def create_series(
    data: SeriesCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建课程系列"""
    sql = text("""
        INSERT INTO course_series (title, description, cover_url, sort_order, is_published)
        VALUES (:title, :desc, :cover, :sort, :pub)
        RETURNING id
    """)
    result = db.execute(sql, {
        "title": data.title, "desc": data.description,
        "cover": data.cover_url, "sort": data.sort_order, "pub": data.is_published,
    })
    db.commit()
    row = result.fetchone()
    return {"status": "ok", "id": row[0]}


@router.put("/admin/series/{series_id}")
def update_series(
    series_id: UUID,
    data: SeriesCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新课程系列"""
    sql = text("""
        UPDATE course_series SET title=:title, description=:desc, cover_url=:cover,
        sort_order=:sort, is_published=:pub, updated_at=NOW()
        WHERE id = :sid
    """)
    db.execute(sql, {
        "title": data.title, "desc": data.description, "cover": data.cover_url,
        "sort": data.sort_order, "pub": data.is_published, "sid": str(series_id),
    })
    db.commit()
    return {"status": "ok"}


@router.post("/admin/series/{series_id}/modules")
def create_module(
    series_id: UUID,
    data: ModuleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """在系列下创建单元"""
    sql = text("""
        INSERT INTO course_modules (series_id, title, description, sort_order)
        VALUES (:sid, :title, :desc, :sort)
        RETURNING id
    """)
    result = db.execute(sql, {
        "sid": str(series_id), "title": data.title,
        "desc": data.description, "sort": data.sort_order,
    })
    db.commit()
    row = result.fetchone()
    return {"status": "ok", "id": row[0]}


@router.put("/admin/modules/{module_id}")
def update_module(
    module_id: UUID,
    data: ModuleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新单元"""
    sql = text("""
        UPDATE course_modules SET title=:title, description=:desc, sort_order=:sort
        WHERE id = :mid
    """)
    db.execute(sql, {"title": data.title, "desc": data.description, "sort": data.sort_order, "mid": str(module_id)})
    db.commit()
    return {"status": "ok"}


@router.put("/admin/lessons/{course_id}/assign")
def assign_lesson(
    course_id: UUID,
    series_id: Optional[UUID] = None,
    module_id: Optional[UUID] = None,
    lesson_order: int = 0,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """将课节分配到系列/单元"""
    sql = text("""
        UPDATE courses SET series_id=:sid, module_id=:mid, lesson_order=:order
        WHERE id = :cid
    """)
    db.execute(sql, {
        "sid": str(series_id) if series_id else None,
        "mid": str(module_id) if module_id else None,
        "order": lesson_order, "cid": str(course_id),
    })
    db.commit()
    return {"status": "ok"}
