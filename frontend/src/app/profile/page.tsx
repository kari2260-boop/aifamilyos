"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ phone: string; role: string } | null>(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
  }, []);

  const handleLogout = () => {
    api.logout();
    router.push("/login");
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white px-5 pt-12 pb-6">
          <h1 className="text-lg font-bold text-gray-800">我的</h1>
        </div>

        <div className="px-4 mt-4 space-y-3">
          {/* 用户信息 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-400">手机号</p>
            <p className="font-medium text-gray-800 mt-1">{user?.phone || "加载中..."}</p>
          </div>

          {/* 家庭档案入口 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="font-medium text-gray-800">家庭档案</p>
            <p className="text-sm text-gray-400 mt-1">查看和编辑家庭信息、孩子档案</p>
          </div>

          {/* 退出登录 */}
          <button
            onClick={handleLogout}
            className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-red-500 text-center"
          >
            退出登录
          </button>
        </div>

        <BottomNav />
      </div>
    </AuthGuard>
  );
}
