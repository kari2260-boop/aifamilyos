"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface FamilyItem {
  id: string;
  family_name: string;
  city: string | null;
  owner_phone: string;
  children_count: number;
  conversations_count: number;
  created_at: string;
}

export default function AdminFamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<FamilyItem[]>([]);

  useEffect(() => {
    api.adminFamilies().then(setFamilies).catch(() => router.push("/admin"));
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">‹</button>
        <h1 className="font-semibold text-gray-800">家庭列表</h1>
        <span className="text-xs text-gray-400 ml-auto">{families.length} 个家庭</span>
      </div>

      <div className="p-4 space-y-3">
        {families.map((f) => (
          <div key={f.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">{f.family_name}</h3>
              <span className="text-xs text-gray-400">{f.city || "未设置"}</span>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-gray-400">
              <span>手机: {f.owner_phone}</span>
              <span>孩子: {f.children_count}</span>
              <span>对话: {f.conversations_count}</span>
            </div>
            <p className="text-xs text-gray-300 mt-1">
              注册: {new Date(f.created_at).toLocaleDateString("zh-CN")}
            </p>
          </div>
        ))}
        {families.length === 0 && (
          <p className="text-center text-gray-300 text-sm mt-10">暂无家庭数据</p>
        )}
      </div>
    </div>
  );
}
