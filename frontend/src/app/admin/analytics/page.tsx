"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Overview {
  weekly_conversations: number;
  weekly_ai_replies: number;
  today_conversations: number;
  new_families_this_month: number;
  feedback_useful: number;
  feedback_not_useful: number;
  total_feedback: number;
  satisfaction_rate: number | null;
  knowledge_chunks: number;
  active_families: number;
  total_families: number;
  total_children: number;
  children_with_profile: number;
  profile_completion_rate: number;
  avg_conv_per_active_family: number;
}

interface FamilyHealth {
  family_id: string;
  family_name: string;
  subscription_plan: string;
  children_count: number;
  children_with_profile: number;
  weekly_conversations: number;
  last_active: string | null;
  is_active: boolean;
  unhandled_risks: number;
}

interface WeeklyReport {
  agent_performance: Record<string, {
    conversations: number;
    satisfaction_rate: number;
    useful_count: number;
    not_useful_count: number;
  }>;
  knowledge_gaps: {
    total_no_rag_questions: number;
    sample_questions: Array<{ question: string; agent_type: string }>;
  };
  user_behavior: {
    activity_rate: number;
    inactive_family_count: number;
    agent_usage: Record<string, number>;
  };
}

const agentNames: Record<string, string> = {
  xuexue: "学学", chuangchuang: "创创", tantan: "探探", banban: "伴伴",
};

