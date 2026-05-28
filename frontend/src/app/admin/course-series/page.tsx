"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

interface Series {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  module_count: number;
  lesson_count: number;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: Array<{ id: string; title: string; content_type: string }>;
}

interface Course {
  id: string;
  title: string;
  content_type: string;
}

type Mode = "list" | "create-series" | "manage-series";

export default function AdminCourseSeriesPage() {
  const [mode, setMode] = useState<Mode>("list");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // 创建系列表单
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  // 管理系列
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  // 分配课节
  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignModuleId, setAssignModuleId] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, c] = await Promise.all([
        api.request("/course-series/admin/all"),
        api.request("/courses?size=200"),
      ]);
      setSeriesList(s);
      setCourses(Array.isArray(c) ? c : []);
    } catch {} finally { setLoading(false); }
  };

  const handleCreateSeries = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.request("/course-series/admin/series", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, is_published: isPublished, sort_order: 0 }),
      });
      setTitle(""); setDescription(""); setMode("list");
      await loadData();
    } catch { alert("创建失败"); }
    finally { setSaving(false); }
  };

  const handleManageSeries = async (seriesId: string) => {
    setActiveSeriesId(seriesId);
    try {
      const detail = await api.request(`/course-series/${seriesId}`);
      setModules(detail.modules || []);
    } catch {}
    setMode("manage-series");
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim() || !activeSeriesId) return;
    try {
      await api.request(`/course-series/admin/series/${activeSeriesId}/modules`, {
        method: "POST",
        body: JSON.stringify({ title: newModuleTitle.trim(), sort_order: modules.length }),
      });
      setNewModuleTitle("");
      await handleManageSeries(activeSeriesId);
    } catch { alert("添加失败"); }
  };

  const handleAssignLesson = async () => {
    if (!assignCourseId || !activeSeriesId) return;
    try {
      const params = new URLSearchParams({
        series_id: activeSeriesId,
        ...(assignModuleId ? { module_id: assignModuleId } : {}),
        lesson_order: "0",
      });
      await api.request(`/course-series/admin/lessons/${assignCourseId}/assign?${params}`, { method: "PUT" });
      setAssignCourseId("");
      await handleManageSeries(activeSeriesId);
      alert("分配成功");
    } catch { alert("分配失败"); }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && <button onClick={() => setMode("list")} className="text-white/60 text-xl">‹</button>}
              <h1 className="text-lg font-bold text-white">课程系列管理</h1>
            </div>
            {mode === "list" && (
              <button onClick={() => setMode("create-series")} className="px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg">新建系列</button>
            )}
          </div>
          <p className="text-white/60 text-xs mt-1">系列 → 单元 → 课节（三级结构）</p>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-6">

          {/* 系列列表 */}
          {mode === "list" && (
            <div className="space-y-3">
              {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}
              {!loading && seriesList.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">暂无课程系列，点击右上角创建</p>}
              {seriesList.map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{s.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.module_count}个单元 · {s.lesson_count}节课 · {s.is_published ? "已发布" : "草稿"}
                      </p>
                    </div>
                    <button onClick={() => handleManageSeries(s.id)} className="text-xs text-primary">管理</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 创建系列 */}
          {mode === "create-series" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">系列名称</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：AI学习力系列" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">简介</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="系列简介" rows={3} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                <span>发布</span>
              </label>
              <button onClick={handleCreateSeries} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? "创建中..." : "创建系列"}
              </button>
            </div>
          )}

          {/* 管理系列（单元+课节） */}
          {mode === "manage-series" && (
            <div className="space-y-6">
              {/* 单元列表 */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">单元列表</h2>
                {modules.length === 0 && <p className="text-xs text-muted-foreground">暂无单元</p>}
                {modules.map((m) => (
                  <div key={m.id} className="bg-card border border-border rounded-xl p-3 mb-2">
                    <h4 className="font-medium text-foreground text-sm">{m.title}</h4>
                    {m.lessons.length > 0 && (
                      <div className="mt-2 space-y-1 pl-3 border-l-2 border-primary/20">
                        {m.lessons.map((l) => (
                          <p key={l.id} className="text-xs text-muted-foreground">
                            {l.content_type === "video" ? "🎬" : "📄"} {l.title}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* 添加单元 */}
                <div className="flex gap-2 mt-3">
                  <input className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="新单元名称" />
                  <button onClick={handleAddModule} className="px-4 py-2 bg-primary text-white text-xs rounded-lg">添加</button>
                </div>
              </div>

              {/* 分配课节到单元 */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">分配课节到此系列</h2>
                <div className="space-y-2">
                  <select className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={assignCourseId} onChange={(e) => setAssignCourseId(e.target.value)}>
                    <option value="">选择课节...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.content_type === "video" ? "🎬" : "📄"} {c.title}</option>
                    ))}
                  </select>
                  <select className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={assignModuleId} onChange={(e) => setAssignModuleId(e.target.value)}>
                    <option value="">不归属单元（独立课节）</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                  <button onClick={handleAssignLesson} disabled={!assignCourseId} className="w-full py-2.5 bg-primary text-white text-sm rounded-xl disabled:opacity-50">
                    分配到此系列
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
