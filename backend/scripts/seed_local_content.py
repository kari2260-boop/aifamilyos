"""Seed local content into the server database.

This script restores public-facing content from the repository's markdown
source directories into courses / articles / resources / learning paths,
without touching local backups.

Usage:
  python -m scripts.seed_local_content
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.article import Article
from app.models.course import (
    Course,
    CourseCategory,
    CourseSeries,
    CourseModule,
    LearningPath,
    LearningPathNode,
)
from app.models.resource import Resource
from app.models.models import AgentPrompt, AgentExample
from app.services.agent_prompts import DEFAULT_PROMPTS

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = [
    ROOT / "knowledge_all",
    ROOT / "knowledge_import",
    ROOT / "knowledge_import_batch2",
]

COURSE_GROUPS = [
    ("learning", "学习力", "learning", "学习力课程"),
    ("project", "项目与创造", "project", "项目与创造课程"),
    ("talent", "个人天赋", "talent", "个人天赋课程"),
    ("parenting", "亲子关系", "parenting", "亲子关系课程"),
]

ARTICLE_GROUPS = [
    ("global", "全局知识", "global"),
    ("product", "产品与战略", "product"),
]

RESOURCE_GROUPS = [
    ("parenting", "亲子资料", "parenting"),
    ("project", "项目资料", "project"),
    ("talent", "天赋资料", "talent"),
]

URL_RE = re.compile(r"https?://[^\s)\]>]+")
TITLE_PREFIX_RE = re.compile(r"^\s*\d+[\-_.\s]*")


def clean_title(stem: str) -> str:
    return TITLE_PREFIX_RE.sub("", stem).strip() or stem


def sanitize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return "".join(ch for ch in value if ch.isprintable() or ch in "\n\r\t")


def read_text(path: Path) -> str:
    return sanitize_text(path.read_text(encoding="utf-8", errors="ignore")) or ""


def iter_source_files(category: str) -> list[Path]:
    files: list[Path] = []
    seen = set()
    for root in SOURCE_ROOTS:
        directory = root / category
        if not directory.exists():
            continue
        for path in sorted(directory.iterdir()):
            if path.is_file() and path.suffix.lower() == ".md" and path.name not in seen:
                files.append(path)
                seen.add(path.name)
    return files


def excerpt(text: str, length: int = 180) -> str:
    for block in re.split(r"\n\s*\n", text):
        block = " ".join(block.split())
        if block:
            return block[:length]
    return ""


def first_url(text: str) -> Optional[str]:
    m = URL_RE.search(text)
    if not m:
        return None
    url = m.group(0).rstrip("\"\'.,;")
    second = url.find("https://", 8)
    if second != -1:
        url = url[:second]
    return url[:500]


def is_mac_metadata_blob(text: str) -> bool:
    head = text[:1000]
    return (
        head.startswith("Mac OS X")
        or "com.apple.metadata:kMDItemWhereFroms" in head
        or "com.apple.quarantine" in head
        or "com.apple.provenance" in head
    )


def ensure_course_category(db: Session, slug: str, name: str, sort_order: int) -> CourseCategory:
    category = db.query(CourseCategory).filter(CourseCategory.slug == slug).first()
    if category:
        category.name = sanitize_text(name) or name
        category.sort_order = sort_order
        return category
    category = CourseCategory(name=sanitize_text(name) or name, slug=slug, sort_order=sort_order)
    db.add(category)
    db.flush()
    return category


def ensure_course_series(db: Session, title: str, description: str, sort_order: int) -> CourseSeries:
    series = db.query(CourseSeries).filter(CourseSeries.title == title).first()
    if series:
        series.description = sanitize_text(description) or description
        series.sort_order = sort_order
        series.is_published = True
        return series
    series = CourseSeries(
        title=sanitize_text(title) or title,
        description=sanitize_text(description) or description,
        sort_order=sort_order,
        is_published=True,
    )
    db.add(series)
    db.flush()
    return series


def ensure_course_module(db: Session, series_id, title: str, description: str, sort_order: int) -> CourseModule:
    module = db.query(CourseModule).filter(
        CourseModule.series_id == series_id,
        CourseModule.title == title,
    ).first()
    if module:
        module.description = sanitize_text(description) or description
        module.sort_order = sort_order
        return module
    module = CourseModule(
        series_id=series_id,
        title=sanitize_text(title) or title,
        description=sanitize_text(description) or description,
        sort_order=sort_order,
    )
    db.add(module)
    db.flush()
    return module


def upsert_course(
    db: Session,
    *,
    title: str,
    description: str,
    category_id,
    content_type: str,
    external_url: Optional[str],
    content_markdown: str,
    tags: list[str],
    series_id,
    module_id,
    lesson_order: int,
    sort_order: int,
    is_free: bool = True,
):
    course = db.query(Course).filter(
        Course.title == title,
        Course.category_id == category_id,
    ).first()
    if not course:
        course = Course(title=sanitize_text(title) or title, category_id=category_id)
        db.add(course)
        db.flush()

    course.description = sanitize_text(description) or description
    course.cover_url = course.cover_url or None
    course.content_type = content_type
    course.external_url = sanitize_text(external_url)
    course.content_markdown = sanitize_text(content_markdown) or ""
    course.tags = [sanitize_text(tag) or tag for tag in tags]
    course.series_id = series_id
    course.module_id = module_id
    course.lesson_order = lesson_order
    course.duration_minutes = course.duration_minutes or None
    course.is_published = True
    course.is_free = is_free
    course.sort_order = sort_order
    course.updated_at = datetime.utcnow()
    return course


def upsert_article(
    db: Session,
    *,
    title: str,
    summary: str,
    category: str,
    content_markdown: str,
    tags: list[str],
    is_featured: bool,
    sort_order: int,
):
    article = db.query(Article).filter(
        Article.title == title,
        Article.category == category,
    ).first()
    if not article:
        article = Article(title=sanitize_text(title) or title, category=category)
        db.add(article)
        db.flush()

    article.summary = sanitize_text(summary) or summary
    article.content_markdown = sanitize_text(content_markdown) or ""
    article.tags = [sanitize_text(tag) or tag for tag in tags]
    article.is_published = True
    article.is_featured = is_featured
    article.is_free = True
    article.sort_order = sort_order
    if not article.published_at:
        article.published_at = datetime.utcnow()
    article.updated_at = datetime.utcnow()
    return article


def upsert_resource(
    db: Session,
    *,
    title: str,
    description: str,
    url: str,
    resource_type: str,
    category: str,
    is_pinned: bool,
    sort_order: int,
):
    resource = db.query(Resource).filter(
        Resource.title == title,
        Resource.category == category,
    ).first()
    if not resource:
        resource = Resource(title=sanitize_text(title) or title, url=sanitize_text(url) or url, category=category)
        db.add(resource)
        db.flush()

    resource.description = sanitize_text(description) or description
    resource.url = sanitize_text(url) or url
    resource.resource_type = resource_type
    resource.is_pinned = is_pinned
    resource.sort_order = sort_order
    resource.updated_at = datetime.utcnow()
    return resource


def ensure_learning_path(
    db: Session,
    *,
    title: str,
    description: str,
    category_id,
    sort_order: int,
    course_ids: list,
):
    path = db.query(LearningPath).filter(LearningPath.title == title).first()
    if not path:
        path = LearningPath(title=title, description=description, category_id=category_id, sort_order=sort_order)
        db.add(path)
        db.flush()
    else:
        path.description = description
        path.category_id = category_id
        path.sort_order = sort_order

    db.query(LearningPathNode).filter(LearningPathNode.path_id == path.id).delete()
    for idx, course_id in enumerate(course_ids, start=1):
        db.add(LearningPathNode(path_id=path.id, course_id=course_id, node_order=idx, is_milestone=(idx == 1)))
    return path


def seed_agent_prompts(db: Session):
    existing = {p.agent_type: p for p in db.query(AgentPrompt).all()}
    for agent_type, defaults in DEFAULT_PROMPTS.items():
        prompt = existing.get(agent_type)
        if not prompt:
            prompt = AgentPrompt(
                agent_type=agent_type,
                name=sanitize_text(defaults["name"]) or defaults["name"],
                role=sanitize_text(defaults["role"]) or defaults["role"],
                system_prompt=sanitize_text(defaults["system_prompt"]) or defaults["system_prompt"],
                is_active=True,
            )
            db.add(prompt)
            db.flush()
        else:
            prompt.name = sanitize_text(defaults["name"]) or defaults["name"]
            prompt.role = sanitize_text(defaults["role"]) or defaults["role"]
            prompt.system_prompt = sanitize_text(defaults["system_prompt"]) or defaults["system_prompt"]
            prompt.is_active = True


def main():
    db = SessionLocal()
    try:
        seed_agent_prompts(db)

        # 课程：从本地知识源 markdown 中恢复
        for sort_order, (slug, name, category_dir_name, series_title) in enumerate(COURSE_GROUPS, start=1):
            category = ensure_course_category(db, slug, name, sort_order)
            series = ensure_course_series(db, series_title, f"{name}课程合集", sort_order)
            module = ensure_course_module(db, series.id, "核心内容", f"{name}基础内容", 1)

            files = iter_source_files(category_dir_name)
            course_ids = []
            for idx, path in enumerate(files, start=1):
                content = read_text(path)
                if is_mac_metadata_blob(content):
                    continue
                title = sanitize_text(clean_title(path.stem)) or clean_title(path.stem)
                desc = sanitize_text(excerpt(content)) or excerpt(content)
                url = sanitize_text(first_url(content))
                content_type = "video" if url and any(k in title for k in ("视频", "直播", "回放")) else "article"
                course = upsert_course(
                    db,
                    title=title,
                    description=desc,
                    category_id=category.id,
                    content_type=content_type,
                    external_url=url,
                    content_markdown=content,
                    tags=[slug, "local-source"],
                    series_id=series.id,
                    module_id=module.id,
                    lesson_order=idx,
                    sort_order=idx,
                    is_free=True,
                )
                course_ids.append(course.id)

            ensure_learning_path(
                db,
                title=f"{name}学习路径",
                description=f"{name}内容路线",
                category_id=category.id,
                sort_order=sort_order,
                course_ids=course_ids[:8],
            )
            db.commit()

        # 文章：global + product
        for sort_order, (slug, name, category_dir_name) in enumerate(ARTICLE_GROUPS, start=1):
            files = iter_source_files(category_dir_name)
            for idx, path in enumerate(files, start=1):
                content = read_text(path)
                if is_mac_metadata_blob(content):
                    continue
                title = sanitize_text(clean_title(path.stem)) or clean_title(path.stem)
                summary = sanitize_text(excerpt(content, 220)) or excerpt(content, 220)
                upsert_article(
                    db,
                    title=title,
                    summary=summary,
                    category=slug,
                    content_markdown=content,
                    tags=[slug, "local-source"],
                    is_featured=idx <= 3,
                    sort_order=idx,
                )
            db.commit()

        # 资料：含真实链接的 markdown
        for sort_order, (slug, name, category_dir_name) in enumerate(RESOURCE_GROUPS, start=1):
            files = iter_source_files(category_dir_name)
            pinned_count = 0
            for idx, path in enumerate(files, start=1):
                content = read_text(path)
                if is_mac_metadata_blob(content):
                    continue
                url = sanitize_text(first_url(content))
                if not url:
                    continue
                title = sanitize_text(clean_title(path.stem)) or clean_title(path.stem)
                desc = sanitize_text(excerpt(content, 180)) or excerpt(content, 180)
                resource_type = "other"
                lower = f"{content.lower()} {url.lower()}"
                if any(k in lower for k in ("feishu", "飞书")):
                    resource_type = "feishu_doc"
                elif any(k in lower for k in ("问卷", "questionnaire")):
                    resource_type = "questionnaire"
                elif any(k in lower for k in ("video", "视频", "bilibili", "v.qq", "mp4")):
                    resource_type = "video"
                upsert_resource(
                    db,
                    title=title,
                    description=desc,
                    url=url,
                    resource_type=resource_type,
                    category=slug,
                    is_pinned=(pinned_count < 5),
                    sort_order=idx,
                )
                pinned_count += 1
            db.commit()

        print("seed_local_content: done")
    finally:
        db.close()


if __name__ == "__main__":
    main()
