"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  resource_type: string;
  category: string | null;
  is_pinned: boolean;
  sort_order: number;
}

type Mode = "list" | "create" | "edit";

const typeLabels: Record<string, string> = {
  feishu_doc: "飞书文档",
  tencent_doc: "腾讯文档",
  questionnaire: "问卷调查",
  video: "视频课程",
  other: "其他链接",
};

export default function AdminResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [resourceType, setResourceType] = useState("other");
  const [category, setCategory] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => { loadResources(); }, []);

  const loadResources = async () => {
    try {
      const data = await api.getResources();
      setResources(Array.isArray(data) ? data : data.items || []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setUrl(""); setResourceType("other");
    setCategory(""); setIsPinned(false); setSortOrder(0);
  };

  const handleCreate = () => { resetForm(); setMode("create"); setEditId(null); };

  const handleEdit = (r: Resource) => {
    setEditId(r.id);
    setTitle(r.title);
    setDescription(r.description || "");
    setUrl(r.url);
    setResourceType(r.resource_type);
    setCategory(r.category || "");
    setIsPinned(r.is_pinned);
    setSortOrder(r.sort_order);
    setMode("edit");
  };

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) { alert("请输入标题和链接"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      url: url.trim(),
      resource_type: resourceType,
      category: category.trim() || null,
      is_pinned: isPinned,
      sort_order: sortOrder,
    };
    try {
      if (mode === "create") {
        await api.adminCreateResource(payload);
      } else if (editId) {
        await api.adminUpdateResource(editId, payload);
      }
      setMode("list");
      resetForm();
      await loadResources();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此资料？")) return;
    try {
      await api.adminDeleteResource(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch { alert("删除失败"); }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <BlurFade delay={0.05}>
        <div className="bg-gradient-to-br from-primary to-[#8B7355] px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && <button onClick={() => setMode("list")} className="text-white/60 text-xl">‹</button>}
              <h1 className="text-lg font-bold text-white">资料管理</h1>
            </div>
            <div className="flex items-center gap-3">
              {mode === "list" && <button onClick={handleCreate} className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">+ 新建</button>}
              <button onClick={() => router.push("/admin")} className="text-white/60 text-sm">返回</button>
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="px-4 mt-4">
        {mode === "list" && (
          <div className="space-y-3">
            {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}
            {!loading && resources.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">暂无资料，点击右上角新建</p>}
            {resources.map((r, i) => (
              <BlurFade key={r.id} delay={0.1 + i * 0.03}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {r.is_pinned && <span className="text-xs">📌</span>}
                          <h3 className="font-semibold text-foreground text-sm">{r.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{typeLabels[r.resource_type] || r.resource_type}</span>
                          {r.category && <span className="text-xs text-muted-foreground">{r.category}</span>}
                        </div>
                        {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button onClick={() => handleEdit(r)} className="text-xs text-primary">编辑</button>
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-destructive">删除</button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>
            ))}
          </div>
        )}

        {(mode === "create" || mode === "edit") && (
          <BlurFade delay={0.1}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">标题 *</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="资料标题" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">描述</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="资料描述" rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">链接 *</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">类型</label>
                  <select className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
                    <option value="feishu_doc">飞书文档</option>
                    <option value="tencent_doc">腾讯文档</option>
                    <option value="questionnaire">问卷调查</option>
                    <option value="video">视频课程</option>
                    <option value="other">其他链接</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">分类</label>
                  <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如：学习资料" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded" />
                  <span className="text-foreground">置顶</span>
                </label>
                <div>
                  <label className="text-sm font-medium text-foreground">排序</label>
                  <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 shadow-sm">
                {saving ? "保存中..." : mode === "create" ? "创建资料" : "保存修改"}
              </button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
