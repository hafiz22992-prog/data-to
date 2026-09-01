import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, CreditCard, Landmark, Loader2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDateDDMMYYYY, toArabicIndic } from "@/lib/arabic";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
} from "@/lib/transport";
import { ReceiptLink } from "@/components/ReceiptLink";

/**
 * سجل عمليات الدفع — للمالك (كل عمليات المنصة) وصاحب الشركة (عمليات شركته فقط).
 * الحماية خادمية: api.payments.list لا يعيد شيئاً للعميل، ويفلتر بشركة الدور
 * للشركة المشغلة. البيانات الإدارية (العميل/الشركة/المبلغ) تظهر هنا فقط لمن
 * يملكها — لا يصل المسافر إلى سجل مدفوعات الآخرين.
 *
 * التحويل البنكي: تُعرض مراجع التحويل والإيصالات (عرض الإيصال محمي خادمياً)،
 * والتأكيد/الرفض متاحان من هنا للمالك وصاحب الشركة فقط (الخادم يرفض أي دور آخر).
 */
export function PaymentsSection({
  bookings,
}: {
  /** حجوزات اللوحة الحالية (لربط رقم الحجز والعميل والشركة بكل عملية دفع). */
  bookings?: Doc<"busBookings">[];
}) {
  const payments = useQuery(api.payments.list);
  const confirmTransfer = useMutation(api.payments.confirmBankTransfer);
  const rejectTransfer = useMutation(api.payments.rejectBankTransfer);
  const [busyId, setBusyId] = useState<Id<"payments"> | null>(null);

  // فلاتر العرض (تؤثر على الواجهة فقط — النطاق الخادمي مفروض في api.payments.list)
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const bookingById = useMemo(
    () => new Map((bookings ?? []).map((b) => [b._id, b])),
    [bookings],
  );

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings ?? []) {
      if (b.companyName) set.add(b.companyName);
    }
    return [...set].sort();
  }, [bookings]);

  const filtered = useMemo(() => {
    if (payments === undefined) return [];
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (companyFilter !== "all") {
        const booking = bookingById.get(p.bookingId);
        if (!booking || booking.companyName !== companyFilter) return false;
      }
      if (dateFilter) {
        const day = new Date(p.createdAt).toISOString().slice(0, 10);
        if (day !== dateFilter) return false;
      }
      return true;
    });
  }, [payments, statusFilter, methodFilter, companyFilter, dateFilter, bookingById]);

  const handleConfirm = async (paymentId: Id<"payments">) => {
    setBusyId(paymentId);
    try {
      await confirmTransfer({ paymentId });
      toast.success("تم تأكيد التحويل — الحجز مؤكد والتذكرة صادرة");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تأكيد التحويل");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (paymentId: Id<"payments">) => {
    setBusyId(paymentId);
    try {
      await rejectTransfer({ paymentId });
      toast.success("تم رفض التحويل — سيُعلم المسافر ويمكنه إعادة المحاولة");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر رفض التحويل");
    } finally {
      setBusyId(null);
    }
  };

  if (payments === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CreditCard className="size-5" />
        </div>
        <p className="mt-3 text-sm font-bold">لا توجد عمليات دفع بعد</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          عند بدء المسافر عملية دفع (تحويل بنكي) أو تسجيل التحصيل عند الانطلاق، تظهر
          العملية هنا بحالتها: قيد المعالجة / مدفوع / فشل / ملغي
        </p>
      </div>
    );
  }

  const resetFilters = () => {
    setStatusFilter("all");
    setCompanyFilter("all");
    setMethodFilter("all");
    setDateFilter("");
  };

  const filterBar = "h-9 text-xs";

  return (
    <div className="space-y-3">
      {/* ===== الفلاتر ===== */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={filterBar}>
            <SelectValue placeholder="الحالة: الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الحالة: الكل</SelectItem>
            <SelectItem value="pending">قيد المعالجة</SelectItem>
            <SelectItem value="paid">تم الدفع بنجاح</SelectItem>
            <SelectItem value="failed">فشل الدفع</SelectItem>
            <SelectItem value="cancelled">تم إلغاء الدفع</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className={filterBar}>
            <SelectValue placeholder="طريقة الدفع: الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">طريقة الدفع: الكل</SelectItem>
            <SelectItem value="on_arrival">الدفع عند الانطلاق</SelectItem>
            <SelectItem value="bank_transfer">التحويل البنكي</SelectItem>
            <SelectItem value="card">بطاقة / محفظة</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={companyFilter}
          onValueChange={setCompanyFilter}
          disabled={companies.length === 0}
        >
          <SelectTrigger className={filterBar}>
            <SelectValue placeholder="الشركة: الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الشركة: الكل</SelectItem>
            {companies.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={filterBar}
            aria-label="تصفية حسب التاريخ"
          />
          {(statusFilter !== "all" ||
            methodFilter !== "all" ||
            companyFilter !== "all" ||
            dateFilter) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 text-xs"
              onClick={resetFilters}
            >
              مسح
            </Button>
          ) : null}
        </div>
      </div>

      {/* ===== الجدول ===== */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1180px] text-right text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-3 font-semibold">معرف العملية</th>
              <th className="px-3 py-3 font-semibold">رقم الحجز</th>
              <th className="px-3 py-3 font-semibold">العميل</th>
              <th className="px-3 py-3 font-semibold">الشركة</th>
              <th className="px-3 py-3 text-center font-semibold">المبلغ</th>
              <th className="px-3 py-3 font-semibold">طريقة الدفع</th>
              <th className="px-3 py-3 text-center font-semibold">الحالة</th>
              <th className="px-3 py-3 font-semibold">مرجع التحويل</th>
              <th className="px-3 py-3 font-semibold">الإيصال</th>
              <th className="px-3 py-3 font-semibold">المزود</th>
              <th className="px-3 py-3 font-semibold">مرجع العملية</th>
              <th className="px-3 py-3 font-semibold">تاريخ الإنشاء</th>
              <th className="px-3 py-3 font-semibold">آخر تحديث</th>
              <th className="px-3 py-3 text-center font-semibold">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const booking = bookingById.get(p.bookingId);
              const isBankTransfer = p.method === "bank_transfer";
              const canReview = isBankTransfer && p.status === "pending";
              const isBusy = busyId === p._id;
              return (
                <tr key={p._id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground" dir="ltr">
                    {p._id.slice(-8)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] font-bold text-muted-foreground">
                    {booking?.bookingNo ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-semibold">{booking?.customerName ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {booking?.companyName ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center font-extrabold">
                    {toArabicIndic(p.amount)}
                    <span className="mr-1 text-[10px] font-medium text-muted-foreground">
                      {p.currency}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <span
                      className={
                        isBankTransfer
                          ? "inline-flex items-center gap-1 font-semibold text-foreground"
                          : ""
                      }
                    >
                      {isBankTransfer ? (
                        <Landmark className="size-3.5 text-primary" />
                      ) : null}
                      {PAYMENT_METHOD_LABELS[p.method]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge variant="outline" className={PAYMENT_STATUS_STYLES[p.status]}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px]" dir="ltr">
                    {p.transferRef ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {p.receiptStorageId ? (
                      <ReceiptLink paymentId={p._id} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{p.provider ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-[11px]" dir="ltr">
                    {p.providerRef ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {toArabicIndic(
                      formatDateDDMMYYYY(new Date(p.createdAt).toISOString().slice(0, 10)),
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {toArabicIndic(
                      formatDateDDMMYYYY(new Date(p.updatedAt).toISOString().slice(0, 10)),
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canReview ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px] text-rose-600 hover:text-rose-700"
                          disabled={isBusy}
                          onClick={() => handleReject(p._id)}
                        >
                          <XCircle className="size-3.5" />
                          رفض
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px]"
                          disabled={isBusy}
                          onClick={() => handleConfirm(p._id)}
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          تأكيد التحويل
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  لا توجد عمليات مطابقة للفلاتر المحددة
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        عرض {toArabicIndic(filtered.length)} من {toArabicIndic(payments.length)} عملية
      </p>
    </div>
  );
}
