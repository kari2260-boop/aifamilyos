"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function TrialBanner() {
  const router = useRouter();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    api.getSubscriptionStatus()
      .then((data) => {
        if (data.membership_level === "trial") {
          if (data.trial_end) {
            const end = new Date(data.trial_end);
            const now = new Date();
            const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diff > 0) {
              setDaysLeft(diff);
              setVisible(true);
            } else {
              setExpired(true);
              setVisible(true);
            }
          } else {
            setDaysLeft(3);
            setVisible(true);
          }
        }
      })
      .catch(() => {
        // API 不存在时优雅降级，不显示 banner
      });
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 flex items-center justify-between shadow-sm">
      <p className="text-sm text-white font-medium">
        {expired ? "试用已结束" : `试用还剩 ${daysLeft} 天`}
      </p>
      <button
        onClick={() => router.push("/subscribe")}
        className="px-3 py-1 bg-white text-amber-600 text-xs font-medium rounded-full shadow-sm"
      >
        立即订阅
      </button>
    </div>
  );
}
