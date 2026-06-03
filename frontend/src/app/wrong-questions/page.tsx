"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import Link from "next/link";

interface WrongQuestion {
  id: string;
  child_id?: string;
  subject?: string;
  grade?: string;
  question_text?: string;
  image_url?: string;
  knowledge_points?: string[];
  mistake_reason?: string;
  status: string;
  created_at: string;
}

export default function WrongQuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  useEffect(() => {
    loadQuestions();
  }, [selectedSubject, selectedStatus]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSubject) params.append("subject", selectedSubject);
      if (selectedStatus) params.append("status", selectedStatus);

      const data = await api.request(`/wrong-questions?${params.toString()}`);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("加载错题失败", error);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.request(`/wrong-questions/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      loadQuestions();
    } catch (error) {
      console.error("更新状态失败", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      new: { label: "新错题", color: "bg-rose-100 text-rose-700" },
      reviewing: { label: "复习中", color: "bg-amber-100 text-amber-700" },
      mastered: { label: "已掌握", color: "bg-emerald-100 text-emerald-700" },
    };
    const config = statusConfig[status] || statusConfig.new;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 px-5 pt-12 pb-6 rounded-b-3xl">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">📚 错题本</h1>
            <Link
              href="/chat/shuashua"
              className="text-xs bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full"
            >
              继续刷题
            </Link>
          </div>
          <p className="text-white/80 text-sm mt-2">让每道错题都变成学习资产</p>
        </div>

        <div className="px-5 mt-4">
          {/* 筛选器 */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => setSelectedStatus("")}
              className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${
                selectedStatus === ""
                  ? "bg-rose-500 text-white"
                  : "bg-card text-muted-foreground border"
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setSelectedStatus("new")}
              className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${
                selectedStatus === "new"
                  ? "bg-rose-500 text-white"
                  : "bg-card text-muted-foreground border"
              }`}
            >
              新错题
            </button>
            <button
              onClick={() => setSelectedStatus("reviewing")}
              className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${
                selectedStatus === "reviewing"
                  ? "bg-rose-500 text-white"
                  : "bg-card text-muted-foreground border"
              }`}
            >
              复习中
            </button>
            <button
              onClick={() => setSelectedStatus("mastered")}
              className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${
                selectedStatus === "mastered"
                  ? "bg-rose-500 text-white"
                  : "bg-card text-muted-foreground border"
              }`}
            >
              已掌握
            </button>
          </div>

          {/* 错题列表 */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-muted-foreground text-sm">暂无错题记录</p>
              <Link
                href="/chat/shuashua"
                className="inline-block mt-4 px-4 py-2 bg-rose-500 text-white text-sm rounded-full"
              >
                和刷刷聊聊吧
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="bg-card rounded-2xl p-4 shadow-sm border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {q.subject && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                          {q.subject}
                        </span>
                      )}
                      {getStatusBadge(q.status)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {q.image_url && (
                    <img
                      src={q.image_url}
                      alt="题目"
                      className="w-full rounded-lg mb-2 max-h-48 object-contain bg-muted"
                    />
                  )}

                  {q.question_text && (
                    <p className="text-sm text-foreground mb-2 line-clamp-2">
                      {q.question_text}
                    </p>
                  )}

                  {q.knowledge_points && q.knowledge_points.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {q.knowledge_points.map((kp, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded"
                        >
                          {kp}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {q.status === "new" && (
                      <button
                        onClick={() => handleStatusChange(q.id, "reviewing")}
                        className="flex-1 py-2 bg-amber-100 text-amber-700 text-xs rounded-lg"
                      >
                        开始复习
                      </button>
                    )}
                    {q.status === "reviewing" && (
                      <button
                        onClick={() => handleStatusChange(q.id, "mastered")}
                        className="flex-1 py-2 bg-emerald-100 text-emerald-700 text-xs rounded-lg"
                      >
                        标记掌握
                      </button>
                    )}
                    <Link
                      href={`/wrong-questions/${q.id}`}
                      className="flex-1 py-2 bg-muted text-foreground text-xs rounded-lg text-center"
                    >
                      查看详情
                    </Link>
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
