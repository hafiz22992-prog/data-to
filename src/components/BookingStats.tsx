import { Banknote, Bus, CheckCircle2, Clock3, Users, XCircle } from "lucide-react";
import { toArabicIndic } from "@/lib/arabic";
import type { Doc } from "@/convex/_generated/dataModel";

type BookingRow = Doc<"busBookings">;

/**
 * بطاقات الإحصائيات — تُشارك بين لوحة المالك ولوحة صاحب الشركة
 * (البيانات تُمرَّر من query مقيّد خادمياً حسب الدور).
 */
export function BookingStats({
  bookings,
  showPaid = false,
}: {
  bookings: BookingRow[] | undefined;
  /** يعرض بطاقة «حجوزات محصّلة» فقط لمن يرى المحاسبة (مالك/شركة). */
  showPaid?: boolean;
}) {
  const stats = [
    {
      label: "إجمالي الحجوزات",
      value: bookings ? toArabicIndic(bookings.length) : "…",
      icon: Bus,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "مؤكدة",
      value: bookings
        ? toArabicIndic(bookings.filter((b) => b.status === "confirmed").length)
        : "…",
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "قيد الانتظار",
      value: bookings
        ? toArabicIndic(bookings.filter((b) => b.status === "pending").length)
        : "…",
      icon: Clock3,
      tone: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "ملغاة",
      value: bookings
        ? toArabicIndic(bookings.filter((b) => b.status === "cancelled").length)
        : "…",
      icon: XCircle,
      tone: "text-rose-600 bg-rose-500/10",
    },
  ];

  const totalPassengers = bookings
    ? toArabicIndic(bookings.reduce((sum, b) => sum + (b.passengers || 1), 0))
    : "…";

  const paidCount = bookings
    ? toArabicIndic(bookings.filter((b) => b.paymentStatus === "paid").length)
    : "…";

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border bg-card p-4">
          <div className={`mb-2 flex size-8 items-center justify-center rounded-lg ${s.tone}`}>
            <s.icon className="size-4" />
          </div>
          <p className="text-xl font-extrabold leading-none">{s.value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
          <Users className="size-4" />
        </div>
        <p className="text-xl font-extrabold leading-none">{totalPassengers}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">إجمالي الركاب</p>
      </div>
      {showPaid ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Banknote className="size-4" />
          </div>
          <p className="text-xl font-extrabold leading-none">{paidCount}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">حجوزات محصّلة</p>
        </div>
      ) : null}
    </section>
  );
}
