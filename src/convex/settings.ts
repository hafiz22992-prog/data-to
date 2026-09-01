import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { resolveRole } from "./roles";

/**
 * إعدادات المنصة التشغيلية — نموذج العمولة وضريبة القيمة المضافة.
 */

export const SETTINGS_KEY = "default";

export const DEFAULT_SETTINGS = {
  commissionCompanyPercent: 80,
  commissionPlatformPercent: 20,
  vatPercent: 15,
} as const;

export interface PlatformRates {
  commissionCompanyPercent: number;
  commissionPlatformPercent: number;
  vatPercent: number;
}

export async function getRates(
  ctx: QueryCtx | MutationCtx,
): Promise<PlatformRates> {
  const doc = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .first();
  if (!doc) return { ...DEFAULT_SETTINGS };
  return {
    commissionCompanyPercent: doc.commissionCompanyPercent,
    commissionPlatformPercent: doc.commissionPlatformPercent,
    vatPercent: doc.vatPercent,
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") return null;

    const doc = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .first();
    if (!doc) {
      return {
        commissionCompanyPercent: DEFAULT_SETTINGS.commissionCompanyPercent,
        commissionPlatformPercent: DEFAULT_SETTINGS.commissionPlatformPercent,
        vatPercent: DEFAULT_SETTINGS.vatPercent,
        saturnPhoneNumbers: [] as { number: string; label?: string; active: boolean }[],
        platformLogo: null as string | null,
        updatedAt: null,
        updatedBy: null,
      };
    }
    return {
      commissionCompanyPercent: doc.commissionCompanyPercent,
      commissionPlatformPercent: doc.commissionPlatformPercent,
      vatPercent: doc.vatPercent,
      saturnPhoneNumbers: doc.saturnPhoneNumbers ?? [],
      platformLogo: doc.platformLogo ?? null,
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedBy,
    };
  },
});

export const update = mutation({
  args: {
    commissionCompanyPercent: v.number(),
    commissionPlatformPercent: v.number(),
    vatPercent: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") {
      throw new Error("غير مصرح — تعديل إعدادات المنصة للمالك فقط");
    }
    const { commissionCompanyPercent: company, commissionPlatformPercent: platform, vatPercent: vat } = args;
    if (!Number.isFinite(company) || !Number.isFinite(platform) || !Number.isFinite(vat)) {
      throw new Error("قيم غير صالحة — أدخل أرقاماً صحيحة");
    }
    if (company < 0 || platform < 0 || vat < 0) throw new Error("لا تُقبل القيم السالبة");
    if (company + platform !== 100) {
      throw new Error(`مجموع النسب يجب أن يساوي 100% — المجموع الحالي ${company + platform}%`);
    }
    if (vat > 100) throw new Error("نسبة ضريبة القيمة المضافة غير منطقية");
    const now = Date.now();
    const existing = await ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { commissionCompanyPercent: company, commissionPlatformPercent: platform, vatPercent: vat, updatedBy: userId, updatedAt: now });
      return { updated: true, updatedAt: now };
    }
    await ctx.db.insert("platformSettings", { key: SETTINGS_KEY, commissionCompanyPercent: company, commissionPlatformPercent: platform, vatPercent: vat, updatedBy: userId, updatedAt: now });
    return { updated: true, updatedAt: now };
  },
});

export const updateSaturnPhones = mutation({
  args: {
    saturnPhoneNumbers: v.array(
      v.object({
        number: v.string(),
        label: v.optional(v.string()),
        active: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") {
      throw new Error("غير مصرح — تعديل أرقام خطوط زحل للمالك فقط");
    }
    const now = Date.now();
    const existing = await ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { saturnPhoneNumbers: args.saturnPhoneNumbers, updatedBy: userId, updatedAt: now });
    } else {
      await ctx.db.insert("platformSettings", {
        key: SETTINGS_KEY,
        commissionCompanyPercent: DEFAULT_SETTINGS.commissionCompanyPercent,
        commissionPlatformPercent: DEFAULT_SETTINGS.commissionPlatformPercent,
        vatPercent: DEFAULT_SETTINGS.vatPercent,
        saturnPhoneNumbers: args.saturnPhoneNumbers,
        updatedBy: userId,
        updatedAt: now,
      });
    }
    return { updated: true, updatedAt: now };
  },
});

/** رفع شعار المنصة — للمالك فقط */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") throw new Error("غير مصرح — للمالك فقط");
    return await ctx.storage.generateUploadUrl();
  },
});

/** حفظ شعار المنصة — يقبل معرّف الملف المرفوع ويحوّله لرابط */
export const setPlatformLogo = mutation({
  args: { logoStorageId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") throw new Error("غير مصرح — للمالك فقط");
    let logoUrl: string | undefined;
    if (args.logoStorageId) {
      const url = await ctx.storage.getUrl(args.logoStorageId);
      if (!url) throw new Error("تعذر جلب رابط الشعار — تأكد من صحة الملف المرفوع");
      logoUrl = url;
    }
    const now = Date.now();
    const existing = await ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { platformLogo: logoUrl, updatedBy: userId, updatedAt: now });
    } else {
      await ctx.db.insert("platformSettings", {
        key: SETTINGS_KEY,
        commissionCompanyPercent: DEFAULT_SETTINGS.commissionCompanyPercent,
        commissionPlatformPercent: DEFAULT_SETTINGS.commissionPlatformPercent,
        vatPercent: DEFAULT_SETTINGS.vatPercent,
        platformLogo: logoUrl,
        updatedBy: userId,
        updatedAt: now,
      });
    }
    return { updated: true };
  },
});

/** تحديث شعار المنصة برابط مباشر — للمالك فقط */
export const updateLogo = mutation({
  args: { logoUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") throw new Error("غير مصرح — للمالك فقط");
    const now = Date.now();
    const existing = await ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { platformLogo: args.logoUrl, updatedBy: userId, updatedAt: now });
    } else {
      await ctx.db.insert("platformSettings", {
        key: SETTINGS_KEY,
        commissionCompanyPercent: DEFAULT_SETTINGS.commissionCompanyPercent,
        commissionPlatformPercent: DEFAULT_SETTINGS.commissionPlatformPercent,
        vatPercent: DEFAULT_SETTINGS.vatPercent,
        platformLogo: args.logoUrl,
        updatedBy: userId,
        updatedAt: now,
      });
    }
    return { updated: true };
  },
});

/** حذف شعار المنصة — للمالك فقط */
export const removePlatformLogo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    if (info.role !== "owner") throw new Error("غير مصرح — للمالك فقط");
    const now = Date.now();
    const existing = await ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { platformLogo: undefined, updatedBy: userId, updatedAt: now });
    }
    return { updated: true };
  },
});
