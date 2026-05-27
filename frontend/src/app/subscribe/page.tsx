"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Plan {
  plan_id: string;
  name: string;
  quota: number;
  price: number;
  features: string[];
}

interface CurrentSub {
  plan: string;
  plan_name: string;
  quota: number;
  used: number;
  remaining: number;
}

export default function SubscribePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<CurrentSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    Promise.all([api.getPlans(), api.getCurrentSubscription()])
      .then(([p, c]) => { setPlans(p); setCurrent(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === current?.plan) return;
    setUpgrading(true);
    try {
      await api.upgradePlan(planId);
      const c = await api.getCurrentSubscription();
      setCurrent(c);
      alert("升级成功！");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "升级失败");
    } finally {
      setUpgrading(false);
    }
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
                      <p className="font-semibold text-foreground text-lg">{current.plan_name || "免费版"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">本月剩余</p>
                      <p className="font-bold text-2xl text-primary">{current.remaining}</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full h-2 bg-muted rounded-full">
                    <div
                      className="h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.min((current.used / current.quota) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">已用 {current.used} / {current.quota} 次</p>
                </CardContent>
              </Card>
            </div>
          </BlurFade>
        )}

        {/* 套餐列表 */}
        <div className="px-4 mt-4 space-y-3">
          {plans.map((plan, i) => {
            const isCurrent = plan.plan_id === current?.plan;
            const isPopular = plan.plan_id === "basic";
            return (
              <BlurFade key={plan.plan_id} delay={0.15 + i * 0.05}>
                <Card className={`border-0 shadow-md relative overflow-hidden ${isPopular ? "ring-2 ring-primary" : ""}`}>
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-white text-xs px-3 py-0.5 rounded-bl-lg font-medium">推荐</div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {plan.price === 0 ? "免费" : `¥${(plan.price / 100).toFixed(0)}/月`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUpgrade(plan.plan_id)}
                        disabled={isCurrent || upgrading}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                          isCurrent
                            ? "bg-muted text-muted-foreground"
                            : "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:opacity-90"
                        }`}
                      >
                        {isCurrent ? "当前" : "升级"}
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
            MVP 阶段暂不收费，所有功能免费体验。正式上线后将接入微信支付。
          </p>
        </BlurFade>
      </div>
    </AuthGuard>
  );
}
