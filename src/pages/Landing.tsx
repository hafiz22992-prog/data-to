import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpLeft,
  Bus,
  CalendarCheck2,
  Clock3,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toArabicIndic } from "@/lib/arabic";
import { getCompany, seatAvailability } from "@/lib/transport";
import { useLocations } from "@/hooks/use-locations";

const features = [
  {
    icon: Ticket,
    title: "حجز فوري في دقيقة",
    desc: "اختر الرحلة من مواعيد الشركة، أدخل بيانات المسافر، وتُحجز المقاعد فوراً لحين تأكيد الشركة.",
  },
  {
    icon: ShieldCheck,
    title: "شركات نقل حقيقية",
    desc: "شركات نقل بري مرخصة تعمل على خطوط اليمن يومياً — بأسمائها وبياناتها الرسمية من منصة النقل.",
  },
  {
    icon: Route,
    title: "مقاعد متاحة لحظياً",
    desc: "كل رحلة تعرض عدد المقاعد المتبقي مباشرة، ويُنقص الرقم فور إتمام الحجز ويُعاد عند الإلغاء.",
  },
  {
    icon: Clock3,
    title: "مواعيد انطلاق واضحة",
    desc: "جدول رحلات لكل شركة: موعد الانطلاق، الوصول المتوقع، والسعر للراكب الواحد.",
  },
  {
    icon: Lock,
    title: "بياناتك محفوظة بأمان",
    desc: "تُحفظ بيانات المسافر في حسابك الخاص، ويمكنك العودة إليها في أي وقت ومن أي جهاز.",
  },
  {
    icon: CalendarCheck2,
    title: "رحلات يومية",
    desc: "مواعيد منتظمة من كبرى المدن السعودية إلى المحافظات اليمنية طوال الأسبوع.",
  },
];

const steps = [
  {
    num: "١",
    title: "أدخل بيانات المسافر",
    desc: "الاسم، رقم الجوال، رقم الإقامة أو الحدود، ورقم جواز السفر.",
  },
  {
    num: "٢",
    title: "اختر الوجهة والشركة",
    desc: "مدينة الانطلاق في السعودية، مدينة الوصول في اليمن، وشركة النقل الأنسب لرحلتك.",
  },
  {
    num: "٣",
    title: "احجز مقعدك من المواعيد",
    desc: "اختر موعد الانطلاق من المقاعد المتاحة، وأكّد الحجز — وتتابع حالته من «حجوزاتي».",
  },
];

const popularRoutes = [
  { from: "جدة", to: "صنعاء", companies: ["رواد الأفضل للنقل الدولي", "شركة البركة للنقل الدولي"] },
  { from: "الرياض", to: "عدن", companies: ["مؤسسة المتصدر للنقل", "مؤسسة السريع للنقل البري"] },
  { from: "الدمام", to: "صنعاء", companies: ["رواد الأفضل للنقل الدولي", "شركة البركة للنقل الدولي"] },
  { from: "جدة", to: "تعز", companies: ["رواد الأفضل للنقل الدولي", "مؤسسة المتصدر للنقل"] },
  { from: "الرياض", to: "صنعاء", companies: ["مؤسسة السريع للنقل البري", "مؤسسة المتصدر للنقل"] },
  { from: "جدة", to: "عدن", companies: ["شركة البركة للنقل الدولي", "مؤسسة السريع للنقل البري"] },
];

