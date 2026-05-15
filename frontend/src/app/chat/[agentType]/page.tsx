"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

const agentInfo: Record<string, { name: string; role: string; color: string; suggestions: string[] }> = {
  xuexue: { name: "学学", role: "学习策略师", color: "bg-blue-500", suggestions: ["孩子写作业总是拖延怎么办？", "如何提高数学成绩？", "怎样培养自主学习习惯？"] },
  chuangchuang: { name: "创创", role: "创造引导师", color: "bg-green-500", suggestions: ["孩子对编程感兴趣，怎么开始？", "有什么适合小学生的创作项目？", "如何把兴趣变成作品？"] },
  tantan: { name: "探探", role: "天赋测评师", color: "bg-purple-500", suggestions: ["怎么发现孩子的天赋？", "孩子什么都想学但坚持不了", "如何判断兴趣班是否适合？"] },
  banban: { name: "伴伴", role: "成长陪伴师", color: "bg-orange-500", suggestions: ["孩子不愿意和我沟通怎么办？", "青春期叛逆如何应对？", "怎样表扬孩子更有效？"] },
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentType = params.agentType as string;
  const agent = agentInfo[agentType];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!agent) {
    return <div className="p-6">Agent 不存在</div>;
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError("");

    // 添加用户消息到界面
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.chatSend(agentType, text, conversationId || undefined);
      setConversationId(res.conversation_id);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: res.reply,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "发送失败";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="mt-12 space-y-4">
              <p className="text-center text-gray-400 text-sm">向{agent.name}提问吧</p>
              <div className="space-y-2">
                {agent.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); }}
                    className="w-full text-left px-4 py-3 bg-white rounded-xl border border-gray-100 text-sm text-gray-600 shadow-sm active:scale-[0.98] transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-md"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm border border-gray-100 shadow-sm">
                思考中...
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-400 text-xs">{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="bg-white border-t border-gray-100 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`px-4 py-2.5 rounded-full text-sm text-white transition ${
              loading || !input.trim()
                ? "bg-blue-300 opacity-50"
                : "bg-blue-500 active:scale-95"
            }`}
          >
            发送
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
