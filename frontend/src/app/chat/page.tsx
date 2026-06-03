"use client";

import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

const agents = [
  { name: "学学", role: "学习策略师", gradient: "from-blue-500 to-indigo-600", avatar: "/agents/xuexue.png", agentType: "xuexue" },
  { name: "创创", role: "创造引导师", gradient: "from-emerald-500 to-teal-600", avatar: "/agents/chuangchuang.png", agentType: "chuangchuang" },
  { name: "探探", role: "天赋测评师", gradient: "from-violet-500 to-purple-600", avatar: "/agents/tantan.png", agentType: "tantan" },
  { name: "伴伴", role: "成长陪伴师", gradient: "from-amber-500 to-orange-600", avatar: "/agents/banban.png", agentType: "banban" },
  { name: "刷刷", role: "真题训练与错题复盘", gradient: "from-rose-500 to-pink-600", avatar: "/agents/shuashua.png", agentType: "shuashua" },
];

export default function ChatListPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="px-5 pt-12 pb-4">
          <h1 className="text-lg font-bold text-foreground">对话</h1>
          <p className="text-sm text-muted-foreground mt-1">选择一位 AI 导师开始对话</p>
        </div>

        <div className="px-4 space-y-3">
          {agents.map((agent, i) => (
            <BlurFade key={agent.agentType} delay={0.1 + i * 0.06}>
              <Link href={`/chat/${agent.agentType}`}>
                <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 active:scale-[0.98]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${agent.gradient} p-0.5 shadow-sm`}>
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="h-full w-full rounded-[14px] object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground">{agent.role}</p>
                    </div>
                    <span className="text-muted-foreground/40 text-xl">›</span>
                  </CardContent>
                </Card>
              </Link>
            </BlurFade>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
