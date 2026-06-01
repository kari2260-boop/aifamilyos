"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";

interface ShareCardProps {
  visible: boolean;
  onClose: () => void;
  agentName: string;
  agentRole: string;
  agentAvatar: string;
  gradient: string;
  question: string;
  answer: string;
}

export default function ShareCard({
  visible,
  onClose,
  agentName,
  agentRole,
  agentAvatar,
  gradient,
  question,
  answer,
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  if (!visible) return null;

  const handleGenerate = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      const url = canvas.toDataURL("image/png");
      setImageUrl(url);
    } catch {
      alert("生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    // 移动端尝试用 share API
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], `${agentName}-分享.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "AI家庭成长OS" });
          return;
        }
      } catch {}
    }
    // 降级：直接下载
    const link = document.createElement("a");
    link.download = `${agentName}-分享卡片.png`;
    link.href = imageUrl;
    link.click();
  };

  const handleClose = () => {
    setImageUrl(null);
    onClose();
  };

  // 截断文本
  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + "..." : text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div className="w-[90%] max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* 如果已生成图片，显示图片 */}
        {imageUrl ? (
          <div className="space-y-3">
            <img src={imageUrl} alt="分享卡片" className="w-full rounded-2xl shadow-xl" />
            <div className="flex gap-3">
              <button onClick={handleDownload} className="flex-1 py-3 bg-white text-gray-800 rounded-xl text-sm font-medium shadow">
                保存/分享
              </button>
              <button onClick={handleClose} className="flex-1 py-3 bg-white/20 text-white rounded-xl text-sm font-medium border border-white/30">
                关闭
              </button>
            </div>
            <p className="text-center text-white/60 text-xs">手机端：长按图片可保存到相册</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 卡片预览（用于截图） */}
            <div ref={cardRef} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden" }}>
              {/* 顶部 */}
              <div style={{ background: "linear-gradient(135deg, #C4A77D, #8B7355)", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <img
                    src={agentAvatar}
                    alt={agentName}
                    style={{ width: "34px", height: "34px", borderRadius: "999px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.55)" }}
                  />
                  <div>
                    <p style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", margin: 0 }}>{agentName}</p>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", margin: 0 }}>{agentRole}</p>
                  </div>
                </div>
              </div>

              {/* 内容区 */}
              <div style={{ padding: "16px 20px" }}>
                <div style={{ backgroundColor: "#f5f5f5", borderRadius: "12px", padding: "10px 12px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "11px", color: "#999", margin: "0 0 4px 0" }}>提问</p>
                  <p style={{ fontSize: "13px", color: "#333", margin: 0 }}>{truncate(question, 80)}</p>
                </div>
                <div>
                  <p style={{ fontSize: "11px", color: "#999", margin: "0 0 4px 0" }}>回答</p>
                  <p style={{ fontSize: "13px", color: "#555", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>{truncate(answer, 300)}</p>
                </div>
              </div>

              {/* 底部品牌 */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: "500", color: "#333", margin: 0 }}>AI 家庭成长 OS</p>
                  <p style={{ fontSize: "11px", color: "#999", margin: "2px 0 0 0" }}>让每个家庭都有AI教育顾问</p>
                </div>
                <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #f59e0b, #ea580c)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: "11px", fontWeight: "bold" }}>AI</span>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-white text-gray-800 rounded-xl text-sm font-medium shadow disabled:opacity-50"
            >
              {generating ? "生成中..." : "生成分享图片"}
            </button>
            <button onClick={handleClose} className="w-full py-3 bg-white/20 text-white rounded-xl text-sm font-medium border border-white/30">
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
