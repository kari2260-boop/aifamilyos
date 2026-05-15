from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.init_db import init_db
from app.routers import auth, family, chat, knowledge, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_origins=["*"],
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


@app.get("/health")
def health_check():
    return {"status": "ok"}
