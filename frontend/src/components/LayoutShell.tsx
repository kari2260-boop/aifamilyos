"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";

// 不显示底部导航的路径前缀
const HIDE_NAV_PATHS = ["/login", "/onboarding", "/chat/", "/admin"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      {children}
      {!hideNav && <BottomNav />}
    </>
  );
}
