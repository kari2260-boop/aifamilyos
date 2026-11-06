"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { SiteFooter } from "@/components/SiteFooter";

// 不显示底部导航的路径前缀
const HIDE_NAV_PATHS = ["/login", "/onboarding", "/chat/", "/admin"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      {children}
      {/* 底部导航是固定在屏幕最下面的：有导航时页脚多留出导航的高度，不被挡住 */}
      <SiteFooter aboveNav={!hideNav} />
      {!hideNav && <BottomNav />}
    </>
  );
}
