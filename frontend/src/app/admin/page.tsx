"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Stats {
  total_families: number;
  total_conversations: number;
  today_conversations: number;
  risk_flags_unhandled: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminStats()
      .then(setStats)
      .catch((e: Error) => {
        if (e.message.includes("403") || e.message.includes("权限")) {
          router.push("/");
        } else {
          setError(e.message);
        }
      });
  }, [router]);

  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  const navItems = [
    { href: "/admin/prompts", label: "Prompt 管理", icon: "🧠" },
    { href: "/admin/courses", label: "课程管理", icon: "📚" },
    { href: "/admin/course-series", label: "课程系列", icon: "📂" },
    { href: "/admin/articles", label: "文章管理", icon: "📝" },
    { href: "/admin/assessment", label: "测评管理", icon: "📋" },
    { href: "/admin/resources", label: "资料管理", icon: "📂" },
    { href: "/admin/families", label: "家庭列表", icon: "👨‍👩‍👧" },
    { href: "/admin/conversations", label: "对话记录", icon: "💬" },
    { href: "/admin/risks", label: "风险提醒", icon: "⚠️", badge: stats?.risk_flags_unhandled },
    { href: "/admin/knowledge", label: "知识库管理", icon: "📖" },
    { href: "/admin/bookings", label: "预约管理", icon: "📅" },
    { href: "/admin/consultations", label: "咨询记录", icon: "📋" },
    { href: "/admin/consultants", label: "专家管理", icon: "👩‍🏫" },
    { href: "/admin/usage", label: "用量统计", icon: "📈" },
    { href: "/admin/analytics", label: "数据分析", icon: "🧠" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <BlurFade delay={0.05}>
        <div className="bg-gradient-to-br from-primary to-[#8B7355] px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">管理后台</h1>
            <button onClick={() => router.push("/profile")} className="text-white/60 text-sm">返回</button>
          </div>
        </div>
      </BlurFade>

      {/* 统计卡片 */}
      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        <BlurFade delay={0.1}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-primary">{stats?.total_families ?? "-"}</p>
              <p className="text-xs text-muted-foreground mt-1">总家庭数</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.12}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-600">{stats?.today_conversations ?? "-"}</p>
              <p className="text-xs text-muted-foreground mt-1">今日对话</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.14}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-foreground">{stats?.total_conversations ?? "-"}</p>
              <p className="text-xs text-muted-foreground mt-1">总对话数</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.16}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-destructive">{stats?.risk_flags_unhandled ?? "-"}</p>
              <p className="text-xs text-muted-foreground mt-1">待处理风险</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      {/* 导航菜单 */}
      <div className="px-4 mt-5 space-y-2">
        {navItems.map((item, i) => (
          <BlurFade key={item.href} delay={0.2 + i * 0.04}>
            <Link href={item.href}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.98]">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium text-foreground">{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="bg-destructive text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {item.badge}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xl">›</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          </BlurFade>
        ))}
      </div>
    </div>
  );
}
