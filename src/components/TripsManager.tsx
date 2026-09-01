import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { toArabicIndic } from "@/lib/arabic";
import { getCompany } from "@/lib/transport";
import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Route as RouteIcon,
  X,
  XCircle,
} from "lucide-react";

/**
 * PHASE 3 STEP 4 — إدارة الرحلات (Trips) داخل لوحة الإدارة.
 *
 * الرحلة تُنشأ على Route موجودة ونشطة: الشركة ومدينة الانطلاق والوصول تُشتق
 * خادمياً من المسار المختار — لا يُدخل المستخدم companyId أو from أو to يدوياً.
 *
 * الصلاحيات تُفرض خادمياً (trips.ts):
 * - owner: يرى ويدير كل الرحلات، ويختار أي Route لشركة نشطة
 * - company: ترى وتدير رحلات شركتها فقط، وترى فقط Routes شركتها النشطة
 * - customer: القسم لا يُعرض أصلاً، والخادم يرفض أي تعديل
 *
 * الرحلات القديمة (بلا routeId / بلا active) تبقى كما هي وتُعتبر نشطة — ولا
 * تُكتب عليها أي قيمة هنا. عدم توفر Routes لا يمنع عرض/تعديل/إيقاف الرحلات
 * القائمة، لكنه يمنع إنشاء رحلة جديدة (بدون اختراع بيانات).
 */

