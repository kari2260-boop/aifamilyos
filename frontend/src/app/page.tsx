"use client";

import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";
import AgentCard from "@/components/AgentCard";

const agents = [
  {
    name: "学学",
    role: "学习策略师",
    description: "学习规划、方法指导、进度追踪",
    color: "bg-blue-500",
    agentType: "xuexue",
  },
  {
    name: "创创",
    role: "创造引导师",
    description: "兴趣发现、项目设计、成果输出",
    color: "bg-green-500",
    agentType: "chuangchuang",
  },
  {
    name: "探探",
    role: "天赋测评师",
    description: "天赋评估、培养建议、动态调整",
    color: "bg-purple-500",
    agentType: "tantan",
  },
  {
    name: "伴伴",
    role: "成长陪伴师",
    description: "家长答疑、亲子沟通、资源推荐",
    color: "bg-orange-500",
    agentType: "banban",
  },
];

export default function Home() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* 顶部 */}
        <div className="bg-white px-5 pt-12 pb-6">
          <h1 className="text-xl font-bold text-gray-800">AI 家庭成长 OS</h1>
          <p className="text-sm text-gray-400 mt-1">选择一位成长伙伴开始对话</p>
        </div>

        {/* Agent 卡片 */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          {agents.map((agent) => (
            <AgentCard key={agent.agentType} {...agent} />
          ))}
        </div>

        <BottomNav />
      </div>
    </AuthGuard>
  );
}
