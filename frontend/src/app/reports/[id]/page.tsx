"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface DimensionData {
  score?: number;
  highlights?: string[];
  suggestions?: string[];
  discoveries?: string[];
}

interface ReportContent {
  summary?: string;
  learning?: DimensionData;
  creativity?: DimensionData;
  talent?: DimensionData;
  overall_suggestions?: string[];
}

interface Report {
  id: string;
  month: string;
  summary: string | null;
  content_json: ReportContent;
  conversation_count: number;
  generated_at: string;
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    api.getReport(id)
      .then(setReport)
      .catch(() => router.push("/reports"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!report) return null;

  const content = report.content_json;
  const monthLabel = (() => {
    const [y, m] = report.month.split("-");
    return `${y}年${parseInt(m)}月`;
  })();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-8">
        <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border">
          <button onClick={() => router.push("/reports")} className="text-muted-foreground text-xl hover:text-foreground transition">‹</button>
          <h1 className="font-semibold text-foreground">{monthLabel} 成长报告</h1>
        </div>

        <div className="px-4 mt-4 space-y-4">
          {content.summary && (
            <BlurFade delay={0.1}>
              <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">本月总结</p>
                  <p className="font-medium text-foreground mt-1">{content.summary}</p>
                  <p className="text-xs text-muted-foreground mt-2">{report.conversation_count} 次对话</p>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {content.learning && (
            <BlurFade delay={0.15}>
              <DimensionCard title="学习进展" color="blue" score={content.learning.score} items={content.learning.highlights} suggestions={content.learning.suggestions} />
            </BlurFade>
          )}

          {content.creativity && (
            <BlurFade delay={0.2}>
              <DimensionCard title="创造力" color="green" score={content.creativity.score} items={content.creativity.highlights} suggestions={content.creativity.suggestions} />
            </BlurFade>
          )}

          {content.talent && (
            <BlurFade delay={0.25}>
              <DimensionCard title="天赋发现" color="purple" score={content.talent.score} items={content.talent.discoveries} suggestions={content.talent.suggestions} />
            </BlurFade>
          )}

          {content.overall_suggestions && content.overall_suggestions.length > 0 && (
            <BlurFade delay={0.3}>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-2">综合建议</h3>
                  <ul className="space-y-1.5">
                    {content.overall_suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-amber-500 shrink-0">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </BlurFade>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function DimensionCard({ title, color, score, items, suggestions }: {
  title: string;
  color: "blue" | "green" | "purple";
  score?: number;
  items?: string[];
  suggestions?: string[];
}) {
  const colorMap = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" },
    green: { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500" },
    purple: { bg: "bg-violet-50", text: "text-violet-600", bar: "bg-violet-500" },
  };
  const c = colorMap[color];

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {score !== undefined && score > 0 && (
            <span className={`text-sm font-bold ${c.text}`}>{score}/10</span>
          )}
        </div>

        {score !== undefined && score > 0 && (
          <div className="w-full h-2 bg-muted rounded-full mb-3">
            <div className={`h-2 rounded-full ${c.bar} transition-all`} style={{ width: `${score * 10}%` }} />
          </div>
        )}

        {items && items.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground mb-1">亮点</p>
            {items.map((item, i) => (
              <p key={i} className="text-sm text-foreground">• {item}</p>
            ))}
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className={`${c.bg} rounded-xl p-3 mt-2`}>
            <p className="text-xs text-muted-foreground mb-1">建议</p>
            {suggestions.map((s, i) => (
              <p key={i} className={`text-sm ${c.text}`}>→ {s}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
