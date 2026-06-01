"""
知识库失败文档重试脚本
只重跑 status='failed' 的文档，不动 completed。
用法: python -m scripts.retry_failed_knowledge [--category learning] [--limit 20]
"""
import sys
import asyncio
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.models import KnowledgeDoc, KnowledgeChunk
from app.services.text_splitter import split_text
from app.services.embedding_service import get_embeddings

BATCH_SIZE = 10


async def retry_doc(doc: KnowledgeDoc, db) -> str:
    """重试单个文档，返回 'ok' / 'skip' / 'fail'"""
    raw_text = doc.raw_text
    if not raw_text or not raw_text.strip():
        doc.status = "completed"
        db.commit()
        return "skip"

    # 清除旧的失败 chunks（如果有）
    db.query(KnowledgeChunk).filter(KnowledgeChunk.doc_id == doc.id).delete()
    db.flush()

    doc.status = "processing"
    db.commit()

    chunks_text = split_text(raw_text)
    if not chunks_text:
        doc.status = "completed"
        db.commit()
        return "ok"

    all_embeddings = []
    for i in range(0, len(chunks_text), BATCH_SIZE):
        batch = chunks_text[i:i + BATCH_SIZE]
        try:
            embeddings = await get_embeddings(batch)
            all_embeddings.extend(embeddings)
        except Exception as e:
            print(f"  [embedding错误] {doc.title}: {e}")
            doc.status = "failed"
            db.commit()
            return "fail"

    for i, (chunk_text, embedding) in enumerate(zip(chunks_text, all_embeddings)):
        db.add(KnowledgeChunk(
            doc_id=doc.id,
            chunk_index=i,
            content=chunk_text,
            category=doc.category,
            embedding=embedding,
        ))

    doc.status = "completed"
    db.commit()
    return "ok"


async def main():
    parser = argparse.ArgumentParser(description="重试失败的知识库文档")
    parser.add_argument("--category", type=str, default=None, help="只重试指定分类")
    parser.add_argument("--limit", type=int, default=50, help="每次最多重试多少条（默认50）")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        query = db.query(KnowledgeDoc).filter(KnowledgeDoc.status == "failed")
        if args.category:
            query = query.filter(KnowledgeDoc.category == args.category)
        total_failed = query.count()
        docs = query.limit(args.limit).all()

        print(f"待重试: {total_failed} 条（本次处理: {len(docs)} 条）")
        if args.category:
            print(f"分类过滤: {args.category}")
        print("=" * 50)

        ok = skip = fail = 0
        for i, doc in enumerate(docs, 1):
            print(f"[{i}/{len(docs)}] {doc.title[:50]} ({doc.category})")
            try:
                result = await retry_doc(doc, db)
                if result == "ok":
                    ok += 1
                    print(f"  ✓ 完成")
                elif result == "skip":
                    skip += 1
                    print(f"  - 跳过（内容为空）")
                else:
                    fail += 1
            except Exception as e:
                fail += 1
                print(f"  ✗ 异常: {e}")
                db.rollback()

        remaining = db.query(KnowledgeDoc).filter(KnowledgeDoc.status == "failed").count()
        print(f"\n{'=' * 50}")
        print(f"本次完成: 成功 {ok} | 跳过 {skip} | 失败 {fail}")
        print(f"剩余 failed: {remaining} 条")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
