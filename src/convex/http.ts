import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * التحقق من توقيع Webhook الخاص بـ Stripe (HMAC-SHA256) عبر Web Crypto —
 * لا حاجة لأي استيراد Node. التوقيع في الترويسة stripe-signature بصيغة
 * t=<timestamp>,v1=<hex>. يُرفض أي طلب بتوقيع غير صحيح أو أقدم من 5 دقائق.
 */
async function verifyStripeSignature(
  secret: string,
  header: string,
  payload: string,
): Promise<boolean> {
  let timestamp = "";
  let signature = "";
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") timestamp = value;
    if (key === "v1") signature = value;
  }
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false; // نافذة 5 دقائق

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${timestamp}.${payload}`),
  );
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Webhook تأكيد الدفع — يُستدعى من مزود الدفع عند تغيّر حالة عملية دفع،
 * ليثبّت النتيجة في الخادم (paid / failed / cancelled). لا تقبل الواجهة
 * أي حالة دفع إطلاقاً — النتيجة النهائية من هنا فقط (أو من finalize اليدوي).
 *
 * مساران:
 * 1) Stripe (PAYMENT_PROVIDER=stripe مع ترويسة stripe-signature):
 *    يتحقق من توقيع HMAC باستخدام PAYMENT_WEBHOOK_SECRET (سر التوقيع whsec_…)
 *    — 401 لأي توقيع مزور. يعالج:
 *      - checkout.session.completed  → paid (مع التحقق من المبلغ/العملة)
 *      - checkout.session.expired    → cancelled
 *    إعادة إرسال نفس الحدث → idempotent بلا أي تغيير.
 * 2) عام (حمولة JSON بسر مشترك في x-webhook-secret أو Authorization):
 *    { paymentId أو providerRef، status، amount اختياري، currency اختياري }.
 *
 * بدون إعداد السر يعيد 503 — ولا يفحص أي حمولة.
 */
http.route({
  path: "/payments/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ error: "webhook_not_configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const provider = process.env.PAYMENT_PROVIDER?.trim() || null;
    const stripeSignature = request.headers.get("stripe-signature");

    // ===== مسار Stripe: التحقق من التوقيع ثم معالجة الحدث =====
    if (provider === "stripe" && stripeSignature) {
      const raw = await request.text();
      if (!(await verifyStripeSignature(secret, stripeSignature, raw))) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      let event: { type?: unknown; data?: { object?: Record<string, unknown> } };
      try {
        event = JSON.parse(raw);
      } catch {
        return new Response(JSON.stringify({ error: "invalid_json" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const session = event?.data?.object ?? {};
      const paymentId =
        typeof session.client_reference_id === "string"
          ? session.client_reference_id
          : undefined;
      const sessionId = typeof session.id === "string" ? session.id : undefined;
      const intent =
        typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const amount =
        typeof session.amount_total === "number" ? session.amount_total / 100 : undefined;
      const currency =
        typeof session.currency === "string" ? session.currency.toLowerCase() : undefined;

      if (event?.type === "checkout.session.completed") {
        try {
          await ctx.runMutation(internal.payments.finalizeFromWebhook, {
            paymentId: paymentId as Id<"payments"> | undefined,
            providerRef: intent ?? sessionId,
            status: "paid",
            amount,
            currency,
          });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "payment_error",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      if (event?.type === "checkout.session.expired") {
        try {
          await ctx.runMutation(internal.payments.finalizeFromWebhook, {
            paymentId: paymentId as Id<"payments"> | undefined,
            providerRef: sessionId,
            status: "cancelled",
          });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "payment_error",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      // أحداث أخرى (مثل payment_intent.*) — لا تغيّر شيئاً
      return new Response(
        JSON.stringify({ ok: true, ignored: event?.type ?? "unknown" }),
        { status: 200 },
      );
    }

    // ===== المسار العام: سر مشترك في الترويسة + حمولة JSON =====
    const provided =
      request.headers.get("x-webhook-secret") ?? request.headers.get("authorization");
    if (provided !== secret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { paymentId, providerRef, status, amount, currency } = (payload ?? {}) as {
      paymentId?: unknown;
      providerRef?: unknown;
      status?: unknown;
      amount?: unknown;
      currency?: unknown;
    };
    if (
      (typeof paymentId !== "string" && typeof providerRef !== "string") ||
      (status !== "paid" && status !== "failed" && status !== "cancelled")
    ) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await ctx.runMutation(internal.payments.finalizeFromWebhook, {
        paymentId: typeof paymentId === "string" ? (paymentId as Id<"payments">) : undefined,
        providerRef: typeof providerRef === "string" ? providerRef : undefined,
        status,
        amount: typeof amount === "number" ? amount : undefined,
        currency: typeof currency === "string" ? currency : undefined,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "payment_error",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

export default http;
