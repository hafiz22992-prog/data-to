import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Banknote, Bus, CalendarDays, CheckCircle2, Clock3, IdCard,
  Landmark, Loader2, MapPin, Phone, Printer, Receipt, Trash2,
  User, Users, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDateDDMMYYYY, toArabicIndic } from "@/lib/arabic";
import { fareBreakdown } from "@/lib/fare";
import {
  BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, getCompany,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES,
} from "@/lib/transport";
import type { PaymentStatus } from "@/lib/transport";
import { TicketReceipt } from "@/components/TicketReceipt";

type BookingRow = Doc<"busBookings">;

interface SaturnPhoneItem { number: string; label?: string; active: boolean; }

function BankTransferPanel({ booking, manageMode }: { booking: BookingRow; manageMode: boolean }) {
  const payments = useQuery(api.payments.byBooking, { bookingId: booking._id });
  const confirmTransfer = useMutation(api.payments.confirmBankTransfer);
  const rejectTransfer = useMutation(api.payments.rejectBankTransfer);
  const generateUploadUrl = useMutation(api.payments.generateUploadUrl);
  const attachReceipt = useMutation(api.payments.attachReceipt);
  const [file, setFile] = useState<File | null>(null);
  const [transferRef, setTransferRef] = useState("");
  const [busy, setBusy] = useState(false);
  const payment = payments?.find((p) => p.method === "bank_transfer");

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payment) return;
    setBusy(true);
    try {
      if (file) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("فشل رفع الإيصال");
        const { storageId } = (await res.json()) as { storageId: string };
        await attachReceipt({ paymentId: payment._id, storageId, transferRef: transferRef.trim() || undefined });
      } else {
        await attachReceipt({ paymentId: payment._id, transferRef: transferRef.trim() || undefined });
      }
      toast.success("أُرسل الإيصال/المرجع — بانتظار المراجعة");
      setFile(null); setTransferRef("");
    } catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : "تعذر إرسال الإيصال"); } finally { setBusy(false); }
  };

  if (payments === undefined || !payment) return null;

  return (
    <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3.5">
      {manageMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground"><Landmark className="size-3.5 text-primary" />تحويل بنكي — بانتظار المراجعة</span>
          {payment.status === "pending" ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={busy} onClick={() => { setBusy(true); rejectTransfer({ paymentId: payment._id }).then(() => { toast.success("تم رفض التحويل"); setBusy(false); }); }}>
                <XCircle className="size-3.5" />رفض
              </Button>
              <Button size="sm" className="h-8 gap-1 text-xs" disabled={busy} onClick={() => { setBusy(true); confirmTransfer({ paymentId: payment._id }).then(() => { toast.success("تم تأكيد التحويل"); setBusy(false); }); }}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}تأكيد
              </Button>
            </div>
          ) : <Badge variant="outline">{PAYMENT_STATUS_LABELS[payment.status]}</Badge>}
        </div>
      ) : payment.status === "paid" ? (
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="size-4" />تم تأكيد التحويل</p>
      ) : null}
    </div>
  );
}

interface BookingsListProps { showAccounting?: boolean; manageMode?: boolean; canDelete?: boolean; }

