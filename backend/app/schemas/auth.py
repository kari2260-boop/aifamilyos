from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class UserRegister(BaseModel):
    phone: str
    password: str
    email: Optional[str] = None


class UserLogin(BaseModel):
    phone: str
    password: str


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
