import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Phone, Plus, Save, Trash2, Power, PowerOff, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface DraftPhone {
  number: string;
  label: string;
  active: boolean;
}

interface SaturnPhone {
  number: string;
  label?: string;
  active: boolean;
}

/**
 * إدارة أرقام جوالات خطوط زحل — للمالك فقط.
 * تظهر في جميع التذاكر الصادرة بغض النظر عن شركة النقل المختارة.
 */
export function SaturnPhoneManager() {
  const settings = useQuery(api.settings.get);
  const updateSaturnPhones = useMutation(api.settings.updateSaturnPhones);

  const [editing, setEditing] = useState(false);
  const [draftPhones, setDraftPhones] = useState<DraftPhone[]>([]);
  const [saving, setSaving] = useState(false);

  if (settings === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const savedPhones: SaturnPhone[] = settings?.saturnPhoneNumbers ?? [];
  const activePhones = savedPhones.filter((p: SaturnPhone) => p.active);

  const startEditing = () => {
    setEditing(true);
    setDraftPhones(
      savedPhones.length > 0
        ? savedPhones.map((p: SaturnPhone) => ({ number: p.number, label: p.label ?? "", active: p.active }))
        : [],
    );
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraftPhones([]);
  };

  const addPhone = () => {
    setDraftPhones((prev) => [...prev, { number: "", label: "", active: true }]);
  };

  const removePhone = (idx: number) => {
    setDraftPhones((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePhone = (idx: number, field: keyof DraftPhone, val: string | boolean) => {
    setDraftPhones((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)),
    );
  };

  const movePhone = (idx: number, dir: -1 | 1) => {
    setDraftPhones((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSaturnPhones({
        saturnPhoneNumbers: draftPhones
          .filter((p) => p.number.trim())
          .map((p) => ({
            number: p.number.trim(),
            label: p.label.trim() || undefined,
            active: p.active,
          })),
      });
      toast.success("تم حفظ أرقام خطوط زحل بنجاح");
      setEditing(false);
      setDraftPhones([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card p-4"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="size-4 text-primary" />
            <span className="text-sm font-bold">خطوط زحل — أرقام التواصل</span>
            {activePhones.length > 0 && !editing ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {activePhones.length} رقم نشط
              </span>
            ) : null}
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
            >
              تعديل الأرقام
            </button>
          ) : null}
        </div>

        {/* Read-only view */}
        {!editing && activePhones.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activePhones.map((p: SaturnPhone) => (
              <span
                key={p.number}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
              >
                {p.label ? `${p.label}: ` : ""}
                <span className="font-mono" dir="ltr">{p.number}</span>
              </span>
            ))}
          </div>
        ) : null}

        {!editing && savedPhones.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            لم تُدخل أرقام جوال لخطوط زحل بعد
          </p>
        ) : null}

        {/* Edit mode */}
        {editing ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              {draftPhones.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={phone.number}
                    onChange={(e) => updatePhone(idx, "number", e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="h-8 w-36 rounded-md border bg-background px-2.5 text-[11px] font-mono outline-none ring-ring transition focus:ring-2"
                  />
                  <input
                    type="text"
                    value={phone.label}
                    onChange={(e) => updatePhone(idx, "label", e.target.value)}
                    placeholder="التصنيف (الحجوزات، الطوارئ...)"
                    className="h-8 flex-1 rounded-md border bg-background px-2.5 text-[11px] outline-none ring-ring transition focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => updatePhone(idx, "active", !phone.active)}
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      phone.active
                        ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        : "border-slate-200 text-slate-400 hover:bg-slate-50"
                    }`}
                    title={phone.active ? "تعطيل" : "تفعيل"}
                  >
                    {phone.active ? <Power className="size-3.5" /> : <PowerOff className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhone(idx, -1)}
                    disabled={idx === 0}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-30"
                    title="تحريك لأعلى"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhone(idx, 1)}
                    disabled={idx === draftPhones.length - 1}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-30"
                    title="تحريك لأسفل"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhone(idx)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50"
                    title="حذف"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addPhone}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/30 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/5"
              >
                <Plus className="size-3" />
                إضافة رقم
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                حفظ
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
