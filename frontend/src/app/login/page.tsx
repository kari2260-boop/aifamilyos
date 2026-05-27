"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await api.register(phone, password);
      } else {
        await api.login(phone, password);
      }
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-4">
      <div className="w-full max-w-sm">
        <BlurFade delay={0.1}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
              <span className="text-2xl text-white font-bold">AI</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">AI 家庭成长 OS</h1>
            <p className="text-muted-foreground text-sm mt-2">为你的家庭提供智能成长陪伴</p>
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-semibold text-center text-foreground">
                  {isRegister ? "注册账号" : "登录"}
                </h2>

                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">手机号</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="请输入手机号"
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition shadow-md shadow-orange-200"
                >
                  {loading ? "处理中..." : isRegister ? "注册" : "登录"}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  {isRegister ? "已有账号？" : "没有账号？"}
                  <button
                    type="button"
                    onClick={() => setIsRegister(!isRegister)}
                    className="text-primary font-medium ml-1"
                  >
                    {isRegister ? "去登录" : "注册"}
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </div>
  );
}