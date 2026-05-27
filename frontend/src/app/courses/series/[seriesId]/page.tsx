"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  is_free: boolean;
  lesson_order: number;
  duration_minutes: number | null;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  lessons: Lesson[];
}

interface SeriesDetail {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  modules: Module[];
  standalone_lessons: Lesson[];
}

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.seriesId as string;
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.request(`/course-series/${seriesId}`)
      .then(setSeries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [seriesId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">加载中...</p></div>;
  if (!series) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">系列不存在</p></div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 顶部 */}
      <div className="bg-gradient-to-br from-primary to-[#8B7355] rounded-b-3xl px-6 py-10 text-white">
        <button onClick={() => router.back()} className="text-white/60 text-sm mb-3 flex items-center gap-1">
          ‹ 返回
        </button>
        <h1 className="text-2xl font-bold">{series.title}</h1>
        {series.description && <p className="text-white/80 text-sm mt-2">{series.description}</p>}
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* 单元列表 */}
        {series.modules.map((m, mIdx) => (
          <div key={m.id} className="mb-6">
            <h2 className="font-semibold text-foreground text-sm mb-2">
              第{mIdx + 1}单元：{m.title}
            </h2>
            {m.description && <p className="text-xs text-muted-foreground mb-3">{m.description}</p>}
            <div className="space-y-2">
              {m.lessons.map((l, lIdx) => (
                <Link key={l.id} href={`/courses/${l.id}`}>
                  <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-all active:scale-[0.98]">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {lIdx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{l.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.content_type === "video" ? "🎬 视频" : "📄 文章"}
                        {l.duration_minutes && ` · ${l.duration_minutes}分钟`}
                      </p>
                    </div>
                    {!l.is_free && <span className="text-xs text-muted-foreground">🔒</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* 独立课节 */}
        {series.standalone_lessons.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-foreground text-sm mb-2">其他课节</h2>
            <div className="space-y-2">
              {series.standalone_lessons.map((l) => (
                <Link key={l.id} href={`/courses/${l.id}`}>
                  <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-all">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs">
                      {l.content_type === "video" ? "🎬" : "📄"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{l.title}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {series.modules.length === 0 && series.standalone_lessons.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-8">课程内容即将上线</p>
        )}
      </div>
    </div>
  );
}
