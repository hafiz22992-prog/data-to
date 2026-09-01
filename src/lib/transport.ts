import { toArabicIndic } from "./arabic";

/**
 * بيانات مشتركة لتطبيق «خطوط زحل» (SaturnLines) — شركات النقل البري الحقيقية
 * العاملة على خطوط السعودية – اليمن، مدن الانطلاق والوصول، وحالات الحجز والدفع.
 */

export interface TransportCompany {
  id: string;
  name: string;
  base: string; // المقر الرئيسي داخل السعودية
  routes: string; // وصف المسارات التي تغطيها
  color: string; // لون مميز للشعار
  logo?: string; // شعار الشركة (اختياري)
}

/** شركات النقل البري الحقيقية العاملة على خطوط السعودية – اليمن. */
export const TRANSPORT_COMPANIES: TransportCompany[] = [
  {
    id: "al-afdal",
    name: "رواد الأفضل للنقل الدولي",
    base: "جدة",
    routes: "رحلات يومية من جدة والرياض والدمام إلى صنعاء وعدن وتعز",
    color: "#1d4ed8",
  },
  {
    id: "al-mutasaddir",
    name: "مؤسسة المتصدر للنقل",
    base: "الرياض",
    routes: "رحلات يومية من الرياض وجدة إلى صنعاء وعدن وتعز والحديدة",
    color: "#0f766e",
  },
  {
    id: "al-baraka",
    name: "شركة البركة للنقل الدولي",
    base: "جدة",
    routes: "رحلات يومية (VIP) من جدة والمدينة المنورة والدمام إلى صنعاء وعدن وتعز",
    color: "#b45309",
  },
  {
    id: "al-saree",
    name: "مؤسسة السريع للنقل البري",
    base: "الرياض",
    routes: "رحلات من الرياض وجدة والدمام إلى صنعاء وعدن وتعز",
    color: "#7c3aed",
  },
];

export function getCompany(id: string): TransportCompany | undefined {
  return TRANSPORT_COMPANIES.find((c) => c.id === id);
}

/** مدن الانطلاق داخل المملكة العربية السعودية. */
export const SAUDI_CITIES = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الطائف",
  "أبها",
  "خميس مشيط",
  "جازان",
  "نجران",
  "بريدة",
  "تبوك",
  "حائل",
];

/** مدن الوصول داخل الجمهورية اليمنية. */
export const YEMEN_CITIES = [
  "صنعاء",
  "عدن",
  "تعز",
  "الحديدة",
  "إب",
  "ذمار",
  "مأرب",
  "صعدة",
  "حجة",
  "عمران",
  "البيضاء",
  "المكلا",
  "سيئون",
  "لحج",
];

/** حالة الحجز. */
export type BookingStatus = "pending" | "confirmed" | "cancelled";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  cancelled: "ملغي",
};

/** تنسيقات badge لكل حالة. */
export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-800",
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-rose-300 bg-rose-50 text-rose-700",
};

/**
 * حالة الدفع — تُحدَّد في الخادم (وليست من واجهة العميل):
 * unpaid: لم تبدأ أي عملية دفع · pending: جاري معالجة الدفع
 * paid: تم الدفع بنجاح · failed: فشل الدفع · cancelled: تم إلغاء الدفع
 */
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "cancelled";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "غير مدفوع",
  pending: "جاري معالجة الدفع",
  paid: "تم الدفع بنجاح",
  failed: "فشل الدفع",
  cancelled: "تم إلغاء الدفع",
};

/** تنسيقات badge لحالة الدفع. */
export const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "border-sky-300 bg-sky-50 text-sky-700",
  pending: "border-amber-300 bg-amber-50 text-amber-800",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-800",
  failed: "border-rose-300 bg-rose-50 text-rose-700",
  cancelled: "border-slate-300 bg-slate-100 text-slate-600",
};

/** طريقة الدفع المخزنة (يطابق paymentMethodValidator في schema). */
export type PaymentMethod = "on_arrival" | "bank_transfer" | "card";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  on_arrival: "الدفع عند الانطلاق",
  bank_transfer: "التحويل البنكي",
  card: "بطاقة / محفظة رقمية",
};

/**
 * طرق الدفع المعروضة في نموذج الحجز:
 * - on_arrival / bank_transfer تعمل فعلياً اليوم (يدويتان — تُؤكدان من المالك/الشركة).
 * - card (Visa/mada/Apple Pay/STC Pay…) تتطلب بوابة دفع خارجية بمفاتيح مزود —
 *   تُعرض معطّلة بملاحظة «غير مفعلة» ولا يُسمح باختيارها (لا نجاح وهمي).
 */
export const AVAILABLE_PAYMENT_METHODS: PaymentMethod[] = [
  "on_arrival",
  "bank_transfer",
];

/** وصف مختصر لكل طريقة دفع يظهر تحت بطاقتها. */
export const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  on_arrival: "ادفع نقداً عند الانطلاق في محطة الشركة — لا حاجة لدفع إلكتروني",
  bank_transfer:
    "حوّل المبلغ إلى حساب الشركة ثم ارفع الإيصال أو أدخل رقم المرجع — يؤكد المالك/الشركة ويُصدر التذكرة",
  card: "Visa · Mastercard · مدى · Apple Pay · Google Pay · STC Pay",
};

/** بطاقات الدفع الإلكتروني المعروضة (لا تعمل حتى تُفعَّل بوابة الدفع). */
export const CARD_METHODS: {
  id: string;
  label: string;
}[] = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "mada", label: "مدى" },
  { id: "apple_pay", label: "Apple Pay" },
  { id: "google_pay", label: "Google Pay" },
  { id: "stc_pay", label: "STC Pay" },
];

export interface SeatAvailability {
  label: string;
  badge: string; // تنسيق badge المقاعد
  bar: string; // لون شريط نسبة الامتلاء
  pct: number; // نسبة المقاعد المحجوزة 0-100
}

/**
 * حالة المقاعد المتوفرة في رحلة معينة:
 * نفدت المقاعد / متبقي قليل / متوفر.
 */
export function seatAvailability(available: number, total: number): SeatAvailability {
  const pct = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
  if (available <= 0) {
    return {
      label: "نفدت المقاعد",
      badge: "border-rose-300 bg-rose-50 text-rose-700",
      bar: "bg-rose-500",
      pct: 100,
    };
  }
  if (available <= 5) {
    return {
      label: `متبقي ${toArabicIndic(available)} مقاعد فقط`,
      badge: "border-amber-300 bg-amber-50 text-amber-800",
      bar: "bg-amber-500",
      pct,
    };
  }
  return {
    label: `متوفر ${toArabicIndic(available)} مقعد`,
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-500",
    pct,
  };
}