const planLabels: Record<string, string> = {
  free: "免费", trial: "试用", trial_9_9: "9.9体验", basic: "基础版",
  community_3480: "3480社区", pilot_9800: "9800领航", premium: "高级",
};

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [families, setFamilies] = useState<FamilyHealth[]>([]);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [familiesLoading, setFamiliesLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    api.request("/admin/analytics/overview")
      .then((d) => setOverview(d as Overview))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.request("/admin/analytics/families")
      .then((d) => setFamilies(d as FamilyHealth[]))
      .catch(() => {})
      .finally(() => setFamiliesLoading(false));
  }, []);

  const runWeeklyReport = async () => {
    setReportLoading(true);
    try {
      const data = await api.request("/admin/analytics/weekly?weeks=1");
      setReport(data as WeeklyReport);
    } catch { alert("分析失败"); }
    finally { setReportLoading(false); }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <BlurFade delay={0.05}>
          <div className="bg-gradient-to-br from-primary to-[#8B7355] px-5 pt-12 pb-8 rounded-b-[2rem]">
            <h1 className="text-lg font-bold text-white">数据分析</h1>
            <p className="text-white/60 text-xs mt-1">运营概览 · 家庭健康度 · Agent 性能</p>
          </div>
        </BlurFade>

        <div className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
          {/* 概览指标 */}
          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-8">加载中...</p>
          ) : overview && (
            <BlurFade delay={0.1}>
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">本周概览</h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="今日对话" value={overview.today_conversations} color="primary" />
                  <StatCard label="本周对话" value={overview.weekly_conversations} />
                  <StatCard label="活跃家庭" value={`${overview.active_families}/${overview.total_families}`} />
                  <StatCard label="本月新增家庭" value={overview.new_families_this_month} color="emerald" />
                  <StatCard
                    label="满意度"
                    value={overview.satisfaction_rate !== null ? `${overview.satisfaction_rate}%` : "暂无反馈"}
                    sub={overview.total_feedback > 0 ? `👍${overview.feedback_useful} 👎${overview.feedback_not_useful}` : undefined}
                    color={overview.satisfaction_rate !== null ? (overview.satisfaction_rate >= 70 ? "emerald" : "amber") : undefined}
                  />
                  <StatCard label="人均对话/活跃家庭" value={`${overview.avg_conv_per_active_family}次`} />
                </div>

                {/* 画像完整度进度条 */}
                <div className="mt-3 bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">孩子画像完整度</p>
                    <p className="text-sm font-bold text-primary">{overview.profile_completion_rate}%</p>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${overview.profile_completion_rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {overview.children_with_profile}/{overview.total_children} 个孩子已有 AI 画像
                  </p>
                </div>

                {/* 知识库 */}
                <div className="mt-3 bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">知识库规模</p>
                    <p className="text-xl font-bold text-foreground">{overview.knowledge_chunks.toLocaleString()} 个知识块</p>
                  </div>
                  <span className="text-2xl">📚</span>
                </div>
              </div>
            </BlurFade>
          )}

          {/* 家庭健康度看板 */}
          <BlurFade delay={0.15}>
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">家庭健康度</h2>
              {familiesLoading ? (
                <p className="text-xs text-muted-foreground">加载中...</p>
              ) : (
                <div className="space-y-2">
                  {families.map((f) => (
                    <div key={f.family_id} className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            f.unhandled_risks > 0 ? "bg-red-500" :
                            f.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`} />
                          <p className="text-sm font-medium text-foreground">{f.family_name}</p>
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {planLabels[f.subscription_plan] || f.subscription_plan}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {f.unhandled_risks > 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                              ⚠️ {f.unhandled_risks}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{f.weekly_conversations}次/周</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span>{f.children_count}个孩子</span>
                        <span>画像 {f.children_with_profile}/{f.children_count}</span>
                        {f.last_active && <span>最近 {f.last_active}</span>}
                        {!f.is_active && <span className="text-amber-600">本周未活跃</span>}
                      </div>
                    </div>
                  ))}
                  {families.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无家庭数据</p>
                  )}
                </div>
              )}
            </div>
          </BlurFade>

          {/* 深度分析按钮 */}
          <BlurFade delay={0.2}>
            <button
              onClick={runWeeklyReport}
              disabled={reportLoading}
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {reportLoading ? "分析中..." : "运行周度深度分析"}
            </button>
          </BlurFade>

          {/* 深度分析结果 */}
          {report && (
            <div className="space-y-5">
              <BlurFade delay={0.05}>
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-3">Agent 性能对比</h2>
                  <div className="space-y-2">
                    {Object.entries(report.agent_performance).map(([agent, data]) => (
                      <div key={agent} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{agentNames[agent] || agent}</p>
                          <p className="text-xs text-muted-foreground">{data.conversations} 次对话</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">
                            {data.useful_count + data.not_useful_count > 0
                              ? `${data.satisfaction_rate}%`
                              : "暂无反馈"}
                          </p>
                          <p className="text-xs text-muted-foreground">👍{data.useful_count} 👎{data.not_useful_count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BlurFade>

              <BlurFade delay={0.1}>
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-3">
                    知识缺口（{report.knowledge_gaps.total_no_rag_questions} 个未命中问题）
                  </h2>
                  {report.knowledge_gaps.sample_questions.length > 0 ? (
                    <div className="space-y-1.5">
                      {report.knowledge_gaps.sample_questions.slice(0, 10).map((q, i) => (
                        <div key={i} className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-foreground">
                          <span className="text-muted-foreground">[{agentNames[q.agent_type] || q.agent_type}]</span> {q.question}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">本周知识库命中率良好，暂无缺口</p>
                  )}
                </div>
              </BlurFade>

              <BlurFade delay={0.15}>
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-3">用户行为</h2>
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">活跃率</p>
                      <p className="text-sm font-bold">{report.user_behavior.activity_rate}%</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">本周未活跃家庭</p>
                      <p className="text-sm font-bold text-amber-600">{report.user_behavior.inactive_family_count} 个</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Agent 使用分布</p>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(report.user_behavior.agent_usage).map(([agent, count]) => (
                          <span key={agent} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {agentNames[agent] || agent}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </BlurFade>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

// 抑制未使用的 Card/CardContent 警告
void Card; void CardContent;

function StatCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "emerald" | "amber";
}) {
  const colorClass = color === "primary" ? "text-primary"
    : color === "emerald" ? "text-emerald-600"
    : color === "amber" ? "text-amber-600"
    : "text-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
