"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

interface Question {
  question: string;
  options: { label: string; value: string }[];
  type?: string;
}

export default function AssessmentTakePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<{ title: string; description: string | null; questions_json: Question[] } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [filledBy, setFilledBy] = useState("child");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"setup" | "questions" | "done">("setup");

  useEffect(() => {
    async function load() {
      const t = await api.getAssessmentTemplate(templateId);
      setTemplate(t);
      const family = await api.getMyFamily();
      if (family.children) {
        setChildren(family.children);
        if (family.children.length === 1) setSelectedChild(family.children[0].id);
      }
    }
    load();
  }, [templateId]);

  const questions = template?.questions_json || [];
  const total = questions.length;
  const progress = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  const handleSelect = (value: string) => {
    setAnswers({ ...answers, [currentIndex]: value });
    // 自动跳下一题
    setTimeout(() => {
      if (currentIndex < total - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }, 300);
  };

  const handleSubmit = async () => {
    if (!selectedChild) return;
    setSubmitting(true);
    try {
      const answerList = Object.entries(answers).map(([idx, val]) => ({
        question_index: parseInt(idx),
        selected_value: val,
      }));
      await api.submitAssessment(templateId, selectedChild, filledBy, answerList);
      setStep("done");
    } catch {
      alert("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (!template) {
    return <AuthGuard><div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">加载中...</p></div></AuthGuard>;
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6">

          {/* 设置步骤：选孩子+填写者 */}
          {step === "setup" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-foreground">{template.title}</h1>
                {template.description && <p className="text-sm text-muted-foreground mt-1">{template.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">共 {total} 题</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">选择孩子</label>
                  <select
                    value={selectedChild}
                    onChange={(e) => setSelectedChild(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm"
                  >
                    <option value="">请选择</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">谁来填写</label>
                  <div className="mt-1 flex gap-3">
                    <button
                      onClick={() => setFilledBy("child")}
                      className={`flex-1 py-2.5 rounded-xl text-sm border transition ${filledBy === "child" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"}`}
                    >
                      孩子自己
                    </button>
                    <button
                      onClick={() => setFilledBy("parent")}
                      className={`flex-1 py-2.5 rounded-xl text-sm border transition ${filledBy === "parent" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"}`}
                    >
                      家长代填
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { if (selectedChild) setStep("questions"); }}
                disabled={!selectedChild}
                className={`w-full py-3 rounded-xl text-sm font-medium text-white transition ${selectedChild ? "bg-gradient-to-r from-amber-500 to-orange-600 active:scale-95" : "bg-muted-foreground/30"}`}
              >
                开始测评
              </button>
            </div>
          )}

          {/* 答题步骤 */}
          {step === "questions" && questions[currentIndex] && (
            <div className="space-y-6">
              {/* 进度条 */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{currentIndex + 1} / {total}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* 题目 */}
              <div>
                <h2 className="text-base font-medium text-foreground leading-relaxed">
                  {questions[currentIndex].question}
                </h2>
              </div>

              {/* 选项 */}
              <div className="space-y-2">
                {questions[currentIndex].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      answers[currentIndex] === opt.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 导航 */}
              <div className="flex gap-3">
                {currentIndex > 0 && (
                  <button
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground"
                  >
                    上一题
                  </button>
                )}
                {currentIndex === total - 1 && Object.keys(answers).length === total && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 active:scale-95"
                  >
                    {submitting ? "提交中..." : "提交测评"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 完成步骤 */}
          {step === "done" && (
            <div className="text-center mt-20 space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="text-lg font-bold text-foreground">测评已提交</h2>
              <p className="text-sm text-muted-foreground">报告将在咨询师审核后发布，届时会通知您查看</p>
              <button
                onClick={() => router.push("/assessment")}
                className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600"
              >
                返回测评列表
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
