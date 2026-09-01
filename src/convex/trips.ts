import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { resolveRole, RoleInfo } from "./roles";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * رحلات شركات النقل البري (الأفضل، المتصدر، البركة، السريع) على خطوط
 * السعودية – اليمن. يُبذر الجدول مرة واحدة عبر `trips.seed`، وتُحدَّث
 * المقاعد المتاحة تلقائياً عند إنشاء الحجوزات أو إلغائها.
 *
 * PHASE 3 — إدارة الرحلات المبنية على المسارات (Routes):
 * - `create`: رحلة جديدة لا تُنشأ إلا على Route موجودة ونشطة لشركة نشطة
 *   (owner على أي شركة نشطة، company على مسارات شركتها فقط). يُشتق
 *   companyId (slug نصي متوافق مع الرحلات القديمة) و from/to من Route
 *   خادمياً — لا يُثق بأي companyId قادم من العميل.
 * - `update`: تعديل الرحلة مع إعادة تحقق كاملة عند تغيير routeId.
 * - `setStatus`: تفعيل / إيقاف الرحلة (حقل active اختياري — الغائب = نشطة).
 * - الرحلات العشرون القديمة (بدون routeId) تبقى كما هي وتعمل كما كانت.
 */

export type TripSeed = {
  companyId: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime?: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  days: string[];
};

/** كتالوج الرحلات الافتتاحي — مواعيد وأسعار تقريبية واقعية بالريال السعودي. */
const SEED_TRIPS: TripSeed[] = [
  // ===== رواد الأفضل للنقل الدولي =====
  { companyId: "al-afdal", from: "جدة", to: "صنعاء", departureTime: "06:00", arrivalTime: "23:00", price: 250, totalSeats: 45, availableSeats: 12, days: ["يومياً"] },
  { companyId: "al-afdal", from: "جدة", to: "صنعاء", departureTime: "14:30", arrivalTime: "07:00", price: 250, totalSeats: 45, availableSeats: 3, days: ["يومياً"] },
  { companyId: "al-afdal", from: "جدة", to: "تعز", departureTime: "07:30", arrivalTime: "22:30", price: 230, totalSeats: 45, availableSeats: 21, days: ["يومياً"] },
  { companyId: "al-afdal", from: "جدة", to: "عدن", departureTime: "05:00", arrivalTime: "21:00", price: 260, totalSeats: 45, availableSeats: 0, days: ["يومياً"] },
  { companyId: "al-afdal", from: "الرياض", to: "صنعاء", departureTime: "06:30", arrivalTime: "00:30", price: 280, totalSeats: 45, availableSeats: 8, days: ["يومياً"] },
  { companyId: "al-afdal", from: "الدمام", to: "عدن", departureTime: "08:00", arrivalTime: "01:30", price: 300, totalSeats: 45, availableSeats: 17, days: ["السبت", "الأحد", "الثلاثاء", "الخميس"] },

  // ===== مؤسسة المتصدر للنقل =====
  { companyId: "al-mutasaddir", from: "الرياض", to: "صنعاء", departureTime: "07:00", arrivalTime: "01:00", price: 270, totalSeats: 45, availableSeats: 14, days: ["يومياً"] },
  { companyId: "al-mutasaddir", from: "الرياض", to: "عدن", departureTime: "09:00", arrivalTime: "02:00", price: 290, totalSeats: 45, availableSeats: 5, days: ["يومياً"] },
  { companyId: "al-mutasaddir", from: "الرياض", to: "تعز", departureTime: "06:00", arrivalTime: "23:30", price: 280, totalSeats: 45, availableSeats: 0, days: ["السبت", "الأحد", "الأربعاء"] },
  { companyId: "al-mutasaddir", from: "جدة", to: "الحديدة", departureTime: "08:30", arrivalTime: "23:30", price: 220, totalSeats: 45, availableSeats: 26, days: ["يومياً"] },
  { companyId: "al-mutasaddir", from: "جدة", to: "تعز", departureTime: "05:30", arrivalTime: "20:30", price: 230, totalSeats: 45, availableSeats: 9, days: ["يومياً"] },

  // ===== شركة البركة للنقل الدولي (باصات VIP) =====
  { companyId: "al-baraka", from: "جدة", to: "صنعاء", departureTime: "08:00", arrivalTime: "23:30", price: 240, totalSeats: 30, availableSeats: 4, days: ["يومياً"] },
  { companyId: "al-baraka", from: "جدة", to: "عدن", departureTime: "06:30", arrivalTime: "22:00", price: 250, totalSeats: 30, availableSeats: 11, days: ["يومياً"] },
  { companyId: "al-baraka", from: "جدة", to: "تعز", departureTime: "09:30", arrivalTime: "00:30", price: 230, totalSeats: 30, availableSeats: 2, days: ["يومياً"] },
  { companyId: "al-baraka", from: "المدينة المنورة", to: "صنعاء", departureTime: "07:00", arrivalTime: "22:30", price: 260, totalSeats: 30, availableSeats: 19, days: ["الأحد", "الثلاثاء", "الخميس"] },
  { companyId: "al-baraka", from: "الدمام", to: "صنعاء", departureTime: "10:00", arrivalTime: "03:00", price: 280, totalSeats: 30, availableSeats: 0, days: ["السبت", "الأربعاء"] },

  // ===== مؤسسة السريع للنقل البري =====
  { companyId: "al-saree", from: "الرياض", to: "صنعاء", departureTime: "05:00", arrivalTime: "23:00", price: 260, totalSeats: 45, availableSeats: 22, days: ["يومياً"] },
  { companyId: "al-saree", from: "الرياض", to: "عدن", departureTime: "07:30", arrivalTime: "00:30", price: 290, totalSeats: 45, availableSeats: 6, days: ["يومياً"] },
  { companyId: "al-saree", from: "جدة", to: "عدن", departureTime: "11:00", arrivalTime: "03:30", price: 250, totalSeats: 45, availableSeats: 13, days: ["يومياً"] },
  { companyId: "al-saree", from: "الدمام", to: "تعز", departureTime: "09:00", arrivalTime: "02:30", price: 280, totalSeats: 45, availableSeats: 15, days: ["الأحد", "الثلاثاء", "الجمعة"] },
];

