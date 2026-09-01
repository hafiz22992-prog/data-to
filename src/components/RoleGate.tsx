import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/convex/roles";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * التوجيه المبني على الدور الحقيقي من Backend.
 *
 * الدور يأتي من `api.roles.role` (خادمي) — لا يُعرض أي Dashboard خاطئ ثم يُخفى،
 * بل يُوجَّه المستخدم فوراً إلى الواجهة المخصصة لدوره:
 *   owner    → /owner    (لوحة المالك)
 *   admin    → /owner    (لوحة المالك — بصلاحيات إدارية)
 *   company  → /company  (لوحة صاحب شركة النقل)
 *   customer → /customer (واجهة المسافر)
 *
 * SECURITY: الدور يُحدَّد دائماً من Backend. لا يمكن للمستخدم تغيير دوره.
 */

/** الصفحة الرئيسية لكل دور. */
export function roleHome(role: AppRole): string {
  if (role === "owner") return "/owner";
  if (role === "admin") return "/owner"; // Admin sees owner dashboard
  if (role === "company") return "/company";
  return "/customer";
}

/** قراءة دور المستخدم الحالي من Backend مع حالة التحميل. */
export function useRole() {
  const roleData = useQuery(api.roles.role);
  const role: AppRole = roleData?.role ?? "customer";
  return {
    role,
    canSeeAccounting: roleData?.canSeeAccounting ?? false,
    companyId: roleData?.companyId,
    companyName: roleData?.companyName,
    isLoading: roleData === undefined,
  };
}

/** شاشة تحميل موحّدة أثناء ق读 الدور. */
function RoleLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}

/**
 * يُوجّه المستخدم المصادق إلى واجهة دوره (مع الحفاظ على query string
 * مثل ?from=…&to=… القادمة من صفحة المقارنة). تُستخدم للمسار القديم /dashboard
 * وبعد تسجيل الدخول حتى يهبط الجميع على الواجهة الصحيحة.
 *
 * SECURITY: ينتظر حتى يُحمَّل الدور فعلياً قبل التوجيه لمنع
 * التوجيه الخاطئ بسبب race condition بعد تسجيل الدخول.
 */
export function RoleRouter() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { role, isLoading: isRoleLoading } = useRole();
  const location = useLocation();

  // Wait for both auth and role to load before routing
  if (isAuthLoading || isRoleLoading) return <RoleLoading />;

  // If not authenticated, redirect to auth page
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  const home = roleHome(role);
  if (location.pathname === home) return null;
  return <Navigate to={`${home}${location.search}`} replace />;
}

interface RoleGateProps {
  /** الدور المسموح بدخول هذه الواجهة. */
  allow: AppRole | AppRole[];
  children: ReactNode;
}

/**
 * بوابة واجهة: تسمح بالدور المحدد فقط، وإلا تُعيد المستخدم إلى واجهة دوره.
 * الحماية الحقيقية على أي حال خادمية في كل Query/Mutation الحساسة.
 */
export function RoleGate({ allow, children }: RoleGateProps) {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { role, isLoading: isRoleLoading } = useRole();
  const location = useLocation();

  if (isAuthLoading || isRoleLoading) return <RoleLoading />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(role)) {
    return <Navigate to={`${roleHome(role)}${location.search}`} replace />;
  }
  return <>{children}</>;
}

/** بوابة لوحة المالك (owner + admin). */
export function OwnerGate({ children }: { children: ReactNode }) {
  return <RoleGate allow={["owner", "admin"]}>{children}</RoleGate>;
}

/** بوابة لوحة صاحب الشركة. */
export function CompanyGate({ children }: { children: ReactNode }) {
  return <RoleGate allow="company">{children}</RoleGate>;
}

/** بوابة واجهة المسافر (العميل). */
export function CustomerGate({ children }: { children: ReactNode }) {
  return <RoleGate allow="customer">{children}</RoleGate>;
}
