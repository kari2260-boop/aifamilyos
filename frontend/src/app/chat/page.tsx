"use client";

import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

const agents = [
  { name: "学学", role: "学习策略师", color: "bg-blue-500", agentType: "xuexue" },
  { name: "创创", role: "创造引导师", color: "bg-green-500", agentType: "chuangchuang" },
  { name: "探探", role: "天赋测评师", color: "bg-purple-500", agentType: "tantan" },
  { name: "伴伴", role: "成长陪伴师", color: "bg-orange-500", agentType: "banban" },
];

export default function ChatListPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white px-5 pt-12 pb-4">
          <h1 className="text-lg font-bold text-gray-800">对话</h1>
        </div>

        <div className="px-4 mt-3 space-y-3">
          {agents.map((agent) => (
            <Link key={agent.agentType} href={`/chat/${agent.agentType}`}>
              <div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 active:scale-[0.98] transition">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${agent.color}`}>
                  {agent.name[0]}
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">{agent.name}</h3>
                  <p className="text-xs text-gray-400">{agent.role}</p>
                </div>
                <span className="ml-auto text-gray-300 text-xl">›</span>
              </div>
            </Link>
          ))}
        </div>

        <BottomNav />
      </div>
    </AuthGuard>
  );
}
