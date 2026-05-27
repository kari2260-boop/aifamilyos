"""
Article Router - 文章模块接口
GET  /articles           文章列表
GET  /articles/{id}      文章详情
GET  /articles/featured  精选文章
POST /admin/articles     创建（管理员）
PUT  /admin/articles/{id}  更新（管理员）
DELETE /admin/articles/{id} 删除（管理员）
"""
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import User
from app.models.article import Article
from app.schemas.article import (
    ArticleResponse, ArticleDetailResponse,
    ArticleCreate, ArticleUpdate,
)
from app.services.knowledge_ingestion import ingest_content

router = APIRouter(tags=["articles"])


@router.get("/articles/featured", response_model=List[ArticleResponse])
def list_featured_articles(
    size: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """获取精选文章（首页用）"""
    articles = db.query(Article).filter(
        Article.is_published == True,
        Article.is_featured == True,
    ).order_by(Article.published_at.desc()).limit(size).all()
    return articles


@router.get("/articles", response_model=List[ArticleResponse])
def list_articles(
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """获取文章列表（已发布的）"""
    query = db.query(Article).filter(Article.is_published == True)

    if category:
        query = query.filter(Article.category == category)
    if tag:
        query = query.filter(Article.tags.contains([tag]))

    articles = query.order_by(Article.published_at.desc()).offset(
        (page - 1) * size
    ).limit(size).all()
    return articles


@router.get("/articles/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: UUID,
    db: Session = Depends(get_db),
):
    """获取文章详情"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    if not article.is_published:
        raise HTTPException(status_code=404, detail="文章未发布")

    # 增加浏览量
    article.view_count = (article.view_count or 0) + 1
    db.commit()

    return article


# --- 管理员接口 ---

@router.post("/admin/articles", response_model=ArticleDetailResponse)
async def create_article(
    data: ArticleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建文章（管理员）- 自动入知识库"""
    from datetime import datetime
    article = Article(**data.model_dump())
    # 发布时自动设置发布时间
    if article.is_published and not article.published_at:
        article.published_at = datetime.utcnow()
    db.add(article)
    db.commit()
    db.refresh(article)

    # 自动入知识库
    if article.content_markdown and article.is_published:
        await ingest_content(
            db=db,
            content_id=str(article.id),
            title=article.title,
            content_text=article.content_markdown,
            category_name=article.category,
            tags=article.tags or [],
            source_type="article",
        )

    return article


@router.put("/admin/articles/{article_id}", response_model=ArticleDetailResponse)
async def update_article(
    article_id: UUID,
    data: ArticleUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新文章（管理员）- 自动更新知识库"""
    from datetime import datetime
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    # 发布时自动设置发布时间
    if article.is_published and not article.published_at:
        article.published_at = datetime.utcnow()

    db.commit()
    db.refresh(article)

    # 自动更新知识库
    if article.content_markdown and article.is_published:
        await ingest_content(
            db=db,
            content_id=str(article.id),
            title=article.title,
            content_text=article.content_markdown,
            category_name=article.category,
            tags=article.tags or [],
            source_type="article",
        )

    return article


@router.delete("/admin/articles/{article_id}")
def delete_article(
    article_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除文章（管理员）"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    db.delete(article)
    db.commit()
    return {"detail": "文章已删除"}
