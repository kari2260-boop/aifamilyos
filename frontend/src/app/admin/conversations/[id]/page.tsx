"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface MessageItem {
  id: string;
  role: string;
  content: string;
  model_name: string | null;
  risk_level: string | null;
  created_at: string | null;
}

export default function AdminConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [messages, setMessages] = useState<MessageItem[]>([]);

  useEffect(() => {
    api.adminConversationMessages(id).then(setMessages).catch(() => router.push("/admin/conversations"));
  }, [id, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-muted-foreground text-xl">‹</button>
        <h1 className="font-semibold text-foreground">对话详情</h1>
        <span className="text-xs text-muted-foreground ml-auto">{messages.length} 条消息</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-card text-foreground border border-border rounded-bl-md shadow-sm"
              }`}
            >
              {msg.content}
              {msg.risk_level && (
                <span className="block mt-1 text-xs text-red-400">
                  [风险: {msg.risk_level}]
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
