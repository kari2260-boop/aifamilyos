"""
Course Router - 课程模块接口
GET  /courses              课程列表
GET  /courses/{id}         课程详情
GET  /courses/categories   分类列表
GET  /courses/paths        学习路径列表
GET  /courses/paths/{id}   路径详情
POST /courses/{id}/progress 更新学习进度
POST /admin/courses        创建课程（管理员）
PUT  /admin/courses/{id}   更新课程（管理员）
DELETE /admin/courses/{id} 删除课程（管理员）
"""
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import User
from app.models.course import (
    Course, CourseCategory, LearningPath, LearningPathNode, UserCourseProgress
)
from app.schemas.course import (
    CourseResponse, CourseDetailResponse, CourseCreate, CourseUpdate,
    CourseCategoryResponse, CourseCategoryCreate,
    LearningPathResponse, LearningPathNodeResponse,
    CourseProgressUpdate, CourseProgressResponse,
)
from app.services.knowledge_ingestion import ingest_content

router = APIRouter(tags=["courses"])

PLAN_HIERARCHY = {"free": 0, "trial_9_9": 0, "community_3480": 1, "pilot_9800": 2}
MINIMUM_PLAN_HIERARCHY = {"free": 0, "community": 1, "pilot": 2}


def get_user_plan_level(current_user: User, db: Session) -> int:
    from app.models.models import Family
    from app.routers.subscription import get_effective_plan

    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return 0
    return PLAN_HIERARCHY.get(get_effective_plan(family), 0)


def course_is_locked(course: Course, user_level: int) -> bool:
    required_level = MINIMUM_PLAN_HIERARCHY.get(course.minimum_plan or "community", 1)
    return user_level < required_level


def course_response(course: Course, user_level: int, include_content: bool = True) -> dict:
    locked = course_is_locked(course, user_level)
    data = {column.name: getattr(course, column.name) for column in Course.__table__.columns}
    data["locked"] = locked
    if locked and include_content:
        data["content_markdown"] = None
        data["external_url"] = None
    return data


# --- 公开接口 ---

