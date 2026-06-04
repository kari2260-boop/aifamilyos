"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Course {
  id: string;
  title: string;
  description: string | null;
  category_name: string | null;
  category_slugs: string[];
  content_type: string;
  is_published: boolean;
  is_free: boolean;
  access_level?: string;
  minimum_plan: string;
  sort_order: number;
  external_url: string | null;
}

type Mode = "list" | "create" | "edit";

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("article");
  const [externalUrl, setExternalUrl] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [category, setCategory] = useState("");
  const [categorySlugs, setCategorySlugs] = useState<string[]>([]); // 多分类
  const [tags, setTags] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [isFree, setIsFree] = useState(true);
  const [minimumPlan, setMinimumPlan] = useState("community"); // free / community / pilot
  const [categories, setCategories] = useState<Array<{id: string; name: string; slug: string}>>([]);

  useEffect(() => {
    loadCourses();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await api.getCourseCategories();
      setCategories(data || []);
    } catch {
      /* empty */
    }
  };

  const loadCourses = async () => {
    try {
      const data = await api.getCourses({ size: 100 });
      setCourses(Array.isArray(data) ? data : data.items || []);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setContentType("article");
    setExternalUrl(""); setContentMarkdown(""); setCategory("");
    setCategorySlugs([]);
    setTags(""); setSortOrder(0); setIsPublished(true); setIsFree(true);
    setMinimumPlan("community");
  };

  const handleCreate = () => { resetForm(); setMode("create"); setEditId(null); };

  const handleEdit = (course: Course) => {
    setEditId(course.id);
    setTitle(course.title);
    setDescription(course.description || "");
    setContentType(course.content_type);
    setExternalUrl(course.external_url || "");
    setSortOrder(course.sort_order);
    setIsPublished(course.is_published);
    setMode("edit");
    // Load full course for markdown content
    api.getCourse(course.id).then((full) => {
      setContentMarkdown(full.content_markdown || "");
      setCategory(full.category_name || "");
      setCategorySlugs(full.category_slugs || []);
      setTags((full.tags || []).join(", "));
      setIsFree(full.is_free !== false);
      setMinimumPlan(full.minimum_plan || "community");
    }).catch(() => {});
  };

  const handleSave = async () => {
    if (!title.trim()) { alert("请输入标题"); return; }
    setSaving(true);
    const coverInput = document.getElementById("cover-url-input") as HTMLInputElement;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      content_type: contentType,
      external_url: externalUrl.trim() || null,
      content_markdown: contentMarkdown.trim() || null,
      cover_url: coverInput?.value || null,
      category_name: category.trim() || null,
      category_slugs: categorySlugs,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      sort_order: sortOrder,
      is_published: isPublished,
      is_free: minimumPlan === "free",
      minimum_plan: minimumPlan,
    };
    try {
      if (mode === "create") {
        await api.adminCreateCourse(payload);
      } else if (editId) {
        await api.adminUpdateCourse(editId, payload);
      }
      setMode("list");
      resetForm();
      await loadCourses();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此课程？")) return;
    try {
      await api.adminDeleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("删除失败");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <BlurFade delay={0.05}>
        <div className="bg-gradient-to-br from-primary to-[#8B7355] px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && (
                <button onClick={() => setMode("list")} className="text-white/60 text-xl">‹</button>
              )}
              <h1 className="text-lg font-bold text-white">课程管理</h1>
            </div>
            <div className="flex items-center gap-3">
              {mode === "list" && (
                <button onClick={handleCreate} className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">+ 新建</button>
              )}
              <button onClick={() => router.push("/admin")} className="text-white/60 text-sm">返回</button>
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="px-4 mt-4">
        {mode === "list" && (
          <div className="space-y-3">
            {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}
            {!loading && courses.length === 0 && (
              <p className="text-center text-muted-foreground text-sm mt-8">暂无课程，点击右上角新建</p>
            )}
            {courses.map((course, i) => (
              <BlurFade key={course.id} delay={0.1 + i * 0.03}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm">{course.title}</h3>
                          {!course.is_published && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">草稿</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{course.content_type === "video" ? "视频" : "文章"}</span>
                          {course.category_name && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{course.category_name}</span>}
                          {course.minimum_plan === "free" && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">免费</span>}
                          {course.minimum_plan === "community" && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">3480起</span>}
                          {course.minimum_plan === "pilot" && <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">9800专属</span>}
                        </div>
                        {course.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{course.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button onClick={() => handleEdit(course)} className="text-xs text-primary">编辑</button>
                        <button onClick={() => handleDelete(course.id)} className="text-xs text-destructive">删除</button>
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
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="课程标题" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">简介</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="课程简介" rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">封面图（可选）</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-primary/10 file:text-primary"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
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
                      // 存到一个隐藏字段，提交时带上
                      (document.getElementById("cover-url-input") as HTMLInputElement).value = data.url;
                      alert("封面上传成功");
                    } catch { alert("上传失败"); }
                  }}
                />
                <input id="cover-url-input" type="hidden" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">类型</label>
                  <select className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={contentType} onChange={(e) => setContentType(e.target.value)}>
                    <option value="article">文章</option>
                    <option value="video">视频</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">分类标签（多选）</label>
                  <div className="mt-2 space-y-2 p-3 bg-muted/50 border border-border rounded-xl">
                    {categories.map((cat) => (
                      <label key={cat.slug} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={categorySlugs.includes(cat.slug)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCategorySlugs([...categorySlugs, cat.slug]);
                            } else {
                              setCategorySlugs(categorySlugs.filter(s => s !== cat.slug));
                            }
                          }}
                          className="w-4 h-4 rounded border-border"
                        />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">可选多个，用户筛选任意一个标签时都能看到此课程</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">可见权限（向上兼容）</label>
                <select className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={minimumPlan} onChange={(e) => setMinimumPlan(e.target.value)}>
                  <option value="free">免费课程（所有人可见）</option>
                  <option value="community">社区会员起（3480 / 9800）</option>
                  <option value="pilot">领航版专属（仅 9800）</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">选"社区会员起"则 3480 和 9800 都能看；选"免费"则所有人都能看</p>
              </div>
              {contentType === "video" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">视频链接（小鹅通/B站等）</label>
                    <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="text-center text-xs text-muted-foreground">或</div>
                  <div>
                    <label className="text-sm font-medium text-foreground">上传本地视频</label>
                    <input
                      type="file"
                      accept="video/mp4,video/mov,video/avi,video/webm"
                      className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-primary/10 file:text-primary"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024 * 1024) { alert("视频不能超过500MB"); return; }
                        const formData = new FormData();
                        formData.append("file", file);
                        try {
                          const res = await fetch(`${api.getBaseUrl()}/upload/video`, {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                            body: formData,
                          });
                          if (!res.ok) throw new Error("上传失败");
                          const data = await res.json();
                          setExternalUrl(data.url);
                          alert(`上传成功: ${file.name}`);
                        } catch { alert("上传失败，请重试"); }
                      }}
                    />
                    {externalUrl && externalUrl.startsWith("/api/files/") && (
                      <p className="text-xs text-green-600 mt-1">已上传本地视频</p>
                    )}
                  </div>
                </div>
              )}
              {contentType === "article" && (
                <div>
                  <label className="text-sm font-medium text-foreground">正文（Markdown）</label>
                  <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" value={contentMarkdown} onChange={(e) => setContentMarkdown(e.target.value)} placeholder="支持 Markdown 格式" rows={10} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">标签（逗号分隔）</label>
                  <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="AI, 教育, 规划" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">排序</label>
                  <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded" />
                <span className="text-foreground">发布</span>
              </label>
              <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 shadow-sm">
                {saving ? "保存中..." : mode === "create" ? "创建课程" : "保存修改"}
              </button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
