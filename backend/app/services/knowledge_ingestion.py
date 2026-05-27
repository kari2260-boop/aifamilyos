"""
Knowledge Ingestion Service - 自动将课程/文章内容切片并入知识库
当管理员创建或更新课程/文章时，自动调用此服务
"""
import logging
import uuid
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import KnowledgeDoc, KnowledgeChunk
from app.services.text_splitter import split_text
from app.services.embedding_service import get_embeddings

logger = logging.getLogger(__name__)

# 课程分类 → 知识库分类映射
CONTENT_CATEGORY_MAP = {
    "家庭教育": "parenting",
    "亲子沟通": "parenting",
    "情绪管理": "parenting",
    "学习方法": "learning",
    "学习力": "learning",
    "考试技巧": "learning",
    "创造力": "project",
    "项目制学习": "project",
    "编程": "project",
    "天赋发现": "talent",
    "教育规划": "talent",
    "升学规划": "talent",
}


def _guess_category(category_name: Optional[str], tags: Optional[list] = None) -> str:
    """根据分类名和标签推断知识库分类"""
    if category_name:
        for key, value in CONTENT_CATEGORY_MAP.items():
            if key in category_name:
                return value
    if tags:
        for tag in tags:
            for key, value in CONTENT_CATEGORY_MAP.items():
                if key in tag:
                    return value
    return "learning"  # 默认归入学习类


async def ingest_content(
    db: Session,
    content_id: str,
    title: str,
    content_text: str,
    category_name: Optional[str] = None,
    tags: Optional[list] = None,
    source_type: str = "course",
) -> Optional[str]:
    """
    将内容切片并存入知识库
    返回 KnowledgeDoc ID，如果内容为空则返回 None
    """
    if not content_text or not content_text.strip():
        return None

    category = _guess_category(category_name, tags)

    # 检查是否已有该内容的知识文档（避免重复）
    existing_doc = db.query(KnowledgeDoc).filter(
        KnowledgeDoc.file_path == f"{source_type}:{content_id}",
    ).first()

    if existing_doc:
        # 删除旧的 chunks，重新生成
        db.query(KnowledgeChunk).filter(
            KnowledgeChunk.doc_id == existing_doc.id
        ).delete()
        doc = existing_doc
        doc.title = title
        doc.category = category
        doc.status = "processing"
    else:
        doc = KnowledgeDoc(
            title=title,
            category=category,
            source_type=source_type,
            file_path=f"{source_type}:{content_id}",
            raw_text=content_text[:5000],  # 保存前5000字作为预览
            status="processing",
        )
        db.add(doc)
        db.flush()

    # 切片
    chunks_text = split_text(content_text)
    if not chunks_text:
        doc.status = "completed"
        db.commit()
        return str(doc.id)

    # 生成 embeddings
    try:
        embeddings = await get_embeddings(chunks_text)
    except Exception as e:
        logger.error(f"Embedding 生成失败: {e}")
        doc.status = "failed"
        db.commit()
        return str(doc.id)

    # 存入 chunks
    for i, (text, embedding) in enumerate(zip(chunks_text, embeddings)):
        chunk = KnowledgeChunk(
            doc_id=doc.id,
            chunk_index=i,
            content=text,
            category=category,
            tags=tags or [],
            embedding=embedding,
        )
        db.add(chunk)

    doc.status = "completed"
    db.commit()

    logger.info(f"知识库自动导入完成: {title} → {len(chunks_text)} 片段, 分类: {category}")
    return str(doc.id)
