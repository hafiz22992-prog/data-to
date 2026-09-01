import { getAuthUserId } from "@convex-dev/auth/server";
import { v, Infer } from "convex/values";
import { mutation, query, internalQuery, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  bookingStatusValidator,
  paymentMethodValidator,
  paymentStatusValidator,
} from "./schema";
import { resolveRole } from "./roles";

/** المدخلات الأساسية عند إنشاء حجز جديد. */
export const bookingInput = v.object({
  customerName: v.string(),
  mobile: v.string(),
  residencyNumber: v.optional(v.string()),
  borderNumber: v.optional(v.string()),
  passportNumber: v.string(),
  departure: v.string(),
  destination: v.string(),
  companyId: v.string(),
  companyName: v.string(),
  travelDate: v.string(),
  passengers: v.number(),
  tripId: v.optional(v.id("busTrips")),
  departureTime: v.optional(v.string()),
  price: v.optional(v.number()),
  paymentMethod: v.optional(paymentMethodValidator),
  notes: v.optional(v.string()),
});

type BookingInput = Infer<typeof bookingInput>;

type UserId = NonNullable<Awaited<ReturnType<typeof getAuthUserId>>>;

/** رقم حجز تلقائي: BK-YYYYMMDD-HHMM */
export function generateBookingNo(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `BK-${y}${m}${d}-${h}${min}`;
}

/** إجمالي قيمة الحجز بالريال (سعر التذكرة × عدد الركاب). */
function computeFare(args: BookingInput): number {
  return (args.price ?? 0) * args.passengers;
}

/** تحويل المدخلات المتحقق منها إلى صف الحجز المخزن. */
function toDbRow(userId: UserId, args: BookingInput) {
  return {
    userId,
    bookingNo: generateBookingNo(),
    customerName: args.customerName,
    mobile: args.mobile,
    residencyNumber: args.residencyNumber ?? "",
    borderNumber: args.borderNumber ?? undefined,
    passportNumber: args.passportNumber,
    departure: args.departure,
    destination: args.destination,
    companyId: args.companyId,
    companyName: args.companyName,
    travelDate: args.travelDate,
    passengers: args.passengers,
    tripId: args.tripId,
    departureTime: args.departureTime,
    price: args.price,
    fareAmount: computeFare(args),
    paymentStatus: "unpaid" as const,
    paymentMethod: args.paymentMethod ?? ("on_arrival" as const),
    notes: args.notes ?? "",
    status: "pending" as const,
  };
}

/** إرجاع مقاعد الحجز إلى الرحلة عند الإلغاء أو الحذف (مع حد أقصى = إجمالي المقاعد). */
async function releaseSeats(ctx: MutationCtx, booking: Doc<"busBookings">) {
  if (!booking.tripId) return;
  const trip = await ctx.db.get(booking.tripId);
  if (!trip) return;
  const availableSeats = Math.min(trip.availableSeats + booking.passengers, trip.totalSeats);
  await ctx.db.patch(trip._id, { availableSeats });
}

/** إعادة حجز المقاعد عند تفعيل حجز كان ملغى. */
async function holdSeats(ctx: MutationCtx, booking: Doc<"busBookings">) {
  if (!booking.tripId) return;
  const trip = await ctx.db.get(booking.tripId);
  if (!trip) return;
  if (trip.availableSeats < booking.passengers) {
    throw new Error("لا توجد مقاعد كافية في الرحلة لإعادة تفعيل الحجز");
  }
  await ctx.db.patch(trip._id, { availableSeats: trip.availableSeats - booking.passengers });
}

/**
 * هل يستطيع هذا المستخدم إدارة (تأكيد/إلغاء) الحجز؟
 * صاحب الحجز دائماً، أو المالك، أو الشركة المشغلة لحجوزات شركتها.
 */
async function canManageBooking(
  ctx: MutationCtx,
  userId: UserId,
  booking: Doc<"busBookings">,
): Promise<boolean> {
  if (booking.userId === userId) return true;
  const user = await ctx.db.get(userId);
  const info = await resolveRole(ctx, user?.email, user?.role);
  if (info.role === "owner") return true;
  if (
    info.role === "company" &&
    info.companyId &&
    info.companyId === booking.companyId
  ) {
    return true;
  }
  return false;
}

/**
 * هل يستطيع هذا المستخدم إجراء عمليات التحصيل/تأكيد الدفع؟
 * المالك (الكل) أو الشركة المشغلة (شركتها) — العميل لا يملك تأكيد الدفع لنفسه.
 */
async function canCollectPayment(
  ctx: MutationCtx,
  userId: UserId,
  booking: Doc<"busBookings">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  const info = await resolveRole(ctx, user?.email, user?.role);
  if (info.role === "owner") return true;
  if (
    info.role === "company" &&
    info.companyId &&
    info.companyId === booking.companyId
  ) {
    return true;
  }
  return false;
}

/**
 * قائمة حجوزات المستخدم الحالي (العميل)، الأحدث أولاً.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("busBookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * قائمة حجوزات الشركة — للمالك (كل الحجوزات) والشركة المشغلة (حجوزات شركتها فقط).
 * تُستخدم في لوحة تشغيل الشركة لتأكيد الحجوزات وتحصيل المدفوعات.
 */
export const forCompany = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role === "customer") return [];
    if (info.companyId) {
      return await ctx.db
        .query("busBookings")
        .withIndex("by_company", (q) => q.eq("companyId", info.companyId!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("busBookings").order("desc").collect();
  },
});

