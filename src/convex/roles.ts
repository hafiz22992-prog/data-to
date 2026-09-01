import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";

/**
 * أدوار النظام في «خطوط زحل»:
 * - owner: المالك — يرى كل شيء ويدير المنصة
 * - admin: مسؤول منصة بصلاحيات إدارية محددة (ليس المالك)
 * - company: الشركة المشغلة — ترى حجوزات ومحاسبة شركتها فقط
 * - customer: المسافر/العميل — يرى حجوزاته وتذاكره فقط
 *
 * يُحدَّد الدور بالترتيب:
 * 0) satrunlines@outlook.sa → owner (hardcoded fallback)
 * 1) OWNER_EMAILS (متغير بيئة) → owner
 * 2) storedRole === "owner" → owner
 * 3) storedRole === "admin" → admin
 * 4) COMPANY_EMAILS أو ملف الشركة في companies → company
 * 5) غير ذلك → customer
 *
 * SECURITY: لا يمكن للمستخدم منح نفسه دوراً من الـ Frontend.
 * الدور يُحدَّد دائماً من Backend عبر these checks.
 */

export type AppRole = "owner" | "admin" | "company" | "customer";

export interface RoleInfo {
  role: AppRole;
  canSeeAccounting: boolean;
  companyId?: string;
  companyName?: string;
}

/** اسم الشركة المخزنة من معرفها — للعرض فقط. */
async function companyNameOf(
  ctx: QueryCtx,
  companyId: string,
): Promise<string | undefined> {
  const company = await ctx.db
    .query("companies")
    .withIndex("by_slug", (q) => q.eq("slug", companyId))
    .first();
  return company?.name;
}

/**
 * تحديد الدور من بريد المستخدم ودوره المخزن وملف الشركة المخزن.
 * يرجع كائن RoleInfo — يُستخدم في كل نقاط التحقق الخادمية.
 */
export async function resolveRole(
  ctx: QueryCtx,
  email: string | undefined,
  storedRole: string | undefined,
): Promise<RoleInfo> {
  const normalized = (email ?? "").toLowerCase().trim();
  const emailList = (raw: string | undefined) =>
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

  // 0. OWNER — hardcoded platform owner (safety net if OWNER_EMAILS env is missing)
  if (normalized === "satrunlines@outlook.sa") {
    return { role: "owner", canSeeAccounting: true };
  }

  // 1. OWNER — من بريدات المالك في Environment Variables
  const ownerEmails = emailList(process.env.OWNER_EMAILS);
  if (ownerEmails.includes(normalized)) {
    return { role: "owner", canSeeAccounting: true };
  }

  // 2. OWNER — إذا كان الدور المخزن صراحةً "owner"
  if (storedRole === "owner") {
    return { role: "owner", canSeeAccounting: true };
  }

  // 3. ADMIN — مسؤول منصة بصلاحيات إدارية
  if (storedRole === "admin") {
    return { role: "admin", canSeeAccounting: true };
  }

  // SECURITY: دور "admin" المخزن لا يعني "owner" بعد الآن
  // تم إصلاح ثغرة أمنية كانت تحوّل admin → owner

  // 4. COMPANY — من متغيرات البيئة
  const companyEntries = emailList(process.env.COMPANY_EMAILS);
  const envMatch = companyEntries.find((entry) => {
    const [em, companyId] = entry.split(":");
    return em === normalized && !!companyId;
  });
  if (envMatch) {
    const companyId = envMatch.split(":")[1];
    return {
      role: "company",
      canSeeAccounting: true,
      companyId,
      companyName: await companyNameOf(ctx, companyId),
    };
  }
  if (companyEntries.includes(normalized)) {
    return { role: "company", canSeeAccounting: true };
  }

  // 5. COMPANY — من ملف الشركة في قاعدة البيانات
  if (normalized) {
    const companies = await ctx.db.query("companies").collect();
    const matched = companies.find(
      (c) => c.status !== "inactive" && c.emails.includes(normalized),
    );
    if (matched) {
      return {
        role: "company",
        canSeeAccounting: true,
        companyId: matched.slug,
        companyName: matched.name,
      };
    }
  }

  // 6. DEFAULT — كل مستخدم جديد يصبح customer (مسافر)
  return { role: "customer", canSeeAccounting: false };
}

/** استعلام الدور للمستخدم الحالي — تستهلكه الواجهة لتحديد ما يُعرض. */
export const role = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { role: "customer", canSeeAccounting: false } satisfies RoleInfo;
    }
    const user = await ctx.db.get(userId);
    return await resolveRole(ctx, user?.email, user?.role);
  },
});
