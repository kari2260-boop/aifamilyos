# AI 家庭成长 OS — 开发实施文档

> **定位**：本文档是技术实施细节参考，包含具体代码变更和文件修改方案。
> **主规划文档**：`~/Desktop/AI_Family_OS_Code_Ready_Docs/14_EXECUTION_PLAN_FINAL.md`（架构、阶段、成本以主文档为准）
> 配合 PRD-v3.md 阅读。

---

## 现有代码库状态

### 技术栈
- 前端：Next.js 16.2.6 + React 19.2.4 + Tailwind CSS
- 后端：FastAPI + PostgreSQL + pgvector
- 部署：Docker Compose 本地开发
- UI 组件：Shadcn UI + Framer Motion（待移除）
- 认证：JWT Bearer token，手机号注册/登录

### 已完成的功能
- 首页（4个AI智能体卡片）
- 登录/注册（手机号密码）
- Onboarding（2步：家庭信息 → 孩子信息）
- 个人资料页
- 对话系统（4个AI智能体：学学/创创/探探/伴伴）
- 预约咨询、成长报告、订阅套餐
- 管理后台（9个页面）
- 后端 8 个路由模块、14 个数据库模型
- RAG 知识库、风险监控

### 当前设计系统
- 色彩：oklch 色彩空间，蓝紫色调
- 导航：底部 3 tab（首页、对话、我的）
- 动画：Framer Motion
- 布局：max-w-md

---

## Phase 1：设计系统迁移

### 目标
全站视觉风格从蓝紫科技感 → APEF 暖金温暖感。完成后打开任何页面都是暖金色调。

### 改动 1：globals.css 色彩变量替换

**文件**：`frontend/src/app/globals.css`

**改动说明**：
- 将 `:root` 中所有 oklch 色值替换为 APEF 暖金色系 hex 值
- 重写 `.dark` 暗色模式为暖金暗色调（非纯黑，保持温暖感）
- 保留 @theme inline 中的 radius、动画等结构性定义

**新色值映射（亮色）**：
```css
:root {
  --background: #FAF9F7;          /* 暖白米色背景 */
  --foreground: #1a2d42;          /* 深蓝灰正文 */
  --card: #F5F2EF;                /* 浅暖灰卡片 */
  --card-foreground: #1a2d42;
  --popover: #FFFFFF;
  --popover-foreground: #1a2d42;
  --primary: #C4A77D;             /* 暖金色主色 */
  --primary-foreground: #FFFFFF;
  --secondary: #F5F2EF;           /* 浅暖灰 */
  --secondary-foreground: #8B7355;
  --muted: #F5F2EF;
  --muted-foreground: #8B7355;    /* 棕色次要文字 */
  --accent: #F5F2EF;
  --accent-foreground: #8B7355;
  --destructive: #e74c3c;
  --border: #E8E4DF;              /* 浅米灰边框 */
  --input: #E8E4DF;
  --ring: #C4A77D;
  --radius: 1rem;                 /* 加大圆角基准 */
}
```

**新色值映射（暗色）**：
```css
.dark {
  --background: #1C1917;          /* 暖深棕黑 */
  --foreground: #F5F2EF;          /* 暖白文字 */
  --card: #292524;                /* 深暖灰卡片 */
  --card-foreground: #F5F2EF;
  --popover: #292524;
  --popover-foreground: #F5F2EF;
  --primary: #C4A77D;             /* 暖金色主色（保持不变） */
  --primary-foreground: #1C1917;
  --secondary: #292524;
  --secondary-foreground: #BFB8AD;
  --muted: #292524;
  --muted-foreground: #BFB8AD;    /* 浅灰棕 */
  --accent: #292524;
  --accent-foreground: #BFB8AD;
  --destructive: #e74c3c;
  --border: #3D3835;              /* 暖深灰边框 */
  --input: #3D3835;
  --ring: #C4A77D;
}
```

### 改动 2：BottomNav 改为 5 tab

**文件**：`frontend/src/components/BottomNav.tsx`

**改动说明**：
- 从 3 个 tab 扩展为 5 个 tab
- 图标从 emoji 改为 SVG 图标（更精致）
- 容器从 max-w-md 改为 max-w-2xl

