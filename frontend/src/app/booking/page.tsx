"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Consultant {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  specialties: string | null;
  price_per_session: number;
  session_duration: number;
}

interface BookingItem {
  id: string;
  consultant_name: string | null;
  booking_date: string;
  time_slot: string;
  duration: number;
  topic: string | null;
  status: string;
}

type Step = "list" | "select" | "done";

export default function BookingPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [myBookings, setMyBookings] = useState<BookingItem[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [topic, setTopic] = useState("");
  const [step, setStep] = useState<Step>("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getConsultants().then(setConsultants).catch(() => {});
    api.getMyBookings().then(setMyBookings).catch(() => {});
  }, []);

  const handleSelectConsultant = (c: Consultant) => {
    setSelectedConsultant(c);
    setStep("select");
    setSelectedDate("");
    setAvailableSlots([]);
    setSelectedSlot("");
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlot("");
    if (!selectedConsultant || !date) return;
    try {
      const res = await api.getAvailableSlots(selectedConsultant.id, date);
      setAvailableSlots(res.slots || []);
    } catch {
      setAvailableSlots([]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedConsultant || !selectedDate || !selectedSlot) return;
    setLoading(true);
    setError("");
    try {
      await api.createBooking({
        consultant_id: selectedConsultant.id,
        booking_date: selectedDate,
        time_slot: selectedSlot,
        topic: topic.trim() || undefined,
      });
      setStep("done");
      const bookings = await api.getMyBookings();
      setMyBookings(bookings);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "预约失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await api.cancelBooking(bookingId);
      setMyBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b));
    } catch {
      alert("取消失败");
    }
  };

  const statusLabel: Record<string, string> = { pending: "待确认", confirmed: "已确认", cancelled: "已取消", completed: "已完成" };
  const statusColor: Record<string, string> = { pending: "text-amber-600 bg-amber-50", confirmed: "text-green-600 bg-green-50", cancelled: "text-muted-foreground bg-muted", completed: "text-primary bg-primary/10" };

  const getNextDays = (n: number) => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 1; i <= n; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <BlurFade delay={0.1}>
          <div className="px-5 pt-12 pb-4">
            <div className="flex items-center gap-3">
              {step !== "list" && (
                <button onClick={() => setStep("list")} className="text-muted-foreground text-xl hover:text-foreground transition">‹</button>
              )}
              <div>
                <h1 className="text-lg font-bold text-foreground">预约咨询</h1>
                <p className="text-sm text-muted-foreground mt-0.5">预约 40 分钟真人专家 1v1 咨询</p>
              </div>
            </div>
          </div>
        </BlurFade>

        <div className="px-4">
          {step === "list" && (
            <div className="space-y-3">
              {consultants.length === 0 && (
                <p className="text-center text-muted-foreground text-sm mt-8">暂无可预约的专家</p>
              )}
              {consultants.map((c, i) => (
                <BlurFade key={c.id} delay={0.15 + i * 0.05}>
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
                          {c.name[0]}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{c.name}</h3>
                          {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                          {c.specialties && <p className="text-xs text-muted-foreground mt-1">擅长：{c.specialties}</p>}
                          {c.bio && <p className="text-sm text-muted-foreground mt-2">{c.bio}</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <span className="text-sm text-muted-foreground">{c.session_duration}分钟 / {c.price_per_session > 0 ? `¥${c.price_per_session / 100}` : "免费"}</span>
                        <button
                          onClick={() => handleSelectConsultant(c)}
                          className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm rounded-full font-medium shadow-sm hover:opacity-90 transition"
                        >
                          预约
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </BlurFade>
              ))}

              {myBookings.length > 0 && (
                <div className="mt-6">
                  <h2 className="font-semibold text-foreground mb-3">我的预约</h2>
                  <div className="space-y-2">
                    {myBookings.map((b) => (
                      <Card key={b.id} className="border-0 shadow-sm">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{b.consultant_name || "专家"}</p>
                            <p className="text-xs text-muted-foreground">{b.booking_date} {b.time_slot} · {b.duration}分钟</p>
                            {b.topic && <p className="text-xs text-muted-foreground mt-0.5">{b.topic}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[b.status] || ""}`}>
                              {statusLabel[b.status] || b.status}
                            </span>
                            {(b.status === "pending" || b.status === "confirmed") && (
                              <button onClick={() => handleCancel(b.id)} className="text-xs text-destructive">取消</button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "select" && selectedConsultant && (
            <BlurFade delay={0.1}>
              <div className="space-y-4">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <p className="font-semibold text-foreground">{selectedConsultant.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedConsultant.title}</p>
                  </CardContent>
                </Card>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">选择日期</p>
                  <div className="grid grid-cols-3 gap-2">
                    {getNextDays(7).map((d) => (
                      <button
                        key={d}
                        onClick={() => handleDateChange(d)}
                        className={`px-3 py-2 rounded-xl text-sm border transition ${
                          selectedDate === d
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-transparent shadow-sm"
                            : "bg-card text-foreground border-border hover:border-primary/30"
                        }`}
                      >
                        {d.slice(5)}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">选择时段</p>
                    {availableSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">该日期暂无可用时段</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-2 rounded-xl text-sm border transition ${
                              selectedSlot === slot
                                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-transparent shadow-sm"
                                : "bg-card text-foreground border-border hover:border-primary/30"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedSlot && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">咨询主题（选填）</p>
                    <textarea
                      className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="简单描述你想咨询的问题"
                      rows={3}
                    />
                  </div>
                )}

                {error && <p className="text-destructive text-sm">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={!selectedSlot || loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 shadow-md shadow-orange-200 hover:opacity-90 transition"
                >
                  {loading ? "提交中..." : "确认预约"}
                </button>
              </div>
            </BlurFade>
          )}

          {step === "done" && (
            <BlurFade delay={0.1}>
              <div className="mt-12 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-green-600 text-2xl">✓</span>
                </div>
                <h2 className="text-lg font-semibold text-foreground">预约提交成功</h2>
                <p className="text-sm text-muted-foreground">专家确认后会通知你，请留意消息</p>
                <button
                  onClick={() => { setStep("list"); setSelectedConsultant(null); setTopic(""); }}
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-full text-sm font-medium shadow-sm"
                >
                  返回
                </button>
              </div>
            </BlurFade>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
