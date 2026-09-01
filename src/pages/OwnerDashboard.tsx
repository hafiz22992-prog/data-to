import { AnimatedTabs } from "@/components/AnimatedTabs";
import { AccountingTable } from "@/components/AccountingTable";
import { BankAccountManager } from "@/components/BankAccountManager";
import { BookingStats } from "@/components/BookingStats";
import { BookingsList } from "@/components/BookingsList";
import { BookingForm } from "@/components/BookingForm";
import { CompaniesManager } from "@/components/CompaniesManager";
import { CompanyContactManager } from "@/components/CompanyContactManager";
import { FinancialSettingsForm } from "@/components/FinancialSettingsForm";
import { PassengersSection } from "@/components/PassengersSection";
import { PaymentsSection } from "@/components/PaymentsSection";
import { PhoneNumbersManager } from "@/components/PhoneNumbersManager";
import { SaturnPhoneManager } from "@/components/SaturnPhoneManager";
import { LogoUploader } from "@/components/LogoUploader";
import { ReportsSection } from "@/components/ReportsSection";
import { RoutesManager } from "@/components/RoutesManager";
import { TicketPreview } from "@/components/TicketPreview";
import { TripsManager } from "@/components/TripsManager";
import { useRole } from "@/components/RoleGate";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  BarChart3, Building2, Bus, CalendarCheck2, CreditCard,
  Image as ImageIcon, KeyRound, Landmark, LayoutDashboard, MapPin, Phone,
  Route as RouteIcon, Settings, ShieldCheck, Ticket, Users, UserCog, Wallet,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
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
}

/* ─── main ────────────────────────────────────────────────────────────────── */