**新导航结构**：
```typescript
const navItems = [
  { href: "/", label: "首页", icon: HomeIcon },
  { href: "/courses", label: "共学", icon: BookIcon },
  { href: "/chat", label: "对话", icon: ChatIcon },
  { href: "/resources", label: "资料", icon: FolderIcon },
  { href: "/profile", label: "我的", icon: UserIcon },
];
```

### 改动 3：布局宽度统一

**涉及文件**：所有页面布局容器

**改动说明**：
- 全站布局容器从 `max-w-md` 改为 `max-w-2xl mx-auto`
- 确保移动端窄版居中，桌面端不会过宽

### 改动 4：去除 Framer Motion

**改动说明**：
- 检查所有使用 `framer-motion` 的组件
- 替换为纯 CSS transition/animation
- 从 package.json 移除 framer-motion 依赖

### 改动 5：字体配置

**文件**：`frontend/src/app/layout.tsx` 或 `globals.css`

**改动说明**：
- 确保字体栈为：Inter + system-ui（中文回退 Noto Sans SC）
- 如果当前已配置 Inter 则保持，只需确认中文回退

---

## Phase 2：课程模块

### 目标
用户可以浏览分类课程、查看课程详情、追踪学习进度。管理员可以在后台管理课程内容。

### 后端改动

**新建文件**：
- `backend/app/models/course.py` — 课程相关数据模型
- `backend/app/routers/course.py` — 课程 API 路由
- `backend/app/schemas/course.py` — Pydantic schemas

**数据模型**：
```python
# CourseCategory - 课程分类
- id, name, slug, sort_order, created_at

# Course - 课程
- id, title, description, cover_url
- category_id (FK → CourseCategory)
- content_type: enum("video", "article")
- external_url (视频课程跳转链接，如小鹅通)
- content_markdown (长文课程内容)
- tags: JSON array
- feishu_doc_id (可选，飞书文档ID)
- is_published, sort_order
- created_at, updated_at

# LearningPath - 学习路径
- id, title, description, category_id

# LearningPathNode - 路径节点
- id, path_id (FK), course_id (FK), node_order, is_milestone

# UserCourseProgress - 用户学习进度
- id, user_id (FK), course_id (FK)
- status: enum("not_started", "in_progress", "completed")
- progress_percent: int (0-100)
- started_at, completed_at
```

**API 端点**：
```
GET  /api/courses                    — 课程列表（?category=&type=&page=&size=）
GET  /api/courses/{id}               — 课程详情
GET  /api/courses/categories         — 分类列表
GET  /api/courses/paths              — 学习路径列表
GET  /api/courses/paths/{id}         — 路径详情（含节点+用户进度）
POST /api/courses/{id}/progress      — 更新学习进度
POST /api/admin/courses              — 创建课程（管理员）
PUT  /api/admin/courses/{id}         — 更新课程（管理员）
DELETE /api/admin/courses/{id}       — 删除课程（管理员）
POST /api/admin/courses/categories   — 创建分类（管理员）
```

### 前端改动

**新建文件**：
- `frontend/src/app/courses/page.tsx` — 课程列表页
- `frontend/src/app/courses/[id]/page.tsx` — 课程详情页

**课程列表页 `/courses` 布局**：
1. 顶部 Banner（暖金渐变背景，当季主推课程标题+副标题）
2. 学习路径区域（可选，线性节点列表，带完成状态圆圈）
3. 分类标签切换栏（家庭教育/AI科技/学科学习/父母成长/教育规划/人性洞察）
4. 课程卡片网格（每卡片：封面+标题+简介+标签+类型图标）

**课程详情页 `/courses/[id]` 布局**：
- 封面图
- 标题 + 描述
- 标签列表
- 学习进度条
- "开始学习"按钮（video→新窗口跳转external_url，article→展示content_markdown）

**管理后台新增**：
- `frontend/src/app/admin/courses/page.tsx` — 课程管理列表
- 支持：新建/编辑/删除/排序/发布切换

### API 层新增

**文件**：`frontend/src/lib/api.ts`

