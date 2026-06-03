"""
中考真题导入脚本 - 批量导入 Markdown 格式化试卷到 practice 知识库
支持数学/物理/英语/语文四个学科，2015-2025年中考真题

使用方法：
    python scripts/import_practice_exams.py --base-dir /path/to/真题库 --subject 数学

参数：
    --base-dir: 真题库根目录（包含4个学科文件夹）
    --subject: 学科名称（数学/物理/英语/语文/all）
    --year: 可选，指定年份（2015-2025），不指定则导入全部
    --limit: 可选，限制导入数量（用于测试）
    --dry-run: 试运行，不实际写入数据库
"""
import sys
import os
import re
from pathlib import Path
from typing import List, Dict, Optional
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models.models import KnowledgeDoc, KnowledgeChunk
from app.services.embedding_service import get_embeddings
from app.services.text_splitter import split_text
from datetime import datetime
import uuid
import asyncio


# 学科映射（目录名 -> 标准学科名）
SUBJECT_MAPPING = {
    "1 语文总复习": "语文",
    "2 数学总复习": "数学",
    "3 英语总复习": "英语",
    "4 物理总复习": "物理",
}

# 学科对应的目录名
SUBJECT_DIRS = {
    "语文": "1 语文总复习/2015-2025年中考语文真题Markdown_可导入版",
    "数学": "2 数学总复习/2015-2025年中考数学真题Markdown_可导入版",
    "英语": "3 英语总复习/2015-2025年中考英语真题Markdown_可导入版",
    "物理": "4 物理总复习/2015-2025年中考物理真题Markdown_可导入版",
}


def extract_metadata_from_filename(filename: str) -> Dict[str, str]:
    """从文件名提取元数据：年份、地区、学科、试卷类型"""
    # 示例：2025年陕西省中考数学试题.md
    # 示例：2022年江苏省泰州市中考语文真题（解析版）.md

    metadata = {
        "year": None,
        "region": None,
        "subject": None,
        "exam_type": "正式卷",  # 默认
    }

    # 提取年份（2015-2025）
    year_match = re.search(r'(20\d{2})年', filename)
    if year_match:
        metadata["year"] = year_match.group(1)

    # 提取地区（省/市）
    region_match = re.search(r'年(.+?)(?:省|市)?(?:中考|初中)', filename)
    if region_match:
        metadata["region"] = region_match.group(1).strip()

    # 提取学科
    for subject in ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理"]:
        if subject in filename:
            metadata["subject"] = subject
            break

    # 提取试卷类型
    if "解析版" in filename or "详解" in filename:
        metadata["exam_type"] = "解析版"
    elif "A卷" in filename:
        metadata["exam_type"] = "A卷"
    elif "B卷" in filename:
        metadata["exam_type"] = "B卷"
    elif "汇编" in filename or "总复习" in filename:
        metadata["exam_type"] = "汇编"

    return metadata


def extract_title_from_content(content: str) -> Optional[str]:
    """从文件内容提取标题（第一个加粗文本或一级标题）"""
    # 优先找加粗标题：**XXXX**
    bold_title = re.search(r'\*\*([^*]+?中考[^*]+?)\*\*', content[:500])
    if bold_title:
        return bold_title.group(1).strip()

    # 其次找一级标题：# XXXX
    h1_title = re.search(r'^#\s+(.+)$', content[:500], re.MULTILINE)
    if h1_title:
        return h1_title.group(1).strip()

    return None


