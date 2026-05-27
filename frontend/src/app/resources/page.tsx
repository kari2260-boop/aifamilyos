"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  resource_type: string;
  category: string | null;
  is_pinned: boolean;
}

const TYPE_ICONS: Record<string, { icon: string; label: string }> = {
  feishu_doc: { icon: "📄", label: "飞书文档" },
  tencent_doc: { icon: "📝", label: "腾讯文档" },
  questionnaire: { icon: "📋", label: "问卷" },
  video: { icon: "▶️", label: "视频" },
  other: { icon: "🔗", label: "链接" },
};

const CATEGORIES = ["全部", "学习资料", "社群文档", "工具模板", "活动回顾"];

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResources();
  }, [activeCategory]);

  async function loadResources() {
    setLoading(true);
    try {
      const params: { category?: string } = {};
      if (activeCategory !== "全部") params.category = activeCategory;
      const data = await api.getResources(params);
      setResources(data);
    } catch {}
    setLoading(false);
  }

  function handleOpen(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-br from-primary to-[#8B7355] rounded-b-3xl px-6 py-10 text-white">
        <h1 className="text-2xl font-bold">资料库</h1>
        <p className="text-white/80 text-sm mt-2">社群精选资料，一站式查阅</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* 分类标签 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-white"
                  : "bg-card text-muted-foreground hover:bg-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 资料列表 */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中...</div>
        ) : resources.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">暂无资料</div>
        ) : (
          <div className="grid gap-3 mt-4">
            {resources.map((resource) => {
              const typeInfo = TYPE_ICONS[resource.resource_type] || TYPE_ICONS.other;
              return (
                <button
                  key={resource.id}
                  onClick={() => handleOpen(resource.url)}
                  className={`w-full text-left bg-card rounded-2xl shadow-sm p-4 transition-all hover:shadow-md ${
                    resource.is_pinned ? "border-2 border-primary/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{typeInfo.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{resource.title}</h3>
                        {resource.is_pinned && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                            置顶
                          </span>
                        )}
                      </div>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {resource.description}
                        </p>
                      )}
                      <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                        {typeInfo.label}
                      </span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
