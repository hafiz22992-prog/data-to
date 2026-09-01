import { Users } from "lucide-react";
import { toArabicIndic } from "@/lib/arabic";
import type { Doc } from "@/convex/_generated/dataModel";

type BookingRow = Doc<"busBookings">;

/**
 * المسافرون — مشتق من الحجوزات المصرّح بها للمستخدم (المالك: الكل،
 * صاحب الشركة: مسافرو شركته فقط — الخادم يقيّد bookings.forCompany).
 * فريد حسب رقم الجوال.
 */
export function PassengersSection({ bookings }: { bookings: BookingRow[] | undefined }) {
  if (bookings === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <span className="text-xs text-muted-foreground">جارٍ التحميل…</span>
      </div>
    );
  }

  const byMobile = new Map<
    string,
    { name: string; mobile: string; bookings: number; passengers: number; fare: number }
  >();
  for (const b of bookings) {
    const key = b.mobile || b.customerName;
    const existing = byMobile.get(key);
    const fare = b.fareAmount ?? (b.price ?? 0) * b.passengers;
    if (existing) {
      existing.bookings += 1;
      existing.passengers += b.passengers;
      existing.fare += fare;
    } else {
      byMobile.set(key, {
        name: b.customerName,
        mobile: b.mobile,
        bookings: 1,
        passengers: b.passengers,
        fare,
      });
    }
  }
  const passengers = [...byMobile.values()].sort((a, b) => b.bookings - a.bookings);

  if (passengers.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-bold">لا يوجد مسافرون بعد</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          عند إنشاء الحجوزات يظهر هنا كل مسافر مع عدد حجوزاته وإجمالي قيمتها
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-right text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-4 py-3 font-semibold">المسافر</th>
            <th className="px-4 py-3 font-semibold">الجوال</th>
            <th className="px-4 py-3 text-center font-semibold">الحجوزات</th>
            <th className="px-4 py-3 text-center font-semibold">الركاب</th>
            <th className="px-4 py-3 text-center font-semibold">إجمالي القيمة</th>
          </tr>
        </thead>
        <tbody>
          {passengers.map((p) => (
            <tr key={p.mobile || p.name} className="border-b last:border-0">
              <td className="px-4 py-3 font-semibold">{p.name}</td>
              <td className="px-4 py-3" dir="ltr">
                {p.mobile || "—"}
              </td>
              <td className="px-4 py-3 text-center">{toArabicIndic(p.bookings)}</td>
              <td className="px-4 py-3 text-center">{toArabicIndic(p.passengers)}</td>
              <td className="px-4 py-3 text-center font-semibold">
                {toArabicIndic(Math.round(p.fare))}{" "}
                <span className="text-[11px] text-muted-foreground">ريال</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
