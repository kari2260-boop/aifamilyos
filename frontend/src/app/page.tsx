"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { api } from "@/lib/api";

const agents = [
  {
    name: "学学",
    role: "学习策略师",
    description: "自己走过厌学，最懂「努力了没用」的感觉",
    avatar: "/agents/xuexue.png",
    agentType: "xuexue",
  },
  {
    name: "创创",
    role: "创造引导师",
    description: "从小被说不务正业，现在帮孩子找到眼睛发光的事",
    avatar: "/agents/chuangchuang.png",
    agentType: "chuangchuang",
  },
  {
    name: "探探",
    role: "天赋发现师",
    description: "说话不多，但每次开口都让人觉得「被看见了」",
    avatar: "/agents/tantan.png",
    agentType: "tantan",
  },
  {
    name: "伴伴",
    role: "成长陪伴师",
    description: "两个孩子的妈妈，深夜崩溃过，也走过来了",
    avatar: "/agents/banban.png",
    agentType: "banban",
  },
];

export default function Home() {
  const [courses, setCourses] = useState<Array<{id: string; title: string; category?: string}>>([]);
  const [articles, setArticles] = useState<Array<{id: string; title: string; summary?: string; author?: string}>>([]);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);

  useEffect(() => {
    api.request("/courses?size=6").then(data => setCourses(Array.isArray(data) ? data : [])).catch(() => {});
    api.request("/articles?size=5").then(data => setArticles(Array.isArray(data) ? data : [])).catch(() => {});
    // 检查套餐是否即将到期（3天内）
    api.request("/subscription/current").then((sub: {expires_at?: string | null; plan?: string}) => {
      if (sub.expires_at && sub.plan && sub.plan !== "free") {
        const diff = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 3) setExpiryDays(diff);
      }
    }).catch(() => {});
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-24">
        {/* 到期提醒条 */}
        {expiryDays !== null && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm text-amber-800">
              {expiryDays === 0 ? "⚠️ 您的套餐今天到期" : `⚠️ 您的套餐还有 ${expiryDays} 天到期`}，续费后继续使用
            </span>
            <Link href="/subscribe" className="text-xs font-medium text-amber-700 underline shrink-0 ml-2">
              立即续费
            </Link>
          </div>
        )}
        {/* Banner */}
        <BlurFade delay={0.05}>
          <div className="bg-gradient-to-br from-primary to-[#8B7355] px-6 pt-14 pb-10 rounded-b-3xl">
            <h1 className="text-2xl font-bold text-white">AI 家庭成长社区</h1>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              为孩子匹配专属成长伙伴，用 AI 陪伴每一步成长
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white">
                4位AI导师
              </span>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white">
                持续更新
              </span>
            </div>
          </div>
        </BlurFade>

        <div className="max-w-2xl mx-auto px-4">
          {/* AI 智能体入口 */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {agents.map((agent, i) => (
              <BlurFade key={agent.agentType} delay={0.1 + i * 0.06}>
                <Link href={`/chat/${agent.agentType}`}>
                  <div className="bg-card rounded-2xl shadow-sm p-4 transition-all hover:shadow-md active:scale-[0.97]">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="mb-2 h-14 w-14 rounded-full border border-primary/20 object-cover shadow-sm"
                    />
                    <h3 className="font-semibold text-foreground text-sm">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </Link>
              </BlurFade>
            ))}
          </div>

          {/* 最新课程 */}
          <BlurFade delay={0.35}>
            <Link href="/assessment">
              <div className="mt-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md active:scale-[0.98] transition-all">
                <div className="text-2xl">📋</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">成长测评</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">了解孩子的学习风格、性格和兴趣方向</p>
                </div>
                <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">去测评</span>
              </div>
            </Link>
          </BlurFade>

          {/* 最新课程 */}
          <BlurFade delay={0.4}>
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground">最新课程</h2>
                <Link href="/courses" className="text-xs text-primary">查看全部</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {courses.length > 0 ? courses.map((c) => (
                  <Link key={c.id} href={`/courses/${c.id}`} className="flex-shrink-0 w-44">
                    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
                      <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-3xl opacity-50">📖</span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-foreground line-clamp-2">{c.title}</p>
                        <span className="text-[10px] text-muted-foreground mt-1 inline-block">{c.category || "课程"}</span>
                      </div>
                    </div>
                  </Link>
                )) : (
                  <Link href="/courses" className="flex-shrink-0 w-44">
                    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
                      <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-3xl opacity-50">📖</span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-foreground line-clamp-2">课程即将上线</p>
                        <span className="text-[10px] text-muted-foreground mt-1 inline-block">敬请期待</span>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </BlurFade>

          {/* 深度阅读 */}
          <BlurFade delay={0.5}>
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground">深度阅读</h2>
                <Link href="/reading" className="text-xs text-primary">查看全部</Link>
              </div>
              <div className="space-y-3">
                {articles.length > 0 ? articles.map((a) => (
                  <Link key={a.id} href={`/reading/${a.id}`}>
                    <div className="bg-card rounded-2xl shadow-sm p-4 transition-all hover:shadow-md">
                      <p className="font-medium text-foreground text-sm">{a.title}</p>
                      {a.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</p>}
                      {a.author && <p className="text-xs text-muted-foreground/70 mt-1">{a.author}</p>}
                    </div>
                  </Link>
                )) : (
                  <div className="bg-card rounded-2xl shadow-sm p-4">
                    <p className="font-medium text-foreground text-sm">精选文章即将上线</p>
                    <p className="text-xs text-muted-foreground mt-1">帮你建立 AI 时代的教育认知</p>
                  </div>
                )}
              </div>
            </div>
          </BlurFade>

          {/* 快捷入口 */}
          <BlurFade delay={0.6}>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Link href="/booking">
                <div className="bg-card rounded-2xl shadow-sm p-4 text-center transition-all hover:shadow-md">
                  <span className="text-2xl">📅</span>
                  <p className="text-xs font-medium text-foreground mt-2">预约咨询</p>
                </div>
              </Link>
              <Link href="/reports">
                <div className="bg-card rounded-2xl shadow-sm p-4 text-center transition-all hover:shadow-md">
                  <span className="text-2xl">🌱</span>
                  <p className="text-xs font-medium text-foreground mt-2">成长报告</p>
                </div>
              </Link>
              <Link href="/subscribe">
                <div className="bg-card rounded-2xl shadow-sm p-4 text-center transition-all hover:shadow-md">
                  <span className="text-2xl">⭐</span>
                  <p className="text-xs font-medium text-foreground mt-2">订阅套餐</p>
                </div>
              </Link>
            </div>
          </BlurFade>
        </div>
      </div>
    </AuthGuard>
  );
}
