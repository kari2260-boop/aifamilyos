from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class UserRegister(BaseModel):
    phone: str = Field(pattern=r'^1[3-9]\d{9}$', description="中国大陆手机号")
    password: str = Field(min_length=8, max_length=64, description="密码8-64位")
    email: Optional[str] = None


class UserLogin(BaseModel):
    phone: str = Field(min_length=5, max_length=20)
    password: str = Field(min_length=1, max_length=64)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    phone: str
    email: Optional[str] = None
    role: str
    status: str

    class Config:
        from_attributes = True
