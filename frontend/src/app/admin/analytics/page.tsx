"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

interface Overview {
  weekly_conversations: number;
  weekly_ai_replies: number;
  feedback_useful: number;
  feedback_not_useful: number;
  satisfaction_rate: number;
  knowledge_chunks: number;
  active_families: number;
  total_families: number;
}

interface WeeklyReport {
  knowledge_effectiveness: {
    total_feedback_messages: number;
    rag_satisfaction_rate: number;
    low_quality_chunks_count: number;
  };
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
    active_families: number;
    total_families: number;
    activity_rate: number;
    inactive_family_count: number;
    agent_usage: Record<string, number>;
  };
}

const agentNames: Record<string, string> = {
  xuexue: "学学", chuangchuang: "创创", tantan: "探探", banban: "伴伴",
};

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    api.request("/admin/analytics/overview").then(setOverview).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runWeeklyReport = async () => {
    setReportLoading(true);
    try {
      const data = await (api as unknown as { request: (path: string) => Promise<WeeklyReport> }).request("/admin/analytics/weekly?weeks=1");
      setReport(data);
    } catch { alert("分析失败"); }
    finally { setReportLoading(false); }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <h1 className="text-lg font-bold text-white">数据分析</h1>
          <p className="text-white/60 text-xs mt-1">知识有效性 · Agent性能 · 知识缺口 · 用户行为</p>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-6">
          {/* 概览卡片 */}
          {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}
          {overview && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">本周对话</p>
                <p className="text-xl font-bold text-foreground">{overview.weekly_conversations}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">AI回复</p>
                <p className="text-xl font-bold text-foreground">{overview.weekly_ai_replies}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">满意度</p>
                <p className="text-xl font-bold text-foreground">{overview.satisfaction_rate}%</p>
                <p className="text-xs text-muted-foreground">👍{overview.feedback_useful} 👎{overview.feedback_not_useful}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">活跃家庭</p>
                <p className="text-xl font-bold text-foreground">{overview.active_families}/{overview.total_families}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 col-span-2">
                <p className="text-xs text-muted-foreground">知识库规模</p>
                <p className="text-xl font-bold text-foreground">{overview.knowledge_chunks.toLocaleString()} 个知识块</p>
              </div>
            </div>
          )}

          {/* 运行分析按钮 */}
          <button
            onClick={runWeeklyReport}
            disabled={reportLoading}
            className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 mb-6"
          >
            {reportLoading ? "分析中..." : "运行周度深度分析"}
          </button>

          {/* 分析报告 */}
          {report && (
            <div className="space-y-6">
              {/* Agent性能 */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">Agent 性能对比</h2>
                <div className="space-y-2">
                  {Object.entries(report.agent_performance).map(([agent, data]) => (
                    <div key={agent} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{agentNames[agent] || agent}</p>
                        <p className="text-xs text-muted-foreground">{data.conversations}次对话</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{data.satisfaction_rate}%</p>
                        <p className="text-xs text-muted-foreground">👍{data.useful_count} 👎{data.not_useful_count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 知识缺口 */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  知识缺口（{report.knowledge_gaps.total_no_rag_questions}个未命中问题）
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
                  <p className="text-xs text-muted-foreground">暂无数据</p>
                )}
              </div>

              {/* 用户行为 */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">用户行为</h2>
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <p className="text-sm">活跃率：<span className="font-bold">{report.user_behavior.activity_rate}%</span></p>
                  <p className="text-sm">不活跃家庭：<span className="font-bold text-amber-600">{report.user_behavior.inactive_family_count}个</span></p>
                  <p className="text-sm">Agent使用分布：</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(report.user_behavior.agent_usage).map(([agent, count]) => (
                      <span key={agent} className="text-xs bg-muted px-2 py-1 rounded">{agentNames[agent] || agent}: {count}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