/**
 * قراءة حجز واحد بالمعرّف — دالة داخلية تُستخدم من Action الدفع الإلكتروني
 * (لا تُستدعى من الواجهة مباشرة).
 */
export const getById = internalQuery({
  args: { id: v.id("busBookings") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

/**
 * إنشاء حجز جديد للمستخدم الحالي — يخصم المقاعد من الرحلة المختارة
 * ويسجل القيمة المحاسبية (سعر الرحلة × الركاب) وطريقة الدفع.
 *
 * حماية المبلغ: السعر ووقت الانطلاق يُشتقان من الرحلة في الخادم دائماً
 * عندما يكون الحجز مرتبطاً برحلة — لا يُقبل أي سعر من العميل.
 */
export const create = mutation({
  args: bookingInput,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // حجز المقاعد: تحقق من التوفر وخصم العدد المطلوب في نفس العملية
    if (args.tripId) {
      const tripId = args.tripId;
      const trip = await ctx.db.get(tripId);
      if (!trip) throw new Error("الرحلة المختارة غير موجودة");
      if (trip.availableSeats < args.passengers) {
        throw new Error("المقاعد المتوفرة في هذه الرحلة لا تكفي لعدد الركاب المطلوب");
      }
      await ctx.db.patch(tripId, {
        availableSeats: trip.availableSeats - args.passengers,
      });
      // السعر والوقت من الرحلة في الخادم — لا يُقبل من العميل
      args = {
        ...args,
        price: trip.price,
        departureTime: trip.departureTime ?? args.departureTime,
      };
    }

    const bookingId = await ctx.db.insert("busBookings", toDbRow(userId, args));
    return bookingId;
  },
});

/**
 * تحديث حالة الحجز (قيد الانتظار / مؤكد / ملغي) مع إدارة المقاعد:
 * الإلغاء يحرر المقاعد، وإعادة التفعيل تعيد حجزها.
 * متاح لصاحب الحجز والمالك والشركة المشغلة لحجوزات شركتها.
 */
export const updateStatus = mutation({
  args: { id: v.id("busBookings"), status: bookingStatusValidator },
  handler: async (ctx, { id, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(id);
    if (!existing || !(await canManageBooking(ctx, userId, existing))) {
      throw new Error("Booking not found");
    }
    if (existing.status === status) return;

    if (status === "cancelled") {
      await releaseSeats(ctx, existing);
    } else if (existing.status === "cancelled") {
      await holdSeats(ctx, existing);
    }

    await ctx.db.patch(id, { status });
  },
});

/**
 * تحديث حالة الدفع (غير مدفوع / مدفوع) — التحصيل اليدوي:
 * الدفع عند الانطلاق في فرع الشركة، أو تأكيد التحويل البنكي المسبق.
 * يسجل العملية في جدول payments حتى يظهر سجل الدفع للمالك والشركة.
 *
 * متاح للمالك (الكل) والشركة المشغلة (حجوزات شركتها) فقط —
 * العميل ممنوع خادمياً من تأكيد دفع حجزه بنفسه.
 */
export const updatePayment = mutation({
  args: {
    id: v.id("busBookings"),
    paymentStatus: paymentStatusValidator,
  },
  handler: async (ctx, { id, paymentStatus }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Booking not found");
    if (!(await canCollectPayment(ctx, userId, existing))) {
      throw new Error("غير مصرح — التحصيل وتأكيد الدفع للمالك أو صاحب الشركة فقط");
    }
    if (existing.status === "cancelled") {
      throw new Error("لا يمكن تحصيل حجز ملغي");
    }
    await ctx.db.patch(id, { paymentStatus });

    // سجل الدفع: أنشئ/حدّث صف العملية ليطابق حالة التحصيل
    const now = Date.now();
    const attempts = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", id))
      .collect();
    const attempt = attempts[0];
    const fare = existing.fareAmount ?? (existing.price ?? 0) * existing.passengers;

    if (paymentStatus === "paid") {
      await ctx.db.patch(id, { paymentRef: existing.paymentRef ?? existing.bookingNo });
      if (attempt) {
        await ctx.db.patch(attempt._id, {
          status: "paid",
          providerRef: attempt.providerRef ?? existing.bookingNo,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("payments", {
          bookingId: id,
          amount: fare,
          currency: "SAR",
          method: existing.paymentMethod ?? "on_arrival",
          status: "paid",
          provider: "manual",
          providerRef: existing.bookingNo,
          idempotencyKey: undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (attempt) {
      await ctx.db.patch(attempt._id, { status: paymentStatus, updatedAt: now });
    }
  },
});

/**
 * حذف أحد حجوزات المستخدم الحالي (أو المالك) — يحرر المقاعد إن لم يكن الحجز ملغى،
 * ويحذف سجل عمليات الدفع المرتبطة بالحجز حتى لا تبقى بيانات يتيمة.
 */
export const remove = mutation({
  args: { id: v.id("busBookings") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Booking not found");
    if (existing.userId !== userId) {
      const user = await ctx.db.get(userId);
      const info = await resolveRole(ctx, user?.email, user?.role);
      if (info.role !== "owner") throw new Error("Booking not found");
    }
    if (existing.status !== "cancelled") {
      await releaseSeats(ctx, existing);
    }
    // حذف عمليات الدفع المرتبطة بالحجز (لا تبقى بيانات يتيمة)
    const attempts = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", id))
      .collect();
    for (const p of attempts) {
      await ctx.db.delete(p._id);
    }
    await ctx.db.delete(id);
  },
});
