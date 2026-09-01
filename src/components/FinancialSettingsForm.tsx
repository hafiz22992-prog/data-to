import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Info } from "lucide-react";
import { toArabicIndic } from "@/lib/arabic";

/**
 * Financial Settings — الإعدادات المالية (Owner فقط).
 *
 * المصدر: api.settings.get (قراءة) + api.settings.update (حفظ) — والتحقق من
 * الصلاحية خادمي بالكامل (غير المالك يتلقى null عند القراءة ورفضاً عند الحفظ).
 *
 * القواعد (مطابقة لتحقق الخادم):
 * - Company Share: 0–100
 * - Platform Commission: 0–100
 * - Company + Platform = 100 بالضبط
 * - VAT: 0–100 (0 مسموح)
 *
 * النسب تُطبَّق على الحجوزات/المدفوعات الجديدة فقط، وتُثبَّت لقطة لكل حجز/دفعة
 * وقت إنشائه (لا تُعاد محاسبة الحجوزات القديمة).
 */
export function FinancialSettingsForm() {
  const settingsData = useQuery(api.settings.get);
  const saveSettings = useMutation(api.settings.update);

  const [company, setCompany] = useState("");
  const [platform, setPlatform] = useState("");
  const [vat, setVat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // مزامنة الحقول مع القيم السارية من الخادم (تتحدث تلقائياً بعد الحفظ)
  useEffect(() => {
    if (settingsData === undefined || settingsData === null) return;
    setCompany(String(settingsData.commissionCompanyPercent));
    setPlatform(String(settingsData.commissionPlatformPercent));
    setVat(String(settingsData.vatPercent));
  }, [settingsData]);

  if (settingsData === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // null = غير مصرح (شركة/مسافر) أو غير مسجل — لا نعرض النموذج
  if (settingsData === null) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
        إعدادات المنصة المالية متاحة للمالك فقط.
      </div>
    );
  }

  const companyNum = Number(company);
  const platformNum = Number(platform);
  const vatNum = Number(vat);

  const companyOk = Number.isFinite(companyNum) && companyNum >= 0 && companyNum <= 100;
  const platformOk =
    Number.isFinite(platformNum) && platformNum >= 0 && platformNum <= 100;
  const vatOk = Number.isFinite(vatNum) && vatNum >= 0 && vatNum <= 100;
  const sum =
    Number.isFinite(companyNum) && Number.isFinite(platformNum)
      ? companyNum + platformNum
      : NaN;
  const sumOk = Number.isFinite(sum) && sum === 100;

  const handleSave = async () => {
    setError(null);
    if (!companyOk || !platformOk || !vatOk) {
      setError("أدخل قيماً رقمية بين 0 و100 لجميع الحقول");
      return;
    }
    if (!sumOk) {
      setError("يجب أن يكون مجموع نسبة الشركة والتطبيق = 100%");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        commissionCompanyPercent: companyNum,
        commissionPlatformPercent: platformNum,
        vatPercent: vatNum,
      });
      toast.success("تم حفظ الإعدادات المالية بنجاح");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر حفظ الإعدادات المالية";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (ok: boolean) =>
    `rounded-xl border bg-card p-4 ${ok ? "" : "border-rose-300"}`;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Save className="size-4" />
        </div>
        <div>
          <h3 className="text-base font-bold tracking-tight">
            Financial Settings — الإعدادات المالية
          </h3>
          <p className="text-[11px] text-muted-foreground">
            نسبة الشركة والتطبيق والضريبة — المالك فقط يستطيع التعديل (تحقق خادمي)
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className={fieldClass(companyOk)}>
          <Label htmlFor="fs-company" className="text-xs font-semibold text-muted-foreground">
            Company Share (%) — حصة الشركة
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="fs-company"
              type="number"
              min={0}
              max={100}
              step={1}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="80"
              className="text-right"
            />
            <span className="text-sm font-bold text-muted-foreground">%</span>
          </div>
        </div>

        <div className={fieldClass(platformOk)}>
          <Label htmlFor="fs-platform" className="text-xs font-semibold text-muted-foreground">
            Platform Commission (%) — عمولة التطبيق
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="fs-platform"
              type="number"
              min={0}
              max={100}
              step={1}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="20"
              className="text-right"
            />
            <span className="text-sm font-bold text-muted-foreground">%</span>
          </div>
        </div>

        <div className={fieldClass(vatOk)}>
          <Label htmlFor="fs-vat" className="text-xs font-semibold text-muted-foreground">
            VAT (%) — ضريبة القيمة المضافة
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="fs-vat"
              type="number"
              min={0}
              max={100}
              step={1}
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              placeholder="15"
              className="text-right"
            />
            <span className="text-sm font-bold text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      {/* مؤشر المجموع — يتحقق فورياً من قاعدة 100% */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          المجموع (شركة + تطبيق):{" "}
          <span className={`font-bold ${sumOk ? "text-emerald-600" : "text-rose-600"}`}>
            {Number.isFinite(sum) ? toArabicIndic(sum) : "—"}%
          </span>
        </span>
        {!sumOk && Number.isFinite(sum) ? (
          <span className="text-[11px] font-semibold text-rose-600">
            يجب أن يكون مجموع نسبة الشركة والتطبيق = 100%
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !companyOk || !platformOk || !vatOk || !sumOk}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ الإعدادات
        </Button>
        {settingsData.updatedAt ? (
          <span className="text-[11px] text-muted-foreground">
            آخر تحديث: {new Date(settingsData.updatedAt).toLocaleString("ar-SA")}
          </span>
        ) : null}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          القيم الحالية: شركة {toArabicIndic(settingsData.commissionCompanyPercent)}% · تطبيق{" "}
          {toArabicIndic(settingsData.commissionPlatformPercent)}% · ضريبة{" "}
          {toArabicIndic(settingsData.vatPercent)}% — تُطبَّق على الحجوزات والمدفوعات
          الجديدة فقط، وتُثبَّت لقطة لكل حجز/دفعة وقت إنشائه (الحجوزات السابقة لا تتغير).
        </span>
      </p>
    </div>
  );
}
