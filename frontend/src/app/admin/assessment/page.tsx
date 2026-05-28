"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type Mode = "list" | "create" | "edit" | "records";

type ImportBucket = "learning" | "creativity" | "talent" | "parent_child";

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

interface WorkbookSectionPreview {
  sheet_name: string;
  question_count: number;
  sample_questions: string[];
}

interface WorkbookPreview {
  bucket: ImportBucket;
  bucket_label: string;
  title: string;
  category: string;
  description: string | null;
  question_count: number;
  sheet_count: number;
  included_sheets: string[];
  excluded_sheets: string[];
  sections: WorkbookSectionPreview[];
}

type ReportModule = {
  key: string;
  name: string;
  score?: number;
  average?: number;
  level?: string;
  highlights?: string[];
  risks?: string[];
  suggestions?: string[];
};

type ReportContent = {
  report_type?: string;
  summary?: string;
  overall_score?: number | string;
  overall_average?: number;
  overall_level?: string;
  profile_tags?: string[];
  module_reports?: ReportModule[];
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

interface ReportDetail {
  id: string;
  family_name: string;
  child_name: string;
  template_title: string;
  category: string;
  scores_json: Record<string, unknown> | null;
  ai_content_json: ReportContent | null;
  final_content_json: ReportContent | null;
  content_json: ReportContent | null;
  consultant_notes: string | null;
  status: string;
  published_at: string | null;
  child_summary?: {
    name?: string;
    age?: number | null;
    grade?: string | null;
  };
}

const categoryOptions = [
  { value: "learning", label: "学习力" },
  { value: "creativity", label: "创造力和综合能力" },
  { value: "talent", label: "个人天赋" },
  { value: "parent_child", label: "亲子关系" },
];

export default function AdminAssessmentPage() {
  const [mode, setMode] = useState<Mode>("list");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [importBucket, setImportBucket] = useState<ImportBucket>("learning");
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 表单状态
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("learning");
  const [description, setDescription] = useState("");
  const [ageMin, setAgeMin] = useState(8);
  const [ageMax, setAgeMax] = useState(18);
  const [questions, setQuestions] = useState<Question[]>([]);

  // 审核状态
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [reportDraftText, setReportDraftText] = useState("");
  const [consultantNotes, setConsultantNotes] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

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
    setTitle(""); setCategory("learning"); setDescription("");
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

  const normalizeReportText = (data: ReportContent | null | undefined) => JSON.stringify(data || {}, null, 2);

  const openReviewReport = async (reportId: string) => {
    setReviewingId(reportId);
    setReviewLoading(true);
    try {
      const data = await api.adminGetAssessmentReport(reportId) as ReportDetail;
      setReportDetail(data);
      setReportDraftText(normalizeReportText(data.final_content_json || data.ai_content_json || data.content_json));
      setConsultantNotes(data.consultant_notes || "");
    } catch {
      alert("加载报告失败");
      setReviewingId(null);
      setReportDetail(null);
      setReportDraftText("");
      setConsultantNotes("");
    } finally {
      setReviewLoading(false);
    }
  };

  const submitReviewReport = async (action: "save_draft" | "publish") => {
    if (!reviewingId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = reportDraftText.trim() ? JSON.parse(reportDraftText) : {};
    } catch {
      alert("报告 JSON 格式有误，请先修正后再提交");
      return;
    }
    setReviewSaving(true);
    try {
      await api.adminReviewReport(reviewingId, {
        consultant_notes: consultantNotes || undefined,
        final_content_json: parsed,
        action,
      });
      setReviewingId(null);
      setReportDetail(null);
      setReportDraftText("");
      setConsultantNotes("");
      await loadRecords();
    } catch {
      alert(action === "publish" ? "发布失败" : "保存失败");
    } finally {
      setReviewSaving(false);
    }
  };

  const parsedDraft = useMemo(() => {
    if (!reportDraftText.trim()) return null;
    try {
      return JSON.parse(reportDraftText) as ReportContent;
    } catch {
      return null;
    }
  }, [reportDraftText]);

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

  const handlePreviewWorkbook = async () => {
    if (!importFile) {
      alert("请选择 Excel 文件");
      return;
    }
    setPreviewing(true);
    setImportMessage("");
    try {
      const result = await api.adminPreviewAssessmentWorkbook(importFile, importBucket);
      setPreview(result);
      setShowPreview(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "预览失败");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) {
      alert("请选择 Excel 文件");
      return;
    }
    setImporting(true);
    setImportMessage("");
    try {
      const result = await api.adminImportAssessmentWorkbook(importFile, importBucket);
      setImportMessage(`导入并发布完成：新增 ${result.created} 个，更新 ${result.updated} 个，共 ${result.total} 个模板`);
      setImportFile(null);
      setPreview(null);
      setShowPreview(false);
      await loadTemplates();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && <button onClick={() => { setMode("list"); resetForm(); }} className="text-white/60 text-xl">‹</button>}
              <h1 className="text-lg font-bold text-white">测评管理</h1>
            </div>
            <div className="flex gap-2">
              {mode === "list" && (
                <>
                  <label className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg cursor-pointer">
                    选择Excel
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <select
                    value={importBucket}
                    onChange={(e) => setImportBucket(e.target.value as ImportBucket)}
                    className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg border border-white/10 outline-none"
                  >
                    {categoryOptions.map((item) => (
                      <option key={item.value} value={item.value} className="text-slate-900">
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handlePreviewWorkbook}
                    disabled={!importFile || previewing}
                    className="px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg disabled:opacity-50"
                  >
                    {previewing ? "预览中..." : "预览测评"}
                  </button>
                  <button onClick={() => { loadRecords(); setMode("records"); }} className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg">答题记录</button>
                  <button onClick={() => { resetForm(); setMode("create"); }} className="px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg">新建测评</button>
                </>
              )}
            </div>
          </div>
        </div>

          <div className="max-w-2xl mx-auto px-4 mt-6">

          {mode === "list" && importMessage && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {importMessage}
            </div>
          )}

          {/* 模板列表 */}
          {mode === "list" && (
            <div className="space-y-3">
              {loading && <p className="text-center text-muted-foreground text-sm">加载中...</p>}
              {!loading && templates.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">暂无测评模板，点击右上角「新建测评」创建</p>}
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
                        onClick={() => openReviewReport(r.report_id!)}
                        className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full"
                      >
                        审核发布
                      </button>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">无报告</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {reviewingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4">
          <div className="w-full max-w-6xl rounded-2xl bg-background shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">审核测评报告</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {reportDetail ? `${reportDetail.family_name} · ${reportDetail.child_name} · ${reportDetail.template_title}` : "正在加载报告详情..."}
                </p>
              </div>
              <button className="text-sm text-muted-foreground" onClick={() => { setReviewingId(null); setReportDetail(null); setReportDraftText(""); setConsultantNotes(""); }}>
                关闭
              </button>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-0 min-h-0 flex-1">
              <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5 space-y-4 border-r border-border">
                {reviewLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">加载中...</div>
                ) : reportDetail && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">当前状态</div>
                        <div className="mt-1 font-medium text-foreground">{reportDetail.status}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">报告分类</div>
                        <div className="mt-1 font-medium text-foreground">{categoryOptions.find((c) => c.value === reportDetail.category)?.label || reportDetail.category}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">家庭 / 孩子</div>
                        <div className="mt-1 font-medium text-foreground">{reportDetail.family_name} / {reportDetail.child_name}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">模板名称</div>
                        <div className="mt-1 font-medium text-foreground">{reportDetail.template_title}</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground">最终报告内容 JSON</label>
                      <textarea
                        className="w-full mt-1 min-h-[340px] px-4 py-3 bg-muted/40 border border-border rounded-xl text-xs font-mono leading-6"
                        value={reportDraftText}
                        onChange={(e) => setReportDraftText(e.target.value)}
                        spellCheck={false}
                      />
                      <div className={`mt-2 text-xs ${parsedDraft ? 'text-emerald-600' : 'text-red-500'}`}>
                        {parsedDraft ? 'JSON 格式正常' : 'JSON 格式有误，请修正后再发布'}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground">额外评价 / 鼓励</label>
                      <textarea
                        className="w-full mt-1 px-4 py-3 bg-muted/40 border border-border rounded-xl text-sm leading-6"
                        value={consultantNotes}
                        onChange={(e) => setConsultantNotes(e.target.value)}
                        rows={4}
                        placeholder="可以写给家长的额外评价、鼓励、下一步提醒"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => submitReviewReport('save_draft')}
                        disabled={reviewSaving}
                        className="flex-1 py-3 bg-muted text-foreground rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        {reviewSaving ? '保存中...' : '保存修改'}
                      </button>
                      <button
                        onClick={() => submitReviewReport('publish')}
                        disabled={reviewSaving}
                        className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        {reviewSaving ? '提交中...' : '确认发布'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5 bg-muted/20 space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">预览</div>
                  {parsedDraft ? (
                    <>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{parsedDraft.child_summary?.name ? `${parsedDraft.child_summary.name} 的学习力报告` : '学习力报告'}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{parsedDraft.summary || '-'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground">总分</div>
                          <div className="text-2xl font-bold text-foreground">{typeof parsedDraft.overall_score === 'number' ? `${parsedDraft.overall_score}/100` : (parsedDraft.overall_score || '-')}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">{parsedDraft.overall_level || '-'}</div>
                      {parsedDraft.profile_tags && parsedDraft.profile_tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {parsedDraft.profile_tags.map((tag) => <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary">{tag}</span>)}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">等待有效 JSON 预览</p>
                  )}
                </div>

                {parsedDraft?.module_reports && parsedDraft.module_reports.length > 0 && (
                  <div className="space-y-3">
                    {parsedDraft.module_reports.map((module) => (
                      <div key={module.key} className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-foreground">{module.name}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{module.level || '-'}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-foreground">{module.score ?? 0}</div>
                            <div className="text-[10px] text-muted-foreground">/100</div>
                          </div>
                        </div>
                        {module.highlights && module.highlights.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs text-muted-foreground mb-1">亮点</div>
                            <ul className="space-y-1 text-sm text-foreground">
                              {module.highlights.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                        )}
                        {module.risks && module.risks.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs text-muted-foreground mb-1">优先关注</div>
                            <ul className="space-y-1 text-sm text-foreground">
                              {module.risks.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                        )}
                        {module.suggestions && module.suggestions.length > 0 && (
                          <div className="mt-3 rounded-xl bg-amber-50 p-3">
                            <div className="text-xs text-muted-foreground mb-1">建议</div>
                            <ul className="space-y-1 text-sm text-orange-700">
                              {module.suggestions.map((item) => <li key={item}>→ {item}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {parsedDraft?.strengths && parsedDraft.strengths.length > 0 && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">优势</div>
                    <ul className="space-y-1 text-sm text-foreground">
                      {parsedDraft.strengths.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {parsedDraft?.areas_to_develop && parsedDraft.areas_to_develop.length > 0 && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">优先练习点</div>
                    <ul className="space-y-1 text-sm text-foreground">
                      {parsedDraft.areas_to_develop.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {parsedDraft?.suggestions && parsedDraft.suggestions.length > 0 && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">行动建议</div>
                    <ul className="space-y-1 text-sm text-foreground">
                      {parsedDraft.suggestions.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {parsedDraft?.next_steps && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">下一步</div>
                    <div className="space-y-3 text-sm">
                      {parsedDraft.next_steps.student && parsedDraft.next_steps.student.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">学生</div>
                          <ul className="space-y-1 text-foreground">
                            {parsedDraft.next_steps.student.map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                      {parsedDraft.next_steps.parent && parsedDraft.next_steps.parent.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">家长</div>
                          <ul className="space-y-1 text-foreground">
                            {parsedDraft.next_steps.parent.map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                      {parsedDraft.next_steps['30_days'] && parsedDraft.next_steps['30_days'].length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">30天</div>
                          <ul className="space-y-1 text-foreground">
                            {parsedDraft.next_steps['30_days'].map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {consultantNotes && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">额外评价 / 鼓励</div>
                    <p className="text-sm leading-relaxed text-foreground">{consultantNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-background p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">导入预览</h2>
                <p className="text-xs text-muted-foreground mt-1">先确认内容和分类，再写入数据库并发布到用户端。</p>
              </div>
              <button className="text-muted-foreground text-sm" onClick={() => setShowPreview(false)}>关闭</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">测评名称</div>
                <div className="mt-1 font-medium">{preview.title}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">分类</div>
                <div className="mt-1 font-medium">{preview.bucket_label}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">题目数</div>
                <div className="mt-1 font-medium">{preview.question_count}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">导入章节</div>
                <div className="mt-1 font-medium">{preview.sheet_count}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-2">将导入的 sheet</div>
                <div className="flex flex-wrap gap-2">
                  {preview.included_sheets.map((sheet) => (
                    <span key={sheet} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{sheet}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">不会导入的 sheet</div>
                <div className="flex flex-wrap gap-2">
                  {preview.excluded_sheets.map((sheet) => (
                    <span key={sheet} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{sheet}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">分段预览</div>
                <div className="space-y-2">
                  {preview.sections.map((section) => (
                    <div key={section.sheet_name} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{section.sheet_name}</span>
                        <span className="text-muted-foreground">{section.question_count}题</span>
                      </div>
                      {section.sample_questions.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                          {section.sample_questions.map((item, idx) => (
                            <li key={`${section.sheet_name}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {importing ? "导入发布中..." : "确认导入并发布"}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-3 border border-border rounded-xl text-sm text-muted-foreground"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
