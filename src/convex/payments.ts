import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { paymentMethodValidator } from "./schema";
import { resolveRole } from "./roles";
import { readGatewayConfig } from "./gateway";

/**
 * نظام الدفع — حالات العملية تُحدَّد في الخادم فقط (وليست من واجهة العميل):
 *
 * 1. initiate: يبدأ العميل (صاحب الحجز) عملية دفع → paymentStatus = pending
 *    (منع التكرار: إن وُجدت محاولة pending لنفس الحجز تُعاد كما هي بلا عملية جديدة)
 *    التحويل البنكي يتطلب حساباً بنكياً نشطاً (يُتحقق خادمياً) ويُحفظ الحساب
 *    المختار مع العملية (bankAccountId + لقطة ثابتة) حتى تعرف المراجعة أي بنك
 *    اختاره المسافر.
 * 2. finalize: المالك (كل العمليات) أو صاحب الشركة (عمليات شركته فقط) يثبّت النتيجة
 *    الفعلية للطرق اليدوية (تحصيل عند الانطلاق) — العميل ممنوع.
 * 3. confirmBankTransfer / rejectBankTransfer: خاصة بالتحويل البنكي — يثبّت
 *    المالك أو صاحب الشركة نتيجة مراجعة التحويل (إيصال/مرجع) → paid أو failed.
 *    التحويل البنكي يعمل مستقلاً تماماً عن أي بوابة دفع خارجية.
 * 4. attachReceipt / generateUploadUrl: رفع إيصال التحويل (اختياري) من صاحب
 *    الحجز أو المالك/الشركة، مع رقم مرجع التحويل (اختياري).
 * 5. finalizeFromWebhook: يُستدعى من Webhook مزود الدفع (عبر دالة داخلية) —
 *    يتحقق من مرجع العملية والمبلغ والعملة ويمنع التكرار.
 * 6. عند paid: يُؤكد الحجز تلقائياً وتُثبَّت المقاعد وتُصدر التذكرة.
 *
 * المبلغ والعملة دائماً من بيانات الحجز في الخادم — لا يُقبل أي مبلغ من العميل.
 * طريقة «card» (Visa/mada/Apple Pay…) تتطلب بوابة دفع مكوّنة فعلياً (Stripe) —
 * بدون مفاتيح حقيقية تُرفض العملية ولا يُنشأ أي دفع وهمي.
 */

/**
 * سجل عمليات الدفع — للمالك (كل العمليات) والشركة المشغلة (عمليات شركتها فقط).
 * العميل لا يصل إلى سجل المدفوعات الإداري؛ يرى حالة الدفع ضمن حجوزاته.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role === "customer") return [];

    const payments = await ctx.db.query("payments").order("desc").collect();
    if (!info.companyId) return payments;

    // الشركة المشغلة: عمليات حجوزات شركتها فقط
    const bookings = await ctx.db.query("busBookings").collect();
    const companyBookingIds = new Set(
      bookings.filter((b) => b.companyId === info.companyId).map((b) => b._id),
    );
    return payments.filter((p) => companyBookingIds.has(p.bookingId));
  },
});

/**
 * عمليات دفع حجز واحد — لصاحب الحجز نفسه، أو المالك، أو الشركة المشغلة
 * لحجوزات شركتها. أي مستخدم آخر يرى قائمة فارغة (لا تسريب لإيصالات الغير).
 */
