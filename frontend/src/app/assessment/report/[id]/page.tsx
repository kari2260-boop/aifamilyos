"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

type ModuleReport = {
  key: string;
  name: string;
  score?: number;
  average?: number;
  level?: string;
  highlights?: string[];
  risks?: string[];
  suggestions?: string[];
};

type LearningReportContent = {
  report_type?: string;
  summary?: string;
  overall_score?: number | string;
  overall_average?: number;
  overall_level?: string;
  profile_tags?: string[];
  module_reports?: ModuleReport[];
  dimension_scores?: Record<string, { total?: number; count?: number; average?: number }>;
  strengths?: string[];
  areas_to_develop?: string[];
  suggestions?: string[];
  next_steps?: {
    student?: string[];
    parent?: string[];
    "30_days"?: string[];
  };
  child_summary?: {
    name?: string;
    age?: number | null;
    grade?: string | null;
  };
  answer_count?: number;
};

type AssessmentReport = {
  id: string;
  child_name: string;
  template_title: string;
  category: string;
  scores_json: Record<string, unknown> | null;
  ai_content_json: LearningReportContent | null;
  final_content_json: LearningReportContent | null;
  content_json: LearningReportContent | null;
  consultant_notes: string | null;
  status: string;
  published_at: string | null;
  message?: string;
};

export default function AssessmentReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getAssessmentReport(reportId) as AssessmentReport;
        setReport(data);
      } catch {
        router.push("/assessment");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportId, router]);

  const content = useMemo(() => report?.content_json || report?.final_content_json || report?.ai_content_json || null, [report]);
  const dimensionScores = report?.scores_json && typeof report.scores_json === "object" ? (report.scores_json as Record<string, unknown>).dimension_scores as Record<string, { average?: number; total?: number; count?: number }> | undefined : undefined;
  const dimensionEntries = Object.entries(dimensionScores || {});

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!report) return null;

  if (report.status !== "published") {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background pb-20">
          <div className="max-w-md mx-auto px-4 py-6">
            <div className="rounded-2xl border border-border bg-card p-5 text-center mt-10">
              <h1 className="text-lg font-bold text-foreground">报告审核中</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                这份测评报告当前状态为 {report.status}，{report.message || "请等待管理员审核后再查看。"}
              </p>
              <button onClick={() => router.push("/assessment")} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600">
                返回测评列表
              </button>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const title = content?.child_summary?.name ? `${content.child_summary.name} 的学习力报告` : `${report.child_name} 的学习力报告`;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary to-[#8B7355] px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => router.push("/assessment")} className="text-white/80 text-sm">返回</button>
            <h1 className="text-base font-bold text-white text-center flex-1 truncate">{title}</h1>
            <span className="text-white/70 text-sm">{content?.overall_level || report.status}</span>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 mt-5 space-y-4">
          <BlurFade delay={0.05}>
            <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总评</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{typeof content?.overall_score === "number" ? `${content.overall_score} / 100` : content?.overall_score || "待评估"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">层级</p>
                    <p className="text-sm font-medium text-orange-700 mt-1">{content?.overall_level || "-"}</p>
                  </div>
                </div>
                {content?.summary && <p className="text-sm text-foreground mt-3 leading-relaxed">{content.summary}</p>}
                {content?.answer_count !== undefined && <p className="text-xs text-muted-foreground mt-2">已答题 {content.answer_count} 题</p>}
              </CardContent>
            </Card>
          </BlurFade>

          {content?.profile_tags && content.profile_tags.length > 0 && (
            <BlurFade delay={0.1}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">画像标签</h2>
                  <div className="flex flex-wrap gap-2">
                    {content.profile_tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary">{tag}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {content?.module_reports && content.module_reports.length > 0 && (
            <div className="space-y-3">
              {content.module_reports.map((module, index) => (
                <BlurFade key={module.key} delay={0.12 + index * 0.05}>
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-foreground">{module.name}</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">{module.level || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">{module.score ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">/100</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full" style={{ width: `${Math.max(0, Math.min(100, module.score ?? 0))}%` }} />
                      </div>
                      {module.highlights && module.highlights.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">亮点</p>
                          <ul className="space-y-1 text-sm text-foreground">
                            {module.highlights.map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                      {module.risks && module.risks.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">优先关注</p>
                          <ul className="space-y-1 text-sm text-foreground">
                            {module.risks.map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                      {module.suggestions && module.suggestions.length > 0 && (
                        <div className="mt-3 rounded-xl bg-amber-50 p-3">
                          <p className="text-xs text-muted-foreground mb-1">建议</p>
                          <ul className="space-y-1 text-sm text-orange-700">
                            {module.suggestions.map((item) => <li key={item}>→ {item}</li>)}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </BlurFade>
              ))}
            </div>
          )}

          {dimensionEntries.length > 0 && (
            <BlurFade delay={0.35}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">子维度明细</h2>
                  <div className="space-y-2">
                    {dimensionEntries.map(([name, detail]) => (
                      <div key={name} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{name}</span>
                          <span className="text-muted-foreground">{detail.average?.toFixed?.(2) ?? detail.average ?? 0}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (detail.average || 0) * 20))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {content?.strengths && content.strengths.length > 0 && (
            <BlurFade delay={0.4}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">优势</h2>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {content.strengths.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {content?.areas_to_develop && content.areas_to_develop.length > 0 && (
            <BlurFade delay={0.45}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">需要关注</h2>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {content.areas_to_develop.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {content?.suggestions && content.suggestions.length > 0 && (
            <BlurFade delay={0.5}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">行动建议</h2>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {content.suggestions.map((item) => <li key={item}>→ {item}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {content?.next_steps && (
            <BlurFade delay={0.55}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">下一步</h2>
                  <div className="space-y-3 text-sm">
                    {content.next_steps.student && content.next_steps.student.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">学生</p>
                        <ul className="space-y-1 text-foreground">{content.next_steps.student.map((item) => <li key={item}>• {item}</li>)}</ul>
                      </div>
                    )}
                    {content.next_steps.parent && content.next_steps.parent.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">家长</p>
                        <ul className="space-y-1 text-foreground">{content.next_steps.parent.map((item) => <li key={item}>• {item}</li>)}</ul>
                      </div>
                    )}
                    {content.next_steps["30_days"] && content.next_steps["30_days"].length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">30 天</p>
                        <ul className="space-y-1 text-foreground">{content.next_steps["30_days"].map((item) => <li key={item}>• {item}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {report.consultant_notes && (
            <BlurFade delay={0.6}>
              <Card className="border-0 shadow-sm bg-amber-50">
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">审核备注</h2>
                  <p className="text-sm text-foreground leading-relaxed">{report.consultant_notes}</p>
                </CardContent>
              </Card>
            </BlurFade>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
