# AI 家庭成长 OS — 完整产品需求文档 v3

> **定位**：产品规格文档，定义用户分层、权益体系、页面结构和数据模型。
> **主规划文档**：`~/Desktop/AI_Family_OS_Code_Ready_Docs/14_EXECUTION_PLAN_FINAL.md`（功能优先级、开发阶段、成本以主文档为准）

---

## 〇、产品背景与商业定位

### 所属产品体系

本平台是 **「AI 未来领航者·AI 智能家庭赋能计划」（9800 元/年）** 的核心数字化交付载体。

### 服务对象

- 8-18 岁孩子的高认知家庭（企业家、高管、创业者）
- 当前规模：200 组家庭
- 目标规模：2000 组家庭
- 付费制私域社区，非公开平台

### 平台在产品体系中承载的权益

| 年度权益 | 平台承载方式 |
|----------|-------------|
| 权益 5：龙虾 AI 天团（4个AI智能体全年陪伴） | 对话模块 `/chat` |
| 权益 7：智慧父母线上课（12节直播+知识库） | 课程模块 `/courses` |
| 权益 10：家庭成长知识库（全年沉淀档案） | 数据沉淀（成长档案、对话记录、学习进度） |
| 权益 8：AI 家庭成长社群资料 | 资料库模块 `/resources` |
| 权益 4：AI 成长建议书 | Onboarding 数据 + 成长报告 `/reports` |
| 权益 3：1v1 家庭战略咨询 | 预约模块 `/booking` |
| 权益 6：真人顾问咨询 | 预约模块 `/booking` |
| 权益 9：月度专家分享 | 课程模块（直播回放） |

### 核心数据沉淀目标

平台的长期价值在于为每个家庭积累私有数据资产：
- 家庭画像（孩子特征、家长信息、教育目标）
- AI 对话记录（学习辅导、创意激发、情感陪伴的完整历史）
- 学习进度（课程完成情况、知识掌握轨迹）
- 成长档案（月度简报、年度总结、作品集）

这些数据存储在私有数据库中，随着使用不断丰富，成为 AI 个性化服务的基础。

---

## 一、产品完成后的全貌

### 一句话描述

一个面向付费家庭的 AI 驱动教育社区平台——有 AI 导师随时对话、有课程可以跟学、有深度文章可以阅读、有社群资料可以查阅，平台越用越懂你的家庭。

### 用户完整体验流程

**首次使用（Onboarding 4 步问卷）**：
1. 家庭基本信息（名称、城市）
2. 孩子信息（姓名、年龄、年级、兴趣、学科强弱项、学习风格、每日学习时长）
3. 家长信息（职业、学历、教育理念、沟通风格）
4. 目标与关系（短期目标、长期规划、亲子关系质量、最大困惑）

所有信息作为 AI 对话上下文，让 4 位 AI 导师真正"懂"这个家庭。

**日常使用（5 个 Tab）**：

| Tab | 路径 | 功能 |
|-----|------|------|
| 首页 | `/` | 社区门户：品牌 Banner + AI 智能体入口 + 最新课程 + 精选文章 + 快捷入口 |
| 共学 | `/courses` | 课程中心：学习路径 + 分类课程 + 进度追踪（视频跳小鹅通，长文平台内阅读） |
| 对话 | `/chat` | AI 智能体对话：学学/创创/探探/伴伴，结合家庭画像个性化回答 |
| 资料 | `/resources` | 社群资料库：飞书/腾讯文档/问卷/视频等外链整合，分类展示 |
| 我的 | `/profile` | 个人中心：家庭档案 + 学习进度 + 档案完善度 + 预约记录 |

**管理后台**：
- 课程管理（CRUD、分类、排序、发布/下架）
- 文章管理（CRUD、标签、精选标记）
- 资料库管理（添加外链、分类、置顶）
- 飞书文档一键同步（输入文档 ID → 拉取转 Markdown → 存入数据库）
- 同步日志查看
- 已有功能：仪表板、预约管理、专家管理、对话监控、家庭管理、知识库、风险预警、统计

### 设计风格（全站统一）

对标 APEF 官网：暖金色主色、米色背景、窄版居中、大留白、大圆角、轻柔阴影。
支持亮色/暗色两种模式（暗色模式为暖金暗色调，非纯黑）。
整体气质：温暖、专业、有品质感，像一个有温度的私域社区，不像冰冷的工具 App。
Logo：后续由创始人提供，预留 Logo 位置。

### 创始人与团队展示

**创始人**：K 博士、Bing Dad

