"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface FamilyItem {
  id: string;
  family_name: string;
  city: string | null;
  owner_phone: string;
  children_count: number;
  conversations_count: number;
  created_at: string;
}

interface Child {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  interests: string | null;
  learning_challenges: string | null;
  parent_expectations: string | null;
}

interface FamilyDetail {
  id: string;
  family_name: string;
  city: string | null;
  membership_level: string;
  monthly_quota: number;
  owner_phone: string;
  conversations_count: number;
  children: Child[];
}

export default function AdminFamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FamilyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.adminFamilies().then(setFamilies).catch(() => router.push("/admin"));
  }, [router]);

  const handleExpand = async (familyId: string) => {
    if (expandedId === familyId) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(familyId);
    setDetailLoading(true);
    try {
      const d = await api.adminFamilyDetail(familyId);
      setDetail(d);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const membershipLabel: Record<string, string> = { free: "免费版", basic: "基础版", premium: "高级版" };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
        <Link href="/admin" className="text-muted-foreground text-xl hover:text-foreground transition">‹</Link>
        <h1 className="font-semibold text-foreground">家庭列表</h1>
        <span className="text-xs text-muted-foreground ml-auto">{families.length} 个家庭</span>
      </div>

      <div className="p-4 space-y-3">
        {families.map((f) => (
          <Card key={f.id} className="border-0 shadow-sm overflow-hidden">
            <div onClick={() => handleExpand(f.id)} className="p-4 cursor-pointer active:bg-muted/50 transition">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{f.family_name}</h3>
                <span className="text-xs text-muted-foreground">{f.city || "未设置"}</span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>手机: {f.owner_phone}</span>
                <span>孩子: {f.children_count}</span>
                <span>对话: {f.conversations_count}</span>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1">
                注册: {new Date(f.created_at).toLocaleDateString("zh-CN")}
              </p>
            </div>

            {expandedId === f.id && (
              <div className="border-t border-border p-4 bg-muted/30">
                {detailLoading && <p className="text-sm text-muted-foreground">加载中...</p>}
                {!detailLoading && detail && (
                  <div className="space-y-3">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>会员：{membershipLabel[detail.membership_level] || detail.membership_level}</span>
                      <span>月额度：{detail.monthly_quota} 次</span>
                    </div>
                    {detail.children.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">孩子信息</p>
                        {detail.children.map((child) => (
                          <Card key={child.id} className="mb-2 border shadow-none">
                            <CardContent className="p-3">
                              <p className="text-sm font-medium text-foreground">
                                {child.name}
                                {child.age && <span className="text-muted-foreground font-normal"> · {child.age}岁</span>}
                                {child.grade && <span className="text-muted-foreground font-normal"> · {child.grade}</span>}
                              </p>
                              {child.interests && <p className="text-xs text-muted-foreground mt-1">兴趣：{child.interests}</p>}
                              {child.learning_challenges && <p className="text-xs text-muted-foreground">卡点：{child.learning_challenges}</p>}
                              {child.parent_expectations && <p className="text-xs text-muted-foreground">期待：{child.parent_expectations}</p>}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">暂无孩子信息</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
        {families.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-10">暂无家庭数据</p>
        )}
      </div>
    </div>
  );
}
