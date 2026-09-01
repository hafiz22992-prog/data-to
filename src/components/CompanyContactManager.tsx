import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  Loader2,
  MapPin,
  Phone,
  Plus,
  Save,
  Trash2,
  Power,
  PowerOff,
  ChevronUp,
  ChevronDown,
  Upload,
  Image,
} from "lucide-react";
import { toast } from "sonner";

interface DraftPhone {
  number: string;
  label: string;
  active: boolean;
}

export function CompanyContactManager() {
  const companies = useQuery(api.companies.listActive);
  const saveContactInfo = useMutation(api.companies.saveContactInfo);
  const generateUploadUrl = useMutation(api.companies.generateUploadUrl);
  const setCompanyLogo = useMutation(api.companies.setLogo);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draftPhones, setDraftPhones] = useState<DraftPhone[]>([]);
  const [draftAddress, setDraftAddress] = useState("");
  const [draftMapUrl, setDraftMapUrl] = useState("");
  const [draftLat, setDraftLat] = useState("");
  const [draftLng, setDraftLng] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [uploadingLogoSlug, setUploadingLogoSlug] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  if (companies === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const startEditing = (slug: string) => {
    const c = companies.find((co) => co.slug === slug);
    if (!c) return;
    setEditingSlug(slug);
    const phones = (c.contactPhones ?? []).map((p) => ({
      number: p.number,
      label: p.label ?? "",
      active: p.active,
    }));
    setDraftPhones(phones.length > 0 ? phones : []);
    setDraftAddress(c.address ?? "");
    setDraftMapUrl(c.mapUrl ?? "");
    setDraftLat(c.lat != null ? String(c.lat) : "");
    setDraftLng(c.lng != null ? String(c.lng) : "");
  };

  const cancelEditing = () => {
    setEditingSlug(null);
    setDraftPhones([]);
    setDraftAddress("");
    setDraftMapUrl("");
    setDraftLat("");
    setDraftLng("");
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

  const handleLogoUpload = async (slug: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }
    setUploadingLogoSlug(slug);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("تعذر رفع الصورة");
      const { storageId } = await result.json();
      await setCompanyLogo({ slug, logoStorageId: storageId });
      toast.success("تم رفع شعار الشركة بنجاح");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر رفع الشعار");
    } finally {
      setUploadingLogoSlug(null);
    }
  };

  const handleSave = async (slug: string) => {
    setBusySlug(slug);
    try {
      const lat = draftLat.trim() ? Number(draftLat) : undefined;
      const lng = draftLng.trim() ? Number(draftLng) : undefined;
      if (draftLat.trim() && isNaN(lat!)) {
        toast.error("خط العرض يجب أن يكون رقماً");
        return;
      }
      if (draftLng.trim() && isNaN(lng!)) {
        toast.error("خط الطول يجب أن يكون رقماً");
        return;
      }
      await saveContactInfo({
        slug,
        address: draftAddress.trim() || undefined,
        mapUrl: draftMapUrl.trim() || undefined,
        lat,
        lng,
        contactPhones: draftPhones
          .filter((p) => p.number.trim())
          .map((p) => ({
            number: p.number.trim(),
            label: p.label.trim() || undefined,
            active: p.active,
          })),
      });
      toast.success("تم حفظ بيانات التواصل بنجاح");
      cancelEditing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الحفظ");
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <div className="space-y-3">
      {companies.map((company) => {
        const phones = company.contactPhones ?? [];
        const activePhones = phones.filter((p) => p.active);
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
                {company.logo ? (
                  <img src={company.logo} alt={company.name} className="size-8 rounded-lg object-contain border bg-white" />
                ) : (
                  <Phone className="size-4 text-primary" />
                )}
                <span className="text-sm font-bold">{company.name}</span>
                {activePhones.length > 0 && !isEditing ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {activePhones.length} رقم نشط
                  </span>
                ) : null}
                {company.address && !isEditing ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <MapPin className="size-2.5" />
                    له عنوان
                  </span>
                ) : null}
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => startEditing(company.slug)}
                  className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  تعديل بيانات التواصل
                </button>
              ) : null}
            </div>

            {!isEditing ? (
              <div className="mt-3 space-y-2">
                {company.address ? (
                  <p className="text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline size-3" />
                    {company.address}
                  </p>
                ) : null}
                {activePhones.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activePhones.map((p) => (
                      <span
                        key={p.number}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                      >
                        {p.label ? `${p.label}: ` : ""}
                        <span className="font-mono" dir="ltr">
                          {p.number}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    لم تُدخل بيانات تواصل لهذه الشركة بعد
                  </p>
                )}
              </div>
            ) : null}

            {isEditing ? (
              <div className="mt-4 space-y-4">
                {/* قسم رفع الشعار */}
                <div>
                  <label className="mb-2 block text-[11px] font-bold text-muted-foreground">
                    شعار الشركة
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      {company.logo ? (
                        <img src={company.logo} alt={company.name} className="size-16 rounded-lg object-contain border bg-white" />
                      ) : (
                        <div className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
                          <Image className="size-6 text-slate-400" />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={logoFileRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(company.slug, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => logoFileRef.current?.click()}
                        disabled={uploadingLogoSlug === company.slug}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                      >
                        {uploadingLogoSlug === company.slug ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        رفع الشعار
                      </button>
                      {company.logo ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">الشعار الحالي — انقر للتغيير</p>
                      ) : (
                        <p className="mt-1 text-[10px] text-muted-foreground">ارفع صورة شعار الشركة (PNG/JPG)</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                    عنوان الشركة
                  </label>
                  <input
                    type="text"
                    value={draftAddress}
                    onChange={(e) => setDraftAddress(e.target.value)}
                    placeholder="مثال: حي الصفا، جدة"
                    className="h-8 w-full rounded-md border bg-background px-2.5 text-[11px] outline-none ring-ring transition focus:ring-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                    رابط Google Maps
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={draftMapUrl}
                    onChange={(e) => setDraftMapUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="h-8 w-full rounded-md border bg-background px-2.5 text-[11px] font-mono outline-none ring-ring transition focus:ring-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      Latitude
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={draftLat}
                      onChange={(e) => setDraftLat(e.target.value)}
                      placeholder="21.5433"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-[11px] font-mono outline-none ring-ring transition focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      Longitude
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={draftLng}
                      onChange={(e) => setDraftLng(e.target.value)}
                      placeholder="39.1728"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-[11px] font-mono outline-none ring-ring transition focus:ring-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold text-muted-foreground">
                    أرقام التواصل
                  </label>
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
                          {phone.active ? (
                            <Power className="size-3.5" />
                          ) : (
                            <PowerOff className="size-3.5" />
                          )}
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

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addPhone}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/30 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/5"
                    >
                      <Plus className="size-3" />
                      إضافة رقم
                    </button>
                  </div>
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
                    onClick={() => handleSave(company.slug)}
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
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