**在产品中的体现方式**：
1. **创始人/团队介绍区域** — 首页或"关于"页面展示创始人头像、简介、教育理念
2. **品牌寄语/欢迎语** — 首次进入或 Banner 区域展示创始人寄语
3. **AI 对话中融入理念** — 4 位 AI 智能体的系统 prompt 中融入创始人教育理念（"能学、会玩、做自己"）
4. **内容推荐标签** — 课程/文章可标注"K博士推荐""Bing Dad 推荐"
5. **团队介绍页** — 展示核心团队成员、背景、理念

### 用户分层与权限设计

产品支持三种用户层级：

| 层级 | 获取方式 | AI 对话 | 课程 | 文章 | 资料库 | 其他功能 |
|------|----------|---------|------|------|--------|----------|
| 免费层 | 注册即可 | 每天 3 次 | 部分免费课程 | 部分免费文章 | 不可用 | 首页浏览、创始人介绍 |
| 试用期 | 注册后自动获得 3 天 | 无限制 | 全部 | 全部 | 全部 | 全功能体验 |
| 付费会员 | 购买年度套餐（9800元）或单独订阅 | 无限制 | 全部 | 全部 | 全部 | 全功能 + 专属服务 |

**关键设计点**：
- 免费用户可以浏览首页、查看部分内容，感受产品价值
- 注册后自动获得 3 天全功能试用，降低决策门槛
- 试用到期后降级为免费层，引导付费
- 付费方式：既可以作为 9800 元年度产品的配套交付，也可以单独订阅购买
- 后台可配置：哪些课程/文章免费、试用天数、每日对话次数限制

---

## 二、产品定位

对标 APEF（父母基本功·湾区论坛），打造 **AI 驱动的家庭教育社区平台**。
核心差异化：4 位 AI 智能体 + 课程共学 + 深度阅读 + 社群资料库 + 增强家庭画像。

设计风格：完全对标 APEF 暖金色系（#C4A77D），米色背景，窄版居中布局，大留白。

---

## 一、设计系统（对标 APEF）

### 配色方案

| 用途 | 色值 | 说明 |
|------|------|------|
| 背景 | #FAF9F7 | 暖白/米色 |
| 主色 | #C4A77D | 暖金色 |
| 主色深 | #8B7355 | 深棕（渐变用） |
| 正文 | #1a2d42 | 深蓝灰 |
| 次要文字 | #8B7355 | 棕色 |
| 弱文字 | #BFB8AD | 浅灰棕 |
| 边框 | #E8E4DF | 浅米灰 |
| 卡片背景 | #F5F2EF | 浅暖灰 |

### 排版规范

- 布局宽度：`max-w-2xl mx-auto`（移动优先窄版）
- 卡片圆角：`rounded-2xl`
- 阴影：`shadow-sm`（轻柔）
- 字体：Inter + system-ui（中文回退 Noto Sans SC）
- 动画：纯 CSS transition，不用 Framer Motion
- 间距：大留白，呼吸感强

---

## 二、导航结构（5 Tab）

```
首页(/) | 共学(/courses) | 对话(/chat) | 资料(/resources) | 我的(/profile)
```

---

## 三、页面需求详细描述

### 3.1 首页 `/` — 社区门户

**布局**（从上到下）：

1. **品牌 Banner**
   - 标题："AI 家庭成长社区"
   - 副标题：一句话价值主张
   - 暖金色渐变背景，圆角底部
   - 两个小标签（如"4位AI导师" "持续更新"）

2. **AI 智能体入口**（保留现有 4 个 Agent 卡片）
   - 2x2 网格
   - 卡片样式改为 APEF 风格（暖色调、rounded-2xl）

3. **最新课程推荐**
   - 标题："最新课程"
   - 横向滚动卡片（3-4 个）
   - 每个卡片：封面缩略图 + 标题 + 分类标签

4. **精选文章**
   - 标题："深度阅读"
   - 2-3 篇文章卡片（竖向排列）
   - 每个卡片：标题 + 摘要 + 标签

5. **快捷入口**
   - 预约专家咨询
   - 成长报告
   - 订阅套餐

---

### 3.2 课程共学 `/courses` — 对标 apef.site/courses

**页面结构**：

1. **顶部 Banner**
   - 当前主推课程/季度主题
   - 标题 + 副标题 + 标签
   - 暖金色渐变背景

2. **学习路径选择**（可选区域）
   - 两条路径可选（如"通识路径" / "学科路径"）
   - 每条路径：线性节点列表，带完成状态圆圈
   - 节点点击跳转对应课程

