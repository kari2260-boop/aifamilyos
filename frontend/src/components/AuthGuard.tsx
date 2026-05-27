"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
    api.getMe().then((user) => {
      if (user.role === "admin") {
        setReady(true);
        return;
      }
      return api.getMyFamily().then(() => {
        setReady(true);
      }).catch(() => {
        router.push("/onboarding");
      });
    }).catch(() => {
      router.push("/login");
    });
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return <>{children}</>;
}
