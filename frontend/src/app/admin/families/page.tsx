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
  subscription_plan: string | null;
  subscription_expires_at: string | null;
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
  subscription_plan: string | null;
  monthly_quota: number | null;
  subscription_expires_at: string | null;
  assessment_quota: number;
  report_quota: number;
  owner_phone: string;
  conversations_count: number;
  children: Child[];
}

const PLAN_OPTIONS = [
  { id: "free", label: "免费体验（5次/月）" },
  { id: "trial_9_9", label: "3天体验包（9.9元）" },
  { id: "community_3480", label: "社区年课（3480元/年）" },
  { id: "pilot_9800", label: "领航年课（9800元/年）" },
];

const planLabel: Record<string, string> = {
  free: "免费体验",
  trial_9_9: "3天体验包",
  community_3480: "社区年课",
  pilot_9800: "领航年课",
  basic: "基础版",
  premium: "高级版",
};

export default function AdminFamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FamilyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("community_3480");
  const [grantNote, setGrantNote] = useState("");
  const [granting, setGranting] = useState(false);
  const [filter, setFilter] = useState<"all" | "expiring">("all");

  useEffect(() => {
    api.adminFamilies().then(setFamilies).catch(() => router.push("/admin"));
  }, [router]);

  // 即将到期：subscription_plan 有效（非 free/null）且 expires_at 在3天内
  const now = Date.now();
  const expiringFamilies = families.filter(f => {
    if (!f.subscription_plan || f.subscription_plan === "free") return false;
    if (!f.subscription_expires_at) return false;
    const diff = Math.ceil((new Date(f.subscription_expires_at).getTime() - now) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 3;
  });
  const displayFamilies = filter === "expiring" ? expiringFamilies : families;

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

  const handleGrant = async (familyId: string) => {
    setGranting(true);
    try {
      await api.adminGrantPlan(familyId, selectedPlan, grantNote);
      alert(`已成功开通「${planLabel[selectedPlan] || selectedPlan}」`);
      setGrantingId(null);
      setGrantNote("");
      const d = await api.adminFamilyDetail(familyId);
      setDetail(d);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "开通失败");
    } finally {
      setGranting(false);
    }
  };

  const handleRenew = async (familyId: string) => {
    if (!confirm("确认续费？将在原到期时间基础上延长一年，配额重置。")) return;
    try {
      const res = await api.adminRenewPlan(familyId);
      alert(`续费成功，新到期时间：${new Date(res.new_expires_at).toLocaleDateString("zh-CN")}`);
      const d = await api.adminFamilyDetail(familyId);
      setDetail(d);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "续费失败");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
        <Link href="/admin" className="text-muted-foreground text-xl hover:text-foreground transition">‹</Link>
        <h1 className="font-semibold text-foreground">家庭列表</h1>
        <span className="text-xs text-muted-foreground ml-auto">{families.length} 个家庭</span>
      </div>

      {/* 筛选 tab */}
      <div className="flex gap-2 px-4 pt-3 pb-1">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === "all" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
        >
          全部 {families.length}
        </button>
        <button
          onClick={() => setFilter("expiring")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === "expiring" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700"}`}
        >
          即将到期 {expiringFamilies.length}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {displayFamilies.map((f) => {
          const expiryDiff = f.subscription_expires_at
            ? Math.ceil((new Date(f.subscription_expires_at).getTime() - now) / (1000 * 60 * 60 * 24))
            : null;
          const isExpiring = expiryDiff !== null && expiryDiff >= 0 && expiryDiff <= 3;
          return (
          <Card key={f.id} className="border-0 shadow-sm overflow-hidden">
            <div onClick={() => handleExpand(f.id)} className="p-4 cursor-pointer active:bg-muted/50 transition">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{f.family_name}</h3>
                <div className="flex items-center gap-2">
                  {isExpiring && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {expiryDiff === 0 ? "今天到期" : `${expiryDiff}天后到期`}
                    </span>
                  )}
                  {f.subscription_plan && f.subscription_plan !== "free" && !isExpiring && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                      {planLabel[f.subscription_plan] || f.subscription_plan}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{f.city || "未设置"}</span>
                </div>
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
              <div className="border-t border-border p-4 bg-muted/30 space-y-4">
                {detailLoading && <p className="text-sm text-muted-foreground">加载中...</p>}
                {!detailLoading && detail && (
                  <>
                    {/* 当前权益 */}
                    <div className="rounded-xl border border-border bg-background p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">当前权益</div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span>套餐：<span className="font-medium text-foreground">{planLabel[detail.membership_level] || detail.membership_level}</span></span>
                        <span>AI对话：<span className="font-medium text-foreground">{detail.monthly_quota}次/月</span></span>
                        <span>测评剩余：<span className="font-medium text-foreground">{detail.assessment_quota ?? 0}次</span></span>
                        <span>报告剩余：<span className="font-medium text-foreground">{detail.report_quota ?? 0}次</span></span>
                      </div>
                      {detail.subscription_expires_at && (
                        <div className="text-xs text-muted-foreground">
                          到期：{new Date(detail.subscription_expires_at).toLocaleDateString("zh-CN")}
                        </div>
                      )}
                    </div>

                    {/* 开通会员 */}
                    {grantingId === f.id ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                        <div className="text-xs font-semibold text-amber-800">开通套餐</div>
                        <select
                          value={selectedPlan}
                          onChange={(e) => setSelectedPlan(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm"
                        >
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                        <input
                          value={grantNote}
                          onChange={(e) => setGrantNote(e.target.value)}
                          placeholder="备注（可选，如：内测名额、已付款）"
                          className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGrant(f.id)}
                            disabled={granting}
                            className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            {granting ? "开通中..." : "确认开通"}
                          </button>
                          <button
                            onClick={() => { setGrantingId(null); setGrantNote(""); }}
                            className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setGrantingId(f.id); setSelectedPlan("community_3480"); }}
                          className="flex-1 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition"
                        >
                          开通 / 修改套餐
                        </button>
                        {detail.subscription_plan && detail.subscription_plan !== "free" && detail.subscription_expires_at && (
                          <button
                            onClick={() => handleRenew(f.id)}
                            className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
                          >
                            续费
                          </button>
                        )}
                      </div>
                    )}

                    {/* 孩子信息 */}
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
                  </>
                )}
              </div>
            )}
          </Card>
          );
        })}
        {displayFamilies.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-10">
            {filter === "expiring" ? "暂无即将到期的家庭" : "暂无家庭数据"}
          </p>
        )}
      </div>
    </div>
  );
}