type Ctx = QueryCtx;

/** هل المستخدم الحالي owner أو company؟ (null = لا صلاحية إدارة). */
async function getManager(ctx: Ctx): Promise<RoleInfo | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  const role = await resolveRole(ctx, user?.email, user?.role);
  if (role.role !== "owner" && role.role !== "company") return null;
  return role;
}

/** معرّف شركة مستخدم الدور «company» من slug دوره — أو null إن اختفت الشركة. */
async function ownCompanyId(
  ctx: Ctx,
  slug: string | undefined,
): Promise<Id<"companies"> | null> {
  if (!slug) return null;
  const company = await ctx.db
    .query("companies")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return company?._id ?? null;
}

/** تحقق كامل من Route قبل بناء/نقل رحلة إليها: موجودة، نشطة، شركتها موجودة ونشطة، مدينتاها موجودتان. */
async function resolveRoute(ctx: Ctx, routeId: Id<"routes">) {
  const route = await ctx.db.get(routeId);
  if (!route) throw new Error("المسار غير موجود");
  if (!route.active) throw new Error("المسار موقوف — فعّله أولاً");

  const company = await ctx.db.get(route.companyId);
  if (!company) throw new Error("الشركة المرتبطة بالمسار غير موجودة");
  if (company.status === "inactive") throw new Error("الشركة موقوفة — فعّلها أولاً");

  const origin = await ctx.db.get(route.originCityId);
  const destination = await ctx.db.get(route.destinationCityId);
  if (!origin || !destination) {
    throw new Error("إحدى مدينتي المسار غير موجودة");
  }

  return { route, company, origin, destination };
}

/** مسار تابِع لشركة مستخدم «company» فقط — المالك يمر دائماً. */
async function assertCompanyOwnsRoute(
  ctx: Ctx,
  manager: RoleInfo,
  route: Doc<"routes">,
): Promise<void> {
  if (manager.role === "owner") return;
  const own = await ownCompanyId(ctx, manager.companyId);
  if (!own || route.companyId !== own) {
    throw new Error("غير مصرح — يمكنك إنشاء رحلات على مسارات شركتك فقط");
  }
}

