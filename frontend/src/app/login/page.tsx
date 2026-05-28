"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api.register(phone, password);
      } else if (mode === "reset") {
        await api.resetPassword(phone, password);
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
                  {mode === "register" ? "注册账号" : mode === "reset" ? "重置密码" : "登录"}
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
                  <label className="block text-sm text-muted-foreground mb-1.5">{mode === "reset" ? "新密码" : "密码"}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "reset" ? "请输入新密码" : "请输入密码"}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition shadow-md shadow-orange-200"
                >
                  {loading ? "处理中..." : mode === "register" ? "注册" : mode === "reset" ? "重置密码" : "登录"}
                </button>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setMode(mode === "register" ? "login" : "register")}
                    className="text-primary font-medium"
                  >
                    {mode === "register" ? "去登录" : "注册账号"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === "reset" ? "login" : "reset")}
                    className="text-primary font-medium"
                  >
                    {mode === "reset" ? "返回登录" : "忘记密码"}
                  </button>
                </div>

                {mode === "register" && (
                  <p className="text-xs text-muted-foreground leading-5">
                    注册要求：手机号必须是 11 位大陆手机号，密码至少 8 位。
                  </p>
                )}
                {mode === "reset" && (
                  <p className="text-xs text-muted-foreground leading-5">
                    重置后会直接写入新密码并自动登录。当前版本先用手机号找回，后续可再加短信验证码。
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </div>
  );
}