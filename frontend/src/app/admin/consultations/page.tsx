"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

interface ConsultRecord {
  id: string;
  booking_id: string;
  family_name: string;
  child_name: string;
  consultant_name: string;
  booking_date: string;
  topic: string;
  has_transcript: boolean;
  has_summary: boolean;
  has_plan: boolean;
  status: string;
  created_at: string;
}

export default function AdminConsultationsPage() {
  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [keyFindings, setKeyFindings] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const data = await api.adminGetConsultationRecords();
      setRecords(data);
    } catch {} finally { setLoading(false); }
  };

  const handleSaveTranscript = async (id: string) => {
    if (!transcript.trim()) return;
    setSaving(true);
    try {
      await api.adminUploadTranscript(id, transcript.trim());
      await loadRecords();
      setTranscript("");
    } catch { alert("保存失败"); }
    finally { setSaving(false); }
  };

  const handleSaveSummary = async (id: string) => {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      const findings = keyFindings.split("\n").map(s => s.trim()).filter(Boolean);
      await api.adminUpdateConsultationSummary(id, summary.trim(), findings.length > 0 ? findings : undefined);
      await loadRecords();
      setSummary("");
      setKeyFindings("");
    } catch { alert("保存失败"); }
    finally { setSaving(false); }
  };

  const handleComplete = async (id: string) => {
    if (!confirm("确认完成？完成后数据将回流到学生画像。")) return;
    try {
      await api.adminCompleteConsultation(id);
      await loadRecords();
      setActiveId(null);
    } catch { alert("操作失败"); }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <h1 className="text-lg font-bold text-white">咨询记录管理</h1>
          <p className="text-white/60 text-xs mt-1">上传逐字稿、录入总结、制定方案</p>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-6 space-y-3">
          {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}
          {!loading && records.length === 0 && (
            <p className="text-center text-muted-foreground text-sm mt-8">暂无咨询记录。请先在预约管理中完成预约，然后创建咨询记录。</p>
          )}

          {records.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground text-sm">{r.child_name} · {r.consultant_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.family_name} · {r.booking_date} · {r.topic || "无主题"}
                  </p>
                  <div className="flex gap-2 mt-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.has_transcript ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      逐字稿{r.has_transcript ? "✓" : ""}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.has_summary ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      总结{r.has_summary ? "✓" : ""}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.has_plan ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      方案{r.has_plan ? "✓" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {r.status === "completed" ? (
                    <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">已完成</span>
                  ) : (
                    <button
                      onClick={() => setActiveId(activeId === r.id ? null : r.id)}
                      className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                    >
                      {activeId === r.id ? "收起" : "编辑"}
                    </button>
                  )}
                </div>
              </div>

              {activeId === r.id && r.status !== "completed" && (
                <div className="mt-4 pt-3 border-t border-border space-y-4">
                  {/* 逐字稿 */}
                  {!r.has_transcript && (
                    <div>
                      <label className="text-xs font-medium text-foreground">上传逐字稿</label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="粘贴腾讯会议逐字稿..."
                        rows={5}
                      />
                      <button onClick={() => handleSaveTranscript(r.id)} disabled={saving} className="mt-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg disabled:opacity-50">
                        {saving ? "保存中..." : "保存逐字稿"}
                      </button>
                    </div>
                  )}

                  {/* 总结 */}
                  {!r.has_summary && (
                    <div>
                      <label className="text-xs font-medium text-foreground">咨询总结</label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="本次咨询的核心内容和建议..."
                        rows={4}
                      />
                      <label className="text-xs font-medium text-foreground mt-2 block">关键发现（每行一个）</label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                        value={keyFindings}
                        onChange={(e) => setKeyFindings(e.target.value)}
                        placeholder="孩子对编程有浓厚兴趣&#10;学习动力来自成就感&#10;需要更多社交互动"
                        rows={3}
                      />
                      <button onClick={() => handleSaveSummary(r.id)} disabled={saving} className="mt-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg disabled:opacity-50">
                        {saving ? "保存中..." : "保存总结"}
                      </button>
                    </div>
                  )}

                  {/* 完成按钮 */}
                  {r.has_transcript && r.has_summary && (
                    <button onClick={() => handleComplete(r.id)} className="w-full py-2.5 bg-green-600 text-white text-sm rounded-lg">
                      完成咨询（数据回流到画像）
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