3. **分类内容区**
   - 分类标签切换（家庭教育 / AI科技 / 学科学习 / 父母成长 / 教育规划 / 人性洞察）
   - 每个分类下 2-3 个课程卡片
   - 卡片信息：标题、简介、标签、类型图标（视频/长文）
   - 视频类型：点击跳转小鹅通
   - 长文类型：点击进入平台内阅读

**课程详情 `/courses/[id]`**：
- 课程标题 + 描述
- 封面图
- 标签
- "开始学习"按钮（视频→跳转小鹅通，文章→进入阅读）
- 学习进度状态

---

### 3.3 深度阅读 `/reading` — 对标 apef.site/reading

**文章列表页**：
- 卡片式展示
- 每个卡片：封面 + 标题 + 摘要 + 作者 + 日期 + 标签
- 支持分类筛选

**文章详情 `/reading/[id]`**：
- 标题 + 作者 + 日期
- Markdown 渲染正文
- 右侧/顶部目录导航（TOC）
- 阅读进度条
- 底部"相关文章"推荐

---

### 3.4 资料库 `/resources` — 社群资料整合

**页面结构**：
- 分类标签切换
- 资料卡片列表
- 每个卡片：标题 + 描述 + 类型图标 + 外链箭头
- 置顶资料高亮显示

**资料类型**：
- 飞书文档（图标：飞书 logo）
- 腾讯文档（图标：腾讯文档 logo）
- 问卷调查（图标：问卷）
- 视频课程（图标：播放）
- 其他链接

点击卡片 → 新窗口打开外链

---

### 3.5 增强版 Onboarding `/onboarding` — 4 步问卷

**第 1 步：家庭基本信息**（现有）
- 家庭名称
- 所在城市

**第 2 步：孩子信息**（现有 + 扩展）
- 姓名、年龄、年级
- 兴趣爱好
- 学科优势 / 学科弱项（新增）
- 学习风格偏好：视觉型/听觉型/动手型/阅读型（新增）
- 每日学习时长（新增）

**第 3 步：家长信息**（新增）
- 职业
- 学历背景
- 教育理念（开放文本）
- 沟通风格：民主型/权威型/放任型

**第 4 步：目标与关系**（新增）
- 短期目标（本学期想达成什么）
- 长期规划（教育方向/升学目标）
- 亲子关系质量：很好/良好/一般/需改善
- 当前最大的教育困惑（开放文本）

**特点**：
- 步骤指示器（1/4, 2/4...）
- 可跳过非必填项
- 注册后可在 Profile 页面随时补充/修改
- 所有信息作为 AI 对话的上下文，提升个性化程度

---

### 3.6 我的 `/profile` — 增加入口

在现有基础上新增：
- "完善家庭档案"入口（跳转问卷的第 3/4 步）
- "我的学习进度"入口（展示课程完成情况）
- 问卷完成度指示（如"档案完善度 60%"）

---

## 四、数据模型新增

### 课程相关

```
CourseCategory   分类（name, slug, sort_order）
Course           课程（title, description, cover_url, category_id, content_type[video/article], external_url, content_markdown, tags[], feishu_doc_id, is_published, sort_order）
LearningPath     学习路径（title, description, category_id）
LearningPathNode 路径节点（path_id, course_id, node_order, is_milestone）
UserCourseProgress 学习进度（user_id, course_id, status[not_started/in_progress/completed], progress_percent）
```

### 文章

```
Article          文章（title, summary, content_markdown, cover_url, author, category, tags[], feishu_doc_id, is_published, view_count, published_at）
```

### 资料库

```
Resource         资料（title, description, url, resource_type[feishu_doc/tencent_doc/questionnaire/video/other], category, is_pinned, sort_order）
```

### 家庭档案扩展

```
ParentProfile    家长档案（family_id, occupation, education_background, education_philosophy, communication_style, parent_child_quality, education_concerns）

ChildProfile 扩展字段：subject_strengths, subject_weaknesses, learning_style, daily_study_hours, short_term_goals, long_term_goals
```

### 飞书同步

```
FeishuSyncLog    同步记录（doc_id, doc_type[course/article], target_id, sync_status, last_synced_at, error_message）
```

---

## 五、飞书 API 集成

### 接入方式
- 飞书开放平台自建应用
- 认证：tenant_access_token（应用级别）
- 权限：docx:document:readonly

### 核心流程
1. 管理后台输入飞书文档 URL/ID
2. 后端调用飞书 API 获取文档内容（Block 结构）
3. 转换为 Markdown 格式
4. 存入 Course 或 Article 表
5. 记录同步日志

