import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { getCompany } from "@/lib/transport";
import {
  Building2,
  Bus,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { motion } from "framer-motion";

type CompanyRow = Doc<"companies">;

interface DraftPhone {
  number: string;
  label: string;
  active: boolean;
}

interface CompanyForm {
  slug: string;
  name: string;
  base: string;
  routes: string;
  color: string;
  email: string;
  status: "active" | "inactive";
  address: string;
  mapUrl: string;
  lat: string;
  lng: string;
  phones: DraftPhone[];
}

const EMPTY_FORM: CompanyForm = {
  slug: "",
  name: "",
  base: "",
  routes: "",
  color: "#0f766e",
  email: "",
  status: "active",
  address: "",
  mapUrl: "",
  lat: "",
  lng: "",
  phones: [],
};

const PRESET_COLORS = [
  "#0f766e",
  "#1d4ed8",
  "#b45309",
  "#7c3aed",
  "#0e7490",
  "#4f46e5",
  "#c026d3",
  "#ea580c",
  "#15803d",
  "#dc2626",
];

/**
 * إدارة الشركات — للمالك فقط.
 * نموذج احترافي شامل لإضافة وتعديل الشركات مع بيانات التواصل والموقع.
 */
export function CompaniesManager() {
  const companiesList = useQuery(api.companies.list);
  const saveCompany = useMutation(api.companies.save);
  const saveContactInfo = useMutation(api.companies.saveContactInfo);
  const setCompanyStatus = useMutation(api.companies.setStatus);
  const removeCompany = useMutation(api.companies.remove);
  const updateEmailStatus = useMutation(api.companies.updateEmailStatus);
  const generateUploadUrl = useMutation(api.companies.generateUploadUrl);
  const setCompanyLogo = useMutation(api.companies.setLogo);
  const sendInvitation = useAction(api.companyEmails.sendCompanyInvitation);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState<Record<string, string>>({});
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<CompanyRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogoSlug, setUploadingLogoSlug] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  // ─── helpers ──────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingCompany(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (company: CompanyRow) => {
    setEditingCompany(company);
    setForm({
      slug: company.slug,
      name: company.name,
      base: company.base ?? "",
      routes: company.routes ?? "",
      color: company.color ?? "#0f766e",
      email: company.emails[0] ?? "",
      status: company.status ?? "active",
      address: company.address ?? "",
      mapUrl: company.mapUrl ?? "",
      lat: company.lat != null ? String(company.lat) : "",
      lng: company.lng != null ? String(company.lng) : "",
      phones: (company.contactPhones ?? []).map((p) => ({
        number: p.number,
        label: p.label ?? "",
        active: p.active,
      })),
    });
    setDialogOpen(true);
  };

  const updateField = <K extends keyof CompanyForm>(key: K, val: CompanyForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addPhone = () =>
    setForm((f) => ({
      ...f,
      phones: [...f.phones, { number: "", label: "", active: true }],
    }));

  const removePhone = (idx: number) =>
    setForm((f) => ({ ...f, phones: f.phones.filter((_, i) => i !== idx) }));

  const updatePhone = (idx: number, field: keyof DraftPhone, val: string | boolean) =>
    setForm((f) => ({
      ...f,
      phones: f.phones.map((p, i) => (i === idx ? { ...p, [field]: val } : p)),
    }));

  // ─── save / create ────────────────────────────────────────

  const handleSave = async () => {
    const slug = form.slug.trim().toLowerCase();
    const name = form.name.trim();
    if (!slug) {
      toast.error("معرّف الشركة (Slug) مطلوب");
      return;
    }
    if (!name) {
      toast.error("اسم الشركة مطلوب");
      return;
    }

    setSaving(true);
    try {
      const emails = form.email
        ? [form.email.trim().toLowerCase()]
        : editingCompany
          ? editingCompany.emails
          : [];

      // 1) save basic company info
      await saveCompany({
        slug,
        name,
        base: form.base.trim() || undefined,
        routes: form.routes.trim() || undefined,
        color: form.color.trim() || undefined,
        emails,
        status: form.status,
      });

      // 2) save contact / location info
      const lat = form.lat.trim() ? Number(form.lat) : undefined;
      const lng = form.lng.trim() ? Number(form.lng) : undefined;
      if (form.lat.trim() && isNaN(lat!)) {
        toast.error("خط العرض يجب أن يكون رقماً");
        return;
      }
      if (form.lng.trim() && isNaN(lng!)) {
        toast.error("خط الطول يجب أن يكون رقماً");
        return;
      }

      const hasContactData =
        form.address.trim() ||
        form.mapUrl.trim() ||
        form.lat.trim() ||
        form.lng.trim() ||
        form.phones.some((p) => p.number.trim());

      if (hasContactData) {
        await saveContactInfo({
          slug,
          address: form.address.trim() || undefined,
          mapUrl: form.mapUrl.trim() || undefined,
          lat,
          lng,
          contactPhones: form.phones
            .filter((p) => p.number.trim())
            .map((p) => ({
              number: p.number.trim(),
              label: p.label.trim() || undefined,
              active: p.active,
            })),
        });
      }

      toast.success(
        editingCompany
          ? "تم تحديث بيانات الشركة بنجاح"
          : "تمت إضافة الشركة بنجاح — يمكنك الآن تعديل بيانات التواصل من بطاقتها",
      );
      setDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الشركة");
    } finally {
      setSaving(false);
    }
  };

  // ─── email management ─────────────────────────────────────

  const sendCompanyEmail = async (company: CompanyRow, emailOverride?: string) => {
    const email = (emailOverride ?? company.emails[0])?.trim().toLowerCase();
    if (!email || !siteUrl) return;

    const companyUrl = `${siteUrl}/company/${company.slug}`;
    setSendingEmail((s) => ({ ...s, [company.slug]: true }));

    try {
      await sendInvitation({ email, companyName: company.name, companyUrl });
      await updateEmailStatus({ slug: company.slug, emailStatus: "sent", companyUrl });
      toast.success(`تم إرسال بريد الدعوة إلى ${email}`);
    } catch (err) {
      console.error(err);
      await updateEmailStatus({ slug: company.slug, emailStatus: "failed", companyUrl });
      toast.error("فشل إرسال البريد — يمكنك إعادة المحاولة لاحقاً");
    } finally {
      setSendingEmail((s) => ({ ...s, [company.slug]: false }));
    }
  };

  const addCompanyEmail = async (company: CompanyRow, rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase();
    if (!email) return;
    try {
      await saveCompany({
        slug: company.slug,
        name: company.name,
        base: company.base,
        routes: company.routes,
        color: company.color,
        emails: [...company.emails, email],
      });
      setEmailInput((s) => ({ ...s, [company.slug]: "" }));
      toast.success("أُضيف البريد — جاري إرسال بريد الدعوة...");

      const companyUrl = `${siteUrl}/company/${company.slug}`;
      setSendingEmail((s) => ({ ...s, [company.slug]: true }));
      try {
        await sendInvitation({ email, companyName: company.name, companyUrl });
        await updateEmailStatus({ slug: company.slug, emailStatus: "sent", companyUrl });
        toast.success(`تم إرسال بريد الدعوة إلى ${email}`);
      } catch (err) {
        console.error(err);
        await updateEmailStatus({ slug: company.slug, emailStatus: "failed", companyUrl });
        toast.error("فشل إرسال البريد — يمكنك إعادة المحاولة لاحقاً");
      } finally {
        setSendingEmail((s) => ({ ...s, [company.slug]: false }));
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر إضافة البريد");
    }
  };

  const removeCompanyEmail = async (company: CompanyRow, email: string) => {
    try {
      await saveCompany({
        slug: company.slug,
        name: company.name,
        base: company.base,
        routes: company.routes,
        color: company.color,
        emails: company.emails.filter((e) => e !== email),
      });
      toast.success("أُزيل البريد");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر إزالة البريد");
    }
  };

  const toggleCompanyStatus = async (company: CompanyRow) => {
    const next = company.status === "inactive" ? "active" : "inactive";
    try {
      await setCompanyStatus({ slug: company.slug, status: next });
      toast.success(
        next === "active"
          ? "تم تفعيل الشركة — ستظهر في المنصة"
          : "تم إيقاف الشركة",
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تغيير حالة الشركة");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await removeCompany({ slug: confirmDelete.slug });
      toast.success("تم حذف الشركة");
      setConfirmDelete(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر حذف الشركة");
    } finally {
      setDeleting(false);
    }
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

  // ─── labels ───────────────────────────────────────────────

  const emailStatusLabel = (status?: string) => {
    if (status === "sent")
      return {
        text: "تم الإرسال",
        color: "border-emerald-300 bg-emerald-50 text-emerald-800",
      };
    if (status === "failed")
      return {
        text: "فشل الإرسال",
        color: "border-rose-300 bg-rose-50 text-rose-700",
      };
    return {
      text: "لم يتم الإرسال",
      color: "border-slate-300 bg-slate-50 text-slate-600",
    };
  };

  const formatDate = (ts?: number) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return new Date(ts).toISOString();
    }
  };

  // ─── render ───────────────────────────────────────────────

  return (
    <div>
      {/* ─── Add Button ────────────────────── */}
      <div className="mb-4">
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="size-4" />
          إضافة شركة نقل جديدة
        </Button>
      </div>

      {/* ─── Loading / Empty ────────────────── */}
      {companiesList === undefined ? (
        <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : companiesList.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold">لا توجد شركات مسجلة بعد</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            اضغط الزر أعلاه لإضافة أول شركة نقل — يمكنك إدخال جميع بيانات الشركة
            وموقعها وأرقام التواصل في خطوة واحدة
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {companiesList.map((company) => {
            const meta = getCompany(company.slug);
            const isSending = sendingEmail[company.slug] ?? false;
            const emailStatus = emailStatusLabel(company.emailStatus);
            const companyUrl =
              company.companyUrl ?? (siteUrl ? `${siteUrl}/company/${company.slug}` : "");
            const phones = company.contactPhones ?? [];
            const activePhones = phones.filter((p) => p.active);

            return (
              <motion.div
                key={company.slug}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border bg-card p-4"
              >
                {/* ─── Header row ───────────── */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex size-10 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: company.color ?? meta?.color ?? "#334155" }}
                    >
                      {company.logo ? (
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="size-8 rounded-lg object-contain"
                        />
                      ) : (
                        <Bus className="size-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">{company.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {company.base ?? meta?.base ?? ""}
                        {company.routes ? ` — ${company.routes}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        company.status === "inactive"
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {company.status === "inactive" ? "موقوفة" : "نشطة"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] text-muted-foreground"
                    >
                      {company.slug}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => openEditDialog(company)}
                    >
                      <Edit3 className="size-3.5" />
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => toggleCompanyStatus(company)}
                    >
                      {company.status === "inactive" ? (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          تفعيل
                        </>
                      ) : (
                        <>
                          <XCircle className="size-3.5" />
                          إيقاف
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* ─── Contact info summary ──── */}
                {(company.address || company.mapUrl || activePhones.length > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                    {company.address && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-3" />
                        {company.address}
                      </span>
                    )}
                    {company.lat != null && company.lng != null && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {company.lat}, {company.lng}
                      </span>
                    )}
                    {activePhones.length > 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="size-3" />
                        {activePhones.map((p) => p.number).join(" · ")}
                      </span>
                    )}
                  </div>
                )}

                {/* ─── Logo upload ────────────── */}
                <div className="mt-3 flex items-center gap-2">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    disabled={uploadingLogoSlug === company.slug}
                    onClick={() => logoFileRef.current?.click()}
                  >
                    {uploadingLogoSlug === company.slug ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {company.logo ? "تغيير الشعار" : "رفع شعار"}
                  </Button>
                </div>

                {/* ─── Emails ─────────────────── */}
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    {company.emails.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        لا توجد بريدات مسؤولين — أضف البريد الأول بالأسفل
                      </span>
                    ) : (
                      company.emails.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                          dir="ltr"
                        >
                          {email}
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            onClick={() => removeCompanyEmail(company, email)}
                            aria-label={`إزالة ${email}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {company.emails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-muted-foreground">
                          حالة الدعوة:
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${emailStatus.color}`}
                        >
                          {isSending ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" />
                              جاري الإرسال...
                            </span>
                          ) : (
                            emailStatus.text
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-muted-foreground">
                          آخر إرسال:
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(company.lastEmailSentAt)}
                        </span>
                      </div>
                      {companyUrl && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-muted-foreground">
                            صفحة الشركة:
                          </span>
                          <a
                            href={companyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                            dir="ltr"
                          >
                            <ExternalLink className="size-3" />
                            {companyUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {company.emails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={isSending}
                        onClick={() => sendCompanyEmail(company)}
                      >
                        {isSending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        إعادة إرسال رابط الشركة
                      </Button>
                      {companyUrl && (
                        <a href={companyUrl} target="_blank" rel="noopener noreferrer">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                          >
                            <ExternalLink className="size-3.5" />
                            فتح صفحة الشركة
                          </Button>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Add email form */}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addCompanyEmail(company, emailInput[company.slug] ?? "");
                    }}
                  >
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={emailInput[company.slug] ?? ""}
                      onChange={(e) =>
                        setEmailInput((s) => ({ ...s, [company.slug]: e.target.value }))
                      }
                      placeholder="bassam@company.com"
                      className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                    />
                    <Button type="submit" size="sm" className="h-9 gap-1">
                      <Plus className="size-4" />
                      إضافة بريد
                    </Button>
                  </form>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Add / Edit Dialog ─────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "تعديل بيانات الشركة" : "إضافة شركة نقل جديدة"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "حدّث بيانات الشركة الأساسية وموقعها وأرقام التواصل"
                : "أدخل بيانات الشركة — يمكنك لاحقاً تعديل جميع الحقول من بطاقتها"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-5 p-1">
              {/* ─── Basic Info ─────────────── */}
              <div>
                <h4 className="mb-2 text-xs font-bold text-muted-foreground">
                  البيانات الأساسية
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">
                      معرّف الشركة <span className="text-destructive">*</span>
                    </label>
                    <input
                      dir="ltr"
                      value={form.slug}
                      onChange={(e) => updateField("slug", e.target.value)}
                      placeholder="al-mutasaddir"
                      disabled={!!editingCompany}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      باللاتينية — فريد لكل شركة ولا يمكن تغييره لاحقاً
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">
                      اسم الشركة <span className="text-destructive">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="مؤسسة المتصدر للنقل"
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">المقر الرئيسي</label>
                    <input
                      value={form.base}
                      onChange={(e) => updateField("base", e.target.value)}
                      placeholder="جدة"
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">الحالة</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        updateField("status", e.target.value as "active" | "inactive")
                      }
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                    >
                      <option value="active">نشطة</option>
                      <option value="inactive">موقوفة</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <label className="block text-xs font-semibold">وصف المسارات</label>
                  <textarea
                    value={form.routes}
                    onChange={(e) => updateField("routes", e.target.value)}
                    placeholder="رحلات يومية من جدة والرياض إلى صنعاء وعدن وتعز"
                    rows={2}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                  />
                </div>
              </div>

              {/* ─── Color ──────────────────── */}
              <div>
                <h4 className="mb-2 text-xs font-bold text-muted-foreground">
                  لون الشركة المميز
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateField("color", c)}
                      className={`size-7 rounded-full border-2 transition-all ${
                        form.color === c
                          ? "scale-110 border-foreground ring-2 ring-foreground/20"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    className="size-7 cursor-pointer rounded-full border"
                    title="اختر لوناً مخصصاً"
                  />
                </div>
              </div>

              {/* ─── Email ──────────────────── */}
              <div>
                <h4 className="mb-2 text-xs font-bold text-muted-foreground">
                  بريد المسؤول
                </h4>
                <input
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="company@example.com"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  البريد الإلكتروني لصاحب/مسؤول الشركة — سيتلقى بريد دعوة للحصول على
                  لوحة تحكم خاصة بالشركة
                </p>
              </div>

              {/* ─── Location & Address ──────── */}
              <div>
                <h4 className="mb-2 text-xs font-bold text-muted-foreground">
                  الموقع والعنوان
                </h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">العنوان</label>
                    <input
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="حي الصفا، شارع الأمير سلطان، جدة"
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">
                      رابط Google Maps
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={form.mapUrl}
                      onChange={(e) => updateField("mapUrl", e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm font-mono outline-none ring-ring transition focus:ring-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold">Latitude</label>
                      <input
                        dir="ltr"
                        value={form.lat}
                        onChange={(e) => updateField("lat", e.target.value)}
                        placeholder="21.5433"
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm font-mono outline-none ring-ring transition focus:ring-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold">Longitude</label>
                      <input
                        dir="ltr"
                        value={form.lng}
                        onChange={(e) => updateField("lng", e.target.value)}
                        placeholder="39.1728"
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm font-mono outline-none ring-ring transition focus:ring-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Contact Phones ──────────── */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground">
                    أرقام التواصل
                  </h4>
                  <button
                    type="button"
                    onClick={addPhone}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/30 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/5"
                  >
                    <Plus className="size-3" />
                    إضافة رقم
                  </button>
                </div>
                {form.phones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    لم تُضف أرقام تواصل بعد — اضغط "إضافة رقم" لإضافة أول رقم
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.phones.map((phone, idx) => (
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
                          placeholder="التصنيف (حجوزات، طوارئ...)"
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
                          onClick={() => removePhone(idx)}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50"
                          title="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              إلغاء
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : editingCompany ? (
                "حفظ التعديلات"
              ) : (
                "إضافة الشركة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ───────────── */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حذف الشركة</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف شركة{" "}
              <strong className="text-foreground">{confirmDelete?.name}</strong>؟ هذا
              الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "حذف الشركة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
