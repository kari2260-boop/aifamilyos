"""
数据库初始化脚本
启动时自动创建所有表 + 启用 pgvector 扩展
"""
from sqlalchemy import text
from app.database import engine, Base
from app.models import *  # noqa: F401, F403 - 确保所有模型被导入


def init_db():
    """创建所有表和扩展"""
    with engine.connect() as conn:
        # 启用 pgvector 扩展
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    # 创建所有表
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")


if __name__ == "__main__":
    init_db()
