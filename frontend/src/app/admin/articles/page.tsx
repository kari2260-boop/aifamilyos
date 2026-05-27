"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Article {
  id: string;
  title: string;
  summary: string | null;
  author: string | null;
  category: string | null;
  is_published: boolean;
  published_at: string | null;
}

type Mode = "list" | "create" | "edit";

export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isFree, setIsFree] = useState(true);

  useEffect(() => { loadArticles(); }, []);

  const loadArticles = async () => {
    try {
      const data = await api.getArticles({ size: 100 });
      setArticles(Array.isArray(data) ? data : data.items || []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setTitle(""); setSummary(""); setAuthor(""); setCategory("");
    setTags(""); setContentMarkdown(""); setIsPublished(true); setIsFree(true);
  };

  const handleCreate = () => { resetForm(); setMode("create"); setEditId(null); };

  const handleEdit = (article: Article) => {
    setEditId(article.id);
    setTitle(article.title);
    setSummary(article.summary || "");
    setAuthor(article.author || "");
    setCategory(article.category || "");
    setIsPublished(article.is_published);
    setContentMarkdown("");
    setTags("");
    setIsFree(true);
    setMode("edit");
    api.getArticle(article.id).then((full) => {
      setContentMarkdown(full.content_markdown || "");
      setTags((full.tags || []).join(", "));
      setIsFree(full.is_free !== false);
    }).catch(() => {});
  };

  const handleSave = async () => {
    if (!title.trim()) { alert("请输入标题"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      summary: summary.trim() || null,
      author: author.trim() || null,
      category: category.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      content_markdown: contentMarkdown.trim() || null,
      is_published: isPublished,
      is_free: isFree,
    };
    try {
      if (mode === "create") {
        await api.adminCreateArticle(payload);
      } else if (editId) {
        await api.adminUpdateArticle(editId, payload);
      }
      setMode("list");
      resetForm();
      await loadArticles();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此文章？")) return;
    try {
      await api.adminDeleteArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch { alert("删除失败"); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <BlurFade delay={0.05}>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && <button onClick={() => setMode("list")} className="text-white/60 text-xl">‹</button>}
              <h1 className="text-lg font-bold text-white">文章管理</h1>
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
            {!loading && articles.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">暂无文章，点击右上角新建</p>}
            {articles.map((article, i) => (
              <BlurFade key={article.id} delay={0.1 + i * 0.03}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm">{article.title}</h3>
                          {!article.is_published && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">草稿</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {article.author && <span className="text-xs text-muted-foreground">{article.author}</span>}
                          {article.category && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{article.category}</span>}
                        </div>
                        {article.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{article.summary}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button onClick={() => handleEdit(article)} className="text-xs text-primary">编辑</button>
                        <button onClick={() => handleDelete(article.id)} className="text-xs text-destructive">删除</button>
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
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">摘要</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="文章摘要" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">作者</label>
                  <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="作者名" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">分类</label>
                  <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如：教育理念" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">标签（逗号分隔）</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="AI, 教育, 亲子" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">正文（Markdown）</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" value={contentMarkdown} onChange={(e) => setContentMarkdown(e.target.value)} placeholder="支持 Markdown 格式" rows={12} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="rounded" />
                <span className="text-foreground">免费内容</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded" />
                <span className="text-foreground">发布</span>
              </label>
              <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 shadow-sm">
                {saving ? "保存中..." : mode === "create" ? (isPublished ? "创建并发布" : "创建草稿") : (isPublished ? "保存并发布" : "保存为草稿")}
              </button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
