"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PaywallModal from "@/components/PaywallModal";
import ReactMarkdown from "react-markdown";

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  content_type: string;
  external_url: string | null;
  content_markdown: string | null;
  tags: string[];
  recommended_by: string | null;
  is_free?: boolean;
  locked?: boolean;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  const isLocked = course?.locked === true || course?.is_free === false;

  useEffect(() => {
    if (params.id) {
      loadCourse(params.id as string);
    }
  }, [params.id]);

  async function loadCourse(id: string) {
    try {
      const data = await api.getCourse(id);
      setCourse(data);
      if (data.locked === true || data.is_free === false) {
        setShowPaywall(true);
      }
    } catch {
      router.push("/courses");
    }
    setLoading(false);
  }

  async function handleStartLearning() {
    if (!course) return;

    // 更新进度为进行中
    try {
      await api.updateCourseProgress(course.id, {
        status: "in_progress",
        progress_percent: 10,
      });
    } catch {}

    if (course.content_type === "video" && course.external_url) {
      window.open(course.external_url, "_blank");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 返回按钮 */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground text-sm flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>
      </div>

      {/* 封面图 */}
      {course.cover_url && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <img
            src={course.cover_url}
            alt={course.title}
            className="w-full h-48 object-cover rounded-2xl"
          />
        </div>
      )}

      {/* 课程信息 */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 mb-2">
          {course.recommended_by && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {course.recommended_by}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            course.content_type === "video"
              ? "bg-blue-50 text-blue-600"
              : "bg-green-50 text-green-600"
          }`}>
            {course.content_type === "video" ? "视频课程" : "长文阅读"}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>

        {course.description && (
          <p className="text-muted-foreground mt-3 leading-relaxed">{course.description}</p>
        )}

        {/* 标签 */}
        {course.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {course.tags.map((tag) => (
              <span key={tag} className="text-xs bg-card text-muted-foreground px-3 py-1 rounded-full border border-border">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 视频播放器（本地上传的视频） */}
        {course.content_type === "video" && course.external_url && (course.external_url.startsWith("/api/static/") || course.external_url.startsWith("/api/files/")) && !isLocked && (
          <div className="mt-6 rounded-2xl overflow-hidden bg-black">
            <video
              controls
              className="w-full"
              src={`http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8000${course.external_url}`}
              playsInline
            >
              您的浏览器不支持视频播放
            </video>
          </div>
        )}

        {/* 开始学习按钮（外部链接视频或文章） */}
        {!(course.content_type === "video" && (course.external_url?.startsWith("/api/static/") || course.external_url?.startsWith("/api/files/"))) && (
          <button
            onClick={handleStartLearning}
            disabled={isLocked}
            className="w-full mt-8 bg-primary text-primary-foreground py-3 rounded-2xl font-medium text-center transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLocked ? "会员专属内容" : course.content_type === "video" ? "前往观看" : "开始阅读"}
          </button>
        )}

        {/* 文章内容（长文类型） */}
        {course.content_type === "article" && course.content_markdown && (
          <div className={`mt-8 prose prose-neutral max-w-none relative ${isLocked ? "max-h-60 overflow-hidden" : ""}`}>
            <div className="text-foreground leading-relaxed">
              <ReactMarkdown>{course.content_markdown}</ReactMarkdown>
            </div>
            {isLocked && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/70 to-background pointer-events-none" />
            )}
          </div>
        )}
      </div>

      {/* 付费墙弹窗 */}
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}
