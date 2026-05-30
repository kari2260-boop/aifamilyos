"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Bold, Heading2, Image as ImageIcon, Italic, List, ListOrdered, Minus, Quote } from "lucide-react";
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
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
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

  const replaceSelection = (before: string, after = "", fallback = "内容", block = false) => {
    const el = contentRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = contentMarkdown.slice(start, end);
    const text = selected || fallback;
    const leadingBreak = block && start > 0 && !contentMarkdown.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const trailingBreak = block ? "\n\n" : "";
    const next = `${contentMarkdown.slice(0, start)}${leadingBreak}${before}${text}${after}${trailingBreak}${contentMarkdown.slice(end)}`;
    const cursor = start + leadingBreak.length + before.length + text.length + after.length + trailingBreak.length;

    setContentMarkdown(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertLinePrefix = (prefix: string, fallback = "标题") => {
    const el = contentRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = contentMarkdown.slice(start, end) || fallback;
    const lineStart = contentMarkdown.lastIndexOf("\n", start - 1) + 1;
    const next = `${contentMarkdown.slice(0, lineStart)}${prefix}${selected}${contentMarkdown.slice(end)}`;
    const cursor = lineStart + prefix.length + selected.length;

    setContentMarkdown(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertBlock = (snippet: string) => {
    const el = contentRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const needsLeadingBreak = start > 0 && !contentMarkdown.slice(0, start).endsWith("\n\n");
    const next = `${contentMarkdown.slice(0, start)}${needsLeadingBreak ? "\n\n" : ""}${snippet}${contentMarkdown.slice(end)}`;
    const cursor = start + (needsLeadingBreak ? 2 : 0) + snippet.length;

    setContentMarkdown(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertImageByUrl = () => {
    const url = window.prompt("请输入图片地址");
    if (!url) return;
    const alt = window.prompt("请输入图片说明（可选）", "图片") || "图片";
    insertBlock(`![${alt}](${url})`);
  };

  const uploadAndInsertImage = async (file?: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${api.getBaseUrl()}/upload/image`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      if (!res.ok) throw new Error("上传失败");
      const data = await res.json();
      const baseUrl = api.getBaseUrl();
      const imageUrl = baseUrl.startsWith("http") ? new URL(data.url, baseUrl).toString() : data.url;
      const alt = file.name.replace(/\.[^.]+$/, "") || "图片";
      insertBlock(`![${alt}](${imageUrl})`);
      alert("图片上传成功");
    } catch {
      alert("图片上传失败");
    }
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
        <div className="bg-gradient-to-br from-primary to-[#8B7355] px-5 pt-12 pb-8 rounded-b-[2rem]">
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
                <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-2">
                  <button type="button" title="标题" onClick={() => insertLinePrefix("## ")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <Heading2 className="h-3.5 w-3.5" />
                    标题
                  </button>
                  <button type="button" title="加粗" onClick={() => replaceSelection("**", "**", "加粗文字")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <Bold className="h-3.5 w-3.5" />
                    加粗
                  </button>
                  <button type="button" title="斜体" onClick={() => replaceSelection("*", "*", "斜体文字")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <Italic className="h-3.5 w-3.5" />
                    斜体
                  </button>
                  <button type="button" title="引用" onClick={() => insertLinePrefix("> ")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <Quote className="h-3.5 w-3.5" />
                    引用
                  </button>
                  <button type="button" title="无序列表" onClick={() => insertBlock("- 要点一\n- 要点二")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <List className="h-3.5 w-3.5" />
                    列表
                  </button>
                  <button type="button" title="有序列表" onClick={() => insertBlock("1. 第一条\n2. 第二条")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <ListOrdered className="h-3.5 w-3.5" />
                    编号
                  </button>
                  <button type="button" title="插入空行" onClick={() => insertBlock("")} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <Minus className="h-3.5 w-3.5" />
                    空行
                  </button>
                  <button type="button" title="插入图片链接" onClick={insertImageByUrl} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <ImageIcon className="h-3.5 w-3.5" />
                    图片链接
                  </button>
                  <button type="button" title="上传图片并插入" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    <ImageIcon className="h-3.5 w-3.5" />
                    上传图片
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void uploadAndInsertImage(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
                <textarea
                  ref={contentRef}
                  className="w-full mt-2 px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm font-mono leading-6 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={contentMarkdown}
                  onChange={(e) => setContentMarkdown(e.target.value)}
                  placeholder="支持 Markdown 格式。建议每个段落之间留空一行，可用上方按钮插入标题、列表和图片。"
                  rows={14}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  图片会以 Markdown 形式写入正文，阅读页会自动渲染。段落之间留空一行，就会有更好的阅读节奏。
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">实时预览</span>
                  <span className="text-xs text-muted-foreground">Markdown 渲染</span>
                </div>
                <div className="prose prose-sm prose-neutral max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90 prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-img:rounded-xl prose-img:shadow-sm">
                  {contentMarkdown.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                      {contentMarkdown}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">这里会显示正文预览。</p>
                  )}
                </div>
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