新增方法：
```typescript
// 课程相关
getCourses(params?: { category?: string; type?: string })
getCourse(id: string)
getCourseCategories()
getCoursePaths()
getCoursePath(id: string)
updateCourseProgress(courseId: string, data: { status: string; progress_percent: number })
// 管理员
adminCreateCourse(data: CourseCreateInput)
adminUpdateCourse(id: string, data: CourseUpdateInput)
adminDeleteCourse(id: string)
```

---

## Phase 3：文章模块

### 目标
用户可以浏览精选文章、阅读 Markdown 长文、查看目录导航。管理员可以管理文章内容。

### 后端改动

**新建文件**：
- `backend/app/models/article.py`
- `backend/app/routers/article.py`
- `backend/app/schemas/article.py`

**数据模型**：
```python
# Article - 文章
- id, title, summary, content_markdown
- cover_url, author, category
- tags: JSON array
- feishu_doc_id (可选)
- is_published, is_featured (精选标记)
- view_count
- published_at, created_at, updated_at
```

**API 端点**：
```
GET  /api/articles              — 文章列表（?category=&tag=&page=&size=）
GET  /api/articles/{id}         — 文章详情
GET  /api/articles/featured     — 精选文章（首页用）
POST /api/admin/articles        — 创建（管理员）
PUT  /api/admin/articles/{id}   — 更新（管理员）
DELETE /api/admin/articles/{id} — 删除（管理员）
```

### 前端改动

**新建文件**：
- `frontend/src/app/reading/page.tsx` — 文章列表页
- `frontend/src/app/reading/[id]/page.tsx` — 文章详情页

**新增依赖**：
```
react-markdown, remark-gfm, rehype-slug, rehype-autolink-headings
```

**文章列表页布局**：
- 分类筛选标签栏
- 文章卡片列表（封面+标题+摘要+作者+日期+标签）

**文章详情页布局**：
- 标题 + 作者 + 日期
- 顶部目录导航（TOC，从 Markdown 标题自动生成）
- 阅读进度条（页面滚动百分比）
- Markdown 正文渲染
- 底部"相关文章"推荐（同分类/同标签）

**管理后台新增**：
- `frontend/src/app/admin/articles/page.tsx` — 文章管理

---

## Phase 4：资料库模块

### 目标
用户可以浏览社群资料（飞书文档、腾讯文档、问卷、视频等外链），点击直接跳转。管理员可以管理资料。

### 后端改动

**新建文件**：
- `backend/app/models/resource.py`
- `backend/app/routers/resource.py`
- `backend/app/schemas/resource.py`

**数据模型**：
```python
# Resource - 资料
- id, title, description, url
- resource_type: enum("feishu_doc", "tencent_doc", "questionnaire", "video", "other")
- category (分类标签)
- is_pinned (置顶)
- sort_order
- created_at, updated_at
```

**API 端点**：
```
GET  /api/resources              — 资料列表（?category=&type=）
POST /api/admin/resources        — 创建（管理员）
PUT  /api/admin/resources/{id}   — 更新（管理员）
DELETE /api/admin/resources/{id} — 删除（管理员）
```

### 前端改动

**新建文件**：
- `frontend/src/app/resources/page.tsx` — 资料库页面

**页面布局**：
- 分类标签切换栏
- 资料卡片列表
- 每个卡片：标题 + 描述 + 类型图标 + 外链箭头图标
- 置顶资料高亮显示（边框或背景色区分）
- 点击卡片 → `window.open(url, '_blank')` 新窗口打开

**类型图标映射**：
- feishu_doc → 飞书图标
- tencent_doc → 腾讯文档图标
- questionnaire → 问卷图标
- video → 播放图标
- other → 链接图标

**管理后台新增**：
- `frontend/src/app/admin/resources/page.tsx` — 资料管理

---

## Phase 5：增强 Onboarding

### 目标
将现有 2 步问卷扩展为 4 步，收集更完整的家庭画像数据，为 AI 个性化服务提供上下文。

### 后端改动

**修改文件**：`backend/app/models/models.py`（或新建 `parent_profile.py`）

