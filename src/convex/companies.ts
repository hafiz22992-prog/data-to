import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveRole } from "./roles";
import { companyStatusValidator } from "./schema";

/**
 * إدارة شركات النقل المشتركة في «خطوط زحل» — للمالك فقط.
 */

const DEFAULT_COMPANIES = [
  { slug: "al-afdal", name: "رواد الأفضل للنقل الدولي", base: "جدة", routes: "رحلات يومية من جدة والرياض والدمام إلى صنعاء وعدن وتعز", color: "#1d4ed8" },
  { slug: "al-mutasaddir", name: "مؤسسة المتصدر للنقل", base: "الرياض", routes: "رحلات يومية من الرياض وجدة إلى صنعاء وعدن وتعز والحديدة", color: "#0f766e" },
  { slug: "al-baraka", name: "شركة البركة للنقل الدولي", base: "جدة", routes: "رحلات يومية (VIP) من جدة والمدينة المنورة والدمام إلى صنعاء وعدن وتعز", color: "#b45309" },
  { slug: "al-saree", name: "مؤسسة السريع للنقل البري", base: "الرياض", routes: "رحلات من الرياض وجدة والدمام إلى صنعاء وعدن وتعز", color: "#7c3aed" },
  { slug: "abu-sarhad", name: "أبو سرهد", color: "#0e7490" },
  { slug: "al-buraq", name: "البراق", color: "#4f46e5" },
  { slug: "al-nokhba", name: "النخبة", color: "#c026d3" },
  { slug: "al-ittihad", name: "الاتحاد", color: "#ea580c" },
  { slug: "al-rihab", name: "الرحاب", color: "#15803d" },
];

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("companies").collect();
    return rows
      .filter((c) => c.status !== "inactive")
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") return [];
    const rows = await ctx.db.query("companies").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") return null;
    return await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", slug.trim()))
      .first();
  },
});

/**
 * استعلام عام لصفحة الشركة — لا يتطلب مصادقة.
 * يعرض فقط البيانات العامة الآمنة (لا بيانات مالية أو حساسة).
 */
export const getPublic = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const company = await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", slug.trim()))
      .first();
    if (!company) return null;
    // Only return public-safe fields
    return {
      slug: company.slug,
      name: company.name,
      base: company.base,
      routes: company.routes,
      color: company.color,
      logo: company.logo,
      status: company.status,
      address: company.address,
      mapUrl: company.mapUrl,
      contactPhones: company.contactPhones?.filter((p) => p.active) ?? [],
      emails: company.emails,
    };
  },
});

export const save = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    base: v.optional(v.string()),
    routes: v.optional(v.string()),
    color: v.optional(v.string()),
    emails: v.array(v.string()),
    status: v.optional(companyStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") {
      throw new Error("غير مصرح — هذه الإدارة للمالك فقط");
    }
    const slug = args.slug.trim();
    if (!slug) throw new Error("معرف الشركة مطلوب");
    if (!args.name.trim()) throw new Error("اسم الشركة مطلوب");
    const emails = [...new Set(args.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    const status = args.status ?? existing?.status ?? "active";
    const doc = {
      slug,
      name: args.name.trim(),
      emails,
      status,
      ...(args.base?.trim() ? { base: args.base.trim() } : {}),
      ...(args.routes?.trim() ? { routes: args.routes.trim() } : {}),
      ...(args.color?.trim() ? { color: args.color.trim() } : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return { saved: existing._id, created: false };
    }
    const id = await ctx.db.insert("companies", doc);
    return { saved: id, created: true };
  },
});

/**
 * تحديث حالة إرسال البريد الإلكتروني للشركة
 */