export default function Landing() {
  const trips = useQuery(api.trips.list, {});

  const activeCompanies = useQuery(api.companies.listActive);
  const companiesLoading = activeCompanies === undefined;
  const companyBySlug = useMemo(
    () => new Map((activeCompanies ?? []).map((c) => [c.slug, c])),
    [activeCompanies],
  );

  const { saudiCities, yemenCities, isLoading: citiesLoading } = useLocations();

  const [filterFrom, setFilterFrom] = useState("all");
  const [filterTo, setFilterTo] = useState("all");
  const hasActiveFilter = filterFrom !== "all" || filterTo !== "all";

  const filteredTrips = (trips ?? []).filter(
    (t) =>
      (filterFrom === "all" || t.from === filterFrom) &&
      (filterTo === "all" || t.to === filterTo),
  );

  const resetFilters = () => {
    setFilterFrom("all");
    setFilterTo("all");
  };

  // رابط الحجز يوجه لصفحة الحجز (/customer) بدلاً من لوحة التحكم
  const bookingParams = new URLSearchParams();
  if (filterFrom !== "all") bookingParams.set("from", filterFrom);
  if (filterTo !== "all") bookingParams.set("to", filterTo);
  const bookingQuery = bookingParams.toString();
  const bookingReturn = bookingQuery ? `/customer?${bookingQuery}` : "/customer";
  const bookingHref = `/auth?returnTo=${encodeURIComponent(bookingReturn)}`;

  const companies = useMemo(() => {
    const list = activeCompanies ?? [];
    if (!hasActiveFilter || filteredTrips.length === 0) return list;
    return [...list].sort((a, b) => {
      const minA = Math.min(
        ...filteredTrips.filter((t) => t.companyId === a.slug).map((t) => t.price),
        Infinity,
      );
      const minB = Math.min(
        ...filteredTrips.filter((t) => t.companyId === b.slug).map((t) => t.price),
        Infinity,
      );
      return minA - minB;
    });
  }, [activeCompanies, hasActiveFilter, filteredTrips]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bus className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">خطوط زحل</p>
              <p className="text-[11px] text-muted-foreground">
                النقل البري من السعودية إلى اليمن
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#trips" className="transition-colors hover:text-foreground">
              الرحلات المتاحة
            </a>
            <a href="#companies" className="transition-colors hover:text-foreground">
              الشركات والأسعار
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              المميزات
            </a>
            <a href="#routes" className="transition-colors hover:text-foreground">
              المسارات الشائعة
            </a>
          </nav>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={bookingHref}>
              دخول
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(30,64,175,0.16),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4 gap-1.5 px-3 py-1">
              <Sparkles className="size-3.5" />
              شبكة شركات النقل البري المعتمدة
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.2] tracking-tight sm:text-5xl">
              سافر براً من السعودية
              <span className="block text-primary">إلى اليمن بكل ثقة</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              قارن أسعار الشركات ومواعيدها قبل الحجز: اختر مدينتك ورحلتك، وسترى
              لكل شركة السعر للراكب وعدد المقاعد المتبقي لحظياً — ثم احجز مقعدك
              وتابعه من «حجوزاتي».
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to={bookingHref}>
                  ابدأ الحجز الآن
                  <ArrowUpLeft className="size-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#companies">قارن الشركات والأسعار</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                {companiesLoading ? "…" : toArabicIndic(activeCompanies.length)} شركات نقل معتمدة
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-primary" />
                {citiesLoading ? "…" : toArabicIndic(yemenCities.length)} وجهة في اليمن
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="size-4 text-primary" />
                مقاعد متاحة لحظياً
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarCheck2 className="size-4 text-primary" />
                حجز خلال دقيقة
              </span>
            </div>
          </motion.div>

          {/* Route visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2.5">
                <span className="text-xs font-bold text-primary">
                  رحلة مقترحة — جدة إلى صنعاء
                </span>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Bus className="size-3" />
                  يومياً
                </Badge>
              </div>
              <div className="p-5">
                <div className="relative flex items-center justify-between">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="size-5" />
                    </div>
                    <p className="text-xs font-bold">جدة</p>
                    <p className="text-[10px] text-muted-foreground">المملكة العربية السعودية</p>
                  </div>
                  <div className="relative mx-3 flex-1">
                    <div className="border-t-2 border-dashed border-muted-foreground/40" />
                    <motion.div
                      className="absolute -top-3.5"
                      initial={{ right: "0%" }}
                      animate={{ right: "78%" }}
                      transition={{ duration: 6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                    >
                      <div className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground">
                        <Bus className="size-3.5" />
                      </div>
                    </motion.div>
                    <div className="absolute -top-1.5 right-0 text-[10px] font-bold text-muted-foreground">
                      ≈ ١٧ ساعة
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <MapPin className="size-5" />
                    </div>
                    <p className="text-xs font-bold">صنعاء</p>
                    <p className="text-[10px] text-muted-foreground">الجمهورية اليمنية</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  {["رواد الأفضل للنقل الدولي", "شركة البركة للنقل الدولي"].map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[11px] font-medium"
                    >
                      <Bus className="size-3.5 shrink-0 text-primary" />
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 rounded-xl border bg-background px-4 py-3 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Ticket className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">رقم الحجز: BK-20260814-1030</p>
                  <p className="text-[10px] text-muted-foreground">مقعد محجوز — بانتظار تأكيد الشركة</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Available trips */}
      <section id="trips" className="scroll-mt-20 border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-3">
              الرحلات المتاحة الآن
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">
              مواعيد اليوم والمقاعد المتبقية
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              مواعيد انطلاق حية من شركات النقل المعتمدة — تتحدث المقاعد تلقائياً
              عند كل حجز أو إلغاء
            </p>
          </div>

          {trips === undefined ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border bg-card">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.slice(0, 6).map((trip, i) => {
                const company = companyBySlug.get(trip.companyId) ?? getCompany(trip.companyId);
                const seat = seatAvailability(trip.availableSeats, trip.totalSeats);
                return (
                  <motion.div
                    key={trip._id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  >
                    <div className="h-full rounded-xl border bg-card p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: company?.color }}
                          />
                          <span className="truncate">{company?.name}</span>
                        </span>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${seat.badge}`}>
                          {seat.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-sm font-bold">
                        <span className="flex items-center gap-1 text-primary">
                          <MapPin className="size-4" />
                          {trip.from}
                        </span>
                        <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex items-center gap-1 text-emerald-600">
                          <MapPin className="size-4" />
                          {trip.to}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock3 className="size-3.5" />
                          انطلاق {trip.departureTime}
                          {trip.arrivalTime ? ` · وصول ≈ ${trip.arrivalTime}` : ""}
                        </span>
                        <span className="font-bold text-foreground">
                          {toArabicIndic(trip.price)}{" "}
                          <span className="font-medium text-muted-foreground">ريال</span>
                        </span>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${seat.bar}`}
                          style={{ width: `${seat.pct}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="mt-8 text-center">
            <Button asChild size="lg" className="gap-2">
              <Link to={bookingHref}>
                احجز مقعدك الآن
                <ArrowUpLeft className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Companies with prices + interactive filters */}
      <section id="companies" className="scroll-mt-20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 text-center">
            <Badge variant="outline" className="mb-3">
              الشركات والأسعار
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">
              قارن الشركات وأسعار رحلاتها قبل الحجز
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              اختر مدينتك لعرض رحلات كل شركة على خطك مع السعر للراكب وحالة
              المقاعد لحظياً — ثم انتقل للحجز
            </p>
          </div>

          {/* فلاتر المقارنة */}
          <div className="mx-auto mb-8 max-w-3xl rounded-2xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from" className="flex items-center gap-1 text-xs font-semibold">
                  <MapPin className="size-3.5 text-primary" />
                  مدينة الانطلاق
                </Label>
                <Select value={filterFrom} onValueChange={setFilterFrom} disabled={citiesLoading}>
                  <SelectTrigger id="filter-from" className="w-full">
                    <SelectValue placeholder={citiesLoading ? "جارٍ تحميل المدن…" : "كل المدن"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المدن (السعودية)</SelectItem>
                    {saudiCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                    {!citiesLoading && saudiCities.length === 0 ? (
                      <SelectItem value="__no-cities" disabled>
                        تعذر تحميل المدن
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-to" className="flex items-center gap-1 text-xs font-semibold">
                  <MapPin className="size-3.5 text-emerald-600" />
                  مدينة الوصول
                </Label>
                <Select value={filterTo} onValueChange={setFilterTo} disabled={citiesLoading}>
                  <SelectTrigger id="filter-to" className="w-full">
                    <SelectValue placeholder={citiesLoading ? "جارٍ تحميل المدن…" : "كل المدن"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المدن (اليمن)</SelectItem>
                    {yemenCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                    {!citiesLoading && yemenCities.length === 0 ? (
                      <SelectItem value="__no-cities" disabled>
                        تعذر تحميل المدن
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1.5 sm:w-auto"
                  onClick={resetFilters}
                  disabled={!hasActiveFilter}
                >
                  <RotateCcw className="size-3.5" />
                  إعادة تعيين
                </Button>
              </div>
            </div>
            {hasActiveFilter && filteredTrips.length > 0 ? (
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                تظهر الآن رحلات خط {filterFrom !== "all" ? `«${filterFrom}»` : "كل المدن"} ←{" "}
                {filterTo !== "all" ? `«${filterTo}»` : "كل المدن"} —{" "}
                {toArabicIndic(filteredTrips.length)} رحلة — مرتبة من الأقل سعراً
              </p>
            ) : null}
          </div>

          {companiesLoading ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border bg-card">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Route className="size-6" />
              </div>
              <p className="mt-3 text-sm font-bold">لا توجد رحلات على هذا الخط حالياً</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                جرّب تغيير مدينة الانطلاق أو الوصول — أو أعد التعيين لعرض جميع
                الرحلات المتاحة
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={resetFilters}
              >
                <RotateCcw className="size-3.5" />
                عرض كل الرحلات
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {companies.map((c, i) => {
                const companyTrips = filteredTrips.filter((t) => t.companyId === c.slug);
                const prices = companyTrips.map((t) => t.price);
                const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;
                return (
                  <motion.div
                    key={c.slug}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                  >
                    <div className={`h-full rounded-xl border bg-card p-5 ${companyTrips.length === 0 ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex size-11 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: c.color }}
                          >
                            <Bus className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-bold leading-snug">{c.name}</h3>
                            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                              المقر: {c.base ?? "—"}
                            </p>
                          </div>
                        </div>
                        {minPrice !== undefined ? (
                          <div className="text-left">
                            <p className="text-[10px] text-muted-foreground">يبدأ من</p>
                            <p className="text-xl font-extrabold leading-none text-primary">
                              {toArabicIndic(minPrice)}
                              <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                                ريال
                              </span>
                            </p>
                            {maxPrice !== undefined && maxPrice !== minPrice ? (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                حتى {toArabicIndic(maxPrice)} ريال
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <p className="mt-3 text-xs leading-5 text-muted-foreground">{c.routes ?? ""}</p>

                      {companyTrips.length > 0 ? (
                        <div className="mt-4 overflow-hidden rounded-lg border bg-muted/30">
                          {companyTrips.slice(0, 4).map((trip) => {
                            const seat = seatAvailability(trip.availableSeats, trip.totalSeats);
                            return (
                              <div
                                key={trip._id}
                                className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 text-xs last:border-0"
                              >
                                <span className="flex min-w-0 items-center gap-1.5 font-bold">
                                  <span className="truncate">{trip.from}</span>
                                  <ArrowLeft className="size-3 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-emerald-600">{trip.to}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                                  <Clock3 className="size-3" />
                                  {trip.departureTime}
                                </span>
                                <span className="shrink-0 font-extrabold text-foreground">
                                  {toArabicIndic(trip.price)}
                                  <span className="mr-0.5 text-[10px] font-medium text-muted-foreground">
                                    ريال
                                  </span>
                                </span>
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${seat.badge}`}
                                >
                                  {seat.label}
                                </span>
                              </div>
                            );
                          })}
                          {companyTrips.length > 4 ? (
                            <p className="border-t border-border/60 px-3 py-2 text-center text-[10px] text-muted-foreground">
                              + {toArabicIndic(companyTrips.length - 4)} رحلات أخرى في نموذج الحجز
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-lg border border-dashed bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
                          {hasActiveFilter
                            ? "لا توجد رحلات من هذه الشركة على الخط المختار"
                            : "لا توجد رحلات مدرجة حالياً"}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="mt-8 text-center">
            <Button asChild size="lg" className="gap-2">
              <Link to={bookingHref}>
                قارن واحجز رحلتك الآن
                <ArrowUpLeft className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-3">
              المميزات
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">
              كل ما تحتاجه لحجز رحلتك
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              صممنا النظام ليكون سريعاً وموثوقاً، فمن اختيار الرحلة حتى تأكيد
              الشركة لا يتطلب الأمر سوى ثلاث خطوات.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <div className="h-full rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular routes with lowest price */}
      <section id="routes" className="scroll-mt-20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-3">
              المسارات الشائعة
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">وجهات يكثر عليها السفر</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              الرحلات الأكثر طلباً بين المدن السعودية والمحافظات اليمنية مع أقل
              سعر متاح على كل مسار
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularRoutes.map((r, i) => {
              const routeTrips = (trips ?? []).filter(
                (t) => t.from === r.from && t.to === r.to,
              );
              const best = routeTrips.reduce<typeof routeTrips[number] | undefined>(
                (min, t) => (min === undefined || t.price < min.price ? t : min),
                undefined,
              );
              const bestCompany = best
                ? companyBySlug.get(best.companyId) ?? getCompany(best.companyId)
                : undefined;
              return (
                <motion.div
                  key={`${r.from}-${r.to}`}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="rounded-xl border bg-card p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      <MapPin className="size-4 text-primary" />
                      {r.from}
                    </span>
                    <ArrowLeft className="size-4 text-muted-foreground" />
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      <MapPin className="size-4 text-emerald-600" />
                      {r.to}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.companies.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  {best && bestCompany ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700">
                        <TrendingDown className="size-3.5" />
                        أقل سعر {toArabicIndic(best.price)} ريال
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700/80">
                        <Bus className="size-3" style={{ color: bestCompany.color }} />
                        {bestCompany.name}
                      </span>
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-3">
              كيف يعمل؟
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">ثلاث خطوات فقط</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative rounded-xl border bg-card p-6"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary text-base font-extrabold text-primary-foreground">
                  {s.num}
                </div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.25),transparent_60%)]" />
            <h2 className="relative text-3xl font-extrabold tracking-tight">
              جاهز لحجز مقعدك؟
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-6 text-primary-foreground/85">
              اختر رحلتك من المواعيد المتاحة، أدخل بياناتك، واحصل على حجز مؤكد
              خلال دقائق.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="relative mt-6 gap-2"
            >
              <Link to={bookingHref}>
                إنشاء حجز الآن
                <ArrowUpLeft className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bus className="size-3.5" />
            </div>
            <span className="font-bold text-foreground">خطوط زحل</span>
          </div>
          <p>ربط المسافرين بشركات النقل البري المعتمدة في السعودية © ٢٠٢٦</p>
        </div>
      </footer>
    </div>
  );
}
