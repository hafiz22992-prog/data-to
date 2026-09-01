import { Badge } from "@/components/ui/badge";
import { BarChart3, Banknote, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { toArabicIndic } from "@/lib/arabic";
import type { Doc } from "@/convex/_generated/dataModel";

type BookingRow = Doc<"busBookings">;

/**
 * التقارير — مشتقة بالكامل من الحجوزات المصرّح بها (المالك: كل الشركات،
 * صاحب الشركة: شركته فقط — الخادم يقيّد المصدر). لا تُنشأ أي بيانات هنا.
 */
export function ReportsSection({ bookings }: { bookings: BookingRow[] | undefined }) {
  if (bookings === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <span className="text-xs text-muted-foreground">جارٍ التحميل…</span>
      </div>
    );
  }

  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const paid = bookings.filter((b) => b.paymentStatus === "paid");
  const unpaid = bookings.filter((b) => b.paymentStatus !== "paid" && b.status !== "cancelled");
  const collected = paid.reduce((s, b) => s + (b.fareAmount ?? (b.price ?? 0) * b.passengers), 0);
  const outstanding = unpaid.reduce(
    (s, b) => s + (b.fareAmount ?? (b.price ?? 0) * b.passengers),
    0,
  );

  const byCompany = new Map<
    string,
    { name: string; bookings: number; passengers: number; fare: number; paid: number }
  >();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const row = byCompany.get(b.companyId) ?? {
      name: b.companyName,
      bookings: 0,
      passengers: 0,
      fare: 0,
      paid: 0,
    };
    row.bookings += 1;
    row.passengers += b.passengers;
    row.fare += b.fareAmount ?? (b.price ?? 0) * b.passengers;
    if (b.paymentStatus === "paid") row.paid += b.fareAmount ?? (b.price ?? 0) * b.passengers;
    byCompany.set(b.companyId, row);
  }
  const rows = [...byCompany.values()].sort((a, b) => b.fare - a.fare);

  const cards = [
    {
      label: "قيد الانتظار",
      value: pending.length,
      icon: Clock3,
      tone: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "مؤكدة",
      value: confirmed.length,
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "ملغاة",
      value: cancelled.length,
      icon: XCircle,
      tone: "text-rose-600 bg-rose-500/10",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className={`mb-2 flex size-8 items-center justify-center rounded-lg ${c.tone}`}>
              <c.icon className="size-4" />
            </div>
            <p className="text-xl font-extrabold leading-none">{toArabicIndic(c.value)}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </div>
          <p className="text-xl font-extrabold leading-none">{toArabicIndic(bookings.length)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">إجمالي الحجوزات</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Banknote className="size-4 text-emerald-600" />
            محصّل
          </span>
          <span className="font-extrabold">
            {toArabicIndic(Math.round(collected))}{" "}
            <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Banknote className="size-4 text-amber-600" />
            مستحق التحصيل (غير محصّل)
          </span>
          <span className="font-extrabold">
            {toArabicIndic(Math.round(outstanding))}{" "}
            <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-4 py-3 font-semibold">الشركة</th>
              <th className="px-4 py-3 text-center font-semibold">الحجوزات</th>
              <th className="px-4 py-3 text-center font-semibold">الركاب</th>
              <th className="px-4 py-3 text-center font-semibold">قيمة التذاكر</th>
              <th className="px-4 py-3 text-center font-semibold">المحصّل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 text-center">{toArabicIndic(r.bookings)}</td>
                <td className="px-4 py-3 text-center">{toArabicIndic(r.passengers)}</td>
                <td className="px-4 py-3 text-center font-semibold">
                  {toArabicIndic(Math.round(r.fare))}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-600">
                  {toArabicIndic(Math.round(r.paid))}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  لا توجد حجوزات نشطة بعد لبناء تقرير
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {bookings.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          التقارير تُبنى لحظياً من حجوزاتك المصرّح بها — يمكن تصدير «التقارير» من قسم
          المحاسبة عند الحاجة (طباعة/PDF عبر التذكرة لكل حجز).
        </p>
      ) : null}
    </div>
  );
}