export const updateEmailStatus = mutation({
  args: {
    slug: v.string(),
    emailStatus: v.union(
      v.literal("not_sent"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    companyUrl: v.optional(v.string()),
  },
  handler: async (ctx, { slug, emailStatus, companyUrl }) => {
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!existing) throw new Error("الشركة غير موجودة");
    const patch: Record<string, unknown> = {
      emailStatus,
      lastEmailSentAt: Date.now(),
    };
    if (companyUrl) patch.companyUrl = companyUrl;
    await ctx.db.patch(existing._id, patch);
    return { updated: true, slug };
  },
});

export const setStatus = mutation({
  args: { slug: v.string(), status: companyStatusValidator },
  handler: async (ctx, { slug, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") {
      throw new Error("غير مصرح — هذه الإدارة للمالك فقط");
    }
    const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", slug.trim())).first();
    if (!existing) throw new Error("الشركة غير موجودة");
    await ctx.db.patch(existing._id, { status });
    return { updated: existing._id, slug: existing.slug, status };
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") {
      throw new Error("غير مصرح — هذه الإدارة للمالك فقط");
    }
    const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", args.slug.trim())).first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { removed: existing._id };
    }
    return { removed: null };
  },
});

export const saveContactInfo = mutation({
  args: {
    slug: v.string(),
    address: v.optional(v.string()),
    mapUrl: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    contactPhones: v.optional(
      v.array(
        v.object({
          number: v.string(),
          label: v.optional(v.string()),
          active: v.boolean(),
        }),
      ),
    ),
  },
  handler: async (ctx, { slug, ...rest }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") {
      throw new Error("غير مصرح — هذه الإدارة للمالك فقط");
    }
    const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", slug.trim())).first();
    if (!existing) throw new Error("الشركة غير موجودة");
    const patch: Record<string, unknown> = {};
    if (rest.address !== undefined) patch.address = rest.address;
    if (rest.mapUrl !== undefined) patch.mapUrl = rest.mapUrl;
    if (rest.lat !== undefined) patch.lat = rest.lat;
    if (rest.lng !== undefined) patch.lng = rest.lng;
    if (rest.contactPhones !== undefined) patch.contactPhones = rest.contactPhones;
    await ctx.db.patch(existing._id, patch);
    return { updated: existing._id };
  },
});

export const updatePhoneNumbers = mutation({
  args: {
    slug: v.string(),
    phoneNumbers: v.array(v.string()),
  },
  handler: async (ctx, { slug, phoneNumbers }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") {
      throw new Error("غير مصرح — هذه الإدارة للمالك فقط");
    }
    const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", slug.trim())).first();
    if (!existing) throw new Error("الشركة غير موجودة");
    const cleaned = [...new Set(phoneNumbers.map((p) => p.trim()).filter(Boolean))];
    await ctx.db.patch(existing._id, { phoneNumbers: cleaned });
    return { updated: existing._id, slug: existing.slug, phoneNumbers: cleaned };
  },
});

export const seedDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const created: string[] = [];
    for (const company of DEFAULT_COMPANIES) {
      const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", company.slug)).first();
      if (existing) continue;
      await ctx.db.insert("companies", { ...company, emails: [], status: "active" });
      created.push(company.slug);
    }
    let backfilled = 0;
    const rows = await ctx.db.query("companies").collect();
    for (const row of rows) {
      if (!row.status) {
        await ctx.db.patch(row._id, { status: "active" });
        backfilled += 1;
      }
    }
    const after = await ctx.db.query("companies").collect();
    return {
      created,
      backfilled,
      total: after.length,
      active: after.filter((c) => c.status !== "inactive").length,
      inactive: after.filter((c) => c.status === "inactive").length,
      slugs: after.map((c) => c.slug),
    };
  },
});

/** رفع شعار الشركة — للمالك فقط */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") throw new Error("غير مصرح — للمالك فقط");
    return await ctx.storage.generateUploadUrl();
  },
});

/** حفظ رابط شعار الشركة — للمالك فقط */
export const setLogo = mutation({
  args: { slug: v.string(), logoStorageId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح — سجّل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if ((await resolveRole(ctx, user?.email, user?.role)).role !== "owner") throw new Error("غير مصرح — للمالك فقط");
    const existing = await ctx.db.query("companies").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (!existing) throw new Error("الشركة غير موجودة");
    let logoUrl: string | undefined;
    if (args.logoStorageId) {
      const url = await ctx.storage.getUrl(args.logoStorageId);
      if (!url) throw new Error("تعذر جلب رابط الشعار — تأكد من صحة الملف المرفوع");
      logoUrl = url;
    }
    await ctx.db.patch(existing._id, { logo: logoUrl });
    return { updated: true };
  },
});
