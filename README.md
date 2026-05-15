# AI 家庭成长 OS

AI教育智能体集群，为200组家庭提供学习力探索、项目创作、亲子沟通、情绪支持四大AI Agent服务。

## 技术栈

- 前端：Next.js 14 + TypeScript + Tailwind CSS
- 后端：FastAPI + SQLAlchemy + PostgreSQL + pgvector
- AI：DeepSeek / Qwen（OpenAI兼容格式）
- 部署：Docker Compose

## 本地开发

### 前置要求

- Docker Desktop 已安装
- Node.js 20+
- Python 3.11+

### 启动

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 编辑 .env 填入你的 API Key
nano .env

# 3. 启动所有服务
docker compose up --build

# 4. 访问
# 前端：http://localhost:3000
# 后端：http://localhost:8000
# API文档：http://localhost:8000/docs
```

### 停止

```bash
docker compose down
```

## 项目结构

```
ai-family-os/
├── frontend/          # Next.js 前端
├── backend/           # FastAPI 后端
│   └── app/
│       ├── main.py        # 入口
│       ├── config.py      # 配置
│       ├── database.py    # 数据库连接
│       ├── models/        # SQLAlchemy 模型
│       ├── schemas/       # Pydantic 模型
│       ├── routers/       # API 路由
│       ├── services/      # 业务逻辑
│       ├── prompts/       # Agent 提示词
│       └── utils/         # 工具函数
├── docs/              # 文档
├── docker-compose.yml
├── .env.example
└── README.md
```
