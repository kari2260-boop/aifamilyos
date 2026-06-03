"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface WrongQuestionDetail {
  id: string;
  family_id: string;
  child_id?: string;
  conversation_id?: string;
  message_id?: string;
  subject?: string;
  grade?: string;
  question_text?: string;
  image_url?: string;
  knowledge_points?: string[];
  mistake_reason?: string;
  ai_explanation?: string;
  similar_questions?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function WrongQuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [question, setQuestion] = useState<WrongQuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestion();
  }, [params.id]);

  const loadQuestion = async () => {
    try {
      const data = await api.request(`/wrong-questions/${params.id}`);
      setQuestion(data);
    } catch (error) {
      console.error("加载错题详情失败", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.request(`/wrong-questions/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      loadQuestion();
    } catch (error) {
      console.error("更新状态失败", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这道错题吗？")) return;
    try {
      await api.request(`/wrong-questions/${params.id}`, { method: "DELETE" });
      router.push("/wrong-questions");
    } catch (error) {
      console.error("删除失败", error);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AuthGuard>
    );
  }

  if (!question) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex flex-col items-center justify-center gap-3">
          <div className="text-4xl">❌</div>
          <div className="text-muted-foreground">错题不存在</div>
          <button
            onClick={() => router.push("/wrong-questions")}
            className="px-4 py-2 bg-primary text-white rounded-full text-sm"
          >
            返回错题本
          </button>
        </div>
      </AuthGuard>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      new: { label: "新错题", color: "bg-rose-100 text-rose-700" },
      reviewing: { label: "复习中", color: "bg-amber-100 text-amber-700" },
      mastered: { label: "已掌握", color: "bg-emerald-100 text-emerald-700" },
    };
    const config = statusConfig[status] || statusConfig.new;
    return (
      <span className={`px-3 py-1 rounded-full text-xs ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 px-5 pt-12 pb-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-white text-lg"
            >
              ←
            </button>
            <h1 className="text-lg font-bold text-white flex-1">错题详情</h1>
            <button
              onClick={handleDelete}
              className="text-white/80 text-sm"
            >
              删除
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 基本信息 */}
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              {question.subject && (
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                  {question.subject}
                </span>
              )}
              {question.grade && (
                <span className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">
                  {question.grade}
                </span>
              )}
              {getStatusBadge(question.status)}
            </div>

            <div className="text-xs text-muted-foreground">
              记录时间：{new Date(question.created_at).toLocaleString()}
            </div>
          </div>

          {/* 题目 */}
          {(question.image_url || question.question_text) && (
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">📝 题目</h2>
              {question.image_url && (
                <img
                  src={question.image_url}
                  alt="题目"
                  className="w-full rounded-lg mb-3 border"
                />
              )}
              {question.question_text && (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {question.question_text}
                </p>
              )}
            </div>
          )}

          {/* 知识点 */}
          {question.knowledge_points && question.knowledge_points.length > 0 && (
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">🎯 涉及知识点</h2>
              <div className="flex flex-wrap gap-2">
                {question.knowledge_points.map((kp, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg"
                  >
                    {kp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 错因分析 */}
          {question.mistake_reason && (
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">⚠️ 错因分析</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {question.mistake_reason}
              </p>
            </div>
          )}

          {/* 刷刷的讲解 */}
          {question.ai_explanation && (
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">💡 刷刷的讲解</h2>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{question.ai_explanation}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 类似题 */}
          {question.similar_questions && (
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">🎯 类似练习题</h2>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{question.similar_questions}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 状态操作 */}
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">📊 学习状态</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleStatusChange("new")}
                className={`py-2 text-xs rounded-lg ${
                  question.status === "new"
                    ? "bg-rose-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                新错题
              </button>
              <button
                onClick={() => handleStatusChange("reviewing")}
                className={`py-2 text-xs rounded-lg ${
                  question.status === "reviewing"
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                复习中
              </button>
              <button
                onClick={() => handleStatusChange("mastered")}
                className={`py-2 text-xs rounded-lg ${
                  question.status === "mastered"
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                已掌握
              </button>
            </div>
          </div>

          {/* 返回对话 */}
          {question.conversation_id && (
            <button
              onClick={() => router.push(`/chat/shuashua?conversation_id=${question.conversation_id}`)}
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium"
            >
              回到原对话
            </button>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
