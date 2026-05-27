"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface BookingItem {
  id: string;
  consultant_name: string | null;
  booking_date: string;
  time_slot: string;
  duration: number;
  topic: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const loadBookings = () => {
    api.adminGetBookings(filter || undefined)
      .then(setBookings)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => { loadBookings(); }, [filter]);

  const handleAction = async (id: string, status: string) => {
    try {
      await api.adminUpdateBooking(id, { status });
      loadBookings();
    } catch {
      alert("操作失败");
    }
  };

  const statusLabel: Record<string, string> = {
    pending: "待确认",
    confirmed: "已确认",
    cancelled: "已取消",
    completed: "已完成",
  };

  const statusColor: Record<string, string> = {
    pending: "text-yellow-600",
    confirmed: "text-green-600",
    cancelled: "text-muted-foreground",
    completed: "text-primary",
  };

  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card px-5 pt-12 pb-4 border-b border-border flex items-center gap-3">
        <Link href="/admin" className="text-muted-foreground text-xl">‹</Link>
        <h1 className="text-lg font-bold text-foreground">预约管理</h1>
      </div>

      {/* 筛选 */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {["", "pending", "confirmed", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap border ${
              filter === s ? "bg-primary text-white border-blue-500" : "bg-card text-muted-foreground border-border"
            }`}
          >
            {s === "" ? "全部" : statusLabel[s]}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="px-4 space-y-3">
        {bookings.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-8">暂无预约记录</p>
        )}
        {bookings.map((b) => (
          <div key={b.id} className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{b.consultant_name || "专家"}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{b.booking_date} {b.time_slot} · {b.duration}分钟</p>
                {b.topic && <p className="text-sm text-muted-foreground mt-1">主题：{b.topic}</p>}
              </div>
              <span className={`text-xs font-medium ${statusColor[b.status] || ""}`}>
                {statusLabel[b.status] || b.status}
              </span>
            </div>

            {b.status === "pending" && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                <button
                  onClick={() => handleAction(b.id, "confirmed")}
                  className="flex-1 py-1.5 bg-green-500 text-white text-sm rounded-lg"
                >
                  确认
                </button>
                <button
                  onClick={() => handleAction(b.id, "cancelled")}
                  className="flex-1 py-1.5 bg-muted text-muted-foreground text-sm rounded-lg"
                >
                  拒绝
                </button>
              </div>
            )}
            {b.status === "confirmed" && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <button
                  onClick={() => handleAction(b.id, "completed")}
                  className="w-full py-1.5 bg-primary text-white text-sm rounded-lg"
                >
                  标记完成
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
