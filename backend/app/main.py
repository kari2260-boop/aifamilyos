from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.init_db import init_db
from app.routers import auth, family, chat, knowledge, admin, booking, report, subscription, course, article, resource, prompt, assessment, consultation, analytics, upload, course_series


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 安全检查：JWT密钥不能是默认值
    from app.config import get_settings
    settings = get_settings()
    if settings.JWT_SECRET in ("change-me-in-production", "change-me-to-a-random-string", ""):
        raise RuntimeError("安全错误：必须在.env中设置JWT_SECRET为强随机值")
    # 启动时初始化数据库
    init_db()
    yield


app = FastAPI(
    title="AI Family OS",
    description="AI家庭成长OS - 教育智能体集群",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://47.99.135.248:3000",
        "http://47.99.135.248",
        "https://aifamily.xin",
        "https://www.aifamily.xin",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api")
app.include_router(family.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(booking.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(subscription.router, prefix="/api")
app.include_router(course.router, prefix="/api")
app.include_router(article.router, prefix="/api")
app.include_router(resource.router, prefix="/api")
app.include_router(prompt.router, prefix="/api")
app.include_router(assessment.router, prefix="/api")
app.include_router(consultation.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(course_series.router, prefix="/api")

# 静态文件服务（视频/图片），支持 Range 请求（视频快进）
from fastapi.staticfiles import StaticFiles
import os
os.makedirs("/app/uploads/videos", exist_ok=True)
os.makedirs("/app/uploads/images", exist_ok=True)
app.mount("/api/static/videos", StaticFiles(directory="/app/uploads/videos"), name="videos")
app.mount("/api/static/images", StaticFiles(directory="/app/uploads/images"), name="images")


@app.get("/health")
def health_check():
    return {"status": "ok"}
