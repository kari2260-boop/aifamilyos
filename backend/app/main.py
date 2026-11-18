from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.utils.slowapi_compat import (
    Limiter,
    _rate_limit_exceeded_handler,
    get_remote_address,
    RateLimitExceeded,
    slowapi_available,
)
from app.init_db import init_db
from app.routers import auth, family, chat, knowledge, admin, booking, report, subscription, course, article, resource, prompt, assessment, consultation, analytics, upload, course_series, wrong_question


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

# 限流器
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
if slowapi_available:
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(wrong_question.router, prefix="/api")

# 静态文件服务（视频/图片），支持 Range 请求（视频快进）
from fastapi.staticfiles import StaticFiles
import os
os.makedirs("/app/uploads/videos", exist_ok=True)
os.makedirs("/app/uploads/images", exist_ok=True)
app.mount("/api/static/videos", StaticFiles(directory="/app/uploads/videos"), name="videos")
app.mount("/api/static/images", StaticFiles(directory="/app/uploads/images"), name="images")


# 全局异常处理：500错误不暴露内部信息
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"},
    )


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.head("/health")
def health_check_head():
    return {"status": "ok"}
