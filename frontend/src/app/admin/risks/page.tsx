"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface RiskItem {
  id: string;
  family_name: string;
  risk_type: string;
  risk_level: string;
  content_snapshot: string;
  handled: boolean;
  handler_notes: string | null;
  created_at: string;
}

const riskTypeNames: Record<string, string> = {
  self_harm: "自伤风险", violence: "暴力倾向", bullying: "霸凌", abuse: "虐待/侵害",
};

export default function AdminRisksPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [handlingId, setHandlingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadRisks();
  }, []);

  const loadRisks = () => {
    api.adminRisks().then(setRisks).catch(() => router.push("/admin"));
  };

  const handleRisk = async (id: string) => {
    await api.adminHandleRisk(id, notes);
    setHandlingId(null);
    setNotes("");
    loadRisks();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">‹</button>
        <h1 className="font-semibold text-gray-800">风险提醒</h1>
      </div>

      <div className="p-4 space-y-3">
        {risks.map((r) => (
          <div key={r.id} className={`bg-white rounded-xl p-4 shadow-sm border ${r.handled ? "border-gray-100" : "border-red-200"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded ${r.risk_level === "high" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"}`}>
                {r.risk_level === "high" ? "高风险" : "中风险"}
              </span>
              <span className="text-xs text-gray-400">
                {riskTypeNames[r.risk_type] || r.risk_type}
              </span>
            </div>
            <p className="text-sm text-gray-800 mt-2">{r.content_snapshot}</p>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{r.family_name}</span>
              <span>{new Date(r.created_at).toLocaleString("zh-CN")}</span>
            </div>

            {r.handled ? (
              <div className="mt-3 text-xs text-green-600 bg-green-50 p-2 rounded">
                已处理{r.handler_notes ? `：${r.handler_notes}` : ""}
              </div>
            ) : handlingId === r.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="处理备注..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRisk(r.id)}
                    className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg"
                  >
                    标记已处理
                  </button>
                  <button
                    onClick={() => setHandlingId(null)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setHandlingId(r.id)}
                className="mt-3 text-xs text-blue-500"
              >
                处理此风险
              </button>
            )}
          </div>
        ))}
        {risks.length === 0 && (
          <p className="text-center text-gray-300 text-sm mt-10">暂无风险记录</p>
        )}
      </div>
    </div>
  );
}
