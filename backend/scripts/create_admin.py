"""
创建管理员账号脚本
用法: python -m scripts.create_admin <手机号> <密码>
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.models import User
from app.utils.auth import hash_password


def main():
    if len(sys.argv) < 3:
        print("用法: python -m scripts.create_admin <手机号> <密码>")
        sys.exit(1)

    phone = sys.argv[1]
    password = sys.argv[2]

    db = SessionLocal()
    try:
        # 检查是否已存在
        existing = db.query(User).filter(User.phone == phone).first()
        if existing:
            existing.role = "admin"
            db.commit()
            print(f"用户 {phone} 已升级为 admin")
        else:
            user = User(
                phone=phone,
                password_hash=hash_password(password),
                role="admin",
            )
            db.add(user)
            db.commit()
            print(f"管理员账号创建成功: {phone}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
