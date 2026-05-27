"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  content_type: string;
  tags: string[];
  is_free: boolean;
  recommended_by: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface SeriesItem {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  module_count: number;
  lesson_count: number;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
    loadCourses();
    loadSeries();
  }, []);

  useEffect(() => {
    loadCourses();
  }, [activeCategory]);

  async function loadCategories() {
    try {
      const data = await api.getCourseCategories();
      setCategories(data);
    } catch {}
  }

  async function loadCourses() {
    setLoading(true);
    try {
      const params: { category?: string } = {};
      if (activeCategory) params.category = activeCategory;
      const data = await api.getCourses(params);
      setCourses(data);
    } catch {}
    setLoading(false);
  }

  async function loadSeries() {
    try {
      const data = await api.request("/course-series");
      setSeries(data);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-br from-primary to-[#8B7355] rounded-b-3xl px-6 py-10 text-white">
        <h1 className="text-2xl font-bold">课程共学</h1>
        <p className="text-white/80 text-sm mt-2">和优秀家庭一起，系统学习 AI 时代的教育方法</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* 课程系列 */}
        {series.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-foreground mb-3">课程系列</h2>
            <div className="space-y-3">
              {series.map((s) => (
                <Link key={s.id} href={`/courses/series/${s.id}`}>
                  <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                    <h3 className="font-medium text-foreground">{s.title}</h3>
                    {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                    <p className="text-xs text-primary mt-2">{s.module_count}个单元 · {s.lesson_count}节课</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 分类标签 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              !activeCategory
                ? "bg-primary text-white"
                : "bg-card text-muted-foreground hover:bg-border"
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat.slug
                  ? "bg-primary text-white"
                  : "bg-card text-muted-foreground hover:bg-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* 课程列表 */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中...</div>
        ) : courses.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">暂无课程</div>
        ) : (
          <div className="grid gap-4 mt-4">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`}>
                <div className="bg-card rounded-2xl shadow-sm p-4 transition-all hover:shadow-md relative">
                  {!course.is_free && (
                    <span className="absolute top-3 right-3 text-base">🔒</span>
                  )}
                  <div className="flex gap-4">
                    {course.cover_url && (
                      <img
                        src={course.cover_url}
                        alt={course.title}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{course.title}</h3>
                        {course.recommended_by && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                            {course.recommended_by}
                          </span>
                        )}
                      </div>
                      {course.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          course.content_type === "video"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-green-50 text-green-600"
                        }`}>
                          {course.content_type === "video" ? "视频" : "长文"}
                        </span>
                        {course.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[10px] text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
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