const DAY_OPTIONS = [
  "يومياً",
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

/** أزرار أيام التشغيل — «يومياً» تلغي الأيام المحددة والعكس. */
function DayChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (days: string[]) => void;
}) {
  const toggle = (day: string) => {
    if (day === "يومياً") {
      onChange(["يومياً"]);
      return;
    }
    const withoutDaily = value.filter((d) => d !== "يومياً");
    onChange(
      withoutDaily.includes(day)
        ? withoutDaily.filter((d) => d !== day)
        : [...withoutDaily, day],
    );
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAY_OPTIONS.map((day) => {
        const selected =
          day === "يومياً" ? value.includes("يومياً") : value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

type EditState = {
  id: Id<"busTrips">;
  routeId: Id<"routes"> | "";
  departureTime: string;
  arrivalTime: string;
  price: string;
  totalSeats: string;
  days: string[];
};

export function TripsManager() {
  const roleData = useQuery(api.roles.role);
  const routes = useQuery(api.routes.list, {});
  const allTrips = useQuery(api.trips.list, {});
  const activeCompanies = useQuery(api.companies.listActive);
  const createTrip = useMutation(api.trips.create);
  const updateTrip = useMutation(api.trips.update);
  const setTripStatus = useMutation(api.trips.setStatus);

  const isOwner = roleData?.role === "owner";
  const isCompany = roleData?.role === "company";
  const companySlug = roleData?.companyId;

  // المسارات النشطة المسموحة للمستخدم (routes.list مُقيَّدة خادمياً بالدور)
  const activeRoutes = useMemo(
    () => (routes ?? []).filter((r) => r.active),
    [routes],
  );

  // الرحلات: المالك يرى الكل، والشركة ترى رحلات شركتها فقط (slug مطابق
  // لـ companyId النصي في الرحلات القديمة والجديدة معاً)
  const trips = useMemo(() => {
    const list = allTrips ?? [];
    if (isOwner) return list;
    if (isCompany && companySlug) {
      return list.filter((t) => t.companyId === companySlug);
    }
    return [];
  }, [allTrips, isOwner, isCompany, companySlug]);

  const companyBySlug = useMemo(
    () => new Map((activeCompanies ?? []).map((c) => [c.slug, c])),
    [activeCompanies],
  );
  const companyNameOf = (slug: string) =>
    companyBySlug.get(slug)?.name ?? getCompany(slug)?.name ?? slug;
  const companyColorOf = (slug: string) =>
    companyBySlug.get(slug)?.color ?? getCompany(slug)?.color;

  // ===== نموذج الإنشاء =====
  const [routeId, setRouteId] = useState<Id<"routes"> | "">("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [price, setPrice] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [days, setDays] = useState<string[]>(["يومياً"]);
  const [creating, setCreating] = useState(false);

  // ===== التعديل =====
  const [editing, setEditing] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyId, setBusyId] = useState<Id<"busTrips"> | null>(null);

  const selectedRoute = activeRoutes.find((r) => r._id === routeId);
  const routesLoading = routes === undefined;
  const tripsLoading = allTrips === undefined;

  const resetCreateForm = () => {
    setRouteId("");
    setDepartureTime("");
    setArrivalTime("");
    setPrice("");
    setTotalSeats("");
    setDays(["يومياً"]);
  };

  const startEdit = (trip: Doc<"busTrips">) => {
    setEditing({
      id: trip._id,
      routeId: trip.routeId ?? "",
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime ?? "",
      price: String(trip.price),
      totalSeats: String(trip.totalSeats),
      days: [...trip.days],
    });
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!routeId) {
      toast.error("اختر المسار لإنشاء الرحلة");
      return;
    }
    const priceNum = Number(price);
    const seatsNum = Number(totalSeats);
    if (!departureTime.trim()) {
      toast.error("حدد موعد الانطلاق");
      return;
    }
    if (!(priceNum > 0)) {
      toast.error("سعر التذكرة يجب أن يكون أكبر من صفر");
      return;
    }
    if (!Number.isInteger(seatsNum) || seatsNum <= 0) {
      toast.error("عدد المقاعد يجب أن يكون عدداً صحيحاً أكبر من صفر");
      return;
    }
    if (days.length === 0) {
      toast.error("حدد أيام التشغيل (يوم واحد على الأقل)");
      return;
    }
    setCreating(true);
    try {
      await createTrip({
        routeId,
        departureTime: departureTime.trim(),
        arrivalTime: arrivalTime.trim() || undefined,
        price: priceNum,
        totalSeats: seatsNum,
        days,
      });
      toast.success("تمت إضافة الرحلة — الشركة والمدن مُشتقة من المسار المختار");
      resetCreateForm();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر إضافة الرحلة");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const priceNum = Number(editing.price);
    const seatsNum = Number(editing.totalSeats);
    if (!editing.departureTime.trim()) {
      toast.error("حدد موعد الانطلاق");
      return;
    }
    if (!(priceNum > 0)) {
      toast.error("سعر التذكرة يجب أن يكون أكبر من صفر");
      return;
    }
    if (!Number.isInteger(seatsNum) || seatsNum <= 0) {
      toast.error("عدد المقاعد يجب أن يكون عدداً صحيحاً أكبر من صفر");
      return;
    }
    if (editing.days.length === 0) {
      toast.error("حدد أيام التشغيل (يوم واحد على الأقل)");
      return;
    }
    setSavingEdit(true);
    try {
      // عند تغيير المسار يعيد الخادم اشتقاق الشركة والمدينتين — لا قيمة من
      // العميل. تمرير arrivalTime فارغة يمسح الوقت المحفوظ سابقاً.
      const input: {
        id: Id<"busTrips">;
        routeId?: Id<"routes">;
        departureTime?: string;
        arrivalTime?: string;
        price?: number;
        totalSeats?: number;
        days?: string[];
      } = {
        id: editing.id,
        departureTime: editing.departureTime.trim(),
        arrivalTime: editing.arrivalTime.trim(),
        price: priceNum,
        totalSeats: seatsNum,
        days: editing.days,
      };
      if (editing.routeId) input.routeId = editing.routeId;
      await updateTrip(input);
      toast.success("تم تحديث الرحلة");
      setEditing(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الرحلة");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleStatus = async (trip: Doc<"busTrips">) => {
    const nextActive = trip.active === false;
    setBusyId(trip._id);
    try {
      await setTripStatus({ id: trip._id, active: nextActive });
      toast.success(nextActive ? "تم تفعيل الرحلة" : "تم إيقاف الرحلة");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تغيير حالة الرحلة");
    } finally {
      setBusyId(null);
    }
  };

  const selectClass =
    "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2 cursor-pointer";
  const inputClass =
    "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2";

  const routeTrip = (routeId: Id<"routes"> | undefined) =>
    routeId ? routes?.find((r) => r._id === routeId) : undefined;

  return (
    <div>
      {/* ===== إنشاء رحلة جديدة (على Route نشطة) ===== */}
      <form onSubmit={handleCreate} className="mb-4 rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <label htmlFor="tp-route" className="block text-xs font-semibold">
              المسار (الشركة والمدن تُشتق منه)
            </label>
            <select
              id="tp-route"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value as Id<"routes"> | "")}
              disabled={routesLoading}
              className={selectClass}
            >
              <option value="">
                {routesLoading
                  ? "جارٍ تحميل المسارات…"
                  : activeRoutes.length === 0
                    ? "لا توجد مسارات نشطة"
                    : "اختر المسار…"}
              </option>
              {activeRoutes.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.companyName} — {r.originName} ← {r.destinationName}
                </option>
              ))}
            </select>
            {selectedRoute ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Bus className="size-3" style={{ color: companyColorOf(selectedRoute.companyId) }} />
                <span className="font-semibold">{selectedRoute.companyName}</span>
                <ArrowRightLeft className="size-3 rotate-90" />
                <span>{selectedRoute.originName}</span>
                <ArrowRightLeft className="size-3 rotate-90" />
                <span className="text-emerald-600">{selectedRoute.destinationName}</span>
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="tp-departure" className="block text-xs font-semibold">
              موعد الانطلاق (HH:MM)
            </label>
            <input
              id="tp-departure"
              dir="ltr"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              placeholder="18:00"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tp-arrival" className="block text-xs font-semibold">
              الوصول المتوقع (اختياري)
            </label>
            <input
              id="tp-arrival"
              dir="ltr"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              placeholder="07:00"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tp-price" className="block text-xs font-semibold">
              السعر للراكب (ريال)
            </label>
            <input
              id="tp-price"
              dir="ltr"
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="250"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tp-seats" className="block text-xs font-semibold">
              إجمالي المقاعد
            </label>
            <input
              id="tp-seats"
              dir="ltr"
              type="number"
              min={1}
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value)}
              placeholder="45"
              className={inputClass}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="sm"
              className="h-9 w-full gap-1 sm:w-auto"
              disabled={creating || routesLoading}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              إضافة رحلة
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <label className="block text-xs font-semibold">أيام التشغيل</label>
          <DayChips value={days} onChange={setDays} />
        </div>

        {!routesLoading && activeRoutes.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed bg-muted/30 px-3 py-3 text-center text-xs leading-5 text-muted-foreground">
            لا توجد مسارات نشطة متاحة لإنشاء رحلة — أضف مساراً نشطاً من قسم
            «إدارة المسارات» أولاً. الرحلات القائمة أدناه تبقى تعمل وتُعدَّل
            دون الحاجة إلى مسار
          </p>
        ) : null}
      </form>

      {/* ===== قائمة الرحلات ===== */}
      {tripsLoading ? (
        <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : trips.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RouteIcon className="size-6" />
          </div>
          <p className="mt-3 text-sm font-bold">
            {isCompany ? "لا توجد رحلات لشركتك بعد" : "لا توجد رحلات بعد"}
          </p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            أضف أول رحلة من النموذج أعلاه على مسار نشط — الرحلة تُبنى على المسار
            وتورث الشركة والمدينتين منه تلقائياً
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const isActive = trip.active !== false;
            const isBusy = busyId === trip._id;
            const isEditing = editing?.id === trip._id;
            const route = routeTrip(trip.routeId);
            return (
              <div key={trip._id} className="rounded-xl border bg-card p-4">
                {isEditing ? (
                  /* ===== نموذج التعديل (داخل البطاقة) ===== */
                  <form onSubmit={handleSaveEdit}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        <Pencil className="size-4 text-primary" />
                        تعديل الرحلة
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        onClick={() => setEditing(null)}
                      >
                        <X className="size-3.5" />
                        إلغاء
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold">
                          المسار (اختياري للتعديل)
                        </label>
                        <select
                          value={editing.routeId}
                          onChange={(e) =>
                            setEditing((s) =>
                              s ? { ...s, routeId: e.target.value as Id<"routes"> | "" } : s,
                            )
                          }
                          disabled={routesLoading}
                          className={selectClass}
                        >
                          <option value="">
                            {trip.routeId
                              ? "الاحتفاظ بالمسار الحالي"
                              : "رحلة قديمة — دون تغيير المسار"}
                          </option>
                          {activeRoutes.map((r) => (
                            <option key={r._id} value={r._id}>
                              {r.companyName} — {r.originName} ← {r.destinationName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold">
                          موعد الانطلاق (HH:MM)
                        </label>
                        <input
                          dir="ltr"
                          value={editing.departureTime}
                          onChange={(e) =>
                            setEditing((s) =>
                              s ? { ...s, departureTime: e.target.value } : s,
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold">
                          الوصول المتوقع (اختياري)
                        </label>
                        <input
                          dir="ltr"
                          value={editing.arrivalTime}
                          onChange={(e) =>
                            setEditing((s) =>
                              s ? { ...s, arrivalTime: e.target.value } : s,
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold">
                          السعر للراكب (ريال)
                        </label>
                        <input
                          dir="ltr"
                          type="number"
                          min={1}
                          value={editing.price}
                          onChange={(e) =>
                            setEditing((s) =>
                              s ? { ...s, price: e.target.value } : s,
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold">
                          إجمالي المقاعد
                        </label>
                        <input
                          dir="ltr"
                          type="number"
                          min={1}
                          value={editing.totalSeats}
                          onChange={(e) =>
                            setEditing((s) =>
                              s ? { ...s, totalSeats: e.target.value } : s,
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <label className="block text-xs font-semibold">أيام التشغيل</label>
                      <DayChips
                        value={editing.days}
                        onChange={(next) =>
                          setEditing((s) => (s ? { ...s, days: next } : s))
                        }
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        size="sm"
                        className="gap-1"
                        disabled={savingEdit}
                      >
                        {savingEdit ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        حفظ التعديل
                      </Button>
                      <p className="text-[11px] leading-5 text-muted-foreground">
                        عند تغيير المسار تُعاد اشتقاق الشركة والمدينتين من المسار
                        الجديد — والمقاعد المتاحة لا تتغير من هنا
                      </p>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Bus className="size-4" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: companyColorOf(trip.companyId) }}
                            />
                            {companyNameOf(trip.companyId)}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="size-3.5 text-primary" />
                            <span>{trip.from}</span>
                            <ArrowRightLeft className="size-3.5 rotate-90" />
                            <span className="text-emerald-600">{trip.to}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isActive
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-rose-300 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {isActive ? "نشطة" : "موقوفة"}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          disabled={isBusy}
                          onClick={() => toggleStatus(trip)}
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : isActive ? (
                            <XCircle className="size-3.5" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          {isActive ? "إيقاف" : "تفعيل"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => startEdit(trip)}
                        >
                          <Pencil className="size-3.5" />
                          تعديل
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-bold text-foreground">
                        <Clock3 className="size-3.5 text-primary" />
                        انطلاق {trip.departureTime}
                        {trip.arrivalTime ? ` · وصول ≈ ${trip.arrivalTime}` : ""}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        {toArabicIndic(trip.price)}{" "}
                        <span className="font-medium text-muted-foreground">ريال / راكب</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        متاح {toArabicIndic(trip.availableSeats)} /{" "}
                        {toArabicIndic(trip.totalSeats)} مقعد
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {trip.days.join("، ")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <RouteIcon className="size-3.5" />
                        {route
                          ? `على المسار: ${route.companyName} — ${route.originName} ← ${route.destinationName}`
                          : "رحلة قديمة (بدون مسار)"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