### 配置项
```
FEISHU_APP_ID=xxx
FEISHU_APP_SECRET=xxx
```

### 同步策略
- MVP：管理后台手动触发同步
- 后续：定时自动同步（检测文档更新）

---

## 六、API 端点汇总

### 课程 `/api/courses`
- GET /courses — 列表（?category=&type=）
- GET /courses/{id} — 详情
- GET /courses/categories — 分类列表
- GET /courses/paths — 学习路径列表
- GET /courses/paths/{id} — 路径详情（含节点+进度）
- POST /courses/{id}/progress — 更新进度
- Admin CRUD: POST/PUT/DELETE /admin/courses

### 文章 `/api/articles`
- GET /articles — 列表（?category=&tag=）
- GET /articles/{id} — 详情
- GET /articles/featured — 精选
- Admin CRUD: POST/PUT/DELETE /admin/articles

### 资料 `/api/resources`
- GET /resources — 列表（?category=&type=）
- Admin CRUD: POST/PUT/DELETE /admin/resources

### 家庭扩展 `/api/families`
- POST /families/parent-profile — 创建/更新家长档案
- GET /families/parent-profile — 获取
- PUT /families/children/{id}/extended — 更新孩子扩展信息

### 飞书 `/api/admin/feishu`
- POST /admin/feishu/sync — 触发同步
- GET /admin/feishu/sync-logs — 同步日志

---

## 七、开发顺序

```
Phase 1: 设计系统迁移（2天）
  ├── globals.css 色彩变量替换
  ├── BottomNav 改为 5 tab
  ├── 数据库新表创建
  └── 后端 models + schemas

Phase 2: 课程模块（3-4天）
  ├── 课程 API（CRUD + 列表 + 进度）
  ├── 前端课程列表页
  ├── 前端课程详情页
  ├── 学习路径页面
  └── 管理后台课程管理

Phase 3: 文章模块（2天）
  ├── 文章 API
  ├── 前端文章列表页
  ├── 前端文章详情（Markdown 渲染）
  └── 管理后台文章管理

Phase 4: 资料库（1-2天）
  ├── 资料 API
  ├── 前端资料库页面
  └── 管理后台资料管理

Phase 5: 增强问卷（2天）
  ├── parent_profiles 表 + children 扩展
  ├── 家长档案 API
  ├── 前端 4 步问卷重构
  └── Profile 页增加入口

Phase 6: 首页重设计（1-2天）
  ├── 首页组件拆分重构
  ├── 最新课程横向滚动
  └── 精选文章区域

Phase 7: 飞书集成（2-3天）
  ├── feishu_service 实现
  ├── 文档转 Markdown 逻辑
  ├── 同步 API
  └── 管理后台同步界面

Phase 8: 全站走查（1天）
  └── 确保所有页面 APEF 风格一致
```

**总工期：约 14-18 天**

---

## 八、前端新增依赖

```
react-markdown    Markdown 渲染
remark-gfm        GFM 支持（表格、删除线等）
rehype-slug       标题锚点
rehype-autolink-headings  标题自动链接
```

---

## 九、关键文件清单

| 文件 | 操作 |
|------|------|
| `frontend/src/app/globals.css` | 重写色彩变量 |
| `frontend/src/components/BottomNav.tsx` | 改为 5 tab |
| `frontend/src/app/page.tsx` | 首页重设计 |
| `frontend/src/app/courses/page.tsx` | 新建 |
| `frontend/src/app/courses/[id]/page.tsx` | 新建 |
| `frontend/src/app/reading/page.tsx` | 新建 |
| `frontend/src/app/reading/[id]/page.tsx` | 新建 |
| `frontend/src/app/resources/page.tsx` | 新建 |
| `frontend/src/app/onboarding/page.tsx` | 重构为 4 步 |
| `frontend/src/app/profile/page.tsx` | 增加入口 |
| `frontend/src/lib/api.ts` | 新增所有 API 方法 |
| `backend/app/models/models.py` | 新增 6 个模型 |
| `backend/app/routers/course.py` | 新建 |
| `backend/app/routers/article.py` | 新建 |
| `backend/app/routers/resource.py` | 新建 |
| `backend/app/services/feishu_service.py` | 新建 |
| `backend/app/main.py` | 注册新路由 |
| `.env` | 新增 FEISHU_APP_ID/SECRET |

---

## 十、验证方式

每个 Phase 完成后：
1. Docker compose 重启验证
2. 浏览器验证页面渲染和交互
3. curl 验证 API 返回
4. 管理后台录入测试数据
5. git commit 保存
