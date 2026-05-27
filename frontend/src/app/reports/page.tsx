"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface ReportItem {
  id: string;
  month: string;
  summary: string | null;
  conversation_count: number;
  generated_at: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.getReports().then(setReports).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const report = await api.generateReport();
      router.push(`/reports/${report.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const monthLabel = (month: string) => {
    const [y, m] = month.split("-");
    return `${y}年${parseInt(m)}月`;
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <BlurFade delay={0.1}>
          <div className="px-5 pt-12 pb-4">
            <h1 className="text-lg font-bold text-foreground">成长报告</h1>
            <p className="text-sm text-muted-foreground mt-1">基于对话记录生成的月度成长分析</p>
          </div>
        </BlurFade>

        <div className="px-4 space-y-3">
          <BlurFade delay={0.15}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 shadow-md shadow-teal-200 hover:opacity-90 transition"
            >
              {generating ? "生成中，请稍候..." : "生成本月报告"}
            </button>
          </BlurFade>

          {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}

          {!loading && reports.length === 0 && (
            <p className="text-center text-muted-foreground text-sm mt-8">暂无报告，点击上方按钮生成</p>
          )}

          {reports.map((r, i) => (
            <BlurFade key={r.id} delay={0.2 + i * 0.05}>
              <Card
                className="border-0 shadow-md hover:shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer"
                onClick={() => router.push(`/reports/${r.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{monthLabel(r.month)}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{r.conversation_count} 次对话</span>
                  </div>
                  {r.summary && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.summary}</p>
                  )}
                </CardContent>
              </Card>
            </BlurFade>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