def process_markdown_file(
    file_path: Path,
    subject: str,
    base_dir: Path,
) -> Optional[Dict]:
    """处理单个 Markdown 文件，返回待导入的文档数据"""

    # 读取文件内容
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ 读取失败 {file_path.name}: {e}")
        return None

    # 跳过空文件或过短文件
    if len(content.strip()) < 100:
        print(f"⏭️  跳过空文件 {file_path.name}")
        return None

    # 提取元数据
    metadata = extract_metadata_from_filename(file_path.name)
    metadata["subject"] = subject  # 强制使用传入的学科

    # 提取标题
    title = extract_title_from_content(content)
    if not title:
        # 如果提取不到，用文件名作为标题
        title = file_path.stem

    # 构造相对路径（用于记录来源）
    relative_path = str(file_path.relative_to(base_dir))

    return {
        "title": title,
        "content": content,
        "category": "practice",  # 刷刷专用知识库
        "subject": metadata["subject"],
        "year": metadata["year"],
        "region": metadata["region"],
        "exam_type": metadata["exam_type"],
        "source_file": relative_path,
        "file_size": len(content),
    }


def import_subject(
    base_dir: Path,
    subject: str,
    year_filter: Optional[str] = None,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> Dict[str, int]:
    """导入指定学科的真题"""

    stats = {
        "total": 0,
        "success": 0,
        "skip": 0,
        "error": 0,
    }

    # 获取学科目录
    subject_subdir = SUBJECT_DIRS.get(subject)
    if not subject_subdir:
        print(f"❌ 不支持的学科：{subject}")
        return stats

    subject_dir = base_dir / "真题库" / "中考真题" / subject_subdir
    if not subject_dir.exists():
        print(f"❌ 目录不存在：{subject_dir}")
        return stats

    print(f"\n{'='*60}")
    print(f"📚 开始导入【{subject}】真题")
    print(f"📂 目录：{subject_dir}")
    print(f"{'='*60}\n")

    # 收集所有 .md 文件
    md_files = list(subject_dir.rglob("*.md"))
    print(f"📄 找到 {len(md_files)} 个 Markdown 文件")

    # 年份过滤
    if year_filter:
        md_files = [f for f in md_files if year_filter in f.name]
        print(f"🔍 过滤年份 {year_filter}：剩余 {len(md_files)} 个文件")

    # 限制数量（测试用）
    if limit:
        md_files = md_files[:limit]
        print(f"🎯 限制导入数量：{limit} 个文件")

    stats["total"] = len(md_files)

    # 批量处理
    documents_to_import = []

    for i, file_path in enumerate(md_files, 1):
        print(f"[{i}/{len(md_files)}] 处理 {file_path.name}...", end=" ")

        doc_data = process_markdown_file(file_path, subject, base_dir)

        if doc_data:
            documents_to_import.append(doc_data)
            print("✅")
        else:
            stats["skip"] += 1
            print("⏭️")

    # 写入数据库
    if not dry_run and documents_to_import:
        print(f"\n💾 准备写入数据库：{len(documents_to_import)} 个文档")
        asyncio.run(_import_to_db(documents_to_import, stats))
    elif dry_run:
        # 试运行：只预览分块数量
        total_chunks = 0
        for doc_data in documents_to_import:
            chunks = split_text(doc_data["content"])
            total_chunks += len(chunks)
            print(f"  📄 {doc_data['title'][:50]} → {len(chunks)} 个分块")
        print(f"\n🧪 【试运行模式】将导入 {len(documents_to_import)} 个文档，共 {total_chunks} 个分块")
        stats["success"] = len(documents_to_import)

    return stats


async def _import_to_db(documents_to_import: list, stats: dict):
    """将文档批量写入数据库（doc + chunks + embeddings）"""
    db = SessionLocal()
    try:
        for i, doc_data in enumerate(documents_to_import, 1):
            print(f"\n[{i}/{len(documents_to_import)}] 导入：{doc_data['title'][:50]}")

            try:
                # 1. 创建 KnowledgeDoc 记录
                doc = KnowledgeDoc(
                    id=uuid.uuid4(),
                    title=doc_data["title"],
                    category="practice",
                    source_type="md",
                    file_path=doc_data["source_file"],
                    raw_text=doc_data["content"],
                    status="processing",
                    created_at=datetime.utcnow(),
                )
                db.add(doc)
                db.flush()  # 获取 doc.id

                # 2. 分块
                chunks_text = split_text(doc_data["content"])
                if not chunks_text:
                    doc.status = "completed"
                    db.commit()
                    print(f"   ⏭️ 内容为空，跳过")
                    stats["skip"] += 1
                    continue

                print(f"   ✂️  分块：{len(chunks_text)} 个")

                # 3. 分批生成 embeddings（DashScope 限制每次最多 25 个）
                BATCH_SIZE = 25
                all_embeddings = []
                for batch_idx in range(0, len(chunks_text), BATCH_SIZE):
                    batch_texts = chunks_text[batch_idx:batch_idx + BATCH_SIZE]
                    batch_embeddings = await get_embeddings(batch_texts)
                    all_embeddings.extend(batch_embeddings)
                    print(f"   🧮 Embedding 批次 {batch_idx//BATCH_SIZE + 1}/{(len(chunks_text)-1)//BATCH_SIZE + 1} 完成")

                print(f"   ✅ 全部 Embedding 生成完成（{len(all_embeddings)} 个）")

                # 4. 存入 KnowledgeChunk
                for idx, (chunk_text, embedding) in enumerate(zip(chunks_text, all_embeddings)):
                    chunk = KnowledgeChunk(
                        id=uuid.uuid4(),
                        doc_id=doc.id,
                        chunk_index=idx,
                        content=chunk_text,
                        category="practice",
                        embedding=embedding,
                    )
                    db.add(chunk)

                doc.status = "completed"
                db.commit()
                print(f"   ✅ 保存成功（{len(chunks_text)} 个分块）")
                stats["success"] += 1

            except Exception as e:
                db.rollback()
                print(f"   ❌ 导入失败：{e}")
                stats["error"] += 1

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="中考真题导入工具")
    parser.add_argument(
        "--base-dir",
        type=str,
        required=True,
        help="真题库根目录（例如：/Users/kari77/Desktop/中国K12知识库）"
    )
    parser.add_argument(
        "--subject",
        type=str,
        default="all",
        choices=["数学", "物理", "英语", "语文", "all"],
        help="学科名称，默认 all 导入全部"
    )
    parser.add_argument(
        "--year",
        type=str,
        help="指定年份（2015-2025），不指定则导入全部"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="限制导入数量（用于测试）"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="试运行，不实际写入数据库"
    )

    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        print(f"❌ 目录不存在：{base_dir}")
        sys.exit(1)

    print(f"\n{'='*70}")
    print(f"🎓 中考真题导入工具 - 刷刷知识库")
    print(f"{'='*70}")
    print(f"📂 根目录：{base_dir}")
    print(f"📚 学科：{args.subject}")
    print(f"📅 年份：{args.year or '全部'}")
    print(f"🎯 限制：{args.limit or '无限制'}")
    print(f"🧪 试运行：{'是' if args.dry_run else '否'}")
    print(f"{'='*70}\n")

    # 确定要导入的学科
    if args.subject == "all":
        subjects = ["数学", "物理", "英语", "语文"]
    else:
        subjects = [args.subject]

    # 导入各学科
    total_stats = {
        "total": 0,
        "success": 0,
        "skip": 0,
        "error": 0,
    }

    for subject in subjects:
        stats = import_subject(
            base_dir=base_dir,
            subject=subject,
            year_filter=args.year,
            limit=args.limit,
            dry_run=args.dry_run,
        )

        for key in total_stats:
            total_stats[key] += stats[key]

        print(f"\n✅ 【{subject}】导入完成")
        print(f"   总数：{stats['total']}")
        print(f"   成功：{stats['success']}")
        print(f"   跳过：{stats['skip']}")
        print(f"   失败：{stats['error']}")

    # 总结
    print(f"\n{'='*70}")
    print(f"🎉 全部导入完成")
    print(f"{'='*70}")
    print(f"📊 总统计：")
    print(f"   总数：{total_stats['total']}")
    print(f"   成功：{total_stats['success']}")
    print(f"   跳过：{total_stats['skip']}")
    print(f"   失败：{total_stats['error']}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
