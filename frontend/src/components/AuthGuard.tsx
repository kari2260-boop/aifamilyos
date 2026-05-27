"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(false);
    setError("");

    if (!api.isLoggedIn()) {
      router.push("/login");
      return;
    }

    // 如果已经在 onboarding 页面，不再检查家庭档案
    if (pathname === "/onboarding") {
      setReady(true);
      return;
    }

    // 检查是否有家庭档案，没有则跳转 onboarding
    let cancelled = false;

    async function checkAuth() {
      try {
        const user = await api.getMe();
        if (cancelled) return;

        if (user.role === "admin") {
          setReady(true);
          return;
        }

        try {
          await api.getMyFamily();
          if (!cancelled) setReady(true);
        } catch {
          if (!cancelled) router.push("/onboarding");
        }
      } catch (err: unknown) {
        api.logout();
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "登录状态已失效，请重新登录");
          router.push("/login");
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <p className="text-gray-400">加载中...</p>
          {error && <p className="text-xs text-gray-400 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
