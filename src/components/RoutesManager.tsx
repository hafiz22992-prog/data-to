import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Route as RouteIcon,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

/**
 * PHASE 2B — إدارة المسارات (Routes) داخل لوحة الإدارة.
 *
 * المسار = شركة + مدينة انطلاق (سعودية) + مدينة وصول (يمنية) بمعرّفات قاعدة
 * البيانات (وليست أسماء نصية). Route ≠ Trip — لا تُنشأ رحلات من هنا.
 *
 * الصلاحيات تُفرض خادمياً (routes.ts):
 * - المالك: يختار الشركة ويدير كل المسارات
 * - الشركة: لا تختار الشركة — خادمياً تُفرض شركتها، وترى مساراتها فقط
 * - العميل: القسم لا يُعرض أصلاً، والخادم يرفض أي تعديل
 *
 * مصادر البيانات كلها من Convex (companies + cities + routes) —
 * لا استخدام لـ transport.ts هنا.
 */
export function RoutesManager() {
  const roleData = useQuery(api.roles.role);
  const routes = useQuery(api.routes.list, {});
  const companies = useQuery(api.companies.list);
  const cities = useQuery(api.locations.listCities, {});
  const createRoute = useMutation(api.routes.create);
  const setRouteStatus = useMutation(api.routes.setStatus);
  const removeRoute = useMutation(api.routes.remove);

  const [companyId, setCompanyId] = useState<Id<"companies"> | "">("");
  const [originCityId, setOriginCityId] = useState<Id<"cities"> | "">("");
  const [destinationCityId, setDestinationCityId] = useState<Id<"cities"> | "">("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOwner = roleData?.role === "owner";

  const saudiCities = useMemo(
    () => (cities ?? []).filter((c) => c.country === "sa"),
    [cities],
  );
  const yemenCities = useMemo(
    () => (cities ?? []).filter((c) => c.country === "ye"),
    [cities],
  );

  const citiesLoading = cities === undefined;

  const resetForm = () => {
    setCompanyId("");
    setOriginCityId("");
    setDestinationCityId("");
    setActive(true);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isOwner && !companyId) {
      toast.error("اختر الشركة المشغلة للمسار");
      return;
    }
    if (!originCityId || !destinationCityId) {
      toast.error("اختر مدينة الانطلاق ومدينة الوصول");
      return;
    }
    if (originCityId === destinationCityId) {
      toast.error("لا يمكن أن تكون مدينة الانطلاق والوصول متطابقتين");
      return;
    }
    setBusy(true);
    try {
      // بناء كائن الإدخال أولاً بدون companyId — ثم تُضاف الشركة شرطياً:
      // يمررها المالك فقط (عندها تكون Id<"companies"> حتماً)، ودور الشركة
      // تُفرض شركتها خادمياً. لا تمرر "" أبداً إلى Convex.
      const routeInput: {
        companyId?: Id<"companies">;
        originCityId: Id<"cities">;
        destinationCityId: Id<"cities">;
        active: boolean;
      } = {
        originCityId,
        destinationCityId,
        active,
      };
      if (isOwner && companyId) routeInput.companyId = companyId;
      await createRoute(routeInput);
      toast.success("تمت إضافة المسار — سترتبط به الرحلات في مرحلة لاحقة");
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر إضافة المسار");
    } finally {
      setBusy(false);
    }
  };

  const toggleRoute = async (id: Id<"routes">, currentlyActive: boolean) => {
    try {
      await setRouteStatus({ id, active: !currentlyActive });
      toast.success(currentlyActive ? "تم إيقاف المسار" : "تم تفعيل المسار");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تغيير حالة المسار");
    }
  };

  const deleteRoute = async (id: Id<"routes">) => {
    try {
      await removeRoute({ id });
      toast.success("تم حذف المسار — لا تتأثر الرحلات أو الحجوزات الحالية");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر حذف المسار");
    }
  };

  const selectClass =
    "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2 cursor-pointer";

  return (
    <div>
      {/* إضافة مسار جديد */}
      <form onSubmit={handleCreate} className="mb-4 rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {isOwner ? (
            <div className="space-y-1">
              <label htmlFor="rt-company" className="block text-xs font-semibold">
                الشركة المشغلة
              </label>
              <select
                id="rt-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value as Id<"companies"> | "")}
                disabled={companies === undefined}
                className={selectClass}
              >
                <option value="">
                  {companies === undefined ? "جارٍ تحميل الشركات…" : "اختر الشركة…"}
                </option>
                {(companies ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <label htmlFor="rt-origin" className="block text-xs font-semibold">
              مدينة الانطلاق (السعودية)
            </label>
            <select
              id="rt-origin"
              value={originCityId}
              onChange={(e) => setOriginCityId(e.target.value as Id<"cities"> | "")}
              disabled={citiesLoading}
              className={selectClass}
            >
              <option value="">
                {citiesLoading ? "جارٍ تحميل المدن…" : "اختر المدينة…"}
              </option>
              {saudiCities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="rt-destination" className="block text-xs font-semibold">
              مدينة الوصول (اليمن)
            </label>
            <select
              id="rt-destination"
              value={destinationCityId}
              onChange={(e) => setDestinationCityId(e.target.value as Id<"cities"> | "")}
              disabled={citiesLoading}
              className={selectClass}
            >
              <option value="">
                {citiesLoading ? "جارٍ تحميل المدن…" : "اختر المدينة…"}
              </option>
              {yemenCities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="rt-active" className="block text-xs font-semibold">
              الحالة
            </label>
            <select
              id="rt-active"
              value={active ? "1" : "0"}
              onChange={(e) => setActive(e.target.value === "1")}
              className={selectClass}
            >
              <option value="1">نشط</option>
              <option value="0">موقوف</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="sm"
              className="h-9 w-full gap-1 sm:w-auto"
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              إضافة مسار
            </Button>
          </div>
        </div>
        {!isOwner ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            أنت تدير مسارات {roleData?.companyName ?? "شركتك"} — تُثبَّت شركتك تلقائياً
          </p>
        ) : null}
      </form>

      {/* قائمة المسارات */}
      {routes === undefined ? (
        <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : routes.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RouteIcon className="size-6" />
          </div>
          <p className="mt-3 text-sm font-bold">لا توجد مسارات بعد</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            أضف أول مسار من النموذج أعلاه — المسار تعريف (شركة + انطلاق + وصول) ولا
            ينشئ رحلات؛ الرحلات تُبنى على المسارات في مرحلة لاحقة
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => (
            <div key={route._id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <RouteIcon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">{route.companyName}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{route.originName}</span>
                      <ArrowRightLeft className="size-3.5 rotate-90" />
                      <span>{route.destinationName}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      route.active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-rose-300 bg-rose-50 text-rose-700"
                    }`}
                  >
                    {route.active ? "نشط" : "موقوف"}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => toggleRoute(route._id, route.active)}
                  >
                    {route.active ? (
                      <>
                        <XCircle className="size-3.5" />
                        إيقاف
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        تفعيل
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive"
                    onClick={() => deleteRoute(route._id)}
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
