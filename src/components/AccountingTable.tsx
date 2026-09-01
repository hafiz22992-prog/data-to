import { Bus, Clock3, Receipt } from "lucide-react";
import { toArabicIndic } from "@/lib/arabic";
import { getCompany } from "@/lib/transport";

/**
 * جدول المحاسبة — يُشارك بين لوحة المالك (كل الشركات) ولوحة صاحب الشركة
 * (شركته فقط — البيانات تُمرَّر من api.accounting.summary المقيّد خادمياً).
 */
export function AccountingTable({
  accounting,
  emptyTitle = "لا توجد حجوزات محاسبية بعد",
}: {
  accounting:
    | {
        rows: {
          companyId: string;
          companyName: string;
          bookings: number;
          passengers: number;
          fare: number;
          companyShare: number;
          appShare: number;
          vat: number;
          paid: number;
          outstanding: number;
        }[];
        totals: {
          bookings: number;
          passengers: number;
          fare: number;
          companyShare: number;
          appShare: number;
          vat: number;
          paid: number;
          outstanding: number;
        };
      }
    | undefined;
  emptyTitle?: string;
}) {
  if (accounting === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Clock3 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounting.totals.bookings === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Receipt className="size-6" />
        </div>
        <p className="mt-3 text-sm font-bold">{emptyTitle}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          بعد إنشاء الحجوزات وتحصيل مدفوعاتها سيظهر هنا ملخص قيمة التذاكر وتوزيعها
          بين الشركة والتطبيق
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[900px] text-right text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-4 py-3 font-semibold">الشركة</th>
            <th className="px-4 py-3 text-center font-semibold">الحجوزات</th>
            <th className="px-4 py-3 text-center font-semibold">الركاب</th>
            <th className="px-4 py-3 text-center font-semibold">قيمة التذاكر</th>
            <th className="px-4 py-3 text-center font-semibold">حصة الشركة (80%)</th>
            <th className="px-4 py-3 text-center font-semibold">عمولة التطبيق (20%)</th>
            <th className="px-4 py-3 text-center font-semibold">الضريبة</th>
            <th className="px-4 py-3 text-center font-semibold">المحصّل</th>
            <th className="px-4 py-3 text-center font-semibold">المستحق للشركة</th>
          </tr>
        </thead>
        <tbody>
          {accounting.rows.map((row) => {
            const company = getCompany(row.companyId);
            return (
              <tr key={row.companyId} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <Bus
                      className="size-4 shrink-0"
                      style={{ color: company?.color ?? "currentColor" }}
                    />
                    {row.companyName}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">{toArabicIndic(row.bookings)}</td>
                <td className="px-4 py-3 text-center">{toArabicIndic(row.passengers)}</td>
                <td className="px-4 py-3 text-center font-medium">
                  {toArabicIndic(row.fare)}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
                <td className="px-4 py-3 text-center font-semibold">
                  {toArabicIndic(row.companyShare)}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
                <td className="px-4 py-3 text-center text-primary">
                  {toArabicIndic(row.appShare)}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
                <td className="px-4 py-3 text-center text-amber-600">
                  {toArabicIndic(row.vat)}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-600">
                  {toArabicIndic(row.paid)}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
                <td className="px-4 py-3 text-center font-bold text-amber-600">
                  {toArabicIndic(row.outstanding)}{" "}
                  <span className="text-[11px] text-muted-foreground">ريال</span>
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-border bg-muted/30">
            <td className="px-4 py-3 font-bold">الإجمالي</td>
            <td className="px-4 py-3 text-center font-bold">
              {toArabicIndic(accounting.totals.bookings)}
            </td>
            <td className="px-4 py-3 text-center font-bold">
              {toArabicIndic(accounting.totals.passengers)}
            </td>
            <td className="px-4 py-3 text-center font-bold">
              {toArabicIndic(accounting.totals.fare)}{" "}
              <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
            </td>
            <td className="px-4 py-3 text-center font-bold">
              {toArabicIndic(accounting.totals.companyShare)}{" "}
              <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
            </td>
            <td className="px-4 py-3 text-center font-bold text-primary">
              {toArabicIndic(accounting.totals.appShare)}{" "}
              <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
            </td>
            <td className="px-4 py-3 text-center font-bold text-amber-600">
              {toArabicIndic(accounting.totals.vat)}{" "}
              <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
            </td>
            <td className="px-4 py-3 text-center font-bold text-emerald-600">
              {toArabicIndic(accounting.totals.paid)}{" "}
              <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
            </td>
            <td className="px-4 py-3 text-center font-bold text-amber-600">
              {toArabicIndic(accounting.totals.outstanding)}{" "}
              <span className="text-[11px] font-medium text-muted-foreground">ريال</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
