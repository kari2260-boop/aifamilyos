"""
知识库批量导入脚本
用法: python -m scripts.import_knowledge <文件夹路径>

文件夹结构:
  knowledge/
    learning/     → category=learning
    project/      → category=project
    talent/       → category=talent
    parenting/    → category=parenting

支持格式: .txt, .md, .pdf
"""
import sys
import os
import asyncio
from pathlib import Path

# 添加项目根目录到 path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.models import KnowledgeDoc, KnowledgeChunk
from app.services.text_splitter import split_text
from app.services.embedding_service import get_embeddings

VALID_CATEGORIES = {"learning", "project", "talent", "parenting", "global", "product"}
SUPPORTED_EXTENSIONS = {".txt", ".md"}
BATCH_SIZE = 10  # embedding 批量大小


def read_file(file_path: Path) -> str:
    """读取文件内容"""
    ext = file_path.suffix.lower()

    if ext in (".txt", ".md"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif ext == ".pdf":
        try:
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                return text
        except ImportError:
            print(f"  [跳过] {file_path.name} - 需要安装 PyPDF2: pip install PyPDF2")
            return ""
    else:
        return ""


def iter_supported_files(category_dir: Path):
    for file_path in sorted(category_dir.rglob("*")):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS | {".pdf"}:
            yield file_path


async def process_file(file_path: Path, category: str, db) -> bool:
    """处理单个文件"""
    print(f"  处理: {file_path.name}")

    # 读取内容
    raw_text = read_file(file_path)
    if not raw_text.strip():
        print(f"  [跳过] 文件为空或无法读取")
        return False

    # 检查是否已导入
    existing = db.query(KnowledgeDoc).filter(
        KnowledgeDoc.title == file_path.name,
        KnowledgeDoc.category == category,
    ).first()
    if existing:
        print(f"  [跳过] 已存在")
        return False

    # 创建文档记录
    doc = KnowledgeDoc(
        title=file_path.name,
        category=category,
        source_type=file_path.suffix.lstrip("."),
        file_path=str(file_path),
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
        print(f"  [完成] 0 个切片（内容太短）")
        return True

    # 批量生成 embeddings
    all_embeddings = []
    for i in range(0, len(chunks_text), BATCH_SIZE):
        batch = chunks_text[i:i + BATCH_SIZE]
        try:
            embeddings = await get_embeddings(batch)
            all_embeddings.extend(embeddings)
        except Exception as e:
            print(f"  [错误] Embedding 失败: {e}")
            doc.status = "failed"
            db.commit()
            return False

    # 存入 chunks
    for i, (chunk_text, embedding) in enumerate(zip(chunks_text, all_embeddings)):
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
    print(f"  [完成] {len(chunks_text)} 个切片")
    return True


async def main():
    if len(sys.argv) < 2:
        print("用法: python -m scripts.import_knowledge <文件夹路径>")
        print()
        print("文件夹结构:")
        print("  knowledge/")
        print("    learning/     → 学习方法类文档")
        print("    project/      → 项目创作类文档")
        print("    talent/       → 天赋发展类文档")
        print("    parenting/    → 亲子教育类文档")
        sys.exit(1)

    folder = Path(sys.argv[1])
    if not folder.exists():
        print(f"错误: 文件夹不存在 - {folder}")
        sys.exit(1)

    db = SessionLocal()
    total = 0
    success = 0
    failed = 0

    try:
        # 遍历子文件夹
        for category_dir in sorted(folder.iterdir()):
            if not category_dir.is_dir():
                continue

            category = category_dir.name.lower()
            if category not in VALID_CATEGORIES:
                print(f"\n[跳过文件夹] {category_dir.name} (不是有效分类)")
                continue

            print(f"\n{'='*50}")
            print(f"分类: {category} ({category_dir.name})")
            print(f"{'='*50}")

            files = list(iter_supported_files(category_dir))

            if not files:
                print("  没有找到支持的文件")
                continue

            for file_path in files:
                total += 1
                try:
                    ok = await process_file(file_path, category, db)
                    if ok:
                        success += 1
                except Exception as e:
                    print(f"  [错误] {file_path.name}: {e}")
                    failed += 1
                    db.rollback()

    finally:
        db.close()

    print(f"\n{'='*50}")
    print(f"导入完成!")
    print(f"  总计: {total} 个文件")
    print(f"  成功: {success}")
    print(f"  失败: {failed}")
    print(f"  跳过: {total - success - failed}")


if __name__ == "__main__":
    asyncio.run(main())
