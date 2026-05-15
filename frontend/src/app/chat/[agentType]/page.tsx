"use client";

import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

const agentInfo: Record<string, { name: string; role: string; color: string }> = {
  xuexue: { name: "学学", role: "学习策略师", color: "bg-blue-500" },
  chuangchuang: { name: "创创", role: "创造引导师", color: "bg-green-500" },
  tantan: { name: "探探", role: "天赋测评师", color: "bg-purple-500" },
  banban: { name: "伴伴", role: "成长陪伴师", color: "bg-orange-500" },
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentType = params.agentType as string;
  const agent = agentInfo[agentType];

  if (!agent) {
    return <div className="p-6">Agent 不存在</div>;
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 顶部栏 */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
          <button onClick={() => router.back()} className="text-gray-400 text-xl">
            ‹
          </button>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${agent.color}`}>
            {agent.name[0]}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">{agent.name}</h2>
            <p className="text-xs text-gray-400">{agent.role}</p>
          </div>
        </div>

        {/* 消息区域（占位，任务08完善） */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <p className="text-gray-300 text-sm">对话功能开发中，任务08完善...</p>
        </div>

        {/* 输入框（占位） */}
        <div className="bg-white border-t border-gray-100 p-3 flex gap-2">
          <input
            type="text"
            placeholder="输入你的问题..."
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            disabled
          />
          <button className="px-4 py-2.5 bg-blue-500 text-white rounded-full text-sm opacity-50" disabled>
            发送
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