**新增数据模型**：
```python
# ParentProfile - 家长档案（新表）
- id, family_id (FK → Family)
- occupation (职业)
- education_background (学历背景)
- education_philosophy (教育理念，开放文本)
- communication_style: enum("democratic", "authoritative", "permissive")
- parent_child_quality: enum("excellent", "good", "average", "needs_improvement")
- education_concerns (最大教育困惑，开放文本)
- created_at, updated_at
```

**扩展 ChildProfile 字段**：
```python
# 在现有 ChildProfile 模型中新增：
- subject_strengths (学科优势，JSON array)
- subject_weaknesses (学科弱项，JSON array)
- learning_style: enum("visual", "auditory", "kinesthetic", "reading")
- daily_study_hours (每日学习时长，float)
- short_term_goals (短期目标，text)
- long_term_goals (长期规划，text)
```

**新增 API 端点**：
```
POST /api/families/parent-profile     — 创建/更新家长档案
GET  /api/families/parent-profile     — 获取家长档案
PUT  /api/families/children/{id}/extended — 更新孩子扩展信息
```

### 前端改动

**修改文件**：`frontend/src/app/onboarding/page.tsx`

**从 2 步改为 4 步**：
- 步骤 1：家庭基本信息（现有，保持不变）
- 步骤 2：孩子信息（现有 + 新增字段：学科强弱项、学习风格、每日学习时长）
- 步骤 3：家长信息（全新：职业、学历、教育理念、沟通风格）
- 步骤 4：目标与关系（全新：短期目标、长期规划、亲子关系质量、最大困惑）

**UI 要素**：
- 顶部步骤指示器（1/4, 2/4, 3/4, 4/4）
- 每步有"跳过"按钮（非必填项可跳过）
- 表单验证（必填项标注星号）
- 提交后跳转首页

---

## Phase 6：首页重设计

### 目标
首页从单纯的 AI 智能体入口，变为社区门户——展示课程推荐、精选文章、快捷入口。

### 前端改动

**修改文件**：`frontend/src/app/page.tsx`

**新布局（从上到下）**：

1. **品牌 Banner**
   - 暖金色渐变背景（`bg-gradient-to-br from-[#C4A77D] to-[#8B7355]`）
   - 圆角底部（`rounded-b-3xl`）
   - 标题："AI 家庭成长社区"（白色大字）
   - 副标题：一句话价值主张
   - 两个小标签（"4位AI导师" "持续更新"）

2. **AI 智能体入口**（保留现有 4 个 Agent）
   - 2x2 网格布局
   - 卡片改为 APEF 风格（暖色调背景、rounded-2xl、shadow-sm）

3. **最新课程推荐**
   - 区域标题："最新课程" + "查看全部"链接
   - 横向滚动容器（`overflow-x-auto flex gap-4`）
   - 3-4 个课程卡片（封面缩略图 + 标题 + 分类标签）
   - 数据来源：`GET /api/courses?size=4&sort=newest`

4. **精选文章**
   - 区域标题："深度阅读" + "查看全部"链接
   - 2-3 篇文章卡片（竖向排列）
   - 每卡片：标题 + 摘要（2行截断）+ 标签
   - 数据来源：`GET /api/articles/featured`

5. **快捷入口**
   - 三个按钮/卡片横排
   - 预约专家咨询 → `/booking`
   - 成长报告 → `/reports`
   - 订阅套餐 → `/subscribe`

---

## Phase 7：Profile 增强

### 目标
在个人中心增加学习进度展示和档案完善度，引导用户补充信息。

### 前端改动

**修改文件**：`frontend/src/app/profile/page.tsx`

**新增区域**：
1. **档案完善度**
   - 环形进度条或进度条
   - 显示百分比（如"60%"）
   - 计算逻辑：已填字段数 / 总字段数
   - "去完善"按钮 → 跳转 `/onboarding?step=3`（从第3步开始）

2. **我的学习进度**
   - 已完成课程数 / 总课程数
   - 最近学习的课程（1-2个）
   - "查看全部"→ 跳转 `/courses`

3. **完善家庭档案入口**
   - 卡片式入口
   - 跳转到 Onboarding 的第 3/4 步

---

## Phase 8：飞书集成

### 目标
管理员可以输入飞书文档 ID，一键将文档内容同步为平台课程或文章，减少手动录入。

