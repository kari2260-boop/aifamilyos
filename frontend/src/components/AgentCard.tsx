"use client";

import Link from "next/link";

interface AgentCardProps {
  name: string;
  role: string;
  description: string;
  color: string;
  agentType: string;
}

export default function AgentCard({ name, role, description, color, agentType }: AgentCardProps) {
  return (
    <Link href={`/chat/${agentType}`}>
      <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition active:scale-95`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold mb-3 ${color}`}>
          {name[0]}
        </div>
        <h3 className="font-semibold text-gray-800">{name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{role}</p>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}
