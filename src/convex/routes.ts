import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { resolveRole, RoleInfo } from "./roles";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * PHASE 2B — طبقة المسارات (Routes).
 *
 * المسار يربط شركة بمدينة انطلاق ومدينة وصول بمعرّفات قاعدة البيانات:
 *   companyId (Id<"companies">) ← originCityId (Id<"cities">) ← destinationCityId (Id<"cities">)
 *
 * Route ≠ Trip: المسار تعريف فقط (مثل: المتصدر، الرياض → صنعاء). الرحلات
 * (busTrips) لم تُنقل إلى هذا الجدول في هذه المرحلة ولا تُلمس إطلاقاً.
 *
 * الصلاحيات (حماية خادمية):
 * - owner: إدارة كل المسارات
 * - company: إدارة مسارات شركتها فقط (تُحل شركتها من الدور — slug → شركة)
 * - customer / ضيف: لا قائمة ولا تعديل (القراءة ترجع [] والمُعدِّلات تُرفض صراحةً)
 */

/** نوع سياق القراءة/الكتابة المشترك. */
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

/** التحقق من صلاحية الوصول لمسار معيّن — owner على الكل، والشركة على مسارها فقط. */
async function assertRouteAccess(
  ctx: Ctx,
  manager: RoleInfo,
  routeId: Id<"routes">,
): Promise<Doc<"routes">> {
  const route = await ctx.db.get(routeId);
  if (!route) throw new Error("المسار غير موجود");
  if (manager.role === "owner") return route;
  const own = await ownCompanyId(ctx, manager.companyId);
  if (!own || route.companyId !== own) {
    throw new Error("غير مصرح — يمكنك إدارة مسارات شركتك فقط");
  }
  return route;
}

