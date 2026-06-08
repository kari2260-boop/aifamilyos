"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Consultant {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  specialties: string | null;
  price_per_session: number;
  session_duration: number;
  is_active: boolean;
}

export default function AdminConsultantsPage() {
  const router = useRouter();
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", title: "", bio: "", specialties: "", price: "" });
  const [saving, setSaving] = useState(false);

  // 编辑专家
  const [editConsultant, setEditConsultant] = useState<Consultant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", title: "", bio: "", specialties: "", price: "" });

  // 时段设置
  const [scheduleConsultant, setScheduleConsultant] = useState<Consultant | null>(null);
  const [scheduleWeekday, setScheduleWeekday] = useState(0);
  const [scheduleSlots, setScheduleSlots] = useState("");

  const loadConsultants = () => {
    api.getConsultants().then(setConsultants).catch(() => router.push("/admin"));
  };

  useEffect(() => { loadConsultants(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.adminCreateConsultant({
        name: form.name.trim(),
        title: form.title.trim() || undefined,
        bio: form.bio.trim() || undefined,
        specialties: form.specialties.trim() || undefined,
        price_per_session: form.price ? Number(form.price) * 100 : 0,
      });
      setShowForm(false);
      setForm({ name: "", title: "", bio: "", specialties: "", price: "" });
      loadConsultants();
    } catch {
      alert("创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSetSchedule = async () => {
    if (!scheduleConsultant || !scheduleSlots.trim()) return;
    const slots = scheduleSlots.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await api.adminSetSchedule(scheduleConsultant.id, {
        weekday: scheduleWeekday,
        time_slots: slots,
      });
      alert("时段设置成功");
      setScheduleConsultant(null);
      setScheduleSlots("");
    } catch {
      alert("设置失败");
    }
  };

  const handleEditOpen = (c: Consultant) => {
    setEditConsultant(c);
    setEditForm({
      name: c.name,
      title: c.title || "",
      bio: c.bio || "",
      specialties: c.specialties || "",
      price: c.price_per_session > 0 ? String(c.price_per_session / 100) : "0",
    });
  };

  const handleEditSave = async () => {
    if (!editConsultant || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await api.adminUpdateConsultant(editConsultant.id, {
        name: editForm.name.trim(),
        title: editForm.title.trim() || undefined,
        bio: editForm.bio.trim() || undefined,
        specialties: editForm.specialties.trim() || undefined,
        price_per_session: editForm.price ? Number(editForm.price) * 100 : 0,
      });
      setEditConsultant(null);
      loadConsultants();
    } catch {
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: Consultant) => {
    try {
      await api.adminUpdateConsultant(c.id, { is_active: !c.is_active });
      loadConsultants();
    } catch {
      alert("操作失败");
    }
  };

  const weekdayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
// PLACEHOLDER_RENDER

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
        <Link href="/admin" className="text-muted-foreground text-xl">‹</Link>
        <h1 className="font-semibold text-foreground">专家管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto text-sm text-primary font-medium"
        >
          + 添加
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* 添加表单 */}
        {showForm && (
          <div className="bg-card rounded-xl p-4 shadow-sm border border-blue-200 space-y-3">
            <p className="text-sm font-medium text-foreground">添加专家</p>
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="姓名 *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="头衔（如：教育学博士）"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="擅长领域"
              value={form.specialties}
              onChange={(e) => setForm({ ...form, specialties: e.target.value })}
            />
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="个人介绍"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
            />
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="单次咨询价格（元，0为免费）"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-primary text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-muted text-muted-foreground py-2 rounded-lg text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 编辑专家弹窗 */}
        {editConsultant && (
          <div className="bg-card rounded-xl p-4 shadow-sm border border-orange-200 space-y-3">
            <p className="text-sm font-medium text-foreground">编辑专家 - {editConsultant.name}</p>
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="姓名 *"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="头衔（如：教育学博士）"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="擅长领域"
              value={editForm.specialties}
              onChange={(e) => setEditForm({ ...editForm, specialties: e.target.value })}
            />
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="个人介绍"
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              rows={3}
            />
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="单次咨询价格（元）"
              type="number"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存修改"}
              </button>
              <button
                onClick={() => setEditConsultant(null)}
                className="flex-1 bg-muted text-muted-foreground py-2 rounded-lg text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 时段设置弹窗 */}
        {scheduleConsultant && (
          <div className="bg-card rounded-xl p-4 shadow-sm border border-purple-200 space-y-3">
            <p className="text-sm font-medium text-foreground">
              设置时段 - {scheduleConsultant.name}
            </p>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              value={scheduleWeekday}
              onChange={(e) => setScheduleWeekday(Number(e.target.value))}
            >
              {weekdayNames.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
            <input
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="时段，逗号分隔（如：09:00,10:00,14:00,15:00）"
              value={scheduleSlots}
              onChange={(e) => setScheduleSlots(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSetSchedule}
                className="flex-1 bg-purple-500 text-white py-2 rounded-lg text-sm"
              >
                保存时段
              </button>
              <button
                onClick={() => setScheduleConsultant(null)}
                className="flex-1 bg-muted text-muted-foreground py-2 rounded-lg text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 专家列表 */}
        {consultants.map((c) => (
          <div key={c.id} className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-foreground">{c.name}</h3>
                {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                {c.specialties && <p className="text-xs text-muted-foreground mt-0.5">擅长：{c.specialties}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-50 text-green-600" : "bg-background text-muted-foreground"}`}>
                {c.is_active ? "活跃" : "停用"}
              </span>
            </div>
            {c.bio && <p className="text-sm text-muted-foreground mt-2">{c.bio}</p>}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <span className="text-xs text-muted-foreground">
                {c.session_duration}分钟 / {c.price_per_session > 0 ? `¥${c.price_per_session / 100}` : "免费"}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => handleEditOpen(c)}
                  className="text-xs text-orange-500 font-medium"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleToggleActive(c)}
                  className={`text-xs font-medium ${c.is_active ? "text-red-400" : "text-green-500"}`}
                >
                  {c.is_active ? "停用" : "启用"}
                </button>
                <button
                  onClick={() => { setScheduleConsultant(c); setScheduleSlots(""); }}
                  className="text-xs text-purple-500 font-medium"
                >
                  设置时段
                </button>
              </div>
            </div>
          </div>
        ))}

        {consultants.length === 0 && !showForm && (
          <p className="text-center text-muted-foreground text-sm mt-8">暂无专家，点击右上角添加</p>
        )}
      </div>
    </div>
  );
}
