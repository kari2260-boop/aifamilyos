"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type Mode = "list" | "create" | "edit" | "records";

interface Template {
  id: string;
  title: string;
  category: string;
  description: string | null;
  question_count: number;
  target_age_min: number;
  target_age_max: number;
}

interface RecordItem {
  id: string;
  family_name: string;
  child_name: string;
  template_title: string;
  category: string;
  filled_by: string;
  report_status: string;
  report_id: string | null;
  created_at: string;
}

interface Question {
  question: string;
  options: { label: string; value: string }[];
}

const categoryOptions = [
  { value: "learning_style", label: "学习风格" },
  { value: "personality", label: "性格特征" },
  { value: "subject_interest", label: "学科兴趣" },
  { value: "learning_system", label: "学习系统" },
];

export default function AdminAssessmentPage() {
  const [mode, setMode] = useState<Mode>("list");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // 表单状态
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("learning_style");
  const [description, setDescription] = useState("");
  const [ageMin, setAgeMin] = useState(8);
  const [ageMax, setAgeMax] = useState(18);
  const [questions, setQuestions] = useState<Question[]>([]);

  // 审核状态
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [consultantNotes, setConsultantNotes] = useState("");

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.getAssessmentTemplates();
      setTemplates(data);
    } catch {} finally { setLoading(false); }
  };

  const loadRecords = async () => {
    try {
      const data = await api.adminGetAssessmentRecords();
      setRecords(data);
    } catch {}
  };

  const resetForm = () => {
    setTitle(""); setCategory("learning_style"); setDescription("");
    setAgeMin(8); setAgeMax(18); setQuestions([]);
    setEditId(null);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: [{ label: "", value: "A" }, { label: "", value: "B" }] }]);
  };

  const updateQuestion = (idx: number, field: string, value: string) => {
    const updated = [...questions];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, label: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx].label = label;
    setQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    const nextValue = String.fromCharCode(65 + updated[qIdx].options.length);
    updated[qIdx].options.push({ label: "", value: nextValue });
    setQuestions(updated);
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options.splice(oIdx, 1);
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim()) { alert("请输入测评标题"); return; }
    if (questions.length === 0) { alert("请至少添加一道题目"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      category,
      description: description.trim() || undefined,
      target_age_min: ageMin,
      target_age_max: ageMax,
      questions_json: questions,
      sort_order: 0,
    };
    try {
      if (editId) {
        await api.adminUpdateTemplate(editId, payload);
      } else {
        await api.adminCreateTemplate(payload);
      }
      setMode("list");
      resetForm();
      await loadTemplates();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally { setSaving(false); }
  };

  const handlePublishReport = async (reportId: string) => {
    try {
      await api.adminReviewReport(reportId, {
        consultant_notes: consultantNotes || undefined,
        action: "publish",
      });
      setReviewingId(null);
      setConsultantNotes("");
      await loadRecords();
    } catch { alert("发布失败"); }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && <button onClick={() => { setMode("list"); resetForm(); }} className="text-white/60 text-xl">‹</button>}
              <h1 className="text-lg font-bold text-white">测评管理</h1>
            </div>
            <div className="flex gap-2">
              {mode === "list" && (
                <>
                  <button onClick={() => { loadRecords(); setMode("records"); }} className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg">答题记录</button>
                  <button onClick={() => { resetForm(); setMode("create"); }} className="px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg">新建测评</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-6">

          {/* 模板列表 */}
          {mode === "list" && (
            <div className="space-y-3">
              {loading && <p className="text-center text-muted-foreground text-sm">加载中...</p>}
              {!loading && templates.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">暂无测评模板，点击右上角"新建测评"创建</p>}
              {templates.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{t.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {categoryOptions.find(c => c.value === t.category)?.label || t.category} · {t.question_count}题 · {t.target_age_min}-{t.target_age_max}岁
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditId(t.id);
                        setTitle(t.title);
                        setCategory(t.category);
                        setDescription(t.description || "");
                        setAgeMin(t.target_age_min);
                        setAgeMax(t.target_age_max);
                        // 加载完整题目
                        api.getAssessmentTemplate(t.id).then((full) => {
                          setQuestions(full.questions_json || []);
                        });
                        setMode("edit");
                      }}
                      className="text-xs text-primary"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 创建/编辑表单 */}
          {(mode === "create" || mode === "edit") && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">测评标题</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：学习风格测评" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">分类</label>
                  <select className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">最小年龄</label>
                    <input type="number" className="w-full mt-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">最大年龄</label>
                    <input type="number" className="w-full mt-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">说明（可选）</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="测评简介" />
              </div>

              {/* 题目编辑 */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-foreground">题目（{questions.length}题）</h3>
                  <button onClick={addQuestion} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg">+ 添加题目</button>
                </div>

                <div className="space-y-4">
                  {questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground mt-2 shrink-0">Q{qIdx + 1}</span>
                        <input
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                          value={q.question}
                          onChange={(e) => updateQuestion(qIdx, "question", e.target.value)}
                          placeholder="输入题目"
                        />
                        <button onClick={() => removeQuestion(qIdx)} className="text-xs text-destructive mt-2">删除</button>
                      </div>
                      <div className="pl-6 space-y-1.5">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{opt.value}</span>
                            <input
                              className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm"
                              value={opt.label}
                              onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                              placeholder={`选项${opt.value}`}
                            />
                            {q.options.length > 2 && (
                              <button onClick={() => removeOption(qIdx, oIdx)} className="text-xs text-muted-foreground">×</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addOption(qIdx)} className="text-xs text-muted-foreground hover:text-primary">+ 添加选项</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? "保存中..." : editId ? "保存修改" : "创建测评"}
              </button>
            </div>
          )}

          {/* 答题记录 + 审核 */}
          {mode === "records" && (
            <div className="space-y-3">
              {records.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">暂无答题记录</p>}
              {records.map((r) => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{r.child_name} · {r.template_title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.family_name} · {r.filled_by === "child" ? "孩子填写" : "家长代填"} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {r.report_status === "published" ? (
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">已发布</span>
                    ) : r.report_id ? (
                      <button
                        onClick={() => { setReviewingId(r.report_id); setConsultantNotes(""); }}
                        className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full"
                      >
                        审核发布
                      </button>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">无报告</span>
                    )}
                  </div>

                  {/* 审核弹出 */}
                  {reviewingId === r.report_id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <textarea
                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                        value={consultantNotes}
                        onChange={(e) => setConsultantNotes(e.target.value)}
                        placeholder="咨询师补充意见（可选）"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePublishReport(r.report_id!)}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm"
                        >
                          确认发布
                        </button>
                        <button
                          onClick={() => setReviewingId(null)}
                          className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
