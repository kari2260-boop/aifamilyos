"""
把学习力测评 Excel 导入数据库

用法:
  python -m scripts.import_assessment_workbook "/path/to/学习力测评.xlsx"
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.services.assessment_workbook_importer import upsert_templates_from_workbook


def main():
    if len(sys.argv) < 2:
        print("用法: python -m scripts.import_assessment_workbook <xlsx文件路径>")
        sys.exit(1)

    workbook_path = Path(sys.argv[1]).expanduser().resolve()
    if not workbook_path.exists():
        print(f"文件不存在: {workbook_path}")
        sys.exit(1)

    db = SessionLocal()
    try:
        result = upsert_templates_from_workbook(db, workbook_path)
        print(
            f"导入完成: 新增 {result['created']} 个, 更新 {result['updated']} 个, 共 {result['total']} 个模板"
        )
        for item in result["templates"]:
            print(f"- {item['title']} [{item['category']}] 题量={item['question_count']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
