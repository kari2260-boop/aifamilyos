"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Article {
  id: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  is_featured: boolean;
  is_free?: boolean;
  recommended_by: string | null;
  view_count: number;
  published_at: string | null;
}

const CATEGORIES = ["全部", "家庭教育", "AI科技", "学科学习", "父母成长", "教育规划", "人性洞察"];

export default function ReadingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, [activeCategory]);

  async function loadArticles() {
    setLoading(true);
    try {
      const params: { category?: string } = {};
      if (activeCategory !== "全部") params.category = activeCategory;
      const data = await api.getArticles(params);
      setArticles(data);
    } catch {}
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-br from-primary to-[#8B7355] rounded-b-3xl px-6 py-10 text-white">
        <h1 className="text-2xl font-bold">深度阅读</h1>
        <p className="text-white/80 text-sm mt-2">精选文章，帮你建立 AI 时代的教育认知</p>
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

        {/* 文章列表 */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中...</div>
        ) : articles.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">暂无文章</div>
        ) : (
          <div className="grid gap-4 mt-4">
            {articles.map((article) => (
              <Link key={article.id} href={`/reading/${article.id}`}>
                <div className="bg-card rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md relative">
                  {article.cover_url && (
                    <img
                      src={article.cover_url}
                      alt={article.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {article.recommended_by && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {article.recommended_by}
                        </span>
                      )}
                      {article.is_featured && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                          精选
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground line-clamp-2">{article.title}</h3>
                    {article.summary && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.summary}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {article.author && <span>{article.author}</span>}
                        {article.published_at && (
                          <span>{new Date(article.published_at).toLocaleDateString("zh-CN")}</span>
                        )}
                      </div>
                      <span>{article.view_count} 阅读</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