export default function OwnerDashboard() {
  const { canSeeAccounting } = useRole();
  const bookings = useQuery(api.bookings.forCompany);
  const accounting = useQuery(api.accounting.summary);
  const companiesList = useQuery(api.companies.list);
  const usersList = useQuery(api.users.list);

  /* ── Tab 1 : نظرة عامة ── */
  const overviewContent = (
    <div className="space-y-8">
      <BookingStats bookings={bookings} showPaid={canSeeAccounting} />
      <div>
        <SectionHeader icon={LayoutDashboard} title="لوحة الإدارة" desc="رؤية شاملة للمنصة" />
        <BookingForm showAccounting={canSeeAccounting} />
      </div>
    </div>
  );

  /* ── Tab 2 : الشركات ── */
  const companiesContent = (
    <div className="space-y-10">
      <div>
        <SectionHeader icon={Building2} title="إدارة الشركات" desc="أضف شركة جديدة، فعّلها/أوقفها" />
        <CompaniesManager />
      </div>
      <div>
        <SectionHeader icon={MapPin} title="بيانات التواصل والموقع" desc="عنوان الشركة + رابط Google Maps + أرقام التواصل لكل شركة" />
        <CompanyContactManager />
      </div>
      <div>
        <SectionHeader icon={UserCog} title="أصحاب الشركات" desc="كل بريد مسؤول يمنح صاحبه دور «صاحب شركة النقل»" />
        {companiesList === undefined ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
            <span className="text-xs text-muted-foreground">جارٍ التحميل…</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">الشركة</th>
                  <th className="px-4 py-3 font-semibold">بريد المسؤول</th>
                  <th className="px-4 py-3 text-center font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {companiesList.filter((c) => c.emails.length > 0).flatMap((c) =>
                  c.emails.map((email) => (
                    <tr key={`${c.slug}-${email}`} className="border-b last:border-0">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3" dir="ltr">{email}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${c.status === "inactive" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
                        >
                          {c.status === "inactive" ? "موقوفة" : "نشطة"}
                        </Badge>
                      </td>
                    </tr>
                  )),
                )}
                {companiesList.every((c) => c.emails.length === 0) && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">لا توجد بريدات مسؤولين مضبوطة بعد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Tab 3 : المسارات والرحلات ── */
  const routesTripsContent = (
    <div className="space-y-10">
      <div>
        <SectionHeader icon={RouteIcon} title="إدارة المسارات" desc="حدد مسارات كل شركة" />
        <RoutesManager />
      </div>
      <div>
        <SectionHeader icon={Bus} title="إدارة الرحلات" desc="أنشئ رحلات على المسارات النشطة" />
        <TripsManager />
      </div>
    </div>
  );

  /* ── Tab 4 : الحجوزات ── */
  const bookingsContent = (
    <div className="space-y-10">
      <div>
        <SectionHeader icon={CalendarCheck2} title="حجوزات المنصة" desc="جميع حجوزات المنصة — أكّد وحصّل واطبع التذكرة" />
        <BookingsList showAccounting={canSeeAccounting} manageMode canDelete />
      </div>
      <div>
        <SectionHeader icon={CreditCard} title="سجل المدفوعات" desc="كل عمليات الدفع في المنصة" />
        <PaymentsSection bookings={bookings} />
      </div>
      <div>
        <SectionHeader icon={Users} title="المسافرون" desc="كل مسافر مرّ عبر المنصة" />
        <PassengersSection bookings={bookings} />
      </div>
    </div>
  );

  /* ── Tab 5 : المالية ── */
  const financeContent = (
    <div className="space-y-10">
      <div>
        <SectionHeader icon={Landmark} title="المحاسبة والإيرادات" desc="نموذج العمولة: شركة النقل والتطبيق" />
        <AccountingTable accounting={accounting} emptyTitle="لا توجد حجوزات محاسبية بعد" />
      </div>
      <div>
        <SectionHeader icon={BarChart3} title="التقارير" desc="ملخص لحظي حسب حالة الحجز والتحصيل وحسب الشركة" />
        <ReportsSection bookings={bookings} />
      </div>
      <div>
        <SectionHeader icon={Wallet} title="الحسابات البنكية" desc="حسابات البنك" />
        <BankAccountManager />
      </div>
    </div>
  );

  /* ── Tab 6 : النظام ── */
  const systemContent = (
    <div className="space-y-10">
      <div>
        <SectionHeader icon={Users} title="المستخدمون" desc="حسابات المنصة وأدوارها المخزنة" />
        {usersList === undefined ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
            <span className="text-xs text-muted-foreground">جارٍ التحميل…</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">البريد</th>
                  <th className="px-4 py-3 font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-center font-semibold">الدور</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u._id} className="border-b last:border-0">
                    <td className="px-4 py-3" dir="ltr">{u.email || (u.isAnonymous ? "(ضيف)" : "—")}</td>
                    <td className="px-4 py-3">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{u.role ?? "غير محدد"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionHeader icon={ShieldCheck} title="نظام الصلاحيات" desc="التحقق خادمي في كل استعلام/تعديل" />
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">الإمكان</th>
                <th className="px-4 py-3 text-center font-semibold">المالك</th>
                <th className="px-4 py-3 text-center font-semibold">صاحب الشركة</th>
                <th className="px-4 py-3 text-center font-semibold">المسافر</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["الحجز والبحث", "✓", "✓", "✓"],
                ["إدارة الشركات", "✓", "✗", "✗"],
                ["الإعدادات المالية", "✓", "✗", "✗"],
              ].map(([f, o, c, u]) => (
                <tr key={f} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{f}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{o}</td>
                  <td className="px-4 py-3 text-center font-bold">{c}</td>
                  <td className="px-4 py-3 text-center font-bold text-rose-600">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionHeader icon={Ticket} title="معاينة التذكرة" desc="نموذج مرجعي لشكل التذكرة" />
        <TicketPreview />
      </div>
    </div>
  );

  /* ── Tab 7 : الإعدادات ── */
  const settingsContent = (
    <div className="space-y-10">
      {/* شعار المنصة */}
      <div>
        <SectionHeader icon={ImageIcon} title="شعار المنصة" desc="ارفع شعار خطوط زحل — يظهر تلقائياً في التذاكر" />
        <LogoUploader />
      </div>

      {/* أرقام خطوط زحل */}
      <div>
        <SectionHeader icon={Phone} title="📱 أرقام جوالات خطوط زحل" desc="أدخل أرقام جوالات خطوط زحل — تظهر تلقائياً في جميع التذاكر" />
        <SaturnPhoneManager />
      </div>

      {/* أرقام شركات النقل */}
      <div>
        <SectionHeader icon={Phone} title="أرقام شركات النقل" desc="أرقام الشركات" />
        <PhoneNumbersManager />
      </div>

      {/* الإعدادات المالية */}
      <div>
        <SectionHeader icon={Settings} title="الإعدادات" desc="الإعدادات المالية + معلومات عامة" />
        <FinancialSettingsForm />
      </div>
    </div>
  );

  /* ── tabs array ── */
  const tabs = [
    { title: "نظرة عامة", value: "overview", icon: LayoutDashboard, content: overviewContent },
    { title: "الشركات", value: "companies", icon: Building2, content: companiesContent },
    { title: "المسارات والرحلات", value: "routes", icon: RouteIcon, content: routesTripsContent },
    { title: "الحجوزات", value: "bookings", icon: CalendarCheck2, content: bookingsContent },
    { title: "المالية", value: "finance", icon: Landmark, content: financeContent },
    { title: "النظام", value: "system", icon: Users, content: systemContent },
    { title: "الإعدادات", value: "settings", icon: Settings, content: settingsContent },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bus className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">خطوط زحل</p>
              <p className="text-xs text-muted-foreground">لوحة الإدارة والمحاسبة — المالك</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <span className="hidden text-xs text-muted-foreground sm:inline">المالك — رؤية كاملة للمنصة</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <AnimatedTabs
          tabs={tabs}
          activeTabClassName="bg-primary text-primary-foreground"
          tabClassName="text-muted-foreground hover:bg-muted hover:text-foreground"
        />
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-muted-foreground">
        <p>خطوط زحل — ربط المسافرين بشركات النقل البري المعتمدة في السعودية © ٢٠٢٦</p>
      </footer>
    </div>
  );
}
