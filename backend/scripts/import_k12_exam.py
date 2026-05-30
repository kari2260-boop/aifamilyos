"""
中考真题批量导入脚本
用法: python -m scripts.import_k12_exam
"""
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.models import KnowledgeDoc, KnowledgeChunk
from app.services.text_splitter import split_text
from app.services.embedding_service import get_embeddings

BATCH_SIZE = 10
CATEGORY = "learning"

EXAM_DIRS = [
    Path("/knowledge_source/真题库/中考真题/1 语文总复习/2015-2025年中考语文真题Markdown_可导入版"),
    Path("/knowledge_source/真题库/中考真题/2 数学总复习/2015-2025年中考数学真题Markdown_可导入版"),
    Path("/knowledge_source/真题库/中考真题/3 英语总复习/2015-2025年中考英语真题Markdown_可导入版"),
    Path("/knowledge_source/真题库/中考真题/4 物理总复习/2015-2025年中考物理真题Markdown_可导入版"),
]


def read_file(file_path: Path) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


async def process_file(file_path: Path, db) -> str:
    """返回: 'ok' / 'skip' / 'fail'"""
    raw_text = read_file(file_path)
    if not raw_text.strip():
        return "skip"

    existing = db.query(KnowledgeDoc).filter(
        KnowledgeDoc.title == file_path.name,
        KnowledgeDoc.category == CATEGORY,
    ).first()
    if existing:
        return "skip"

    doc = KnowledgeDoc(
        title=file_path.name,
        category=CATEGORY,
        source_type="md",
        file_path=str(file_path),
        raw_text=raw_text,
        status="processing",
    )
    db.add(doc)
    db.flush()

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
            print(f"  [embedding错误] {file_path.name}: {e}")
            doc.status = "failed"
            db.commit()
            return "fail"

    for i, (chunk_text, embedding) in enumerate(zip(chunks_text, all_embeddings)):
        db.add(KnowledgeChunk(
            doc_id=doc.id,
            chunk_index=i,
            content=chunk_text,
            category=CATEGORY,
            embedding=embedding,
        ))

    doc.status = "completed"
    db.commit()
    return "ok"


async def main():
    db = SessionLocal()
    total = ok = skip = fail = 0

    try:
        for exam_dir in EXAM_DIRS:
            if not exam_dir.exists():
                print(f"[跳过] 目录不存在: {exam_dir}")
                continue

            files = sorted(exam_dir.rglob("*.md"))
            print(f"\n{'='*50}")
            print(f"导入: {exam_dir.name}  ({len(files)} 个文件)")
            print(f"{'='*50}")

            for i, file_path in enumerate(files, 1):
                total += 1
                try:
                    result = await process_file(file_path, db)
                    if result == "ok":
                        ok += 1
                        if ok % 50 == 0:
                            print(f"  已完成 {ok} 个...")
                    elif result == "skip":
                        skip += 1
                    else:
                        fail += 1
                        print(f"  [失败] {file_path.name}")
                except Exception as e:
                    fail += 1
                    print(f"  [异常] {file_path.name}: {e}")
                    db.rollback()
    finally:
        db.close()

    print(f"\n{'='*50}")
    print(f"导入完成！总计 {total} | 成功 {ok} | 跳过 {skip} | 失败 {fail}")


if __name__ == "__main__":
    asyncio.run(main())