/** هل يستطيع المستخدم إدارة رحلة قائمة؟ المالك دائماً، والشركة لرحلات شركتها (slug). */
async function canManageTrip(
  ctx: Ctx,
  manager: RoleInfo,
  trip: Doc<"busTrips">,
): Promise<boolean> {
  if (manager.role === "owner") return true;
  return !!manager.companyId && trip.companyId === manager.companyId;
}

/** تحقق من قيم رحلة (موعد/سعر/مقاعد/أيام) قبل الإنشاء أو التحديث. */
function validateTripFields(args: {
  departureTime?: string;
  price?: number;
  totalSeats?: number;
  days?: string[];
}): void {
  if (args.departureTime !== undefined && !args.departureTime.trim()) {
    throw new Error("موعد الانطلاق مطلوب");
  }
  if (args.price !== undefined && !(args.price > 0)) {
    throw new Error("سعر التذكرة يجب أن يكون أكبر من صفر");
  }
  if (
    args.totalSeats !== undefined &&
    (!Number.isInteger(args.totalSeats) || args.totalSeats <= 0)
  ) {
    throw new Error("عدد المقاعد يجب أن يكون عدداً صحيحاً أكبر من صفر");
  }
  if (args.days !== undefined && args.days.length === 0) {
    throw new Error("حدد أيام التشغيل (يوم واحد على الأقل)");
  }
}

/**
 * قائمة الرحلات المتاحة — يمكن تصفيتها حسب مدينة الانطلاق أو الوصول أو الشركة.
 * استعلام عام (بدون تسجيل دخول) لعرض الرحلات على الصفحة الرئيسية.
 * يعيد الوثائق كما هي (تحمل routeId وactive تلقائياً إن وُجدا — بدون بيانات مشتقة مخزنة).
 */
export const list = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    companyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let trips = await ctx.db.query("busTrips").collect();
    if (args.from) trips = trips.filter((t) => t.from === args.from);
    if (args.to) trips = trips.filter((t) => t.to === args.to);
    if (args.companyId) trips = trips.filter((t) => t.companyId === args.companyId);
    return trips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  },
});

