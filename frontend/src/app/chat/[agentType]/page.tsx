"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import AuthGuard from "@/components/AuthGuard";
import ShareCard from "@/components/ShareCard";
import { api } from "@/lib/api";

const agentInfo: Record<string, { name: string; role: string; gradient: string; icon: string; suggestions: string[] }> = {
  xuexue: { name: "学学", role: "学习策略师", gradient: "from-blue-500 to-indigo-600", icon: "📚", suggestions: ["孩子写作业总是拖延怎么办？", "如何提高数学成绩？", "怎样培养自主学习习惯？"] },
  chuangchuang: { name: "创创", role: "创造引导师", gradient: "from-emerald-500 to-teal-600", icon: "🎨", suggestions: ["孩子对编程感兴趣，怎么开始？", "有什么适合小学生的创作项目？", "如何把兴趣变成作品？"] },
  tantan: { name: "探探", role: "天赋测评师", gradient: "from-violet-500 to-purple-600", icon: "🔮", suggestions: ["怎么发现孩子的天赋？", "孩子什么都想学但坚持不了", "如何判断兴趣班是否适合？"] },
  banban: { name: "伴伴", role: "成长陪伴师", gradient: "from-amber-500 to-orange-600", icon: "🤝", suggestions: ["孩子不愿意和我沟通怎么办？", "青春期叛逆如何应对？", "怎样表扬孩子更有效？"] },
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: "useful" | "not_useful" | null;
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareQuestion, setShareQuestion] = useState("");
  const [shareAnswer, setShareAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("您的浏览器不支持语音输入");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    async function loadHistory() {
      try {
        const conversations = await api.getConversations(agentType);
        if (conversations && conversations.length > 0) {
          const latestConv = conversations[0];
          setConversationId(latestConv.id);
          const msgs = await api.getMessages(latestConv.id);
          if (msgs && msgs.length > 0) {
            setMessages(
              msgs.map((m: { id: string; role: "user" | "assistant"; content: string }) => ({
                id: m.id,
                role: m.role,
                content: m.content,
              }))
            );
          }
        }
      } catch {
        // 首次使用没有历史
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, [agentType]);

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
      if (res.remaining_quota !== undefined) {
        setRemainingQuota(res.remaining_quota);
      }

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
      <div className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto">
        {/* 顶部栏 */}
        <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border shrink-0">
          <button onClick={() => router.back()} className="text-muted-foreground text-xl hover:text-foreground transition">
            ‹
          </button>
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center text-base shadow-sm`}>
            {agent.icon}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground text-sm">{agent.name}</h2>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
          {remainingQuota !== null && (
            <Link href="/subscribe" className={`text-xs px-2 py-1 rounded-full ${remainingQuota <= 5 ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>
              剩余 {remainingQuota} 次
            </Link>
          )}
          {conversationId && messages.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("确定清空当前对话？")) return;
                try {
                  await api.deleteConversation(conversationId);
                  setMessages([]);
                  setConversationId(null);
                } catch {}
              }}
              className="text-xs px-2 py-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-red-50 transition"
            >
              清空
            </button>
          )}
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {historyLoading && (
            <div className="mt-12 text-center text-muted-foreground text-sm">加载中...</div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div className="mt-12 space-y-4">
              <p className="text-center text-muted-foreground text-sm">向{agent.name}提问吧</p>
              <div className="space-y-2">
                {agent.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); }}
                    className="w-full text-left px-4 py-3 bg-card rounded-xl border border-border text-sm text-foreground shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
            >
              <div className="max-w-[80%]">
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-br-md shadow-sm whitespace-pre-wrap"
                      : "bg-card text-foreground border border-border rounded-bl-md shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-0.5">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        h3: ({ children }) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                        h4: ({ children }) => <h4 className="font-medium mt-1.5 mb-0.5">{children}</h4>,
                        code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/30 pl-2 italic text-muted-foreground">{children}</blockquote>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "assistant" && (
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      onClick={async () => {
                        try {
                          await api.submitFeedback(msg.id, "useful");
                          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, feedback: "useful" } : m));
                        } catch {}
                      }}
                      className={`text-xs transition ${msg.feedback === "useful" ? "text-green-600 font-medium" : "text-muted-foreground hover:text-green-600"}`}
                      disabled={!!msg.feedback}
                    >
                      👍 有用
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api.submitFeedback(msg.id, "not_useful");
                          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, feedback: "not_useful" } : m));
                        } catch {}
                      }}
                      className={`text-xs transition ${msg.feedback === "not_useful" ? "text-red-500 font-medium" : "text-muted-foreground hover:text-red-500"}`}
                      disabled={!!msg.feedback}
                    >
                      👎 没用
                    </button>
                    <button
                      onClick={() => {
                        const prevMsg = messages[idx - 1];
                        setShareQuestion(prevMsg?.role === "user" ? prevMsg.content : "");
                        setShareAnswer(msg.content);
                        setShareVisible(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-primary transition"
                    >
                      分享
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("删除这条消息？")) return;
                        try {
                          await api.deleteMessage(msg.id);
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                        } catch {}
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                    >
                      删除
                    </button>
                  </div>
                )}
                {msg.role === "user" && (
                  <div className="mt-1 flex justify-end">
                    <button
                      onClick={async () => {
                        if (!confirm("删除这条消息？")) return;
                        try {
                          await api.deleteMessage(msg.id);
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                        } catch {}
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-card text-muted-foreground px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm border border-border shadow-sm">
                <span className="animate-pulse">思考中...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-destructive text-xs">{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="bg-card border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            className="flex-1 px-4 py-2.5 bg-muted/50 border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            disabled={loading}
            autoComplete="off"
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-muted/50 border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            🎤
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`px-4 py-2.5 rounded-full text-sm text-white font-medium transition ${
              loading || !input.trim()
                ? "bg-muted-foreground/30"
                : "bg-gradient-to-r from-amber-500 to-orange-600 active:scale-95 shadow-sm"
            }`}
          >
            发送
          </button>
        </div>
      </div>

      <ShareCard
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        agentName={agent.name}
        agentRole={agent.role}
        agentIcon={agent.icon}
        gradient={agent.gradient}
        question={shareQuestion}
        answer={shareAnswer}
      />
    </AuthGuard>
  );
}
