"""
数据库初始化脚本

生产环境的数据库结构变更应使用 Alembic：
    cd backend && alembic upgrade head

这里保留 create_all 作为开发/首次启动兜底，只创建缺失的表，不负责修改已有表结构。
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