@router.get("/courses/categories", response_model=List[CourseCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """获取课程分类列表"""
    categories = db.query(CourseCategory).order_by(CourseCategory.sort_order).all()
    return categories


@router.get("/courses/paths", response_model=List[LearningPathResponse])
def list_paths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取学习路径列表"""
    paths = db.query(LearningPath).order_by(LearningPath.sort_order).all()
    result = []
    for path in paths:
        nodes = []
        for node in path.nodes:
            progress = db.query(UserCourseProgress).filter(
                UserCourseProgress.user_id == current_user.id,
                UserCourseProgress.course_id == node.course_id,
            ).first()
            nodes.append(LearningPathNodeResponse(
                id=node.id,
                course_id=node.course_id,
                node_order=node.node_order,
                is_milestone=node.is_milestone,
                course_title=node.course.title if node.course else None,
                progress_status=progress.status if progress else "not_started",
            ))
        result.append(LearningPathResponse(
            id=path.id,
            title=path.title,
            description=path.description,
            sort_order=path.sort_order,
            nodes=nodes,
        ))
    return result


@router.get("/courses/paths/{path_id}", response_model=LearningPathResponse)
def get_path(
    path_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取学习路径详情"""
    path = db.query(LearningPath).filter(LearningPath.id == path_id).first()
    if not path:
        raise HTTPException(status_code=404, detail="学习路径不存在")

    nodes = []
    for node in path.nodes:
        progress = db.query(UserCourseProgress).filter(
            UserCourseProgress.user_id == current_user.id,
            UserCourseProgress.course_id == node.course_id,
        ).first()
        nodes.append(LearningPathNodeResponse(
            id=node.id,
            course_id=node.course_id,
            node_order=node.node_order,
            is_milestone=node.is_milestone,
            course_title=node.course.title if node.course else None,
            progress_status=progress.status if progress else "not_started",
        ))

    return LearningPathResponse(
        id=path.id,
        title=path.title,
        description=path.description,
        sort_order=path.sort_order,
        nodes=nodes,
    )


@router.get("/courses", response_model=List[CourseResponse])
def list_courses(
    category: Optional[str] = Query(None, description="分类slug筛选"),
    content_type: Optional[str] = Query(None, description="类型筛选: video/article"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取课程列表（根据用户等级过滤，向上兼容）
    minimum_plan 层级：free(0) ⊆ community(1) ⊆ pilot(2)
    用户只能看到 minimum_plan <= 用户等级 的课程
    """
    user_level = get_user_plan_level(current_user, db)

    # 根据用户等级决定可见的 minimum_plan 集合
    visible_plans = [p for p, lvl in MINIMUM_PLAN_HIERARCHY.items() if lvl <= user_level]

    query = db.query(Course).filter(Course.is_published == True)
    if hasattr(Course, 'minimum_plan'):
        query = query.filter(Course.minimum_plan.in_(visible_plans))

    if category:
        # 多分类支持：检查 category_slugs 数组是否包含该 slug
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
        query = query.filter(Course.category_slugs.contains(cast([category], PG_ARRAY(String))))
    if content_type:
        query = query.filter(Course.content_type == content_type)

    courses = query.order_by(Course.sort_order, Course.created_at.desc()).offset(
        (page - 1) * size
    ).limit(size).all()
    return [course_response(course, user_level, include_content=False) for course in courses]


@router.get("/courses/{course_id}", response_model=CourseDetailResponse)
def get_course(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取课程详情"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    if not course.is_published:
        raise HTTPException(status_code=404, detail="课程未发布")
    return course_response(course, get_user_plan_level(current_user, db))


@router.post("/courses/{course_id}/progress", response_model=CourseProgressResponse)
def update_progress(
    course_id: UUID,
    data: CourseProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新学习进度"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    progress = db.query(UserCourseProgress).filter(
        UserCourseProgress.user_id == current_user.id,
        UserCourseProgress.course_id == course_id,
    ).first()

    now = datetime.utcnow()

    if not progress:
        progress = UserCourseProgress(
            user_id=current_user.id,
            course_id=course_id,
            status=data.status,
            progress_percent=data.progress_percent,
            started_at=now if data.status == "in_progress" else None,
            completed_at=now if data.status == "completed" else None,
        )
        db.add(progress)
    else:
        progress.status = data.status
        progress.progress_percent = data.progress_percent
        if data.status == "in_progress" and not progress.started_at:
            progress.started_at = now
        if data.status == "completed":
            progress.completed_at = now

    db.commit()
    db.refresh(progress)
    return progress


# --- 管理员接口 ---

@router.post("/admin/courses/categories", response_model=CourseCategoryResponse)
def create_category(
    data: CourseCategoryCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建课程分类（管理员）"""
    category = CourseCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.post("/admin/courses", response_model=CourseDetailResponse)
async def create_course(
    data: CourseCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建课程（管理员）- 自动入知识库"""
    course = Course(**data.model_dump())
    # 自动补全链接协议
    if course.external_url and not course.external_url.startswith("http"):
        course.external_url = "https://" + course.external_url
    db.add(course)
    db.commit()
    db.refresh(course)

    # 自动入知识库
    if course.content_markdown and course.is_published:
        cat_name = course.category.name if course.category else None
        await ingest_content(
            db=db,
            content_id=str(course.id),
            title=course.title,
            content_text=course.content_markdown,
            category_name=cat_name,
            tags=course.tags,
            source_type="course",
        )

    return course


@router.put("/admin/courses/{course_id}", response_model=CourseDetailResponse)
async def update_course(
    course_id: UUID,
    data: CourseUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新课程（管理员）- 自动更新知识库"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(course, key, value)

    db.commit()
    db.refresh(course)

    # 自动更新知识库
    if course.content_markdown and course.is_published:
        cat_name = course.category.name if course.category else None
        await ingest_content(
            db=db,
            content_id=str(course.id),
            title=course.title,
            content_text=course.content_markdown,
            category_name=cat_name,
            tags=course.tags,
            source_type="course",
        )

    return course


@router.delete("/admin/courses/{course_id}")
def delete_course(
    course_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除课程（管理员）"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    db.delete(course)
    db.commit()
    return {"detail": "课程已删除"}