/** إثراء مسار بالبيانات المقروءة (اسم الشركة وأسماء المدن) — للعرض فقط. */
async function enrichRoute(
  ctx: Ctx,
  route: Doc<"routes">,
) {
  const [company, origin, destination] = await Promise.all([
    ctx.db.get(route.companyId),
    ctx.db.get(route.originCityId),
    ctx.db.get(route.destinationCityId),
  ]);
  return {
    _id: route._id,
    companyId: route.companyId,
    companyName: company?.name ?? "شركة غير معروفة",
    originCityId: route.originCityId,
    originName: origin?.name ?? "مدينة غير معروفة",
    destinationCityId: route.destinationCityId,
    destinationName: destination?.name ?? "مدينة غير معروفة",
    active: route.active,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

/** التحقق الكامل لبيانات مسار (شركة + مدينتان) قبل الإنشاء/التحديث. */
async function validateRouteData(
  ctx: Ctx,
  companyId: Id<"companies">,
  originCityId: Id<"cities">,
  destinationCityId: Id<"cities">,
): Promise<void> {
  // 1) الشركة موجودة
  const company = await ctx.db.get(companyId);
  if (!company) throw new Error("الشركة غير موجودة");
  // 2) الشركة نشطة
  if (company.status === "inactive") throw new Error("الشركة موقوفة — فعّلها أولاً");

  // 3) مدينة الانطلاق موجودة
  const origin = await ctx.db.get(originCityId);
  if (!origin) throw new Error("مدينة الانطلاق غير موجودة");
  // 5) مدينة الانطلاق مفعّلة
  if (!origin.active) throw new Error("مدينة الانطلاق موقوفة — فعّلها أولاً");

  // 4) مدينة الوصول موجودة
  const destination = await ctx.db.get(destinationCityId);
  if (!destination) throw new Error("مدينة الوصول غير موجودة");
  // 5) مدينة الوصول مفعّلة
  if (!destination.active) throw new Error("مدينة الوصول موقوفة — فعّلها أولاً");

  // 6) المدينتان مختلفتان
  if (originCityId === destinationCityId) {
    throw new Error("لا يمكن أن تكون مدينة الانطلاق والوصول متطابقتين");
  }

  // 7) الاتجاه صالح حسب النظام الحالي: سعودية → يمن فقط (كل رحلات busTrips
  // الحالية من مدن سعودية إلى وجهات يمنية — قاعدة مستمدة من الكود الموجود).
  if (origin.country !== "sa" || destination.country !== "ye") {
    throw new Error("الاتجاه غير صالح — المسار المدعوم هو: مدينة سعودية ← مدينة يمنية");
  }
}

/** منع التكرار: نفس (الشركة + الانطلاق + الوصول) لا يُنشأ مرتين. */
async function assertNoDuplicate(
  ctx: Ctx,
  companyId: Id<"companies">,
  originCityId: Id<"cities">,
  destinationCityId: Id<"cities">,
  excludeId?: Id<"routes">,
): Promise<void> {
  const existing = await ctx.db
    .query("routes")
    .withIndex("by_company_origin_destination", (q) =>
      q
        .eq("companyId", companyId)
        .eq("originCityId", originCityId)
        .eq("destinationCityId", destinationCityId),
    )
    .first();
  if (existing && existing._id !== excludeId) {
    throw new Error("هذا المسار موجود مسبقاً لهذه الشركة — لا يمكن تكراره");
  }
}

/** قائمة المسارات — للمالك: الكل، للشركة: مسارات شركتها فقط، وللعميل: فارغة. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const manager = await getManager(ctx);
    if (!manager) return [];

    let routes;
    if (manager.role === "owner") {
      routes = await ctx.db.query("routes").collect();
    } else {
      const companyId = await ownCompanyId(ctx, manager.companyId);
      if (!companyId) return [];
      routes = await ctx.db
        .query("routes")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect();
    }
    const enriched = await Promise.all(routes.map((r) => enrichRoute(ctx, r)));
    return enriched.sort((a, b) => a.companyName.localeCompare(b.companyName, "ar"));
  },
});

/** قراءة مسار واحد — مع التحقق من الصلاحية. */
export const get = query({
  args: { id: v.id("routes") },
  handler: async (ctx, { id }) => {
    const manager = await getManager(ctx);
    if (!manager) return null;
    const route = await assertRouteAccess(ctx, manager, id);
    return enrichRoute(ctx, route);
  },
});

/**
 * إنشاء مسار — للمالك (أي شركة) والشركة (شركتها فقط).
 * التحقق: شركة موجودة ونشطة، مدينتان موجودتان ونشطتان ومختلفتان،
 * اتجاه صالح (سعودية ← يمن)، ولا تكرار.
 */
export const create = mutation({
  args: {
    companyId: v.optional(v.id("companies")), // مطلوب للمالك — تُهمَل للشركة (تفرض شركتها)
    originCityId: v.id("cities"),
    destinationCityId: v.id("cities"),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const manager = await getManager(ctx);
    if (!manager) throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");

    // الشركة: تُفرض شركة المستخدم؛ المالك: من المعامل
    let companyId: Id<"companies">;
    if (manager.role === "company") {
      const own = await ownCompanyId(ctx, manager.companyId);
      if (!own) throw new Error("شركتك غير مسجلة في المنصة بعد");
      companyId = own;
    } else {
      if (!args.companyId) throw new Error("اختر الشركة المشغلة للمسار");
      companyId = args.companyId;
    }

    await validateRouteData(ctx, companyId, args.originCityId, args.destinationCityId);
    await assertNoDuplicate(ctx, companyId, args.originCityId, args.destinationCityId);

    const now = Date.now();
    const id = await ctx.db.insert("routes", {
      companyId,
      originCityId: args.originCityId,
      destinationCityId: args.destinationCityId,
      active: args.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return { created: id };
  },
});

/** تحديث مسار (المدينتان/الحالة) — مع إعادة التحقق ومنع التكرار باستثناء الذات. */
export const update = mutation({
  args: {
    id: v.id("routes"),
    originCityId: v.optional(v.id("cities")),
    destinationCityId: v.optional(v.id("cities")),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const manager = await getManager(ctx);
    if (!manager) throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");
    const route = await assertRouteAccess(ctx, manager, args.id);

    const originCityId = args.originCityId ?? route.originCityId;
    const destinationCityId = args.destinationCityId ?? route.destinationCityId;
    const active = args.active ?? route.active;

    if (originCityId !== route.originCityId || destinationCityId !== route.destinationCityId) {
      await validateRouteData(ctx, route.companyId, originCityId, destinationCityId);
    }
    await assertNoDuplicate(ctx, route.companyId, originCityId, destinationCityId, route._id);

    await ctx.db.patch(route._id, {
      originCityId,
      destinationCityId,
      active,
      updatedAt: Date.now(),
    });
    return { updated: route._id };
  },
});

/** تفعيل / إيقاف مسار. */
export const setStatus = mutation({
  args: { id: v.id("routes"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    const manager = await getManager(ctx);
    if (!manager) throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");
    const route = await assertRouteAccess(ctx, manager, id);
    await ctx.db.patch(route._id, { active, updatedAt: Date.now() });
    return { updated: route._id, active };
  },
});

/** حذف مسار — لا يمسّ الحجوزات أو الرحلات. */
export const remove = mutation({
  args: { id: v.id("routes") },
  handler: async (ctx, { id }) => {
    const manager = await getManager(ctx);
    if (!manager) throw new Error("غير مصرح — هذه الإدارة للمالك أو الشركة المشغلة فقط");
    const route = await assertRouteAccess(ctx, manager, id);
    await ctx.db.delete(route._id);
    return { removed: route._id };
  },
});
