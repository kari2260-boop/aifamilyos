"""
RAG Service - 检索增强生成
在聊天时自动检索知识库，将相关内容注入 prompt
"""
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.embedding_service import get_embedding


async def retrieve_context(
    query: str,
    category: Optional[str],
    db: Session,
    top_k: int = 3,
    min_score: float = 0.3,
    query_embedding: Optional[List[float]] = None,
) -> Tuple[str, Optional[List[dict]]]:
    """
    检索知识库中与 query 相关的内容

    Returns:
        (拼接后的上下文文本, 检索到的chunks元数据列表)
        如果没有相关内容或 embedding 未配置，返回 ("", None)
    """
    if query_embedding is None:
        try:
            query_embedding = await get_embedding(query)
        except Exception:
            # Embedding 未配置或失败，静默跳过
            return ("", None)
    if not query_embedding:
        return ("", None)

    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    # 参数化查询，防止SQL注入
    # 注意：embedding用字符串拼接（已是数字数组，无注入风险），category用参数化
    if category:
        sql = text(f"""
            SELECT kc.id, kc.content, kc.category,
                   1 - (kc.embedding <=> '{embedding_str}'::vector) as score,
                   kd.title as doc_title
            FROM knowledge_chunks kc
            JOIN knowledge_docs kd ON kd.id = kc.doc_id
            WHERE kc.embedding IS NOT NULL AND kc.category = :category
            ORDER BY kc.embedding <=> '{embedding_str}'::vector
            LIMIT :top_k
        """)
        results = db.execute(sql, {"category": category, "top_k": top_k}).fetchall()
    else:
        sql = text(f"""
            SELECT kc.id, kc.content, kc.category,
                   1 - (kc.embedding <=> '{embedding_str}'::vector) as score,
                   kd.title as doc_title
            FROM knowledge_chunks kc
            JOIN knowledge_docs kd ON kd.id = kc.doc_id
            WHERE kc.embedding IS NOT NULL
            ORDER BY kc.embedding <=> '{embedding_str}'::vector
            LIMIT :top_k
        """)
        results = db.execute(sql, {"top_k": top_k}).fetchall()

    # 过滤低分结果
    relevant = [(row[1], float(row[3]), row[4]) for row in results if float(row[3]) >= min_score]

    if not relevant:
        return ("", None)

    # 拼接上下文
    context_parts = []
    chunks_meta = []
    for content, score, doc_title in relevant:
        context_parts.append(content)
        chunks_meta.append({
            "doc_title": doc_title,
            "score": round(score, 3),
            "content_preview": content[:100],
        })

    context_text = "\n---\n".join(context_parts)
    return (context_text, chunks_meta)
