/**
 * نموذج العمولة في «خطوط زحل» — النسب تُدار من إعدادات المنصة (المالك فقط)
 * ولا تُثبَّت في الكود:
 * - حصة شركة النقل من إجمالي قيمة التذكرة (افتراضياً ٨٠٪)
 * - عمولة التطبيق (افتراضياً ٢٠٪) — مجموع الاثنين = 100%
 * - تُحسب ضريبة القيمة المضافة على عمولة التطبيق فقط (وليست على كامل التذكرة)
 *
 * الحجوزات القديمة تُحاسب بالنسب التي كانت سارية وقت إنشائها (لقطة مخزنة في
 * الحجز/العملية) — لا تُعاد محاسبتها عند تغيير إعدادات المنصة لاحقاً.
 */

/** النسب السارية لنموذج العمولة (تُطابق إعدادات المنصة في قاعدة البيانات). */
export interface CommissionRates {
  /** نسبة حصة شركة النقل من قيمة التذكرة (مثال: 80). */
  companyPercent: number;
  /** نسبة عمولة التطبيق (مثال: 20) — مجموع الاثنين = 100. */
  platformPercent: number;
  /** نسبة ضريبة القيمة المضافة على عمولة التطبيق فقط (مثال: 15). */
  vatPercent: number;
}

/** القيم الافتراضية عند غياب إعدادات مخزنة (80/20/15). */
export const DEFAULT_COMMISSION_RATES: CommissionRates = {
  companyPercent: 80,
  platformPercent: 20,
  vatPercent: 15,
};

export interface FareBreakdown {
  /** القيمة الإجمالية للتذكرة. */
  fare: number;
  /** حصة شركة النقل من القيمة. */
  companyShare: number;
  /** عمولة التطبيق من القيمة. */
  appShare: number;
  /** ضريبة القيمة المضافة — على عمولة التطبيق فقط. */
  vat: number;
}

/**
 * توزيع قيمة التذكرة حسب نموذج العمولة الساري (يُقرَّب للريال/هللتين).
 * يمكن تمرير نسب مخصصة (لقطة حجز قديم) — وبدونه تُستخدم القيم الافتراضية.
 */
export function fareBreakdown(
  fare: number,
  rates: CommissionRates = DEFAULT_COMMISSION_RATES,
): FareBreakdown {
  const appShare = Math.round(fare * (rates.platformPercent / 100) * 100) / 100;
  const vat = Math.round(appShare * (rates.vatPercent / 100) * 100) / 100;
  const companyShare = Math.round((fare - appShare) * 100) / 100;
  return { fare, companyShare, appShare, vat };
}
