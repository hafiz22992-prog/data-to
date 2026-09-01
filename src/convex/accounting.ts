import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { fareBreakdown, DEFAULT_COMMISSION_RATES } from "../lib/fare";
import { getRates } from "./settings";
import { resolveRole } from "./roles";

/**
 * الربط المحاسبي بين التطبيق وشركات النقل المشاركة.
 *
 * يُجمّع الحجوزات النشطة (غير الملغاة) لكل شركة، مع تطبيق نموذج العمولة الساري
 * من إعدادات المنصة (يديرها المالك):
 * - نسبة الشركة من قيمة التذكرة (افتراضياً 80%)
 * - نسبة التطبيق (افتراضياً 20%) — مجموع الاثنين = 100%
 * - ضريبة القيمة المضافة على عمولة التطبيق فقط (افتراضياً 15%)
 *
 * تثبيت النسب: كل حجز يخزن لقطة النسب سارية وقت إنشائه — الحجز القديم يُحاسب
 * بنسبته المخزنة ولا يتغير عند تعديل إعدادات المنصة لاحقاً (اللقطة غائبة فقط
 * للحجوزات القديمة قبل هذه الميزة → تُستخدم النسب الحالية ثم الافتراضية).
 *
 * «المستحق للشركة» = حصة الشركة من الحجوزات غير المحصَّلة بعد.
 *
 * متاح فقط للمالك (كل الشركات) والشركات المشغلة (شركتها فقط) — العميل لا يتلقى أي بيانات.
 * يعيد المبالغ والعدود المجمعة فقط — بدون أي بيانات شخصية للمسافرين، مع النسب
 * المطبقة (rates) لعرضها في واجهات المحاسبة.
 */

const emptyTotals = {
  companyId: "all",
  companyName: "الجميع",
  bookings: 0,
  passengers: 0,
  fare: 0,
  companyShare: 0,
  appShare: 0,
  vat: 0,
  paid: 0,
  outstanding: 0,
};

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { rows: [], totals: emptyTotals, rates: DEFAULT_COMMISSION_RATES };
    }
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (!info.canSeeAccounting) {
      return { rows: [], totals: emptyTotals, rates: DEFAULT_COMMISSION_RATES };
    }

    const current = await getRates(ctx);
    const rates = {
      companyPercent: current.commissionCompanyPercent,
      platformPercent: current.commissionPlatformPercent,
      vatPercent: current.vatPercent,
    };

    const bookings = await ctx.db.query("busBookings").collect();
    // الشركة المشغلة ترى محاسبة شركتها فقط
    const active = bookings
      .filter((b) => b.status !== "cancelled")
      .filter((b) => !info.companyId || b.companyId === info.companyId);

    type Row = {
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
    };

    const newRow = (companyId: string, companyName: string): Row => ({
      companyId,
      companyName,
      bookings: 0,
      passengers: 0,
      fare: 0,
      companyShare: 0,
      appShare: 0,
      vat: 0,
      paid: 0,
      outstanding: 0,
    });

    const rows = new Map<string, Row>();
    const totals = newRow("all", "الجميع");

    for (const b of active) {
      const fare = b.fareAmount ?? (b.price ?? 0) * b.passengers;
      // لقطة الحجز إن وُجدت (النسب سارية وقت إنشاء الحجز) وإلا النسب الحالية
      const bookingRates =
        b.commissionCompanyPercent !== undefined &&
        b.commissionPlatformPercent !== undefined &&
        b.vatPercent !== undefined
          ? {
              companyPercent: b.commissionCompanyPercent,
              platformPercent: b.commissionPlatformPercent,
              vatPercent: b.vatPercent,
            }
          : rates;
      const split = fareBreakdown(fare, bookingRates);
      const isPaid = b.paymentStatus === "paid";

      let row = rows.get(b.companyId);
      if (!row) {
        row = newRow(b.companyId, b.companyName);
        rows.set(b.companyId, row);
      }

      row.bookings += 1;
      row.passengers += b.passengers;
      row.fare += fare;
      row.companyShare += split.companyShare;
      row.appShare += split.appShare;
      row.vat += split.vat;
      if (isPaid) {
        row.paid += fare;
      } else {
        row.outstanding += split.companyShare;
      }

      totals.bookings += 1;
      totals.passengers += b.passengers;
      totals.fare += fare;
      totals.companyShare += split.companyShare;
      totals.appShare += split.appShare;
      totals.vat += split.vat;
      if (isPaid) {
        totals.paid += fare;
      } else {
        totals.outstanding += split.companyShare;
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const sorted = [...rows.values()].sort((a, b) => b.fare - a.fare);
    for (const row of sorted) {
      row.fare = round(row.fare);
      row.companyShare = round(row.companyShare);
      row.appShare = round(row.appShare);
      row.vat = round(row.vat);
      row.paid = round(row.paid);
      row.outstanding = round(row.outstanding);
    }
    totals.fare = round(totals.fare);
    totals.companyShare = round(totals.companyShare);
    totals.appShare = round(totals.appShare);
    totals.vat = round(totals.vat);
    totals.paid = round(totals.paid);
    totals.outstanding = round(totals.outstanding);

    return { rows: sorted, totals, rates };
  },
});
