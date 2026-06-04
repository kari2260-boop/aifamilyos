#!/usr/bin/env python3
"""
检查真题导入进度
运行：docker exec ai-family-os-backend-1 python scripts/check_import_progress.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models.models import KnowledgeDoc, KnowledgeChunk
from sqlalchemy import func
from datetime import datetime, timedelta

db = SessionLocal()

# 统计总体数据
total_docs = db.query(KnowledgeDoc).filter(KnowledgeDoc.category == 'practice').count()
total_chunks = db.query(KnowledgeChunk).filter(KnowledgeChunk.category == 'practice').count()

print("=" * 70)
print("📊 中考真题导入进度")
print("=" * 70)
print()
print(f"总计：{total_docs} 个文档，{total_chunks} 个分块")
print()

# 按年份统计（从标题提取）
print("📅 按年份分布：")
for year in [2025, 2024, 2023, 2022]:
    count = db.query(KnowledgeDoc).filter(
        KnowledgeDoc.category == 'practice',
        KnowledgeDoc.title.like(f'%{year}年%')
    ).count()
    if count > 0:
        bar = '█' * (count // 5)
        print(f"  {year}年: {count:3d} 个  {bar}")

print()

# 按学科统计（从标题提取）
print("📚 按学科分布：")
subjects = {
    '数学': ['数学'],
    '物理': ['物理'],
    '英语': ['英语'],
    '语文': ['语文'],
}

subject_stats = {}
for subject_name, keywords in subjects.items():
    count = 0
    for keyword in keywords:
        count += db.query(KnowledgeDoc).filter(
            KnowledgeDoc.category == 'practice',
            KnowledgeDoc.title.like(f'%{keyword}%')
        ).count()
    subject_stats[subject_name] = count
    if count > 0:
        bar = '█' * (count // 10)
        print(f"  {subject_name}: {count:3d} 个  {bar}")

print()

# 最近导入的10个文档
print("📝 最近导入的10个文档：")
recent = db.query(KnowledgeDoc).filter(
    KnowledgeDoc.category == 'practice'
).order_by(KnowledgeDoc.created_at.desc()).limit(10).all()

for doc in recent:
    chunks = db.query(KnowledgeChunk).filter(KnowledgeChunk.doc_id == doc.id).count()
    time_ago = datetime.utcnow() - doc.created_at
    if time_ago.seconds < 60:
        time_str = f"{time_ago.seconds}秒前"
    elif time_ago.seconds < 3600:
        time_str = f"{time_ago.seconds // 60}分钟前"
    else:
        time_str = f"{time_ago.seconds // 3600}小时前"
    print(f"  [{time_str}] {doc.title} ({chunks}个分块)")

print()
print("=" * 70)

# 目标进度
print("🎯 目标进度（方案B）：2,380 个文档")
progress = (total_docs / 2380) * 100
bar_length = int(progress / 2)
bar = '█' * bar_length + '░' * (50 - bar_length)
print(f"  {bar} {progress:.1f}%")
print("=" * 70)

db.close()