/** قراءة رحلة واحدة — استعلام عام (الرحلات بيانات عامة مثل list). */
export const get = query({
  args: { id: v.id("busTrips") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * إنشاء رحلة جديدة — لا تُنشأ إلا على Route موجودة ونشطة لشركة نشطة.
 * - owner: أي Route لشركة نشطة.
 * - company: Route تابعة لشركتها فقط (لا يُقبل companyId من العميل إطلاقاً).
 * - customer / ضيف: رفض صريح.
 * companyId (slug) و from و to تُشتق من Route خادمياً — متوافقة مع الرحلات القديمة.
 */
export const create = mutation({
  args: {
    routeId: v.id("routes"),
    departureTime: v.string(),
    arrivalTime: v.optional(v.string()),
    price: v.number(),
    totalSeats: v.number(),
    days: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await getManager(ctx);
    if (!manager) {
      throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");
    }

    const { route, company, origin, destination } = await resolveRoute(ctx, args.routeId);
    await assertCompanyOwnsRoute(ctx, manager, route);

    validateTripFields({
      departureTime: args.departureTime,
      price: args.price,
      totalSeats: args.totalSeats,
      days: args.days,
    });

    const id = await ctx.db.insert("busTrips", {
      companyId: company.slug, // slug نصي — نفس صيغة الرحلات العشرين الحالية
      from: origin.name,
      to: destination.name,
      departureTime: args.departureTime.trim(),
      arrivalTime: args.arrivalTime?.trim() || undefined,
      price: args.price,
      totalSeats: args.totalSeats,
      availableSeats: args.totalSeats, // رحلة جديدة تبدأ بكامل مقاعدها
      days: args.days,
      routeId: args.routeId,
    });
    return { created: id };
  },
});

/**
 * تعديل رحلة قائمة — للمالك (كل الرحلات) والشركة (رحلات شركتها فقط).
 * عند تغيير routeId: تحقق كامل (موجودة، نشطة، شركة نشطة، ملكية الشركة إن كان
 * المستخدم company) ويُعاد اشتقاق companyId/from/to من المسار الجديد.
 * الرحلات القديمة (بلا routeId) تبقى صالحة: عدم تمرير routeId لا يلمسها.
 * لا يُعدَّل availableSeats هنا إطلاقاً (نظام المقاعد خارج نطاق هذه المرحلة).
 */
export const update = mutation({
  args: {
    id: v.id("busTrips"),
    routeId: v.optional(v.id("routes")),
    departureTime: v.optional(v.string()),
    arrivalTime: v.optional(v.string()),
    price: v.optional(v.number()),
    totalSeats: v.optional(v.number()),
    days: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const manager = await getManager(ctx);
    if (!manager) {
      throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");
    }
    const trip = await ctx.db.get(args.id);
    if (!trip) throw new Error("الرحلة غير موجودة");
    if (!(await canManageTrip(ctx, manager, trip))) {
      throw new Error("غير مصرح — يمكنك إدارة رحلات شركتك فقط");
    }

    validateTripFields({
      departureTime: args.departureTime,
      price: args.price,
      totalSeats: args.totalSeats,
      days: args.days,
    });

    const patch: {
      companyId?: string;
      from?: string;
      to?: string;
      departureTime?: string;
      arrivalTime?: string;
      price?: number;
      totalSeats?: number;
      days?: string[];
      routeId?: Id<"routes">;
      active?: boolean;
    } = {};

    // تغيير المسار: تحقق كامل وإعادة اشتقاق (الشركة/المدينتان) من Route — خادمياً
    if (args.routeId !== undefined && args.routeId !== trip.routeId) {
      const { route, company, origin, destination } = await resolveRoute(ctx, args.routeId);
      await assertCompanyOwnsRoute(ctx, manager, route);
      patch.companyId = company.slug;
      patch.from = origin.name;
      patch.to = destination.name;
      patch.routeId = args.routeId;
    }

    if (args.departureTime !== undefined) {
      patch.departureTime = args.departureTime.trim();
    }
    if (args.arrivalTime !== undefined) {
      patch.arrivalTime = args.arrivalTime.trim() || undefined;
    }
    if (args.price !== undefined) {
      patch.price = args.price;
    }
    if (args.totalSeats !== undefined) {
      // حماية المقاعد: لا يُقلَّل الإجمالي إلى ما دون المتاح — دون لمس availableSeats
      if (args.totalSeats < trip.availableSeats) {
        throw new Error(
          "لا يمكن تقليل إجمالي المقاعد إلى ما دون المقاعد المتاحة حالياً (" +
            trip.availableSeats +
            ")",
        );
      }
      patch.totalSeats = args.totalSeats;
    }
    if (args.days !== undefined) {
      patch.days = args.days;
    }
    if (args.active !== undefined) {
      patch.active = args.active;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, patch);
    }
    return { updated: args.id };
  },
});

/** تفعيل / إيقاف رحلة — للمالك والشركة (رحلات شركتها فقط). الغائب = نشطة. */
export const setStatus = mutation({
  args: { id: v.id("busTrips"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    const manager = await getManager(ctx);
    if (!manager) {
      throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");
    }
    const trip = await ctx.db.get(id);
    if (!trip) throw new Error("الرحلة غير موجودة");
    if (!(await canManageTrip(ctx, manager, trip))) {
      throw new Error("غير مصرح — يمكنك إدارة رحلات شركتك فقط");
    }
    await ctx.db.patch(id, { active });
    return { updated: id, active };
  },
});

/**
 * بذر كتالوج الرحلات — آمن للتكرار: لا يُدخل شيئاً إذا كان الجدول ممتلئاً.
 * يُشغَّل مرة واحدة: `npx convex run trips:seed`
 * (لا يُنشئ رحلات جديدة بعد الآن — الرحلات الجديدة تُنشأ من إدارة الرحلات على Routes).
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("busTrips").first();
    if (existing) return { inserted: 0, skipped: true };
    let inserted = 0;
    for (const trip of SEED_TRIPS) {
      await ctx.db.insert("busTrips", trip);
      inserted += 1;
    }
    return { inserted, skipped: false };
  },
});
