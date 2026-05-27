"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Example {
  id: string;
  title: string;
  user_input: string;
  assistant_output: string;
  sort_order: number;
  is_active: boolean;
}

interface AgentPromptItem {
  id: string | null;
  agent_type: string;
  name: string;
  role: string;
  system_prompt: string;
  is_active: boolean;
  source: "database" | "default";
  examples: Example[];
}

const AGENT_LABELS: Record<string, string> = {
  xuexue: "学学",
  chuangchuang: "创创",
  tantan: "探探",
  banban: "伴伴",
};

type Mode = "list" | "edit-prompt" | "add-example" | "edit-example";

export default function AdminPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<AgentPromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [saving, setSaving] = useState(false);

  // Edit prompt state
  const [editAgent, setEditAgent] = useState<AgentPromptItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  // Example state
  const [exTitle, setExTitle] = useState("");
  const [exInput, setExInput] = useState("");
  const [exOutput, setExOutput] = useState("");
  const [editExampleId, setEditExampleId] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const data = await api.adminGetPrompts();
      setPrompts(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrompt = (agent: AgentPromptItem) => {
    setEditAgent(agent);
    setEditName(agent.name);
    setEditRole(agent.role);
    setEditPrompt(agent.system_prompt);
    setMode("edit-prompt");
  };

  const handleSavePrompt = async () => {
    if (!editAgent) return;
    setSaving(true);
    try {
      await api.adminUpdatePrompt(editAgent.agent_type, {
        name: editName,
        role: editRole,
        system_prompt: editPrompt,
      });
      setMode("list");
      await loadPrompts();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPrompt = async (agentType: string) => {
    if (!confirm("确定恢复默认提示词？当前修改将丢失。")) return;
    try {
      await api.adminResetPrompt(agentType);
      await loadPrompts();
    } catch {
      alert("重置失败");
    }
  };

  const handleAddExample = (agent: AgentPromptItem) => {
    setEditAgent(agent);
    setExTitle("");
    setExInput("");
    setExOutput("");
    setEditExampleId(null);
    setMode("add-example");
  };

  const handleEditExample = (agent: AgentPromptItem, ex: Example) => {
    setEditAgent(agent);
    setExTitle(ex.title);
    setExInput(ex.user_input);
    setExOutput(ex.assistant_output);
    setEditExampleId(ex.id);
    setMode("edit-example");
  };

  const handleSaveExample = async () => {
    if (!editAgent || !exTitle.trim() || !exInput.trim() || !exOutput.trim()) {
      alert("请填写完整");
      return;
    }
    setSaving(true);
    try {
      if (mode === "add-example") {
        await api.adminCreateExample(editAgent.agent_type, {
          title: exTitle,
          user_input: exInput,
          assistant_output: exOutput,
        });
      } else if (editExampleId) {
        await api.adminUpdateExample(editAgent.agent_type, editExampleId, {
          title: exTitle,
          user_input: exInput,
          assistant_output: exOutput,
        });
      }
      setMode("list");
      await loadPrompts();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExample = async (agentType: string, exampleId: string) => {
    if (!confirm("确定删除此案例？")) return;
    try {
      await api.adminDeleteExample(agentType, exampleId);
      await loadPrompts();
    } catch {
      alert("删除失败");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <BlurFade delay={0.05}>
        <div className="bg-gradient-to-br from-violet-700 to-purple-900 px-5 pt-12 pb-8 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "list" && (
                <button onClick={() => setMode("list")} className="text-white/60 text-xl">‹</button>
              )}
              <h1 className="text-lg font-bold text-white">Prompt 管理</h1>
            </div>
            <button onClick={() => router.push("/admin")} className="text-white/60 text-sm">返回</button>
          </div>
          <p className="text-white/60 text-xs mt-2">编辑4个AI Agent的提示词和案例</p>
        </div>
      </BlurFade>

      <div className="px-4 mt-4">
        {mode === "list" && (
          <div className="space-y-4">
            {loading && <p className="text-center text-muted-foreground text-sm mt-8">加载中...</p>}
            {prompts.map((agent, i) => (
              <BlurFade key={agent.agent_type} delay={0.1 + i * 0.05}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{agent.name}（{AGENT_LABELS[agent.agent_type]}）</h3>
                        <p className="text-xs text-muted-foreground">{agent.role} · {agent.source === "database" ? "已自定义" : "默认"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditPrompt(agent)} className="text-xs text-primary">编辑</button>
                        {agent.source === "database" && (
                          <button onClick={() => handleResetPrompt(agent.agent_type)} className="text-xs text-muted-foreground">重置</button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{agent.system_prompt.slice(0, 100)}...</p>

                    {/* 案例列表 */}
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-foreground">案例 ({agent.examples.length})</span>
                        <button onClick={() => handleAddExample(agent)} className="text-xs text-primary">+ 添加</button>
                      </div>
                      {agent.examples.length === 0 && (
                        <p className="text-xs text-muted-foreground">暂无案例</p>
                      )}
                      {agent.examples.map((ex) => (
                        <div key={ex.id} className="bg-muted/30 rounded-lg p-2 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{ex.title}</span>
                            <div className="flex gap-2">
                              <button onClick={() => handleEditExample(agent, ex)} className="text-xs text-primary">编辑</button>
                              <button onClick={() => handleDeleteExample(agent.agent_type, ex.id)} className="text-xs text-destructive">删除</button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">用户：{ex.user_input}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>
            ))}
          </div>
        )}

        {mode === "edit-prompt" && editAgent && (
          <BlurFade delay={0.1}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">名称</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">角色</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={editRole} onChange={(e) => setEditRole(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">系统提示词</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={16} />
              </div>
              <button onClick={handleSavePrompt} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? "保存中..." : "保存提示词"}
              </button>
            </div>
          </BlurFade>
        )}

        {(mode === "add-example" || mode === "edit-example") && (
          <BlurFade delay={0.1}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">为「{editAgent?.name}」{mode === "add-example" ? "添加" : "编辑"}案例</p>
              <div>
                <label className="text-sm font-medium text-foreground">案例标题</label>
                <input className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={exTitle} onChange={(e) => setExTitle(e.target.value)} placeholder="如：10岁男孩数学粗心" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">用户输入</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={exInput} onChange={(e) => setExInput(e.target.value)} placeholder="家长/孩子会怎么问..." rows={4} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">期望回复</label>
                <textarea className="w-full mt-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={exOutput} onChange={(e) => setExOutput(e.target.value)} placeholder="AI应该怎么回答..." rows={6} />
              </div>
              <button onClick={handleSaveExample} disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? "保存中..." : mode === "add-example" ? "添加案例" : "保存修改"}
              </button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
