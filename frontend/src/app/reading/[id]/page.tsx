"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { api } from "@/lib/api";

interface ArticleDetail {
  id: string;
  title: string;
  summary: string | null;
  content_markdown: string | null;
  cover_url: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  recommended_by: string | null;
  view_count: number;
  published_at: string | null;
  is_free?: boolean;
  locked?: boolean;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/(^-|-$)/g, "");
    items.push({ id, text, level: match[1].length });
  }
  return items;
}

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [readProgress, setReadProgress] = useState(0);

  useEffect(() => {
    if (params.id) {
      loadArticle(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setReadProgress(Math.min(100, Math.round((scrollTop / docHeight) * 100)));
      }
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function loadArticle(id: string) {
    try {
      const data = await api.getArticle(id);
      setArticle(data);
    } catch {
      router.push("/reading");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!article) return null;

  const toc = article.content_markdown ? extractToc(article.content_markdown) : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 阅读进度条 */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-border z-50">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* 返回 */}
        <button
          onClick={() => router.back()}
          className="text-muted-foreground text-sm flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>

        {/* 文章头部 */}
        <div className="mt-6">
          <h1 className="text-2xl font-bold text-foreground leading-tight">{article.title}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            {article.author && <span>{article.author}</span>}
            {article.published_at && (
              <span>{new Date(article.published_at).toLocaleDateString("zh-CN")}</span>
            )}
            <span>{article.view_count} 阅读</span>
          </div>
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {article.tags.map((tag) => (
                <span key={tag} className="text-xs bg-card text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 目录 */}
        {toc.length > 0 && (
          <div className="mt-6 p-4 bg-card rounded-2xl border border-border">
            <p className="text-sm font-medium text-foreground mb-2">目录</p>
            <nav className="space-y-1">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                  style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* 正文 */}
        {article.content_markdown && (
          <div className="mt-8 relative">
            <article className="prose prose-neutral prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                {article.content_markdown}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>

    </div>
  );
}