### 后端改动

**新建文件**：
- `backend/app/services/feishu_service.py` — 飞书 API 封装
- `backend/app/routers/feishu.py` — 飞书同步路由

**新增数据模型**：
```python
# FeishuSyncLog - 同步记录
- id, doc_id, doc_type: enum("course", "article")
- target_id (同步到的课程/文章 ID)
- sync_status: enum("success", "failed", "pending")
- last_synced_at
- error_message
- created_at
```

**飞书 API 调用流程**：
1. 获取 tenant_access_token（用 APP_ID + APP_SECRET）
2. 调用 `GET /open-apis/docx/v1/documents/{document_id}/blocks` 获取文档内容
3. 将 Block 结构转换为 Markdown
4. 存入 Course.content_markdown 或 Article.content_markdown
5. 记录同步日志

**API 端点**：
```
POST /api/admin/feishu/sync          — 触发同步（参数：doc_id, target_type, target_id）
GET  /api/admin/feishu/sync-logs     — 同步日志列表
```

**环境变量**：
```
FEISHU_APP_ID=xxx
FEISHU_APP_SECRET=xxx
```

### 前端改动

**管理后台新增**：
- 课程编辑页增加"从飞书同步"按钮
- 文章编辑页增加"从飞书同步"按钮
- 输入飞书文档 URL 或 ID → 点击同步 → 内容自动填充
- 同步日志页面（可选）

---

## Phase 9：用户分层与权限系统

### 目标
实现免费层/试用期/付费会员三级权限，让未付费用户也能体验产品价值，同时保护付费内容。

### 后端改动

**修改文件**：`backend/app/models/models.py`（User 模型扩展）

**User 模型新增字段**：
```python
- membership_tier: enum("free", "trial", "premium")  # 当前会员等级
- trial_started_at: datetime (试用开始时间)
- trial_days: int (试用天数，默认3)
- subscription_expires_at: datetime (付费到期时间)
- daily_chat_count: int (当日对话次数，每日重置)
- daily_chat_limit: int (每日对话上限，免费层=3，付费=无限)
```

**Course / Article 模型新增字段**：
```python
- is_free: bool (是否免费可见，默认 False)
```

**新增中间件/依赖**：
- 权限检查中间件：根据用户 tier 判断是否可访问
- 试用期自动过期逻辑：`trial_started_at + trial_days` 超过当前时间则降级为 free
- 对话次数限制：免费用户每天 3 次，超出返回 403 + 升级提示

**新增 API**：
```
GET  /api/user/membership        — 获取当前会员状态（tier、剩余试用天数、对话剩余次数）
POST /api/user/activate-trial    — 激活试用（注册后自动调用）
```

### 前端改动

**新增组件**：
- `frontend/src/components/PaywallModal.tsx` — 付费墙弹窗（"升级会员解锁全部内容"）
- `frontend/src/components/TrialBanner.tsx` — 试用期提示条（"试用还剩 X 天"）

**改动逻辑**：
- 课程/文章列表：非免费内容显示锁定图标，点击弹出付费墙
- 对话页面：达到每日上限后显示"今日对话次数已用完，升级解锁无限对话"
- 首页/Profile：显示当前会员状态和试用倒计时

---

## Phase 10：创始人与团队展示

### 目标
在产品中体现 K 博士和 Bing Dad 的存在感，建立品牌信任。

### 前端改动

**1. 首页创始人寄语区域**

在首页 Banner 下方或底部快捷入口之后，新增：
- 创始人头像（圆形）+ 姓名
- 一段品牌寄语（如"让每个家庭都能用 AI 支持孩子成长"）
- "了解更多"链接 → 跳转团队介绍页

**2. 团队介绍页** `/about`

新建页面：
- 品牌故事（简短）
- 创始人介绍卡片（K 博士、Bing Dad）
  - 头像、姓名、title、简介
  - 教育理念金句
- 核心团队成员（可选，后续扩展）

**3. 内容推荐标签**

Course 和 Article 模型新增字段：
```python
- recommended_by: str (可选，如"K博士推荐"、"Bing Dad 推荐")
```

前端课程/文章卡片上显示推荐标签（暖金色小标签）。

