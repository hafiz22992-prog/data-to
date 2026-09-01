import { query } from "./_generated/server";

/**
 * إعدادات بوابة الدفع — نقطة مركزية واحدة تُقرأ من متغيرات البيئة
 * (تُضبط من Keys في لوحة المشروع، ولا تُقرأ من أي ملف .env):
 *
 *   PAYMENT_PROVIDER       — اسم المزود (مثل stripe)
 *   PAYMENT_PUBLIC_KEY     — المفتاح العام (pk_…)
 *   PAYMENT_SECRET_KEY     — المفتاح السري (sk_…)
 *   PAYMENT_WEBHOOK_SECRET — سر توقيع الـWebhook (يستخدمه http.ts)
 *
 * غياب المفاتيح لا يكسر التطبيق إطلاقاً: تبقى طرق الدفع اليدوية
 * (الدفع عند الانطلاق / التحويل البنكي) تعمل، وتُعرض البطاقات
 * في الواجهة كـ «الدفع الإلكتروني غير متاح حالياً» حتى يكتمل الإعداد.
 * لا تُعرض أي وسيلة دفع إلكترونية كأنها تعمل قبل اكتمال الإعداد الفعلي.
 */
export interface GatewayConfig {
  /** اسم مزود الدفع المكوَّن (مثل stripe) أو null. */
  provider: string | null;
  /** هل اكتمل إعداد البوابة (المزود + المفاتيح العامة والسرية)؟ */
  configured: boolean;
  /** هل ضُبط سر الـWebhook؟ */
  webhookConfigured: boolean;
  /** عملة المنصة — ثابتة ولا تُغيَّر من الواجهة. */
  currency: "SAR";
}

/** قراءة إعدادات البوابة من البيئة — تُستخدم في الخادم (والاستعلام أدناه). */
export function readGatewayConfig(): GatewayConfig {
  const provider = process.env.PAYMENT_PROVIDER?.trim() || null;
  const hasKeys = Boolean(
    process.env.PAYMENT_PUBLIC_KEY?.trim() && process.env.PAYMENT_SECRET_KEY?.trim(),
  );
  return {
    provider,
    configured: Boolean(provider && hasKeys),
    webhookConfigured: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
    currency: "SAR",
  };
}

/**
 * استعلام عام — يفضح للواجهة حالة إعداد البوابة فقط (لا يُفضح أي سر):
 * تستخدمه صفحة الحجز لتقرير ما تُظهره من طرق دفع إلكترونية.
 */
export const gatewayConfig = query({
  args: {},
  handler: async () => readGatewayConfig(),
});
