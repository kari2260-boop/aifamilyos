"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useState } from "react";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PaywallModal({ open, onClose }: PaywallModalProps) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);

  if (!open) return null;

  const handleTrial = async () => {
    setActivating(true);
    try {
      await api.activateTrial();
      onClose();
      window.location.reload();
    } catch {
      // API 不存在时优雅降级，跳转订阅页
      router.push("/subscribe");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* 底部弹出卡片 */}
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition-colors"
        >
          ✕
        </button>

        {/* 暖金色渐变顶部 */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-t-3xl px-6 pt-8 pb-6">
          <h2 className="text-xl font-bold text-white">升级会员，解锁全部内容</h2>
          <p className="text-white/80 text-sm mt-1">畅享所有课程、文章和专属服务</p>
        </div>

        {/* 权益对比 */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            {/* 免费版 */}
            <div className="bg-muted/50 rounded-2xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">免费版</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>✓ 每月 30 次对话</li>
                <li>✓ 免费课程/文章</li>
                <li className="line-through opacity-50">✗ 全部课程内容</li>
                <li className="line-through opacity-50">✗ 成长报告</li>
                <li className="line-through opacity-50">✗ 专家咨询</li>
              </ul>
            </div>
            {/* 付费版 */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-medium text-amber-700 mb-3">高级会员</p>
              <ul className="space-y-2 text-xs text-foreground">
                <li>✓ 每月 999 次对话</li>
                <li>✓ 全部课程/文章</li>
                <li>✓ 全部课程内容</li>
                <li>✓ 月度成长报告</li>
                <li>✓ 1v1 专家咨询</li>
              </ul>
            </div>
          </div>

          {/* 按钮区 */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleTrial}
              disabled={activating}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium rounded-2xl shadow-sm disabled:opacity-50 transition-opacity"
            >
              {activating ? "开通中..." : "免费试用 3 天"}
            </button>
            <button
              onClick={() => { onClose(); router.push("/subscribe"); }}
              className="w-full py-3 bg-muted text-foreground font-medium rounded-2xl transition-colors hover:bg-muted/80"
            >
              查看套餐
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
