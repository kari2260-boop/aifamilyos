from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.models import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["认证"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    # 检查手机号是否已注册
    existing = db.query(User).filter(User.phone == data.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="该手机号已注册")

    # 创建用户
    user = User(
        phone=data.phone,
        password_hash=hash_password(data.password),
        email=data.email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 返回 token
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == data.phone).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
