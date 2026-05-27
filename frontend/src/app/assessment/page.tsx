"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

interface Template {
  id: string;
  title: string;
  category: string;
  description: string | null;
  question_count: number;
}

interface AssessmentRecordItem {
  id: string;
  template_title: string;
  category: string;
  child_name: string;
  filled_by: string;
  has_report: boolean;
  report_status: string | null;
  report_id: string | null;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  learning_style: "学习风格",
  personality: "性格特征",
  subject_interest: "学科兴趣",
  learning_system: "学习系统",
  mental_health: "心理健康",
};

export default function AssessmentPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [records, setRecords] = useState<AssessmentRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, r] = await Promise.all([
          api.getAssessmentTemplates(),
          api.getAssessmentRecords(),
        ]);
        setTemplates(t);
        setRecords(r);
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-md mx-auto px-4 py-6">
          <h1 className="text-xl font-bold text-foreground mb-1">成长测评</h1>
          <p className="text-sm text-muted-foreground mb-6">了解孩子的学习风格、性格特征和兴趣方向</p>

          {loading && <p className="text-center text-muted-foreground text-sm mt-12">加载中...</p>}

          {!loading && templates.length > 0 && (
            <div className="space-y-3 mb-8">
              <h2 className="text-sm font-medium text-muted-foreground">可用测评</h2>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/assessment/${t.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{t.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {categoryLabels[t.category] || t.category} · {t.question_count}题
                      </p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">开始</span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-2">{t.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="text-center text-muted-foreground text-sm mt-12">
              <p>暂无可用测评</p>
              <p className="mt-1">管理员可在后台添加测评模板</p>
            </div>
          )}

          {!loading && records.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">测评记录</h2>
              {records.map((r) => (
                <div
                  key={r.id}
                  className="bg-card border border-border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{r.template_title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.child_name} · {r.filled_by === "child" ? "孩子填写" : "家长代填"} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {r.report_status === "published" && r.report_id ? (
                      <button
                        onClick={() => router.push(`/assessment/report/${r.report_id}`)}
                        className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full"
                      >
                        查看报告
                      </button>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        {r.report_status === "draft" ? "待审核" : r.report_status === "reviewed" ? "审核中" : "已完成"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
