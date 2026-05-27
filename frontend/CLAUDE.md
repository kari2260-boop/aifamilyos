# AI 家庭教育大脑 — 前端开发指南

## 技术栈
- Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- 手机端优先设计（max-w-md mx-auto）

## 关键约定
- 聊天详情页（/chat/*）隐藏底部导航栏（LayoutShell.tsx 中配置）
- API客户端统一在 src/lib/api.ts
- 认证使用 JWT，AuthGuard 组件包裹需登录页面
- 管理后台路由 /admin/*，需 role=admin

## 主规划文档
`~/Desktop/AI_Family_OS_Code_Ready_Docs/14_EXECUTION_PLAN_FINAL.md`