export const byBooking = query({
  args: { bookingId: v.id("busBookings") },
  handler: async (ctx, { bookingId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const booking = await ctx.db.get(bookingId);
    if (!booking) return [];
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    const isBookingOwner = booking.userId === userId;
    const isCompanyManager =
      info.role === "company" && info.companyId === booking.companyId;
    if (!isBookingOwner && info.role !== "owner" && !isCompanyManager) return [];
    return await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .order("desc")
      .collect();
  },
});

/** إجمالي قيمة الحجز كما تُسجل في عملية الدفع (تُحسب خادمياً دائماً). */
function fareOf(booking: Doc<"busBookings">): number {
  return booking.fareAmount ?? (booking.price ?? 0) * booking.passengers;
}

/** صاحب الحجز نفسه؟ */
async function isBookingOwner(
  ctx: MutationCtx,
  userId: Id<"users">,
  booking: Doc<"busBookings">,
): Promise<boolean> {
  return booking.userId === userId;
}

/** المالك أو صاحب الشركة المشغلة للحجز؟ (لتأكيد الطرق اليدوية) */
async function canFinalizePayment(
  ctx: MutationCtx,
  userId: Id<"users">,
  booking: Doc<"busBookings">,
): Promise<"owner" | "company" | null> {
  const user = await ctx.db.get(userId);
  const info = await resolveRole(ctx, user?.email, user?.role);
  if (info.role === "owner") return "owner";
  if (info.role === "company" && info.companyId === booking.companyId) {
    return "company";
  }
  return null;
}

/** قراءة عملية دفع واحدة (داخلية — تُستخدم من Action الدفع الإلكتروني). */
export const getById = internalQuery({
  args: { id: v.id("payments") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

/**
 * ربط مرجع مزود الدفع (مثل session id في Stripe) بعملية الدفع —
 * يُستدعى من Action الدفع بعد إنشاء الجلسة لدى المزود (داخلية فقط).
 * لا يعدّل عملية مكتملة (paid) — منع التكرار.
 */
export const attachGatewayRef = internalMutation({
  args: {
    paymentId: v.id("payments"),
    providerRef: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, { paymentId, providerRef, provider }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "paid") return { ok: true, idempotent: true };
    await ctx.db.patch(paymentId, {
      providerRef,
      ...(provider ? { provider } : {}),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export type FinalizeStatus = "paid" | "failed" | "cancelled";

/** تطبيق النتيجة المؤكدة على العملية والحجز — منطق مشترك بين finalize و Webhook. */
async function applyStatus(
  ctx: MutationCtx,
  payment: Doc<"payments">,
  status: FinalizeStatus,
  providerRef?: string,
  confirmed?: { by: Id<"users">; at: number },
) {
  const booking = await ctx.db.get(payment.bookingId);
  if (!booking) throw new Error("Booking not found");

  // منع التكرار: نفس الحالة تُعيد النتيجة نفسها بلا تغيير (إعادة إرسال Webhook آمنة)
  if (payment.status === status) return { ok: true, idempotent: true };
  // لا تراجع عن دفع مكتمل
  if (payment.status === "paid") {
    throw new Error("الحجز مدفوع بالفعل — لا يمكن تغيير حالة الدفع");
  }
  // لا يُقبل دفع لحجز ملغي
  if (status === "paid" && booking.status === "cancelled") {
    throw new Error("لا يمكن تأكيد دفع حجز ملغي");
  }

  await ctx.db.patch(payment._id, {
    status,
    ...(providerRef ? { providerRef } : {}),
    ...(confirmed
      ? { confirmedBy: confirmed.by, confirmedAt: confirmed.at }
      : {}),
    updatedAt: Date.now(),
  });

  if (status === "paid") {
    // نجاح الدفع: تأكيد الحجز وتثبيت المقعد وإصدار التذكرة (المرجع من مزود الدفع أو رقم الحجز)
    await ctx.db.patch(booking._id, {
      paymentStatus: "paid",
      paymentRef: providerRef ?? booking.bookingNo,
      status: "confirmed",
    });
  } else {
    // فشل/إلغاء: لا يُعد الحجز مدفوعاً ولا يُصدر تذكرة مدفوعة — يبقى المقعد محجوزاً
    // مؤقتاً حسب منطق الحجز الحالي، ويمكن للعميل إعادة المحاولة
    await ctx.db.patch(booking._id, { paymentStatus: status });
  }
  return { ok: true };
}

/**
 * بدء عملية دفع لحجز موجود — صاحب الحجز أو المالك أو صاحب الشركة.
 * يعيد محاولة pending القائمة كما هي (حماية من الضغط المزدوج/إعادة التحميل).
 * طريقة «card» تُرفض ما لم تكن بوابة الدفع مكوّنة فعلياً (لا دفع وهمي).
 * التحويل البنكي: يتطلب تحديد حساب بنكي نشط (يُتحقق خادمياً) ويُحفظ الحساب
 * المختار مع العملية (bankAccountId + لقطة) — إعادة المحاولة تستعيد آخر حساب
 * اختاره المسافر تلقائياً.
 */
export const initiate = mutation({
  args: {
    id: v.id("busBookings"),
    method: paymentMethodValidator,
    idempotencyKey: v.optional(v.string()),
    bankAccountId: v.optional(v.id("bankAccounts")),
  },
  handler: async (ctx, { id, method, idempotencyKey, bankAccountId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    if (!(await isBookingOwner(ctx, userId, booking))) {
      const canFinalize = await canFinalizePayment(ctx, userId, booking);
      if (!canFinalize) {
        throw new Error("غير مصرح — هذا الحجز ليس لك");
      }
    }
    if (booking.status === "cancelled") {
      throw new Error("لا يمكن الدفع لحجز ملغي");
    }
    if (booking.paymentStatus === "paid") {
      throw new Error("الحجز مدفوع بالفعل");
    }

    // الدفع الإلكتروني يتطلب بوابة دفع مكوّنة فعلياً بمفاتيح مزود حقيقية
    const config = readGatewayConfig();
    if (method === "card") {
      if (!config.configured || config.provider !== "stripe") {
        throw new Error("الدفع الإلكتروني غير مفعل — أضف مفاتيح بوابة الدفع (Stripe) في Keys أولاً");
      }
    }

    // منع التكرار: محاولة قيد المعالجة تُعاد كما هي بلا عملية جديدة
    const attempts = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .collect();
    const pending = attempts.find((p) => p.status === "pending");
    if (pending) {
      return { paymentId: pending._id, status: "pending" as const, idempotent: true };
    }
    if (attempts.some((p) => p.status === "paid")) {
      throw new Error("الحجز مدفوع بالفعل");
    }

    // التحويل البنكي: تحديد حساب بنكي نشط (يُتحقق خادمياً) — يُحفظ الحساب المختار
    // مع العملية (bankAccountId + لقطة ثابتة) حتى تعرف المراجعة أي بنك اختاره
    // المسافر حتى لو عُدّل/حُذف الحساب لاحقاً.
    let bankAccountDoc: Doc<"bankAccounts"> | null = null;
    if (method === "bank_transfer") {
      let selectedId = bankAccountId;
      // إعادة المحاولة من «حجوزاتي» قد لا ترسل الحساب — يُعاد استخدام آخر حساب
      // اختاره المسافر في محاولة سابقة لنفس الحجز.
      if (!selectedId) {
        selectedId = attempts.find((p) => p.bankAccountId)?.bankAccountId;
      }
      if (selectedId) {
        bankAccountDoc = await ctx.db.get(selectedId);
      }
      if (!bankAccountDoc || !bankAccountDoc.active) {
        throw new Error("اختر حساباً بنكياً نشطاً للتحويل أولاً");
      }
    }

    const now = Date.now();
    const paymentId = await ctx.db.insert("payments", {
      bookingId: booking._id,
      amount: fareOf(booking), // المبلغ من الحجز في الخادم — لا يُقبل من العميل
      currency: "SAR", // العملة ثابتة — لا تُقبل من العميل
      method,
      status: "pending",
      // لا توجد بوابة دفع مكوّنة حالياً — الطرق اليدوية؛ عند تفعيل Stripe
      // تُسجل عمليات البطاقات باسم المزود (stripe) بدل manual.
      provider: method === "card" ? (config.provider ?? "manual") : "manual",
      providerRef: undefined,
      idempotencyKey: idempotencyKey ?? undefined,
      // الحساب البنكي المختار ولقطته — للتحويل البنكي فقط
      bankAccountId: bankAccountDoc?._id,
      bankAccountSnapshot: bankAccountDoc
        ? {
            bankName: bankAccountDoc.bankName,
            accountHolderName: bankAccountDoc.accountHolderName,
            accountNumber: bankAccountDoc.accountNumber,
            iban: bankAccountDoc.iban,
            beneficiaryName: bankAccountDoc.beneficiaryName,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(booking._id, {
      paymentStatus: "pending",
      paymentMethod: method,
    });
    return { paymentId, status: "pending" as const, idempotent: false };
  },
});

/**
 * تثبيت نتيجة الدفع للطرق اليدوية (تحصيل عند الانطلاق):
 * المالك (كل العمليات) أو صاحب الشركة المشغلة (عمليات شركته فقط).
 * العميل لا يستطيع إرسال paid من الواجهة إطلاقاً.
 * (تأكيد التحويل البنكي له مساره المخصص: confirmBankTransfer/rejectBankTransfer.)
 */
export const finalize = mutation({
  args: {
    id: v.id("payments"),
    status: v.union(
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    providerRef: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, providerRef }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const payment = await ctx.db.get(id);
    if (!payment) throw new Error("Payment not found");
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) throw new Error("Booking not found");

    const access = await canFinalizePayment(ctx, userId, booking);
    if (!access) {
      throw new Error("غير مصرح — تأكيد نتائج الدفع للمالك أو صاحب الشركة فقط");
    }
    return applyStatus(ctx, payment, status, providerRef, {
      by: userId,
      at: Date.now(),
    });
  },
});

/**
 * تنفيذ نتيجة الدفع من Webhook مزود الدفع — لا يُستدعى إلا خادمياً
 * (من src/convex/http.ts بعد التحقق من التوقيع/السر المشترك).
 *
 * - يُحدَّد الحجز بـ paymentId (مرجعنا) أو providerRef (مرجع المزود).
 * - يتحقق من المبلغ والعملة إن وردا في الحمولة (حماية من التلاعب).
 * - منع التكرار: نفس الحالة أو نفس providerRef → idempotent.
 */
export const finalizeFromWebhook = internalMutation({
  args: {
    paymentId: v.optional(v.id("payments")),
    providerRef: v.optional(v.string()),
    status: v.union(
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { paymentId, providerRef, status, amount, currency }) => {
    let payment: Doc<"payments"> | null = null;
    if (paymentId) {
      payment = await ctx.db.get(paymentId);
    } else if (providerRef) {
      const byRef = await ctx.db
        .query("payments")
        .withIndex("by_providerRef", (q) => q.eq("providerRef", providerRef))
        .first();
      payment = byRef ?? null;
    }
    if (!payment) throw new Error("Payment not found");

    // التحقق من المبلغ والعملة إن وردا (لا يقبل الخادم مبلغاً من الواجهة إطلاقاً)
    if (amount !== undefined && amount !== payment.amount) {
      throw new Error("Amount mismatch — الدفع المرفوض: مبلغ غير مطابق");
    }
    if (currency !== undefined && currency !== payment.currency) {
      throw new Error("Currency mismatch");
    }

    // منع التكرار بمرجع المزود: نفس المرجع لنفس الحالة → مكرر بلا تغيير
    if (
      providerRef &&
      payment.providerRef === providerRef &&
      payment.status === status
    ) {
      return { ok: true, idempotent: true };
    }

    await ctx.db.patch(payment._id, { provider: "gateway" });
    return applyStatus(ctx, payment, status, providerRef);
  },
});

// ===== التحويل البنكي — مراجعة وتأكيد ورفض (بدون أي بوابة دفع خارجية) =====

/** تحديد عملية الدفع بالمعرّف أو برقم الحجز (يجب تمرير أحدهما). */
async function resolvePayment(
  ctx: MutationCtx,
  args: { bookingId?: Id<"busBookings">; paymentId?: Id<"payments"> },
): Promise<Doc<"payments"> | null> {
  if (args.paymentId) return await ctx.db.get(args.paymentId);
  if (args.bookingId) {
    return (
      (await ctx.db
        .query("payments")
        .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId!))
        .order("desc")
        .first()) ?? null
    );
  }
  return null;
}

/**
 * تأكيد التحويل البنكي — المالك أو صاحب الشركة المشغلة فقط:
 * يتحقق الخادم من الصلاحية وملكية الشركة والحجز والعملية (pending + bank_transfer)
 * ثم: payment pending → paid · booking → confirmed · تذكرة · سجل confirmedBy/confirmedAt.
 * المبلغ والعملة من العملية المخزنة خادمياً (لا يُقبل من المستدعي).
 */
export const confirmBankTransfer = mutation({
  args: {
    paymentId: v.optional(v.id("payments")),
    bookingId: v.optional(v.id("busBookings")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const payment = await resolvePayment(ctx, args);
    if (!payment) throw new Error("Payment not found");
    if (payment.method !== "bank_transfer") {
      throw new Error("هذه العملية ليست تحويلاً بنكياً");
    }
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) throw new Error("Booking not found");

    const access = await canFinalizePayment(ctx, userId, booking);
    if (!access) {
      throw new Error("غير مصرح — تأكيد التحويل البنكي للمالك أو صاحب الشركة فقط");
    }
    if (payment.status === "paid") return { ok: true, idempotent: true };
    if (payment.status === "failed" || payment.status === "cancelled") {
      throw new Error(
        "تم رفض/إلغاء هذه العملية سابقاً — اطلب من المسافر إعادة المحاولة لإنشاء عملية جديدة",
      );
    }

    const ref = payment.transferRef || payment.providerRef || booking.bookingNo;
    return applyStatus(ctx, payment, "paid", ref, { by: userId, at: Date.now() });
  },
});

/**
 * رفض التحويل البنكي — المالك أو صاحب الشركة المشغلة فقط:
 * payment pending → failed · booking يبقى غير مؤكد (لا تذكرة مدفوعة) ·
 * paymentStatus = failed · يمكن للمسافر إعادة المحاولة (initiate جديد).
 */
export const rejectBankTransfer = mutation({
  args: {
    paymentId: v.optional(v.id("payments")),
    bookingId: v.optional(v.id("busBookings")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const payment = await resolvePayment(ctx, args);
    if (!payment) throw new Error("Payment not found");
    if (payment.method !== "bank_transfer") {
      throw new Error("هذه العملية ليست تحويلاً بنكياً");
    }
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) throw new Error("Booking not found");

    const access = await canFinalizePayment(ctx, userId, booking);
    if (!access) {
      throw new Error("غير مصرح — رفض التحويل البنكي للمالك أو صاحب الشركة فقط");
    }
    if (payment.status === "paid") {
      throw new Error("لا يمكن رفض عملية مدفوعة ومؤكدة");
    }
    if (payment.status === "failed") return { ok: true, idempotent: true };

    await ctx.db.patch(payment._id, { status: "failed", updatedAt: Date.now() });
    await ctx.db.patch(booking._id, { paymentStatus: "failed" });
    return { ok: true };
  },
});

/** إنشاء رابط رفع ملف (الإيصال) في Convex storage — لأي مستخدم مسجّل. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * ربط إيصال التحويل (اختياري) ورقم مرجع التحويل (اختياري) بعملية دفع بنكية:
 * صاحب الحجز نفسه، أو المالك، أو صاحب الشركة المشغلة. أي مستخدم آخر مرفوض.
 * لا يُعدّل عملية مدفوعة (paid).
 */
export const attachReceipt = mutation({
  args: {
    paymentId: v.optional(v.id("payments")),
    bookingId: v.optional(v.id("busBookings")),
    storageId: v.optional(v.string()),
    transferRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const payment = await resolvePayment(ctx, args);
    if (!payment) throw new Error("Payment not found");
    if (payment.method !== "bank_transfer") {
      throw new Error("الإيصال خاص بالتحويل البنكي فقط");
    }
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) throw new Error("Booking not found");

    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    const isBookingOwner = booking.userId === userId;
    const isCompanyManager =
      info.role === "company" && info.companyId === booking.companyId;
    if (!isBookingOwner && info.role !== "owner" && !isCompanyManager) {
      throw new Error("غير مصرح — لا يمكنك تعديل إيصال هذا الحجز");
    }
    if (payment.status === "paid") {
      throw new Error("الحجز مدفوع ومؤكد بالفعل — لا يمكن تعديل الإيصال");
    }

    // معرّف الرفع يُقبل فقط إن كان صالح الشكل (يأتي من generateUploadUrl الحصرية —
    // لا يستطيع العميل اختلاقه)، والتحقق الفعلي من وجود الملف يتم عند قراءة رابط
    // العرض: getReceiptUrl يعيد null إن لم يوجد الملف فعلاً في التخزين.
    let receiptStorageId: string | undefined;
    if (args.storageId) {
      const s = args.storageId.trim();
      if (s.length < 10 || s.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(s)) {
        throw new Error("معرّف الملف المرفوع غير صالح — أعد الرفع");
      }
      receiptStorageId = s;
    }

    await ctx.db.patch(payment._id, {
      ...(receiptStorageId !== undefined ? { receiptStorageId } : {}),
      ...(args.transferRef !== undefined
        ? { transferRef: args.transferRef.trim() || undefined }
        : {}),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * رابط عرض الإيصال — لصاحب الحجز أو المالك أو الشركة المشغلة فقط.
 * أي مستخدم آخر يعيد null (لا تسريب لإيصالات الغير).
 */
export const getReceiptUrl = query({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, { paymentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const payment = await ctx.db.get(paymentId);
    if (!payment || !payment.receiptStorageId) return null;
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) return null;

    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    const isBookingOwner = booking.userId === userId;
    const isCompanyManager =
      info.role === "company" && info.companyId === booking.companyId;
    if (!isBookingOwner && info.role !== "owner" && !isCompanyManager) return null;
    return await ctx.storage.getUrl(payment.receiptStorageId);
  },
});
