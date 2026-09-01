import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { BookingForm } from "@/components/BookingForm";
import { BookingsList } from "@/components/BookingsList";
import { useLocations } from "@/hooks/use-locations";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { toArabicIndic } from "@/lib/arabic";
import {
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  Search,
  Ticket,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

/**
 * واجهة المسافر (Customer Home) — البحث والحجز والسفر.
 * تعمل بدون مصادقة للضيوف (Guest) وللمستخدمين المسجلين (Passenger).
 * الضيف يستطيع تصفح النموذج والحجز، لكن لا يستطيع إنشاء حجز فعلي بدون مصادقة.
 */
export default function CustomerHome() {
  const { user, signOut } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { saudiCities, yemenCities, isLoading: citiesLoading } = useLocations();
  const bookings = useQuery(api.bookings.list);
  const [quickFrom, setQuickFrom] = useState(searchParams.get("from") ?? "");
  const [quickTo, setQuickTo] = useState(searchParams.get("to") ?? "");
  const [quickDate, setQuickDate] = useState("");

  const displayName = user?.name || user?.email || "ضيف";
  const initialFrom = searchParams.get("from") ?? undefined;
  const initialTo = searchParams.get("to") ?? undefined;

  const confirmedCount = useMemo(
    () => (bookings ?? []).filter((b) => b.status === "confirmed").length,
    [bookings],
  );

  const handleQuickSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (quickFrom) params.set("from", quickFrom);
    if (quickTo) params.set("to", quickTo);
    const query = params.toString();
    navigate(query ? `/customer?${query}` : "/customer", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const selectClass =
    "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2 cursor-pointer";

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Bus className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">خطوط زحل</p>
              <p className="text-xs text-muted-foreground">حجوزات النقل البري من السعودية إلى اليمن</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{isAuthenticated ? "مسافر" : "ضيف"}</p>
            </div>
            {isAuthenticated ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleSignOut}>
                <LogOut className="size-4" />
                خروج
              </Button>
            ) : (
              <Button asChild type="button" variant="outline" size="sm" className="gap-1.5">
                <Link to="/auth">
                  <User className="size-4" />
                  تسجيل الدخول
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero / search */}
        <section className="relative overflow-hidden rounded-2xl border bg-card px-6 py-10 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(30,64,175,0.14),transparent_55%)]" />
          <div className="relative">
            <Badge variant="secondary" className="mb-3 gap-1.5">
              <Search className="size-3.5" />
              ابحث عن رحلتك
            </Badge>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              أين تسافر اليوم؟
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              اختر مدينتك وشركة النقل والرحلة — تُحجز المقاعد فوراً وتتابع حالة
              حجزك وتطبع تذكرتك من «حجوزاتي».
            </p>

            <form
              onSubmit={handleQuickSearch}
              className="mx-auto mt-6 grid max-w-3xl gap-3 rounded-2xl border bg-background/70 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div className="space-y-1.5 text-right">
                <label htmlFor="qs-from" className="flex items-center gap-1 text-xs font-semibold">
                  <MapPin className="size-3.5 text-primary" />
                  من (السعودية)
                </label>
                <select
                  id="qs-from"
                  value={quickFrom}
                  onChange={(e) => setQuickFrom(e.target.value)}
                  disabled={citiesLoading}
                  className={selectClass}
                >
                  <option value="">كل المدن</option>
                  {saudiCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 text-right">
                <label htmlFor="qs-to" className="flex items-center gap-1 text-xs font-semibold">
                  <MapPin className="size-3.5 text-emerald-600" />
                  إلى (اليمن)
                </label>
                <select
                  id="qs-to"
                  value={quickTo}
                  onChange={(e) => setQuickTo(e.target.value)}
                  disabled={citiesLoading}
                  className={selectClass}
                >
                  <option value="">كل المدن</option>
                  {yemenCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 text-right">
                <label htmlFor="qs-date" className="flex items-center gap-1 text-xs font-semibold">
                  <CalendarDays className="size-3.5 text-primary" />
                  تاريخ السفر
                </label>
                <input
                  id="qs-date"
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" size="lg" className="w-full gap-1.5 sm:w-auto">
                  <Search className="size-4" />
                  ابحث
                </Button>
              </div>
            </form>
            <p className="mt-3 text-[11px] text-muted-foreground">
              تاريخ السفر يُملأ في نموذج الحجز أدناه بعد اختيار الرحلة — يظهر هنا
              لضبط وجهتك قبل البدء
            </p>
          </div>
        </section>

        {/* Profile strip */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{displayName}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {user?.email ?? "ضيف"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isAuthenticated && (
              <>
                <span className="flex items-center gap-1.5">
                  <Ticket className="size-4 text-primary" />
                  {bookings === undefined ? "…" : toArabicIndic(bookings.length)} حجز
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  {toArabicIndic(confirmedCount)} مؤكد
                </span>
              </>
            )}
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/">
                <Bus className="size-4" />
                الصفحة الرئيسية
              </Link>
            </Button>
          </div>
        </section>

        {/* Booking form */}
        <section id="booking" className="mt-8 scroll-mt-24">
          <BookingForm initialFrom={initialFrom} initialTo={initialTo} />
        </section>

        {/* My bookings — authenticated users only */}
        {isAuthenticated ? (
          <section id="my-bookings" className="mt-12 scroll-mt-24">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock3 className="size-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">حجوزاتي</h2>
                <p className="text-xs text-muted-foreground">
                  تُحدَّث القائمة تلقائياً بعد كل حجز — أكّد أو ألغِ أي حجز بنقرة
                  واحدة، واطبع التذكرة أو احفظها PDF
                </p>
              </div>
            </div>
            <BookingsList />
          </section>
        ) : (
          <section id="login-prompt" className="mt-12 scroll-mt-24">
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold">سجّل الدخول لحفظ حجوزاتك</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                بأمكانك حجز رحلة الآن، وستظهر حجوزاتك هنا بعد تسجيل الدخول
              </p>
              <Button asChild className="mt-4 gap-2">
                <Link to="/auth">
                  تسجيل الدخول
                  <Clock3 className="size-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted-foreground">
        <p>خطوط زحل — ربط المسافرين بشركات النقل البري المعتمدة في السعودية © ٢٠٢٦</p>
      </footer>
    </div>
  );
}
