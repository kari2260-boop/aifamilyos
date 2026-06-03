"""
刷刷知识库批量导入脚本

用途：
- 把“教材 / 真题 / 讲义 / 沟通文档 / 练习”等资料统一导入到 learning 知识库
- 适合刷刷智能体使用的资料体系

用法：
  python -m scripts.import_shuashua_library <目录1> [目录2] [目录3] ...

建议目录组织：
  根目录/
    语文/
      真题/
      教材/
      沟通文档/
    数学/
      真题/
      教材/
      沟通文档/

脚本会：
- 递归扫描 .md / .txt / .pdf
- 统一归入 category = learning
- 通过文件路径和文件名推断学科 / 资料类型
- 给每个 chunk 附加 tags，方便后续检索和维护
- 在内容前注入结构化元数据，帮助刷刷更稳定地命中教材、真题和沟通文档
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path
from typing import Iterable

# 添加项目根目录到 path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.models import KnowledgeDoc, KnowledgeChunk
from app.services.text_splitter import split_text
from app.services.embedding_service import get_embeddings

CATEGORY = "learning"
SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf"}
BATCH_SIZE = 10

SUBJECT_KEYWORDS = {
    "语文": "语文",
    "数学": "数学",
    "英语": "英语",
    "物理": "物理",
    "化学": "化学",
    "生物": "生物",
    "历史": "历史",
    "地理": "地理",
    "政治": "政治",
}

DOC_TYPE_KEYWORDS = [
    ("真题", "真题"),
    ("教材", "教材"),
    ("讲义", "讲义"),
    ("课件", "讲义"),
    ("练习", "练习"),
    ("作业", "练习"),
    ("沟通", "沟通文档"),
    ("咨询", "沟通文档"),
    ("访谈", "沟通文档"),
    ("家校", "沟通文档"),
    ("家长", "沟通文档"),
]


def read_file(file_path: Path) -> str:
    ext = file_path.suffix.lower()
    if ext in (".txt", ".md"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    if ext == ".pdf":
        try:
            import PyPDF2
        except ImportError:
            print(f"  [跳过] {file_path.name} - 需要安装 PyPDF2")
            return ""

        try:
            text = []
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text.append(page.extract_text() or "")
            return "\n".join(text)
        except Exception as e:
            print(f"  [跳过] {file_path.name} - PDF 读取失败: {e}")
            return ""
    return ""


def iter_supported_files(root: Path) -> Iterable[Path]:
    for file_path in sorted(root.rglob("*")):
        if (
            file_path.is_file()
            and not file_path.name.startswith("._")
            and file_path.suffix.lower() in SUPPORTED_EXTENSIONS
        ):
            yield file_path


def detect_subject(path: Path) -> str:
    full_text = " / ".join(path.parts)
    for keyword, subject in SUBJECT_KEYWORDS.items():
        if keyword in full_text:
            return subject
    return "综合"


def detect_doc_type(path: Path) -> str:
    full_text = " / ".join(path.parts)
    for keyword, label in DOC_TYPE_KEYWORDS:
        if keyword in full_text:
            return label
    return "资料"


def build_metadata_header(root: Path, file_path: Path) -> tuple[str, list[str], str, str]:
    relative_path = file_path.relative_to(root)
    subject = detect_subject(relative_path)
    doc_type = detect_doc_type(relative_path)
    source_label = str(relative_path.parent) if str(relative_path.parent) != "." else root.name

    header_lines = [
        "【刷刷知识库】",
        f"【学科】{subject}",
        f"【类型】{doc_type}",
        f"【来源】{source_label}",
        f"【路径】{relative_path}",
        "【用途】真题训练、教材讲解、沟通文档复盘、错题分析",
    ]
    tags = ["shuashua", subject, doc_type, source_label]
    return ("\n".join(header_lines), tags, subject, doc_type)


def make_title(subject: str, doc_type: str, filename: str) -> str:
    base = f"【刷刷】{subject}-{doc_type}-{filename}"
    return base[:200]


async def process_file(root: Path, file_path: Path, db) -> bool:
    print(f"  处理: {file_path.relative_to(root)}")

    raw_text = read_file(file_path)
    if not raw_text.strip():
        print("  [跳过] 文件为空或无法读取")
        return False

    header_text, tags, subject, doc_type = build_metadata_header(root, file_path)
    enriched_text = f"{header_text}\n\n{raw_text}"
    relative_path = str(file_path.relative_to(root))
    file_key = f"shuashua:{root.name}/{relative_path}"

    existing = db.query(KnowledgeDoc).filter(
        KnowledgeDoc.file_path == file_key,
    ).first()
    if existing:
        print("  [跳过] 已存在")
        return False

    doc = KnowledgeDoc(
        title=make_title(subject, doc_type, file_path.name),
        category=CATEGORY,
        source_type=file_path.suffix.lstrip("."),
        file_path=file_key,
        raw_text=enriched_text,
        status="processing",
    )
    db.add(doc)
    db.flush()

    chunks_text = split_text(enriched_text)
    if not chunks_text:
        doc.status = "completed"
        db.commit()
        print("  [完成] 0 个切片（内容太短）")
        return True

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

    for i, (chunk_text, embedding) in enumerate(zip(chunks_text, all_embeddings)):
        db.add(KnowledgeChunk(
            doc_id=doc.id,
            chunk_index=i,
            content=chunk_text,
            category=CATEGORY,
            tags=tags,
            embedding=embedding,
        ))

    doc.status = "completed"
    db.commit()
    print(f"  [完成] {len(chunks_text)} 个切片")
    return True


async def main() -> None:
    parser = argparse.ArgumentParser(description="导入刷刷知识库（教材/真题/沟通文档等）")
    parser.add_argument("roots", nargs="+", help="要导入的根目录，可传多个")
    args = parser.parse_args()

    roots = [Path(p).expanduser().resolve() for p in args.roots]
    for root in roots:
        if not root.exists():
            print(f"错误: 目录不存在 - {root}")
            sys.exit(1)

    db = SessionLocal()
    total = success = failed = 0

    try:
        for root in roots:
            print(f"\n{'=' * 60}")
            print(f"刷刷知识库导入: {root}")
            print(f"{'=' * 60}")

            files = list(iter_supported_files(root))
            if not files:
                print("  没有找到支持的文件")
                continue

            for file_path in files:
                total += 1
                try:
                    ok = await process_file(root, file_path, db)
                    if ok:
                        success += 1
                except Exception as e:
                    failed += 1
                    print(f"  [异常] {file_path.name}: {e}")
                    db.rollback()
    finally:
        db.close()

    print(f"\n{'=' * 60}")
    print("导入完成！")
    print(f"  总计: {total} 个文件")
    print(f"  成功: {success}")
    print(f"  失败: {failed}")
    print(f"  跳过: {total - success - failed}")


if __name__ == "__main__":
    asyncio.run(main())
