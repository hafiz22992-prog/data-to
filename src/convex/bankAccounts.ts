import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveRole } from "./roles";

/**
 * الحسابات البنكية للمنصة — بيانات التحويل البنكي المباشر (بدون أي بوابة دفع):
 *
 * الصلاحيات (خادمية — لا اعتماد على الواجهة):
 * - OWNER: يرى ويدير جميع الحسابات (إضافة/تعديل/حذف/تفعيل/تعطيل/ترتيب).
 * - CUSTOMER: يرى الحسابات النشطة فقط (مرتبة حسب displayOrder) لاختيار أحدها
 *   عند التحويل البنكي في الحجز — لا يعدّل ولا يحذف.
 * - COMPANY OWNER: لا يدير الحسابات البنكية العامة للمنصة إطلاقاً — يرى الحسابات
 *   النشطة فقط (كمعلومات تحويل مرتبطة بحجوزات شركته)، وأي تعديل مرفوض خادمياً.
 *
 * الحساب المختار يُحفظ مع عملية الدفع (payments.bankAccountId + لقطة) حتى يعرف
 * النظام أي حساب بنكي اختاره العميل للمراجعة لاحقاً.
 */

/** هل المستخدم الحالي هو المالك؟ (شرط كل عمليات الإدارة) */
async function isOwner(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  const info = await resolveRole(ctx, user?.email, user?.role);
  return info.role === "owner";
}

/**
 * قائمة الحسابات البنكية:
 * - المالك: جميع الحسابات (نشطة ومعطّلة) مرتبة حسب displayOrder.
 * - العميل / صاحب الشركة: الحسابات النشطة فقط مرتبة حسب displayOrder.
 * أي مستخدم غير مسجّل: قائمة فارغة.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);

    const rows = await ctx.db.query("bankAccounts").collect();
    const sorted = [...rows].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
    if (info.role === "owner") return sorted;
    return sorted.filter((a) => a.active);
  },
});

/**
 * إنشاء حساب بنكي جديد — المالك فقط.
 * رقم الحساب أو الآيبان: أحدهما على الأقل مطلوب (يمكن أن يكتفي النظام بأحدهما
 * طالما أن هناك رقماً/بياناً واضحاً يستطيع المسافر استخدامه للتحويل).
 */
export const create = mutation({
  args: {
    bankName: v.string(),
    accountHolderName: v.string(),
    accountNumber: v.optional(v.string()),
    iban: v.optional(v.string()),
    beneficiaryName: v.string(),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!(await isOwner(ctx, userId))) {
      throw new Error("Authorization denied — المالك فقط يدير الحسابات البنكية");
    }

    const bankName = args.bankName.trim();
    const accountHolderName = args.accountHolderName.trim();
    const beneficiaryName = args.beneficiaryName.trim();
    const accountNumber = args.accountNumber?.trim();
    const iban = args.iban?.trim().replace(/\s+/g, "").toUpperCase();

    if (!bankName || !accountHolderName || !beneficiaryName) {
      throw new Error("أكمل بيانات الحساب: اسم البنك، صاحب الحساب، واسم المستفيد");
    }
    if (!accountNumber && !iban) {
      throw new Error("أدخل رقم الحساب أو الآيبان (أحدهما على الأقل) ليتمكن المسافر من التحويل");
    }

    const now = Date.now();
    const id = await ctx.db.insert("bankAccounts", {
      bankName,
      accountHolderName,
      accountNumber: accountNumber || undefined,
      iban: iban || undefined,
      beneficiaryName,
      description: args.description?.trim() || undefined,
      active: args.active ?? true,
      displayOrder: args.displayOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });
    return { accountId: id, created: true };
  },
});

/**
 * تحديث حساب بنكي — المالك فقط. الحقول الاختيارية غير المُرسلة تبقى كما هي.
 */
export const update = mutation({
  args: {
    accountId: v.id("bankAccounts"),
    bankName: v.optional(v.string()),
    accountHolderName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    iban: v.optional(v.string()),
    beneficiaryName: v.optional(v.string()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!(await isOwner(ctx, userId))) {
      throw new Error("Authorization denied — المالك فقط يدير الحسابات البنكية");
    }

    const existing = await ctx.db.get(args.accountId);
    if (!existing) throw new Error("الحساب البنكي غير موجود");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.bankName !== undefined) {
      const v = args.bankName.trim();
      if (!v) throw new Error("اسم البنك مطلوب");
      patch.bankName = v;
    }
    if (args.accountHolderName !== undefined) {
      const v = args.accountHolderName.trim();
      if (!v) throw new Error("اسم صاحب الحساب مطلوب");
      patch.accountHolderName = v;
    }
    if (args.beneficiaryName !== undefined) {
      const v = args.beneficiaryName.trim();
      if (!v) throw new Error("اسم المستفيد مطلوب");
      patch.beneficiaryName = v;
    }
    if (args.accountNumber !== undefined) {
      const v = args.accountNumber.trim();
      if (!v && !existing.iban && !args.iban) {
        throw new Error("أدخل رقم الحساب أو الآيبان (أحدهما على الأقل)");
      }
      patch.accountNumber = v || undefined;
    }
    if (args.iban !== undefined) {
      const v = args.iban.trim().replace(/\s+/g, "").toUpperCase();
      if (!v && !existing.accountNumber && !args.accountNumber) {
        throw new Error("أدخل رقم الحساب أو الآيبان (أحدهما على الأقل)");
      }
      patch.iban = v || undefined;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.active !== undefined) patch.active = args.active;
    if (args.displayOrder !== undefined) patch.displayOrder = args.displayOrder;

    await ctx.db.patch(args.accountId, patch);
    return { accountId: args.accountId, updated: true };
  },
});

/** حذف حساب بنكي نهائياً — المالك فقط. */
export const remove = mutation({
  args: { accountId: v.id("bankAccounts") },
  handler: async (ctx, { accountId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!(await isOwner(ctx, userId))) {
      throw new Error("Authorization denied — المالك فقط يدير الحسابات البنكية");
    }
    const existing = await ctx.db.get(accountId);
    if (!existing) return { removed: null };
    await ctx.db.delete(accountId);
    return { removed: accountId };
  },
});

/** تفعيل / تعطيل حساب بنكي — المالك فقط. */
export const setActive = mutation({
  args: { accountId: v.id("bankAccounts"), active: v.boolean() },
  handler: async (ctx, { accountId, active }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!(await isOwner(ctx, userId))) {
      throw new Error("Authorization denied — المالك فقط يدير الحسابات البنكية");
    }
    const existing = await ctx.db.get(accountId);
    if (!existing) throw new Error("الحساب البنكي غير موجود");
    await ctx.db.patch(accountId, { active, updatedAt: Date.now() });
    return { accountId, active };
  },
});

/**
 * ترتيب الحسابات — المالك فقط. يستقبل قائمة معرّفات بالترتيب المطلوب
 * ويضبط displayOrder = 1..n لكل حساب.
 */
export const reorder = mutation({
  args: { orderedIds: v.array(v.id("bankAccounts")) },
  handler: async (ctx, { orderedIds }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!(await isOwner(ctx, userId))) {
      throw new Error("Authorization denied — المالك فقط يدير الحسابات البنكية");
    }
    const now = Date.now();
    for (let i = 0; i < orderedIds.length; i++) {
      const existing = await ctx.db.get(orderedIds[i]);
      if (!existing) throw new Error("الحساب البنكي غير موجود");
      await ctx.db.patch(orderedIds[i], { displayOrder: i + 1, updatedAt: now });
    }
    return { ok: true };
  },
});
