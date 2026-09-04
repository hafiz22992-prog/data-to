import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { BookingForm } from "@/components/BookingForm";
import { BookingsList } from "@/components/BookingsList";
import { useLocations } from "@/hooks/use-locations";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { toArabicIndic } from "@/lib/arabic";
import { Bus, CalendarDays, CheckCircle2, Clock3, LogOut, MapPin, Search, ShieldCheck, Ticket, User, Headphones, Armchair, Tag, WalletCards, ChevronLeft, Mail, Phone, } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

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
  const confirmedCount = useMemo(() => (bookings ?? []).filter((b) => b.status === "confirmed").length, [bookings]);

  const handleQuickSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (quickFrom) params.set("from", quickFrom);
    if (quickTo) params.set("to", quickTo);
    const query = params.toString();
    navigate(query ? `/customer?${query}` : "/customer", { replace: true });
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };
  const selectClass = "h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none ring-ring transition focus:ring-2 cursor-pointer";

  return (
    <div dir="rtl" className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/customer" className="flex items-center gap-3">
            <img src="/saturn-lines-logo.svg" alt="خطوط زحل" className="h-12 w-auto" />
            <div className="hidden sm:block border-r pr-3">
              <p className="text-sm font-bold text-slate-900">خطوط زحل</p>
              <p className="text-xs text-slate-500">حجوزات النقل البري من السعودية إلى اليمن</p>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-700">
            <Link to="/customer" className="text-[#0b2b55] font-bold">الصفحة الرئيسية</Link>
            <a href="#booking" className="hover:text-[#0b2b55]">الحجز</a>
            <a href="#popular" className="hover:text-[#0b2b55]">الرحلات</a>
            <a href="#companies" className="hover:text-[#0b2b55]">شركات النقل</a>
            <a href="#footer" className="hover:text-[#0b2b55]">تواصل معنا</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-left">
              <p className="text-sm font-bold">{displayName}</p>
              <p className="text-xs text-slate-500">{isAuthenticated ? "مسافر" : "ضيف"}</p>
            </div>
            {isAuthenticated ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleSignOut}><LogOut className="size-4" />خروج</Button>
            ) : (
              <Button asChild size="sm" className="gap-1.5 bg-[#0b2b55] hover:bg-[#123d72]"><Link to="/auth"><User className="size-4" />تسجيل الدخول</Link></Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden min-h-[570px] bg-[#071a3a]">
          <img src="/customer-hero.svg" alt="طريق وحافلة خطوط زحل" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#071a3a]/20 via-transparent to-[#071a3a]/20" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mr-auto max-w-3xl text-center lg:mr-0 lg:text-right lg:pr-8">
              <Badge className="mb-5 gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-white backdrop-blur"><ShieldCheck className="size-4" />منصة موثوقة وآمنة</Badge>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">رحلتك تبدأ من <span className="text-[#e5b34f]">هنا</span></h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/90 lg:mx-0 sm:text-lg">اختر مدينتك وشركة النقل والرحلة — احجز المقاعد فوراً وتابع حالة حجزك وتذكرتك من «حجوزاتي».</p>
            </div>

            <form onSubmit={handleQuickSearch} className="relative mx-auto mt-12 max-w-6xl rounded-3xl border border-white/30 bg-white p-4 shadow-2xl sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="space-y-2 text-right"><label htmlFor="qs-from" className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="size-4 text-[#0b2b55]" />من (السعودية)</label><select id="qs-from" value={quickFrom} onChange={(e) => setQuickFrom(e.target.value)} disabled={citiesLoading} className={selectClass}><option value="">كل المدن</option>{saudiCities.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="space-y-2 text-right"><label htmlFor="qs-to" className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="size-4 text-emerald-600" />إلى (اليمن)</label><select id="qs-to" value={quickTo} onChange={(e) => setQuickTo(e.target.value)} disabled={citiesLoading} className={selectClass}><option value="">كل المدن</option>{yemenCities.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="space-y-2 text-right"><label htmlFor="qs-date" className="flex items-center gap-1.5 text-sm font-bold"><CalendarDays className="size-4 text-[#0b2b55]" />تاريخ السفر</label><input id="qs-date" type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} className="h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none ring-ring transition focus:ring-2" /></div>
                <div className="flex items-end"><Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-xl bg-[#d9a441] px-8 text-base font-bold text-[#071a3a] hover:bg-[#c89532] lg:w-auto"><Search className="size-5" />ابحث عن الرحلات</Button></div>
              </div>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-[#d9a441]" />تاريخ السفر يُملأ في نموذج الحجز بعد اختيار الرحلة — استخدم البحث لتحديد وجهتك أولاً</p>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
          <div className="grid rounded-2xl border bg-white shadow-sm md:grid-cols-4">
            {[[ShieldCheck,"شركات معتمدة","شركات نقل بري موثوقة ومعتمدة"],[Armchair,"حجز فوري","احجز مقعدك الآن وتأكيد فوري"],[Tag,"أسعار تنافسية","قارن الأسعار واختر الأنسب لك"],[Headphones,"دعم على مدار الساعة","فريق دعم جاهز لمساعدتك 24/7"]].map(([Icon,title,desc],i) => { const I=Icon as typeof ShieldCheck; return <div key={i} className="flex items-center gap-4 border-b p-5 last:border-0 md:border-b-0 md:border-l md:last:border-l-0"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0b2b55]/5 text-[#0b2b55]"><I className="size-6" /></div><div><p className="font-bold text-[#0b2b55]">{title as string}</p><p className="mt-1 text-xs leading-5 text-slate-500">{desc as string}</p></div></div>; })}
          </div>
        </section>

        <section id="companies" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-[#0b2b55]">شركات النقل المعتمدة</h2><span className="text-sm text-slate-500">شركاؤنا المستقلون في النقل البري</span></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {['المتصدر','السريع','البركة','رواد الأفضل','النخبة','الرحاب','البراق','الاتحاد','أبو سرهد'].map((name)=><div key={name} className="flex min-h-24 items-center justify-center rounded-2xl border bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"><div><div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-[#0b2b55]/5 text-[#0b2b55]"><Bus className="size-5" /></div><p className="font-bold text-[#0b2b55]">{name}</p><p className="mt-1 text-[11px] text-slate-500">شركة نقل مستقلة</p></div></div>)}
          </div>
        </section>

        <section id="popular" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-[#0b2b55]">رحلات شائعة</h2><a href="#booking" className="flex items-center gap-1 text-sm font-bold text-[#0b2b55]">عرض جميع الرحلات <ChevronLeft className="size-4" /></a></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[['جدة','عدن','230','19 ساعة'],['الرياض','عدن','260','19 ساعة'],['جدة','صنعاء','280','16 ساعة'],['الرياض','صنعاء','250','17 ساعة']].map(([from,to,price,time])=><div key={from+to} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex h-28 items-center justify-center bg-gradient-to-br from-[#0b2b55] to-[#315b82] text-white"><Bus className="size-12 opacity-90" /></div><div className="p-4"><div className="flex items-center justify-between text-sm font-bold"><span>{from}</span><span className="text-[#d39b32]">⇄</span><span>{to}</span></div><div className="mt-3 flex items-end justify-between"><div><p className="text-xs text-slate-500">ابتداءً من</p><p className="text-2xl font-black text-[#d39b32]">{price} <span className="text-sm">ريال</span></p></div><div className="flex items-center gap-1 text-xs text-slate-500"><Clock3 className="size-3.5" />{time}</div></div><Button asChild variant="outline" className="mt-4 w-full rounded-xl border-[#0b2b55]/20 text-[#0b2b55]"><a href="#booking">عرض الرحلات</a></Button></div></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><div className="grid overflow-hidden rounded-3xl bg-[#071a3a] text-white sm:grid-cols-4">{[[Search,'اختر رحلتك','اختر من بين الرحلات المتاحة يومياً'],[WalletCards,'احجز بسهولة','أدخل بياناتك واحجز مقعدك في دقائق'],[CheckCircle2,'تأكيد فوري','تصلك تفاصيل تذكرتك مباشرة'],[ShieldCheck,'سافر بثقة','استمتع برحلتك مع شركات النقل المعتمدة']].map(([Icon,title,desc],i)=>{const I=Icon as typeof Search;return <div key={i} className="flex items-center gap-4 border-b border-white/15 p-6 last:border-0 sm:border-b-0 sm:border-l sm:last:border-l-0"><I className="size-10 shrink-0 text-[#e5b34f]"/><div><p className="font-bold text-[#e5b34f]">{title as string}</p><p className="mt-1 text-xs leading-5 text-white/75">{desc as string}</p></div></div>})}</div></section>

        <section id="booking" className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><div className="mb-5"><h2 className="text-2xl font-black text-[#0b2b55]">حجز رحلة جديدة</h2><p className="mt-1 text-sm text-slate-500">أدخل بيانات المسافر واختر الشركة والوجهة ثم الرحلة من المواعيد المتاحة.</p></div><BookingForm initialFrom={initialFrom} initialTo={initialTo} /></section>

        {isAuthenticated ? <section id="my-bookings" className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><div className="mb-5 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#0b2b55]/5 text-[#0b2b55]"><Ticket className="size-5" /></div><div><h2 className="text-2xl font-black text-[#0b2b55]">حجوزاتي</h2><p className="text-sm text-slate-500">تُحدَّث القائمة تلقائياً — يمكنك متابعة الحجز وطباعة التذكرة أو حفظها PDF.</p></div></div><BookingsList /></section> : <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><div className="rounded-3xl border border-dashed bg-slate-50 p-10 text-center"><User className="mx-auto size-10 text-[#0b2b55]"/><h2 className="mt-4 text-xl font-black text-[#0b2b55]">سجّل الدخول لحفظ حجوزاتك</h2><p className="mt-2 text-sm text-slate-500">بإمكانك تصفح الرحلات الآن، وتظهر حجوزاتك هنا بعد تسجيل الدخول.</p><Button asChild className="mt-5 rounded-xl bg-[#0b2b55] hover:bg-[#123d72]"><Link to="/auth">تسجيل الدخول</Link></Button></div></section>}
      </main>

      <footer id="footer" className="mt-8 bg-[#071a3a] text-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="grid gap-10 md:grid-cols-4"><div><img src="/saturn-lines-logo.svg" alt="خطوط زحل" className="mb-4 h-14 w-auto brightness-0 invert"/><p className="text-sm leading-7 text-white/70">منصة تجمع المسافرين بشركات النقل البري المستقلة والمعتمدة للرحلات بين السعودية واليمن.</p></div><div><h3 className="font-bold text-[#e5b34f]">روابط مهمة</h3><div className="mt-4 space-y-3 text-sm text-white/75"><a className="block hover:text-white" href="#booking">حجز رحلة</a><a className="block hover:text-white" href="#popular">الرحلات</a><a className="block hover:text-white" href="#companies">شركات النقل</a><a className="block hover:text-white" href="#my-bookings">حجوزاتي</a></div></div><div><h3 className="font-bold text-[#e5b34f]">خدمة العملاء</h3><div className="mt-4 space-y-3 text-sm text-white/75"><p className="flex items-center gap-2"><Mail className="size-4 text-[#e5b34f]"/>satrunlines@outlook.sa</p><p className="flex items-center gap-2"><Phone className="size-4 text-[#e5b34f]"/>تواصل معنا عبر أرقام المنصة</p><p className="flex items-center gap-2"><Headphones className="size-4 text-[#e5b34f]"/>دعم على مدار الساعة</p></div></div><div><h3 className="font-bold text-[#e5b34f]">طرق الدفع المتاحة</h3><p className="mt-4 text-sm leading-6 text-white/70">الدفع الإلكتروني سيُفعّل بعد إعداد بوابة الدفع، ويتوفر حالياً الدفع عند الانطلاق أو التحويل البنكي وفق إعدادات الشركة.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-lg border border-white/15 px-3 py-2 text-xs">Visa</span><span className="rounded-lg border border-white/15 px-3 py-2 text-xs">Mastercard</span><span className="rounded-lg border border-white/15 px-3 py-2 text-xs">مدى</span><span className="rounded-lg border border-white/15 px-3 py-2 text-xs">Apple Pay</span></div></div></div><div className="mt-10 border-t border-white/15 pt-5 text-center text-xs text-white/55">خطوط زحل — ربط المسافرين بشركات النقل البري المعتمدة في السعودية © ٢٠٢٦ · جميع الحقوق محفوظة</div></div></footer>
    </div>
  );
}
