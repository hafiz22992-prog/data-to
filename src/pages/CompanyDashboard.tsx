import { AdminShell } from "@/components/AdminShell";
import { AccountingTable } from "@/components/AccountingTable";
import { BookingStats } from "@/components/BookingStats";
import { BookingsList } from "@/components/BookingsList";
import { PassengersSection } from "@/components/PassengersSection";
import { PaymentsSection } from "@/components/PaymentsSection";
import { ReportsSection } from "@/components/ReportsSection";
import { RoutesManager } from "@/components/RoutesManager";
import { TripsManager } from "@/components/TripsManager";
import { useRole } from "@/components/RoleGate";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { toArabicIndic } from "@/lib/arabic";
import { getCompany as legacyCompany } from "@/lib/transport";
import {
  Armchair,
  BarChart3,
  Building2,
  Bus,
  CalendarCheck2,
  CreditCard,
  Info,
  Landmark,
  LayoutDashboard,
  Route as RouteIcon,
  Settings,
  Users,
} from "lucide-react";

/**
 * لوحة صاحب شركة النقل (Company Dashboard) — التجربة الثانية: إدارة شركته فقط.
 * الدور «company» (من بريدات الشركة المخزنة) = صاحب شركة النقل. كل البيانات
 * تأتي من استعلامات مقيّدة خادمياً (routes.list/forCompany/accounting.summary
 * تُرجع شركته فقط، والخادم يرفض أي وصول لشركة أخرى أو لدوال المالك).
 * الحسابات البنكية للمنصة عامة ويديرها المالك فقط — صاحب الشركة لا يديرها،
 * ويراجع التحويلات البنكية لحجوزات شركته فقط (تأكيد/رفض/عرض الإيصال).
 */
