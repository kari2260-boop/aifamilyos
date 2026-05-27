"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { BlurFade } from "@/components/ui/blur-fade";

interface Child {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  interests: string | null;
  learning_challenges: string | null;
  parent_expectations: string | null;
}

interface Tag {
  id: string;
  tag_name: string;
  tag_category: string;
  confidence: number;
  source: string;
}

interface FamilyData {
  id: string;
  family_name: string;
  city: string | null;
  membership_level: string;
  monthly_quota: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ phone: string; role: string } | null>(null);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [tags, setTags] = useState<Record<string, Tag[]>>({});
  const [refreshingTags, setRefreshingTags] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    Promise.all([
      api.getMe().catch(() => null),
      api.getMyFamily().catch(() => null),
      api.getChildren().catch(() => []),
    ]).then(([me, f, c]) => {
      if (me) {
        setUser({ phone: me.phone, role: me.role || "parent" });
      }
      setFamily(f);
      setChildren(c || []);
      // load tags for each child
      (c || []).forEach((child: Child) => {
        api.getChildTags(child.id).then((t) => setTags((prev) => ({ ...prev, [child.id]: t }))).catch(() => {});
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveChild = async (child: Child) => {
    try {
      await api.updateChild(child.id, {
        name: child.name,
        age: child.age ?? undefined,
        grade: child.grade ?? undefined,
        interests: child.interests ?? undefined,
        learning_challenges: child.learning_challenges ?? undefined,
        parent_expectations: child.parent_expectations ?? undefined,
      });
      setChildren((prev) => prev.map((c) => (c.id === child.id ? child : c)));
      setEditingChild(null);
    } catch {
      alert("保存失败");
    }
  };

  const handleRefreshTags = async (childId: string) => {
    setRefreshingTags(childId);
    try {
      const newTags = await api.refreshChildTags(childId);
      setTags((prev) => ({ ...prev, [childId]: newTags }));
    } catch {
      alert("刷新失败");
    } finally {
      setRefreshingTags(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const membershipLabel: Record<string, string> = {
    free: "免费版",
    trial: "试用中",
    premium: "高级会员",
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-24">
        {/* Banner */}
        <BlurFade delay={0.05}>
          <div className="bg-gradient-to-br from-primary to-[#8B7355] px-6 pt-14 pb-10 rounded-b-3xl">
            <h1 className="text-2xl font-bold text-white">我的</h1>
            {user && (
              <p className="text-white/80 text-sm mt-2">{user.phone} · {user.role === "admin" ? "管理员" : "家长"}</p>
            )}
            {family && (
              <div className="mt-3 flex items-center gap-2">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white">
                  {family.family_name}
                </span>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white">
                  {membershipLabel[family.membership_level] || family.membership_level}
                </span>
                {family.city && (
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white">
                    {family.city}
                  </span>
                )}
              </div>
            )}
          </div>
        </BlurFade>

        <div className="max-w-2xl mx-auto px-4">
          {/* 管理员入口 */}
          {user?.role === "admin" && (
          <BlurFade delay={0.08}>
            <button onClick={() => router.push("/admin")} className="w-full mt-4 bg-card rounded-2xl shadow-sm p-4 flex items-center justify-between transition-all hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚙️</span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">管理后台</p>
                  <p className="text-xs text-muted-foreground">课程、文章、资料、家庭管理</p>
                </div>
              </div>
              <span className="text-muted-foreground/40 text-xl">›</span>
            </button>
          </BlurFade>
          )}

          {/* 快捷入口 */}
          <BlurFade delay={0.1}>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => router.push("/reports")} className="bg-card rounded-2xl shadow-sm p-4 text-left transition-all hover:shadow-md">
                <span className="text-2xl">🌱</span>
                <p className="text-sm font-medium text-foreground mt-2">成长报告</p>
                <p className="text-xs text-muted-foreground mt-0.5">查看月度分析</p>
              </button>
              <button onClick={() => router.push("/booking")} className="bg-card rounded-2xl shadow-sm p-4 text-left transition-all hover:shadow-md">
                <span className="text-2xl">📅</span>
                <p className="text-sm font-medium text-foreground mt-2">预约咨询</p>
                <p className="text-xs text-muted-foreground mt-0.5">1v1 专家指导</p>
              </button>
            </div>
          </BlurFade>

          {/* 孩子列表 */}
          <BlurFade delay={0.15}>
            <div className="mt-6">
              <h2 className="font-semibold text-foreground mb-3">孩子档案</h2>
              {children.length === 0 && (
                <div className="bg-card rounded-2xl shadow-sm p-6 text-center">
                  <p className="text-muted-foreground text-sm">暂无孩子信息</p>
                </div>
              )}
              <div className="space-y-3">
                {children.map((child) => (
                  <div key={child.id} className="bg-card rounded-2xl shadow-sm p-4">
                    {editingChild?.id === child.id ? (
                      <div className="space-y-3">
                        <input className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm" value={editingChild.name} onChange={(e) => setEditingChild({ ...editingChild, name: e.target.value })} placeholder="姓名" />
                        <div className="grid grid-cols-2 gap-2">
                          <input className="px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm" type="number" value={editingChild.age ?? ""} onChange={(e) => setEditingChild({ ...editingChild, age: e.target.value ? Number(e.target.value) : null })} placeholder="年龄" />
                          <input className="px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm" value={editingChild.grade ?? ""} onChange={(e) => setEditingChild({ ...editingChild, grade: e.target.value })} placeholder="年级" />
                        </div>
                        <textarea className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm" value={editingChild.interests ?? ""} onChange={(e) => setEditingChild({ ...editingChild, interests: e.target.value })} placeholder="兴趣爱好" rows={2} />
                        <textarea className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm" value={editingChild.learning_challenges ?? ""} onChange={(e) => setEditingChild({ ...editingChild, learning_challenges: e.target.value })} placeholder="学习挑战" rows={2} />
                        <textarea className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm" value={editingChild.parent_expectations ?? ""} onChange={(e) => setEditingChild({ ...editingChild, parent_expectations: e.target.value })} placeholder="家长期望" rows={2} />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveChild(editingChild)} className="flex-1 py-2 bg-primary text-white text-sm rounded-xl font-medium">保存</button>
                          <button onClick={() => setEditingChild(null)} className="flex-1 py-2 bg-muted text-foreground text-sm rounded-xl font-medium">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#8B7355] flex items-center justify-center text-white font-bold text-sm">{child.name[0]}</div>
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">{child.name}</h3>
                              <p className="text-xs text-muted-foreground">{child.age ? `${child.age}岁` : ""}{child.grade ? ` · ${child.grade}` : ""}</p>
                            </div>
                          </div>
                          <button onClick={() => setEditingChild({ ...child })} className="text-xs text-primary font-medium">编辑</button>
                        </div>
                        {child.interests && <p className="text-xs text-muted-foreground mt-3"><span className="font-medium text-foreground">兴趣：</span>{child.interests}</p>}
                        {child.learning_challenges && <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground">挑战：</span>{child.learning_challenges}</p>}
                        {/* Tags */}
                        {tags[child.id] && tags[child.id].length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-foreground">AI 标签</span>
                              <button onClick={() => handleRefreshTags(child.id)} disabled={refreshingTags === child.id} className="text-xs text-primary disabled:opacity-50">
                                {refreshingTags === child.id ? "刷新中..." : "刷新"}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {tags[child.id].map((tag) => (
                                <span key={tag.id} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{tag.tag_name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </BlurFade>

          {/* 退出登录 */}
          <BlurFade delay={0.25}>
            <div className="mt-8">
              <button onClick={handleLogout} className="w-full py-3 bg-card rounded-2xl shadow-sm text-sm text-destructive font-medium hover:shadow-md transition-all">
                退出登录
              </button>
            </div>
          </BlurFade>
        </div>
      </div>
    </AuthGuard>
  );
}
