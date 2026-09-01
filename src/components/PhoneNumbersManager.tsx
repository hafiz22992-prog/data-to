import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Phone, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

/**
 * إدارة أرقام جوالات شركات النقل — للمالك فقط.
 * يعرض كل شركة مع أرقامها الحالية ويسمح بالتعديل.
 */
export function PhoneNumbersManager() {
  const companies = useQuery(api.companies.listActive);
  const updatePhoneNumbers = useMutation(api.companies.updatePhoneNumbers);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draftNumbers, setDraftNumbers] = useState<string[]>([]);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  if (companies === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const startEditing = (slug: string, current: string[]) => {
    setEditingSlug(slug);
    setDraftNumbers(current.length > 0 ? [...current] : [""]);
  };

  const cancelEditing = () => {
    setEditingSlug(null);
    setDraftNumbers([]);
  };

  const addNumber = () => {
    setDraftNumbers((prev) => [...prev, ""]);
  };

  const removeNumber = (idx: number) => {
    setDraftNumbers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateNumber = (idx: number, val: string) => {
    setDraftNumbers((prev) => prev.map((n, i) => (i === idx ? val : n)));
  };

  const saveNumbers = async (slug: string) => {
    setBusySlug(slug);
    try {
      await updatePhoneNumbers({ slug, phoneNumbers: draftNumbers });
      toast.success("تم حفظ أرقام الجوال بنجاح");
      setEditingSlug(null);
      setDraftNumbers([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الأرقام");
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <div className="space-y-3">
      {companies.map((company) => {
        const phones = company.phoneNumbers ?? [];
        const isEditing = editingSlug === company.slug;
        const isBusy = busySlug === company.slug;

        return (
          <motion.div
            key={company.slug}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-primary" />
                <span className="text-sm font-bold">{company.name}</span>
                {phones.length > 0 && !isEditing ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {phones.length} {phones.length === 1 ? "رقم" : "أرقام"}
                  </span>
                ) : null}
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => startEditing(company.slug, phones)}
                  className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  تعديل الأرقام
                </button>
              ) : null}
            </div>

            {/* عرض الأرقام الحالية (وضع القراءة) */}
            {!isEditing && phones.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {phones.map((num) => (
                  <span
                    key={num}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700"
                    dir="ltr"
                  >
                    {num}
                  </span>
                ))}
              </div>
            ) : null}

            {!isEditing && phones.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                لم تُدخل أرقام جوال لهذه الشركة بعد
              </p>
            ) : null}

            {/* وضع التعديل */}
            {isEditing ? (
              <div className="mt-3 space-y-2">
                {draftNumbers.map((num, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={num}
                      onChange={(e) => updateNumber(idx, e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="h-8 flex-1 rounded-md border bg-background px-2.5 text-[11px] font-mono outline-none ring-ring transition focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => removeNumber(idx)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50"
                      title="حذف الرقم"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={addNumber}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/30 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/5"
                  >
                    <Plus className="size-3" />
                    إضافة رقم
                  </button>

                  <div className="mr-auto flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => saveNumbers(company.slug)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Save className="size-3" />
                      )}
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
