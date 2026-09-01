"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { readGatewayConfig } from "./gateway";

/**
 * بوابة الدفع الإلكتروني — Stripe (مناسب للسوق السعودي):
 * يدعم Visa و Mastercard ومدى (عبر مسار البطاقات) و Apple Pay و Google Pay
 * من صفحة الدفع الآمنة لدى Stripe، بالريال السعودي (SAR).
 * طريقة STC Pay غير مدعومة من Stripe — تبقى معطّلة في الواجهة.
 *
 * التدفق:
 *   Booking → payments:initiate (pending) → جلسة Checkout لدى Stripe
 *   → العميل يدفع على صفحة Stripe → Webhook موقّع يؤكد النتيجة
 *   → payments:finalizeFromWebhook → paid → تأكيد الحجز وإصدار التذكرة.
 *
 * الأمان:
 *   - المبلغ والعملة يُشتقان من الحجز في الخادم (لا يُقبلان من العميل).
 *   - تُرفض العملية تماماً إذا لم تكن البوابة مكوّنة بمفاتيح حقيقية (لا دفع وهمي).
 *   - المفاتيح تُقرأ من متغيرات البيئة (Keys) ولا تصل إلى الواجهة أبداً.
 */

/** تنفيذ إنشاء جلسة الدفع — دالة مستقلة بنوع إرجاع صريح لكسر الاستدلال الدائري. */
async function createCheckoutSessionHandler(
  ctx: ActionCtx,
  bookingId: Id<"busBookings">,
): Promise<{ url: string; paymentId: Id<"payments"> }> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");

  // إعدادات البوابة من البيئة — بدون مفاتيح حقيقية لا يُنشأ أي دفع
  const config = readGatewayConfig();
  if (!config.configured || config.provider !== "stripe") {
    throw new Error(
      "الدفع الإلكتروني غير مفعل — أضف مفاتيح بوابة الدفع (Stripe) في Keys أولاً",
    );
  }
  const secretKey = process.env.PAYMENT_SECRET_KEY;
  if (!secretKey) {
    throw new Error("الدفع الإلكتروني غير مفعل — PAYMENT_SECRET_KEY غير مضبوط في Keys");
  }
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  if (!siteUrl) {
    throw new Error("SITE_URL غير مضبوط — لا يمكن إنشاء جلسة الدفع");
  }

  const booking = await ctx.runQuery(internal.bookings.getById, { id: bookingId });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled") {
    throw new Error("لا يمكن الدفع لحجز ملغي");
  }
  if (booking.paymentStatus === "paid") {
    throw new Error("الحجز مدفوع بالفعل");
  }

  // الصلاحية: صاحب الحجز أو المالك/صاحب الشركة المشغلة
  const role = await ctx.runQuery(api.roles.role);
  const isAdminForBooking =
    role.role === "owner" ||
    (role.role === "company" && role.companyId === booking.companyId);
  if (booking.userId !== userId && !isAdminForBooking) {
    throw new Error("غير مصرح — هذا الحجز ليس لك");
  }

  // إنشاء محاولة الدفع (pending) عبر النظام الحالي — المبلغ يُحسب خادمياً هناك
  const initiated = await ctx.runMutation(api.payments.initiate, {
    id: bookingId,
    method: "card",
    idempotencyKey: `checkout-${bookingId}`,
  });

  // المبلغ من صف العملية (المرجع الرسمي) — لا يُقبل أي مبلغ من العميل
  const payment = await ctx.runQuery(internal.payments.getById, {
    id: initiated.paymentId,
  });
  if (!payment) throw new Error("Payment not found");

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "ar",
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "sar",
          unit_amount: Math.round(payment.amount * 100), // الريال → هللة
          product_data: {
            name: `حجز رحلة ${booking.bookingNo} — ${booking.departure} → ${booking.destination}`,
            description: `${booking.companyName} · ${booking.passengers} ${
              booking.passengers > 1 ? "ركاب" : "راكب"
            } · ${booking.travelDate}`,
          },
        },
      },
    ],
    // مرجع العملية لدينا (يستخدمه الـWebhook لتأكيد الدفع)
    client_reference_id: payment._id,
    metadata: { paymentId: payment._id, bookingId: booking._id },
    success_url: `${siteUrl}/customer?payment=success&booking=${booking._id}`,
    cancel_url: `${siteUrl}/customer?payment=cancelled&booking=${booking._id}`,
  });

  if (!session.url) {
    throw new Error("تعذر إنشاء جلسة الدفع لدى المزود — حاول مرة أخرى");
  }

  // ربط مرجع المزود (session id) بالعملية ليطابق الـWebhook لاحقاً
  await ctx.runMutation(internal.payments.attachGatewayRef, {
    paymentId: payment._id,
    providerRef: session.id,
    provider: "stripe",
  });

  return { url: session.url, paymentId: payment._id };
}

export const createCheckoutSession = action({
  args: {
    bookingId: v.id("busBookings"),
    method: v.literal("card"),
  },
  handler: async (ctx, { bookingId }) =>
    createCheckoutSessionHandler(ctx, bookingId),
});
