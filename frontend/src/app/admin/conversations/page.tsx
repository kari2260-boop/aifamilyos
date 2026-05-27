"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface ConvItem {
  id: string;
  family_name: string;
  agent_type: string;
  title: string | null;
  messages_count: number;
  has_risk: boolean;
  created_at: string;
}

const agentNames: Record<string, string> = {
  xuexue: "学学", chuangchuang: "创创", tantan: "探探", banban: "伴伴",
};

export default function AdminConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConvItem[]>([]);

  useEffect(() => {
    api.adminConversations().then(setConversations).catch(() => router.push("/admin"));
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-muted-foreground text-xl">‹</button>
        <h1 className="font-semibold text-foreground">对话记录</h1>
      </div>

      <div className="p-4 space-y-3">
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => router.push(`/admin/conversations/${c.id}`)}
            className="bg-card rounded-xl p-4 shadow-sm border border-border active:scale-[0.98] transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-blue-50 text-primary px-2 py-0.5 rounded">
                  {agentNames[c.agent_type] || c.agent_type}
                </span>
                {c.has_risk && (
                  <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">风险</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground/60">{c.messages_count} 条</span>
            </div>
            <p className="text-sm text-foreground mt-2 truncate">{c.title || "无标题"}</p>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{c.family_name}</span>
              <span>{new Date(c.created_at).toLocaleDateString("zh-CN")}</span>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-center text-muted-foreground/60 text-sm mt-10">暂无对话记录</p>
        )}
      </div>
    </div>
  );
}