**4. AI 对话融入理念**

修改 4 位 AI 智能体的系统 prompt，加入：
- 核心教育理念："能学、会玩、做自己"
- K 博士和 Bing Dad 的教育方法论
- 在适当时机引用创始人观点

**5. Logo 预留**

- 导航栏左侧预留 Logo 位置（当前用文字"AI 家庭成长"占位）
- 后续收到 Logo 文件后替换

---

## Phase 11：全站走查

### 目标
确保所有页面风格统一，交互流畅，权限逻辑正确。

### 检查清单
- [ ] 所有页面使用暖金色系（亮色+暗色模式）
- [ ] 所有卡片 rounded-2xl + shadow-sm
- [ ] 所有布局 max-w-2xl mx-auto
- [ ] 底部导航 5 tab 正确高亮
- [ ] 无 Framer Motion 残留
- [ ] 移动端适配正常
- [ ] 课程/文章/资料的 CRUD 流程完整
- [ ] Onboarding 4 步流程顺畅
- [ ] 首页数据正确加载
- [ ] Profile 档案完善度计算正确
- [ ] 免费用户权限限制生效
- [ ] 试用期倒计时正确
- [ ] 付费墙弹窗正常触发
- [ ] 创始人/团队页面展示正常
- [ ] Logo 位置预留正确

---

## 文件变更总览

| 文件 | 操作 | Phase |
|------|------|-------|
| `frontend/src/app/globals.css` | 重写色彩变量（亮色+暗色） | 1 |
| `frontend/src/components/BottomNav.tsx` | 改为 5 tab | 1 |
| `frontend/src/app/page.tsx` | 首页重设计 | 6 |
| `frontend/src/app/courses/page.tsx` | 新建 | 2 |
| `frontend/src/app/courses/[id]/page.tsx` | 新建 | 2 |
| `frontend/src/app/reading/page.tsx` | 新建 | 3 |
| `frontend/src/app/reading/[id]/page.tsx` | 新建 | 3 |
| `frontend/src/app/resources/page.tsx` | 新建 | 4 |
| `frontend/src/app/onboarding/page.tsx` | 重构为 4 步 | 5 |
| `frontend/src/app/profile/page.tsx` | 增加入口 | 7 |
| `frontend/src/app/about/page.tsx` | 新建（团队介绍） | 10 |
| `frontend/src/app/admin/courses/page.tsx` | 新建 | 2 |
| `frontend/src/app/admin/articles/page.tsx` | 新建 | 3 |
| `frontend/src/app/admin/resources/page.tsx` | 新建 | 4 |
| `frontend/src/components/PaywallModal.tsx` | 新建（付费墙） | 9 |
| `frontend/src/components/TrialBanner.tsx` | 新建（试用提示） | 9 |
| `frontend/src/lib/api.ts` | 新增 API 方法 | 2-4, 9 |
| `backend/app/models/course.py` | 新建 | 2 |
| `backend/app/models/article.py` | 新建 | 3 |
| `backend/app/models/resource.py` | 新建 | 4 |
| `backend/app/models/models.py` | 扩展 User/ChildProfile + ParentProfile | 5, 9 |
| `backend/app/routers/course.py` | 新建 | 2 |
| `backend/app/routers/article.py` | 新建 | 3 |
| `backend/app/routers/resource.py` | 新建 | 4 |
| `backend/app/routers/membership.py` | 新建（会员权限） | 9 |
| `backend/app/services/feishu_service.py` | 新建 | 8 |
| `backend/app/routers/feishu.py` | 新建 | 8 |
| `backend/app/middleware/permission.py` | 新建（权限中间件） | 9 |
| `backend/app/main.py` | 注册新路由 | 2-4, 8-9 |
| `frontend/package.json` | 新增 react-markdown 等依赖 | 3 |
| `.env` | 新增 FEISHU_APP_ID/SECRET | 8 |

---

## 验证方式

每个 Phase 完成后：
1. `docker compose up --build` 重启验证
2. 浏览器验证页面渲染和交互
3. `curl` 验证 API 返回正确数据
4. 管理后台录入测试数据
5. `git commit` 保存进度
