import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { resolveRole } from "./roles";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Ensure the current user has a role assigned. Called after sign-in.
 * If no role exists, assigns "user" (customer/passenger).
 * SECURITY: This is the ONLY way a role gets assigned to a new user.
 * The role is always "user" — never "admin" or "owner".
 */
export const ensureRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("المستخدم غير موجود");

    // If user already has a role, keep it
    if (user.role) return { role: user.role };

    // New user gets "user" role (customer/passenger)
    // SECURITY: New users NEVER get admin/owner automatically
    await ctx.db.patch(userId, { role: "user" });
    return { role: "user" as const };
  },
});

/**
 * قائمة مستخدمي المنصة — للمالك فقط (قراءة فقط).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const user = await ctx.db.get(userId);
    const info = await resolveRole(ctx, user?.email, user?.role);
    // Only owner can see all users
    if (info.role !== "owner") return [];
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role ?? null,
      isAnonymous: u.isAnonymous ?? false,
    }));
  },
});

// REMOVED: setRole mutation — role escalation is a security vulnerability.
// Roles must be assigned ONLY through:
// 1. OWNER_EMAILS environment variable (server-side, in roles.ts)
// 2. COMPANY_EMAILS environment variable (server-side, in roles.ts)
// 3. Company email matching in companies table (server-side, in roles.ts)
// 4. Owner manually assigning via a secure admin panel (future)