export default function CompanyDashboard() {
  const { canSeeAccounting, companyId, companyName } = useRole();
  const bookings = useQuery(api.bookings.forCompany);
  const accounting = useQuery(api.accounting.summary);
  const trips = useQuery(api.trips.list, {});
  const activeCompanies = useQuery(api.companies.listActive);

  const company = activeCompanies?.find((c) => c.slug === companyId);
  const meta = legacyCompany(companyId ?? "");

  const navItems = [
    { id: "company-overview", icon: LayoutDashboard, label: "نظرة عامة" },
    { id: "company-profile", icon: Building2, label: "بيانات الشركة" },
    { id: "company-routes", icon: RouteIcon, label: "المسارات" },
    { id: "company-trips", icon: Bus, label: "الرحلات" },
    { id: "company-bookings", icon: CalendarCheck2, label: "الحجوزات" },
    { id: "company-payments", icon: CreditCard, label: "المدفوعات" },
    { id: "company-seats", icon: Armchair, label: "المقاعد" },
    { id: "company-passengers", icon: Users, label: "المسافرون" },
    { id: "company-revenue", icon: Landmark, label: "الإيرادات" },
    { id: "company-reports", icon: BarChart3, label: "التقارير" },
    { id: "company-settings", icon: Settings, label: "الإعدادات" },
  ];

  const header = (icon: typeof LayoutDashboard, title: string, desc: string) => {
    const Icon = icon;
    return (
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
    );
  };

  const companyTrips = (trips ?? []).filter((t) => t.companyId === companyId);

  return (
    <AdminShell
      appName="خطوط زحل"
      appSubtitle={`لوحة تشغيل ${companyName ?? "الشركة"}`}
      navItems={navItems}
    >
      {/* ===== نظرة عامة ===== */}
      <section id="company-overview" className="scroll-mt-24">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">
            لوحة {companyName ?? "شركتك"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            تابع حجوزات رحلاتك لحظة بلحظة، أكّد الحجوزات، حصّل قيمتها عند الانطلاق،
            واطبع تذاكر مسافريك — كل البيانات خاصة بشركتك فقط.
          </p>
        </div>
        <BookingStats bookings={bookings} showPaid={canSeeAccounting} />
      </section>

      {/* ===== بيانات الشركة ===== */}
      <section id="company-profile" className="mt-12 scroll-mt-24">
        {header(
          Building2,
          "بيانات الشركة",
          "ملف شركتك كما هو مخزّن في المنصة (قراءة فقط — التعديل للمالك)",
        )}
        {company === undefined ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
            <span className="text-xs text-muted-foreground">جارٍ التحميل…</span>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex size-11 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: company.color ?? meta?.color ?? "#334155" }}
                >
                  <Bus className="size-5" />
                </div>
                <div>
                  <p className="text-base font-extrabold">{company.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {company.slug}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  company.status === "inactive"
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                }`}
              >
                {company.status === "inactive" ? "موقوفة" : "نشطة"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4" />
                المقر: <span className="font-bold text-foreground">{company.base ?? "—"}</span>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Bus className="size-4" />
                المسارات: <span className="font-bold text-foreground">{company.routes ?? "—"}</span>
              </p>
            </div>
            {company.emails.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {company.emails.map((e) => (
                  <span
                    key={e}
                    className="rounded-md border bg-muted/40 px-2 py-1 text-xs"
                    dir="ltr"
                  >
                    {e}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* ===== المسارات ===== */}
      <section id="company-routes" className="mt-12 scroll-mt-24">
        {header(
          RouteIcon,
          "مسارات الشركة",
          "مسارات شركتك فقط — تُثبَّت شركتك خادمياً ولا يمكن إدارة مسار لشركة أخرى",
        )}
        <RoutesManager />
      </section>

      {/* ===== الرحلات ===== */}
      <section id="company-trips" className="mt-12 scroll-mt-24">
        {header(
          Bus,
          "رحلات الشركة",
          "أنشئ رحلات على مسارات شركتك النشطة وعدّل/أوقف رحلات شركتك فقط",
        )}
        <TripsManager />
      </section>

      {/* ===== الحجوزات ===== */}
      <section id="company-bookings" className="mt-12 scroll-mt-24">
        {header(
          CalendarCheck2,
          "حجوزات الشركة",
          "جميع حجوزات شركتك — أكّد الحجز عند وصول المسافر، حصّل القيمة، واطبع التذكرة",
        )}
        <BookingsList showAccounting={canSeeAccounting} manageMode />
      </section>

      {/* ===== المدفوعات ===== */}
      <section id="company-payments" className="mt-12 scroll-mt-24">
        {header(
          CreditCard,
          "مدفوعات الشركة",
          "عمليات الدفع الخاصة بحجوزات شركتك فقط: المبلغ وطريقة الدفع والحالة (قيد المعالجة / مدفوع / فشل / ملغي) ومرجع العملية — مع مراجعة التحويلات البنكية (تأكيد/رفض)",
        )}
        <PaymentsSection bookings={bookings} />
      </section>

      {/* ===== المقاعد ===== */}
      <section id="company-seats" className="mt-12 scroll-mt-24">
        {header(
          Armchair,
          "المقاعد",
          "المقاعد المتاحة لكل رحلة من رحلات شركتك — تُحدَّث لحظياً مع كل حجز/إلغاء",
        )}
        {companyTrips.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
            <Armchair className="size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">لا توجد رحلات لشركتك بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">الرحلة</th>
                  <th className="px-4 py-3 text-center font-semibold">انطلاق</th>
                  <th className="px-4 py-3 text-center font-semibold">متاح / إجمالي</th>
                  <th className="px-4 py-3 text-center font-semibold">الامتلاء</th>
                </tr>
              </thead>
              <tbody>
                {companyTrips.map((trip) => {
                  const pct =
                    trip.totalSeats > 0
                      ? Math.round(((trip.totalSeats - trip.availableSeats) / trip.totalSeats) * 100)
                      : 0;
                  return (
                    <tr key={trip._id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-semibold">
                        {trip.from} ← {trip.to}
                        <span className="mr-2 text-[11px] font-normal text-muted-foreground">
                          {trip.days.join("، ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{trip.departureTime}</td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {toArabicIndic(trip.availableSeats)} / {toArabicIndic(trip.totalSeats)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="mx-auto flex max-w-40 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${
                                trip.availableSeats <= 0
                                  ? "bg-rose-500"
                                  : trip.availableSeats <= 5
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-[11px] text-muted-foreground">
                            {toArabicIndic(pct)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== المسافرون ===== */}
      <section id="company-passengers" className="mt-12 scroll-mt-24">
        {header(
          Users,
          "المسافرون",
          "المسافرون المرتبطون بحجوزات شركتك — مشتق من حجوزاتك المصرّح بها",
        )}
        <PassengersSection bookings={bookings} />
      </section>

      {/* ===== الإيرادات ===== */}
      <section id="company-revenue" className="mt-12 scroll-mt-24">
        {header(
          Landmark,
          "إيرادات الشركة",
          "محاسبة شركتك فقط: ٨٠٪ حصتك من قيمة التذاكر، ٢٠٪ عمولة للتطبيق، والضريبة على العمولة فقط",
        )}
        <AccountingTable
          accounting={accounting}
          emptyTitle={`لا توجد حجوزات محاسبية لـ ${companyName ?? "شركتك"} بعد`}
        />
      </section>

      {/* ===== التقارير ===== */}
      <section id="company-reports" className="mt-12 scroll-mt-24">
        {header(
          BarChart3,
          "تقارير الشركة",
          "ملخص حجوزات شركتك حسب الحالة والتحصيل — مشتق من حجوزاتك المصرّح بها",
        )}
        <ReportsSection bookings={bookings} />
      </section>

      {/* ===== الإعدادات ===== */}
      <section id="company-settings" className="mt-12 scroll-mt-24">
        {header(
          Settings,
          "إعدادات الشركة",
          "معلومات عامة للشركة — تعديل بيانات الشركة أو بريد مسؤولها من لوحة المالك",
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "الشركة", value: companyName ?? "—" },
            { label: "المعرف", value: companyId ?? "—" },
            { label: "رحلاتك", value: companyTrips.length === 0 ? "…" : toArabicIndic(companyTrips.length) },
            { label: "نموذج العمولة", value: "80% شركة / 20% تطبيق" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-sm font-extrabold break-all" dir={c.label === "المعرف" ? "ltr" : undefined}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            الحسابات البنكية للمنصة تُدار من لوحة المالك (قسم «الحسابات البنكية») — ويختار
            المسافر أحد الحسابات النشطة عند «التحويل البنكي» في الحجز. يمكنك مراجعة
            التحويلات البنكية الخاصة بحجوزات شركتك (تأكيد/رفض/عرض الإيصال) من قسمي
            «الحجوزات» و«المدفوعات» — ولا يمكنك رؤية حسابات شركات أخرى أو حجوزاتها أو
            مدفوعاتها أو إيراداتها، والوصول إلى دوال المالك مرفوض خادمياً حتى لو استُدعيت
            مباشرة.
          </span>
        </div>
      </section>
    </AdminShell>
  );
}
