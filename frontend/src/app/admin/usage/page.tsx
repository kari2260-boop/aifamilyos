"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface UsageSummary {
  total_tokens_input: number;
  total_tokens_output: number;
  total_tokens: number;
  total_cost: number;
  total_chats: number;
  active_families: number;
  agent_usage: { agent_type: string; count: number }[];
}

interface DailyItem {
  date: string;
  count: number;
  tokens: number;
}

const agentNames: Record<string, string> = {
  xuexue: "学学", chuangchuang: "创创", tantan: "探探", banban: "伴伴",
};

export default function AdminUsagePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [daily, setDaily] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.adminUsageSummary(),
      api.adminUsageDaily(30),
    ]).then(([s, d]) => {
      setSummary(s);
      setDaily(d.days || []);
    }).catch(() => router.push("/admin"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">加载中...</p></div>;
  }

  const maxCount = Math.max(...daily.map(d => d.count), 1);

  const totalAgentCount = summary?.agent_usage.reduce((s, a) => s + a.count, 0) || 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
        <Link href="/admin" className="text-muted-foreground text-xl hover:text-foreground transition">‹</Link>
        <h1 className="font-semibold text-foreground">用量统计</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 总览卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <BlurFade delay={0.1}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{summary?.total_tokens ? (summary.total_tokens / 1000).toFixed(1) + "K" : "0"}</p>
                <p className="text-xs text-muted-foreground mt-1">总 Token 消耗</p>
              </CardContent>
            </Card>
          </BlurFade>
          <BlurFade delay={0.12}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-emerald-600">¥{summary?.total_cost?.toFixed(2) || "0"}</p>
                <p className="text-xs text-muted-foreground mt-1">预估成本</p>
              </CardContent>
            </Card>
          </BlurFade>
          <BlurFade delay={0.14}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-primary">{summary?.total_chats || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">总对话次数</p>
              </CardContent>
            </Card>
          </BlurFade>
          <BlurFade delay={0.16}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-amber-600">{summary?.active_families || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">活跃家庭</p>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* 每日对话趋势 */}
        <BlurFade delay={0.2}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">每日对话趋势（近30天）</h3>
              {daily.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">暂无数据</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {daily.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full bg-gradient-to-t from-amber-500 to-orange-400 rounded-t-sm min-h-[2px]"
                        style={{ height: `${(d.count / maxCount) * 100}%` }}
                        title={`${d.date}: ${d.count} 次`}
                      />
                    </div>
                  ))}
                </div>
              )}
              {daily.length > 0 && (
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{daily[0]?.date.slice(5)}</span>
                  <span>{daily[daily.length - 1]?.date.slice(5)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </BlurFade>

        {/* Agent 使用占比 */}
        <BlurFade delay={0.25}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">各 Agent 使用占比</h3>
              {(!summary?.agent_usage || summary.agent_usage.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-3">
                  {summary.agent_usage.map((a) => {
                    const pct = Math.round((a.count / totalAgentCount) * 100);
                    return (
                      <div key={a.agent_type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-foreground font-medium">{agentNames[a.agent_type] || a.agent_type}</span>
                          <span className="text-muted-foreground">{a.count} 次 ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full">
                          <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </div>
  );
}
