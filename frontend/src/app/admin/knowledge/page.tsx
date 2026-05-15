"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface DocItem {
  id: string;
  title: string;
  category: string;
  source_type: string | null;
  status: string;
  created_at: string;
}

const categoryNames: Record<string, string> = {
  learning: "学习方法", project: "项目创作", talent: "天赋发展", parenting: "亲子教育",
};

export default function AdminKnowledgePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("learning");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = () => {
    api.adminKnowledgeDocs().then(setDocs).catch(() => router.push("/admin"));
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.adminUploadKnowledge(file, category);
      loadDocs();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">‹</button>
        <h1 className="font-semibold text-gray-800">知识库管理</h1>
      </div>

      {/* 上传区域 */}
      <div className="p-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <p className="text-sm font-medium text-gray-800">上传文档</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="learning">学习方法</option>
            <option value="project">项目创作</option>
            <option value="talent">天赋发展</option>
            <option value="parenting">亲子教育</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            className="w-full text-sm text-gray-500"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`w-full py-2 rounded-lg text-sm text-white ${uploading ? "bg-gray-300" : "bg-blue-500 active:scale-[0.98]"}`}
          >
            {uploading ? "上传中..." : "上传并处理"}
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="px-4 space-y-3">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800 truncate flex-1">{doc.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded ml-2 ${
                doc.status === "completed" ? "bg-green-50 text-green-600" :
                doc.status === "processing" ? "bg-yellow-50 text-yellow-600" :
                "bg-red-50 text-red-600"
              }`}>
                {doc.status === "completed" ? "完成" : doc.status === "processing" ? "处理中" : "失败"}
              </span>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              <span>{categoryNames[doc.category] || doc.category}</span>
              <span>{doc.source_type}</span>
              <span>{new Date(doc.created_at).toLocaleDateString("zh-CN")}</span>
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <p className="text-center text-gray-300 text-sm mt-6">暂无文档</p>
        )}
      </div>
    </div>
  );
}
