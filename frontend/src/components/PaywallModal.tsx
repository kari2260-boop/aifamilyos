"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan?: string; // free / trial_9_9 / community_3480 / pilot_9800
  requiredPlan?: string; // 课程要求的最低等级
}

export default function PaywallModal({ open, onClose, currentPlan = "free", requiredPlan = "community" }: PaywallModalProps) {
  const router = useRouter();

  if (!open) return null;

  // 已是 3480，被 pilot 内容锁住 → 直接显示小钰二维码
  const isUpgradeToPilot = currentPlan === "community_3480" && requiredPlan === "pilot";
  // 已是 9800，不应该出现 paywall
  const isPilot = currentPlan === "pilot_9800";

  if (isPilot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition-colors"
        >
          ✕
        </button>

        {isUpgradeToPilot ? (
          /* 3480 用户想访问 pilot 内容 → 引导升级 9800，扫码找小钰 */
          <>
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-t-3xl px-6 pt-8 pb-6">
              <h2 className="text-xl font-bold text-white">升级领航年课，解锁此内容</h2>
              <p className="text-white/80 text-sm mt-1">此内容为领航年课（¥9800/年）专属</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex justify-center">
                <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                  <Image src="/contact-qrcode.png" alt="小钰老师微信二维码" width={200} height={200} className="object-contain" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">扫码添加小钰老师微信</p>
                <p className="text-xs text-muted-foreground">备注「升级领航年课」，老师会尽快为您处理</p>
              </div>
              <button onClick={onClose} className="w-full py-3 bg-muted text-muted-foreground rounded-xl text-sm">
                关闭
              </button>
            </div>
          </>
        ) : (
          /* 免费/9.9 用户，显示升级选项 */
          <>
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-t-3xl px-6 pt-8 pb-6">
              <h2 className="text-xl font-bold text-white">升级会员，解锁全部内容</h2>
              <p className="text-white/80 text-sm mt-1">畅享所有课程、文章和专属服务</p>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-2xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">当前</p>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li>✓ 每月 30 次对话</li>
                    <li>✓ 免费课程/文章</li>
                    <li className="line-through opacity-50">✗ 全部课程内容</li>
                    <li className="line-through opacity-50">✗ 成长报告</li>
                    <li className="line-through opacity-50">✗ 专家咨询</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-medium text-amber-700 mb-3">社区年课</p>
                  <ul className="space-y-2 text-xs text-foreground">
                    <li>✓ 每月 200 次对话</li>
                    <li>✓ 全部课程/文章</li>
                    <li>✓ 正式测评</li>
                    <li>✓ 月度成长报告</li>
                    <li>✓ 团体答疑</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => { onClose(); router.push("/subscribe"); }}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium rounded-2xl shadow-sm"
                >
                  查看套餐 / 咨询开通
                </button>
                <button onClick={onClose} className="w-full py-3 bg-muted text-foreground font-medium rounded-2xl">
                  暂不升级
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
