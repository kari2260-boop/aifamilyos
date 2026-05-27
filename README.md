# AI 家庭教育大脑

AI驱动的家庭成长陪伴系统。4个专业AI Agent + 私有知识库(20-30G) + 视频课程 + 测评咨询 + 数据飞轮。

> **主规划文档**：`~/Desktop/AI_Family_OS_Code_Ready_Docs/14_EXECUTION_PLAN_FINAL.md`
> 包含完整架构、功能清单、分阶段计划、成本测算。

---

## 当前状态

**已完成（MVP + 内测期 + 扩展期核心）：**
- 4个AI Agent对话系统（学学/创创/探探/伴伴）+ Markdown渲染 + 语音输入
- RAG知识库（1784篇文档/27643知识块，多分类联合检索）
- 用户系统（手机号登录+JWT+角色权限）
- 家庭/孩子档案 + Onboarding引导
- 用户分层与付费墙
- Prompt后台管理（数据库驱动+fallback）
- 课程三级目录（系列/单元/课节）+ 本地视频上传播放
- 文章管理 + 封面图上传
- 在线测评系统（问卷+AI报告+人工审核）
- 咨询系统（预约+逐字稿+总结+方案+数据回流）
- 月度成长报告（AI生成）
- 学生画像增强（对话+测评+咨询多源整合）
- 数据回流分析引擎 + Prompt自动优化建议
- 卡片分享、风险识别、用户反馈（赞/踩）
- 管理后台（15+页面）
- 移动端适配
- 模型Fallback机制（DeepSeek主力+Qwen备用）

**下一步：** 服务器部署上线、视频ffmpeg转码、Icon/UI统一、付费订阅

---

## 技术栈

```
前端：Next.js 16 + TypeScript + Tailwind CSS 4（手机端优先）
后端：FastAPI + SQLAlchemy + PostgreSQL 16 + pgvector
AI模型：DeepSeek-V3（主力）+ Qwen-Max（fallback）
Embedding：阿里云DashScope text-embedding-v3
部署：Docker Compose + Nginx + 腾讯云
```

## 本地开发

```bash
# 1. 复制环境变量
cp .env.example .env
# 编辑 .env 填入 API Key

# 2. 启动所有服务
docker compose up --build

# 3. 访问
# 前端：http://localhost:3000
# 后端API：http://localhost:8000
# API文档：http://localhost:8000/docs
```

## 项目结构

```
ai-family-os/
├── frontend/              # Next.js 前端
│   └── src/
│       ├── app/           # 页面路由
│       ├── components/    # 组件
│       └── lib/api.ts     # API客户端
├── backend/               # FastAPI 后端
│   └── app/
│       ├── main.py        # 入口
│       ├── models/        # 数据模型
│       ├── routers/       # API路由
│       ├── services/      # 业务逻辑（RAG/LLM/Prompt/风险）
│       └── utils/         # 工具函数
├── docs/                  # 技术文档
│   ├── DEV-PLAN.md        # 开发实施细节
│   └── PRD-v3.md          # 产品需求文档
├── docker-compose.yml     # 本地开发配置
├── docker-compose.prod.yml # 生产环境配置
└── .env.example           # 环境变量模板
```

## 4个AI Agent

| Agent | agent_type | 知识域 | 角色 |
|-------|-----------|--------|------|
| 学学 | xuexue | learning | 学习策略师 |
| 创创 | chuangchuang | project | 创造引导师 |
| 探探 | tantan | talent | 天赋测评师 |
| 伴伴 | banban | parenting | 成长陪伴师 |

## 文档导航

| 文档 | 位置 | 用途 |
|------|------|------|
| **总体建设方案** | `~/Desktop/AI_Family_OS_Code_Ready_Docs/14_EXECUTION_PLAN_FINAL.md` | 架构+功能+阶段+成本（权威主文档） |
| 开发实施细节 | `docs/DEV-PLAN.md` | 具体代码变更和实施方案 |
| 产品需求文档 | `docs/PRD-v3.md` | 产品规格、用户分层、权益定义 |
