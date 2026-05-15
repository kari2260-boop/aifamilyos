"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";

interface Stats {
  total_families: number;
  total_conversations: number;
  today_conversations: number;
  risk_flags_unhandled: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminStats()
      .then(setStats)
      .catch((e: Error) => {
        if (e.message.includes("403") || e.message.includes("权限")) {
          router.push("/");
        } else {
          setError(e.message);
        }
      });
  }, [router]);

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-800">管理后台</h1>
      </div>

      {/* 统计卡片 */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-blue-600">{stats?.total_families ?? "-"}</p>
          <p className="text-xs text-gray-400 mt-1">总家庭数</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-green-600">{stats?.today_conversations ?? "-"}</p>
          <p className="text-xs text-gray-400 mt-1">今日对话</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-gray-600">{stats?.total_conversations ?? "-"}</p>
          <p className="text-xs text-gray-400 mt-1">总对话数</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-red-600">{stats?.risk_flags_unhandled ?? "-"}</p>
          <p className="text-xs text-gray-400 mt-1">待处理风险</p>
        </div>
      </div>

      {/* 导航菜单 */}
      <div className="px-4 mt-2 space-y-3">
        <Link href="/admin/families">
          <div className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="font-medium text-gray-800">家庭列表</span>
            <span className="text-gray-300 text-xl">›</span>
          </div>
        </Link>
        <Link href="/admin/conversations">
          <div className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="font-medium text-gray-800">对话记录</span>
            <span className="text-gray-300 text-xl">›</span>
          </div>
        </Link>
        <Link href="/admin/risks">
          <div className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="font-medium text-gray-800">风险提醒</span>
            {stats?.risk_flags_unhandled ? (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {stats.risk_flags_unhandled}
              </span>
            ) : (
              <span className="text-gray-300 text-xl">›</span>
            )}
          </div>
        </Link>
        <Link href="/admin/knowledge">
          <div className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="font-medium text-gray-800">知识库管理</span>
            <span className="text-gray-300 text-xl">›</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