export function BookingsList({ showAccounting = false, manageMode = false, canDelete = false }: BookingsListProps) {
  const bookings = useQuery(manageMode ? api.bookings.forCompany : api.bookings.list);
  const updateStatus = useMutation(api.bookings.updateStatus);
  const updatePayment = useMutation(api.bookings.updatePayment);
  const initiatePayment = useMutation(api.payments.initiate);
  const removeBooking = useMutation(api.bookings.remove);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printBooking, setPrintBooking] = useState<BookingRow | null>(null);
  const activeCompanies = useQuery(api.companies.listActive);
  const companyBySlug = useMemo(() => new Map((activeCompanies ?? []).map((c) => [c.slug, c])), [activeCompanies]);
  const settings = useQuery(api.settings.get);
  const saturnPhones = useMemo(() => (settings?.saturnPhoneNumbers ?? []).filter((p) => p.active), [settings]);

  useEffect(() => {
    if (!printBooking) return;
    const cleanup = () => { document.body.classList.remove("print-ticket"); setPrintBooking(null); };
    document.body.classList.add("print-ticket"); window.print();
    window.addEventListener("afterprint", cleanup);
    const timer = window.setTimeout(cleanup, 3000);
    return () => { window.removeEventListener("afterprint", cleanup); window.clearTimeout(timer); };
  }, [printBooking]);

  if (bookings === undefined) return <div className="flex min-h-40 items-center justify-center rounded-xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (bookings.length === 0) return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
      <Bus className="size-6 text-primary" />
      <p className="mt-3 text-sm font-bold">{manageMode ? "لا توجد حجوزات على شركتك بعد" : "لا توجد حجوزات بعد"}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {bookings.map((booking, i) => {
        const company = companyBySlug.get(booking.companyId) ?? getCompany(booking.companyId);
        const isBusy = busyId === booking._id;
        const fare = booking.fareAmount ?? (booking.price ?? 0) * booking.passengers;
        const split = fareBreakdown(fare);
        const paymentStatus: PaymentStatus = booking.paymentStatus ?? "unpaid";
        const isCancelled = booking.status === "cancelled";
        const isBankTransfer = booking.paymentMethod === "bank_transfer";
        return (
          <motion.div key={booking._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-bold text-muted-foreground">{booking.bookingNo}</span>
                <Badge variant="outline" className={BOOKING_STATUS_STYLES[booking.status]}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
                <Badge variant="outline" className={PAYMENT_STATUS_STYLES[paymentStatus]}>{PAYMENT_STATUS_LABELS[paymentStatus]}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setPrintBooking(booking); toast("ستفتح نافذة الطباعة"); }}>
                  <Printer className="size-3.5" />طباعة
                </Button>
                {manageMode && paymentStatus !== "paid" && !isCancelled && !isBankTransfer ? (
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={isBusy} onClick={() => { setBusyId(booking._id); updatePayment({ id: booking._id, paymentStatus: "paid" }).then(() => { toast.success("تم التحصيل"); setBusyId(null); }); }}>
                    <Banknote className="size-3.5" />تحصيل
                  </Button>
                ) : null}
                {manageMode && booking.status !== "confirmed" && !isBankTransfer ? (
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={isBusy} onClick={() => { setBusyId(booking._id); updateStatus({ id: booking._id, status: "confirmed" }).then(() => { toast.success("تم التأكيد"); setBusyId(null); }); }}>
                    <CheckCircle2 className="size-3.5" />تأكيد
                  </Button>
                ) : null}
                {booking.status !== "cancelled" ? (
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setBusyId(booking._id); updateStatus({ id: booking._id, status: "cancelled" }).then(() => { toast.success("تم الإلغاء"); setBusyId(null); }); }}>
                    <XCircle className="size-3.5" />إلغاء
                  </Button>
                ) : null}
                {manageMode && canDelete ? (
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => { if (window.confirm("حذف الحجز؟")) { removeBooking({ id: booking._id }).then(() => toast.success("تم الحذف")); } }}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="flex items-center gap-1.5 text-primary"><MapPin className="size-4" />{booking.departure}</span>
              <ArrowLeft className="size-4 text-muted-foreground" />
              <span className="flex items-center gap-1.5 text-emerald-600"><MapPin className="size-4" />{booking.destination}</span>
              {booking.departureTime ? <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 className="size-3.5" />انطلاق {booking.departureTime}</span> : null}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <span className="flex items-center gap-1.5"><Bus className="size-3.5" style={{ color: company?.color }} />{booking.companyName}{company?.base ? ` — ${company.base}` : ""}</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{toArabicIndic(formatDateDDMMYYYY(booking.travelDate))}</span>
              <span className="flex items-center gap-1.5"><Users className="size-3.5" />{toArabicIndic(booking.passengers)} {booking.passengers > 1 ? "ركاب" : "راكب"}</span>
              <span className="flex items-center gap-1.5"><Phone className="size-3.5" /><span dir="ltr">{booking.mobile}</span></span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-bold text-foreground"><Receipt className="size-3.5 text-primary" />{toArabicIndic(fare)} ريال</span>
              {booking.price ? <span>({toArabicIndic(booking.price)} × {toArabicIndic(booking.passengers)})</span> : null}
              {showAccounting ? <span className="text-[11px]">للشركة {toArabicIndic(split.companyShare)} · للتطبيق {toArabicIndic(split.appShare)}</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><User className="size-3.5" />{booking.customerName}</span>
              <span className="flex items-center gap-1.5"><IdCard className="size-3.5" />إقامة: {booking.residencyNumber || "—"}</span>
              <span>جواز: {booking.passportNumber}</span>
            </div>
            {isBankTransfer ? <BankTransferPanel booking={booking} manageMode={manageMode} /> : null}
          </motion.div>
        );
      })}

      {printBooking ? createPortal(
        <div id="ticket-print" className="hidden">
          <TicketReceipt booking={printBooking} showAccounting={false} companyBySlug={companyBySlug} saturnPhones={saturnPhones} />
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
