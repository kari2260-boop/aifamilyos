"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Plan {
  plan_id: string;
  name: string;
  duration_days?: number | null;
  monthly_quota?: number | null;
  price: number;
  features: string[];
  description?: string;
}

interface CurrentSub {
  plan: string;
  plan_name: string;
  quota: number | null;
  used: number;
  remaining: number | null;
  unlimited?: boolean;
  expires_at?: string | null;
}

export default function SubscribePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<CurrentSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContact, setShowContact] = useState(false);
  const [contactPlan, setContactPlan] = useState<Plan | null>(null);

  const planLabel: Record<string, string> = {
    free: "免费体验",
    trial_9_9: "3天体验包",
    community_3480: "社区年课",
    pilot_9800: "领航年课",
  };

  const formatPrice = (plan: Plan) => {
    if (plan.plan_id === "free") return "免费";
    if (plan.plan_id === "trial_9_9") return `¥${plan.price.toFixed(1)} / ${plan.duration_days || 3}天`;
    if (plan.duration_days === 365) return `¥${plan.price.toFixed(0)} / 年`;
    return `¥${plan.price.toFixed(0)}`;
  };

  const formatQuota = (plan: Plan) => {
    if (plan.monthly_quota === null) return "AI对话不限量";
    return `AI对话 ${plan.monthly_quota} 次/月`;
  };

  useEffect(() => {
    Promise.all([api.getPlans(), api.getCurrentSubscription()])
      .then(([p, c]) => { setPlans(p); setCurrent(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClickUpgrade = (plan: Plan) => {
    if (plan.plan_id === current?.plan) return;
    setContactPlan(plan);
    setShowContact(true);
  };

  if (loading) {
    return <AuthGuard><div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">加载中...</p></div></AuthGuard>;
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-8">
        <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border">
          <button onClick={() => router.back()} className="text-muted-foreground text-xl hover:text-foreground transition">‹</button>
          <h1 className="font-semibold text-foreground">订阅套餐</h1>
        </div>

        {/* 当前用量 */}
        {current && (
          <BlurFade delay={0.1}>
            <div className="px-4 mt-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">当前套餐</p>
                      <p className="font-semibold text-foreground text-lg">
                        {planLabel[current.plan] || current.plan_name || "免费体验"}
                      </p>
                      {current.expires_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          到期：{new Date(current.expires_at).toLocaleDateString("zh-CN")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">本月剩余</p>
                      <p className="font-bold text-2xl text-primary">
                        {current.unlimited ? "不限" : (current.remaining ?? 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 w-full h-2 bg-muted rounded-full">
                    <div
                      className="h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                      style={{
                        width: current.unlimited || !current.quota || current.quota <= 0
                          ? "100%"
                          : `${Math.min((current.used / current.quota) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    已用 {current.used}
                    {current.unlimited || !current.quota ? " / 不限" : ` / ${current.quota} 次`}
                  </p>
                </CardContent>
              </Card>
            </div>
          </BlurFade>
        )}

        {/* 套餐列表 */}
        <div className="px-4 mt-4 space-y-3">
          {plans.filter(p => p.plan_id !== "free").map((plan, i) => {
            const isCurrent = plan.plan_id === current?.plan;
            const isPopular = plan.plan_id === "community_3480";
            return (
              <BlurFade key={plan.plan_id} delay={0.15 + i * 0.05}>
                <Card className={`border-0 shadow-md relative overflow-hidden ${isPopular ? "ring-2 ring-primary" : ""}`}>
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-white text-xs px-3 py-0.5 rounded-bl-lg font-medium">推荐</div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{planLabel[plan.plan_id] || plan.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{formatPrice(plan)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatQuota(plan)}</p>
                      </div>
                      <button
                        onClick={() => handleClickUpgrade(plan)}
                        disabled={isCurrent}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                          isCurrent
                            ? "bg-muted text-muted-foreground"
                            : "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm active:scale-95"
                        }`}
                      >
                        {isCurrent ? "当前" : "咨询开通"}
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {plan.features.map((f, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="text-emerald-500 text-xs">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </BlurFade>
            );
          })}
        </div>

        <BlurFade delay={0.4}>
          <p className="text-center text-xs text-muted-foreground mt-6 px-4">
            开通后由老师手动配置权益，通常在1小时内生效
          </p>
        </BlurFade>
      </div>

      {/* 联系方式弹窗 */}
      {showContact && contactPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowContact(false)}
        >
          <div
            className="w-full max-w-md bg-background rounded-t-3xl p-6 pb-10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground">咨询开通</h2>
              <p className="text-sm text-muted-foreground mt-1">
                您选择的是「{planLabel[contactPlan.plan_id] || contactPlan.name}」
                <span className="text-primary font-medium ml-1">{formatPrice(contactPlan)}</span>
              </p>
            </div>

            <div className="flex justify-center">
              <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                <Image
                  src="/contact-qrcode.png"
                  alt="小钰老师微信二维码"
                  width={220}
                  height={220}
                  className="object-contain"
                />
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">扫码添加小钰老师微信</p>
              <p className="text-xs text-muted-foreground">备注「开通{planLabel[contactPlan.plan_id]}」，老师会尽快为您处理</p>
            </div>

            <button
              onClick={() => setShowContact(false)}
              className="w-full py-3 bg-muted text-muted-foreground rounded-xl text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
