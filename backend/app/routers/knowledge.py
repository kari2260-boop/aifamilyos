"""
Knowledge Router - 知识库管理接口
POST /knowledge/upload  上传文档
POST /knowledge/search  向量检索
GET  /knowledge/docs     文档列表
"""
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import User, KnowledgeDoc, KnowledgeChunk
from app.schemas.knowledge import (
    KnowledgeUploadResponse, KnowledgeSearchRequest,
    KnowledgeSearchResponse, ChunkResult, KnowledgeDocItem,
)
from app.services.embedding_service import get_embedding, get_embeddings
from app.services.text_splitter import split_text

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

VALID_CATEGORIES = {"learning", "project", "talent", "parenting"}


@router.post("/upload", response_model=KnowledgeUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    title: str = Form(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """上传文档到知识库（仅管理员）"""
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"无效的category，可选: {VALID_CATEGORIES}")

    # 读取文件内容
    content = await file.read()
    try:
        raw_text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="文件编码不支持，请使用UTF-8格式")

    doc_title = title or file.filename or "未命名文档"

    # 创建文档记录
    doc = KnowledgeDoc(
        title=doc_title,
        category=category,
        source_type=file.filename.split(".")[-1] if file.filename else "txt",
        file_path=file.filename,
        raw_text=raw_text,
        status="processing",
    )
    db.add(doc)
    db.flush()

    # 切片
    chunks_text = split_text(raw_text)
    if not chunks_text:
        doc.status = "completed"
        db.commit()
        return KnowledgeUploadResponse(
            doc_id=doc.id, title=doc_title, category=category, chunks_count=0
        )

    # 生成 embeddings
    try:
        embeddings = await get_embeddings(chunks_text)
    except Exception as e:
        doc.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Embedding生成失败: {str(e)}")

    # 存入 chunks
    for i, (chunk_text, embedding) in enumerate(zip(chunks_text, embeddings)):
        chunk = KnowledgeChunk(
            doc_id=doc.id,
            chunk_index=i,
            content=chunk_text,
            category=category,
            embedding=embedding,
        )
        db.add(chunk)

    doc.status = "completed"
    db.commit()

    return KnowledgeUploadResponse(
        doc_id=doc.id, title=doc_title, category=category, chunks_count=len(chunks_text)
    )


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    req: KnowledgeSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """向量检索知识库"""
    # 生成查询向量
    try:
        query_embedding = await get_embedding(req.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding生成失败: {str(e)}")

    # pgvector 相似度检索
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    category_filter = ""
    if req.category:
        category_filter = f"AND kc.category = '{req.category}'"

    sql = text(f"""
        SELECT kc.id, kc.content, kc.category,
               1 - (kc.embedding <=> '{embedding_str}'::vector) as score,
               kd.title as doc_title
        FROM knowledge_chunks kc
        JOIN knowledge_docs kd ON kd.id = kc.doc_id
        WHERE kc.embedding IS NOT NULL {category_filter}
        ORDER BY kc.embedding <=> '{embedding_str}'::vector
        LIMIT :top_k
    """)

    results = db.execute(sql, {"top_k": req.top_k}).fetchall()

    return KnowledgeSearchResponse(
        results=[
            ChunkResult(
                chunk_id=row[0],
                content=row[1],
                category=row[2],
                score=float(row[3]),
                doc_title=row[4],
            )
            for row in results
        ]
    )


@router.get("/docs", response_model=List[KnowledgeDocItem])
def list_docs(
    category: str = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """获取知识库文档列表（仅管理员）"""
    query = db.query(KnowledgeDoc)
    if category:
        query = query.filter(KnowledgeDoc.category == category)
    docs = query.order_by(KnowledgeDoc.created_at.desc()).limit(100).all()
    return docs
