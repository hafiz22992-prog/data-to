import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  Armchair,
  Banknote,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  IdCard,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Plane,
  Receipt,
  Route,
  ShieldAlert,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { toArabicIndic, todayInputValue } from "@/lib/arabic";
import { fareBreakdown } from "@/lib/fare";
import {
  AVAILABLE_PAYMENT_METHODS,
  CARD_METHODS,
  getCompany,
  PAYMENT_METHOD_DESCRIPTIONS,
  PAYMENT_METHOD_LABELS,
  seatAvailability,
} from "@/lib/transport";
import type { PaymentMethod } from "@/lib/transport";
import { useLocations } from "@/hooks/use-locations";

interface BookingFormProps {
  onSaved?: () => void;
  /** قيم أولية تمر من الصفحة الرئيسية (فلاتر المدينة المختارة). */
  initialFrom?: string;
  initialTo?: string;
  /** المالك/الشركة المشغلة فقط ترى توزيع العمولة — العميل يرى السعر الإجمالي. */
  showAccounting?: boolean;
}

interface BookingFormState {
  customerName: string;
  mobile: string;
  residencyNumber: string;
  borderNumber: string;
  passportNumber: string;
  departure: string;
  destination: string;
  companyId: string;
  tripId: string;
  travelDate: string;
  passengers: string;
  paymentMethod: PaymentMethod;
  /** الحساب البنكي الذي اختاره المسافر للتحويل (يُحفظ مع عملية الدفع). */
  bankAccountId: string;
  notes: string;
}

const emptyForm = (): BookingFormState => ({
  customerName: "",
  mobile: "",
  residencyNumber: "",
  borderNumber: "",
  passportNumber: "",
  departure: "",
  destination: "",
  companyId: "",
  tripId: "",
  travelDate: "",
  passengers: "1",
  paymentMethod: "on_arrival",
  bankAccountId: "",
  notes: "",
});

/** تنظيف رقم الجوال من الفراغات والرموز. */
function normalizeMobile(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

/** التحقق من صيغة الجوال السعودي (05xxxxxxxx أو +9665xxxxxxxx). */
function isValidSaudiMobile(value: string): boolean {
  return /^(\+?966|0)5\d{8}$/.test(normalizeMobile(value));
}

/** نسخ قيمة إلى الحافظة مع إشعار للمستخدم. */
async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`تم نسخ ${label}`);
  } catch {
    toast.error(`تعذر النسخ التلقائي — انسخ ${label} يدوياً`);
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/** بطاقة طريقة دفع — اختيارية إن كانت متاحة فعلاً، ومعطّلة إن تطلبت مزوداً خارجياً. */
function PaymentMethodCard({
  method,
  selected,
  disabled,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  disabled?: boolean;
  onSelect: (method: PaymentMethod) => void;
}) {
  const Icon =
    method === "on_arrival" ? Banknote : method === "bank_transfer" ? Landmark : CreditCard;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(method)}
      aria-pressed={selected}
      className={`relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-right transition-colors ${
        disabled
          ? "cursor-not-allowed border-border bg-muted/30 opacity-55"
          : selected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border bg-card hover:border-primary/50"
      }`}
    >
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-primary" : "border-muted-foreground/40"
        }`}
      >
        {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            {PAYMENT_METHOD_LABELS[method]}
          </span>
          {disabled ? (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="size-2.5" />
              غير مفعلة
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
          {PAYMENT_METHOD_DESCRIPTIONS[method]}
        </span>
      </span>
    </button>
  );
}

export function BookingForm({
  onSaved,
  initialFrom,
  initialTo,
  showAccounting = false,
}: BookingFormProps = {}) {
  const createBooking = useMutation(api.bookings.create);
  const initiatePayment = useMutation(api.payments.initiate);

  // حالة إعداد بوابة الدفع من الخادم (متغيرات البيئة) — البطاقات تظهر معطّلة
  // ما دامت البوابة غير مكوّنة فعلياً (لا يُدّعى نجاح وهمي بلا مفاتيح حقيقية).
  const gateway = useQuery(api.gateway.gatewayConfig);

  // مدن الانطلاق والوصول من قاعدة البيانات (PHASE 1.5) — بدلاً من ثوابت transport.ts
  const { saudiCities, yemenCities, isLoading: citiesLoading } = useLocations();

  // الشركات النشطة من Convex (PHASE 3) — مصدر الحقيقة في الواجهة، مع fallback
  // إلى transport.ts للتوافق مع أي شركة قديمة غير مخزنة في قاعدة البيانات.
  const activeCompanies = useQuery(api.companies.listActive);
  const companiesLoading = activeCompanies === undefined;
  const companyBySlug = useMemo(
    () => new Map((activeCompanies ?? []).map((c) => [c.slug, c])),
    [activeCompanies],
  );

  const [form, setForm] = useState<BookingFormState>(() => ({
    ...emptyForm(),
    departure: initialFrom ?? "",
    destination: initialTo ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // الرحلات المتاحة حسب (الانطلاق + الوصول + الشركة) — تُحدَّث لحظياً من Convex
  const showTrips = Boolean(form.departure && form.destination && form.companyId);
  const trips = useQuery(
    api.trips.list,
    showTrips
      ? {
          from: form.departure,
          to: form.destination,
          companyId: form.companyId,
        }
      : "skip",
  );

  const selectedTrip = trips?.find((t) => t._id === form.tripId);

  // الحسابات البنكية النشطة للمنصة — تُدار من المالك، ويظهر هنا الحسابات النشطة
  // فقط (مرتبة حسب displayOrder) ليختار المسافر حساب التحويل المباشر منها
  // (لا يكتب رقم الحساب يدوياً — تُجلب البيانات من قاعدة البيانات).
  const bankAccounts = useQuery(api.bankAccounts.list);
  const activeBankAccounts = (bankAccounts ?? []).filter((a) => a.active);

  const update = (field: keyof BookingFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // تغيير المسار أو الشركة يلغي الرحلة المختارة سابقاً
      if (field === "departure" || field === "destination" || field === "companyId") {
        next.tripId = "";
      }
      return next;
    });
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors: Record<string, string> = {};

    if (!form.customerName.trim()) fieldErrors.customerName = "أدخل اسم العميل";
    if (!form.mobile.trim()) fieldErrors.mobile = "أدخل رقم الجوال";
    else if (!isValidSaudiMobile(form.mobile))
      fieldErrors.mobile = "أدخل رقماً سعودياً صحيحاً (مثال: 0551234567)";
    if (form.passportNumber.trim().length < 4)
      fieldErrors.passportNumber = "أدخل رقم جواز السفر";
    if (!form.departure) fieldErrors.departure = "اختر وجهة الانطلاق";
    if (!form.destination) fieldErrors.destination = "اختر وجهة الوصول";
    if (!form.companyId) fieldErrors.companyId = "اختر شركة النقل";
    if (form.paymentMethod === "bank_transfer" && !form.bankAccountId) {
      fieldErrors.bankAccountId = "اختر الحساب البنكي للتحويل";
    }
    if (!selectedTrip) fieldErrors.tripId = "اختر رحلة من المواعيد المتاحة";
    if (!form.travelDate) fieldErrors.travelDate = "حدد تاريخ السفر";
    else if (form.travelDate < todayInputValue())
      fieldErrors.travelDate = "لا يمكن اختيار تاريخ في الماضي";
    const passengerCount = Number(form.passengers);
    if (!passengerCount || passengerCount < 1)
      fieldErrors.passengers = "حدد عدد الركاب (١ على الأقل)";
    else if (selectedTrip && passengerCount > selectedTrip.availableSeats)
      fieldErrors.passengers = `الحد الأقصى ${toArabicIndic(
        selectedTrip.availableSeats,
      )} مقاعد متاحة في هذه الرحلة`;

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("أكمل البيانات المطلوبة في النموذج");
      return;
    }

    const company = companyBySlug.get(form.companyId) ?? getCompany(form.companyId);
    setIsSaving(true);
    try {
      const bookingId = await createBooking({
        customerName: form.customerName.trim(),
        mobile: normalizeMobile(form.mobile),
        residencyNumber: form.residencyNumber.trim() || undefined,
        borderNumber: form.borderNumber.trim() || undefined,
        passportNumber: form.passportNumber.trim(),
        departure: form.departure,
        destination: form.destination,
        companyId: form.companyId,
        companyName: company?.name ?? form.companyId,
        travelDate: form.travelDate,
        passengers: passengerCount,
        tripId: selectedTrip?._id,
        departureTime: selectedTrip?.departureTime,
        price: selectedTrip?.price,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || undefined,
      });

      // التحويل البنكي (مسبق): بدء عملية دفع pending في الخادم مع الحساب البنكي
      // المختار — تُثبَّت النتيجة (paid/failed) من المالك/الشركة بعد المراجعة فقط.
      if (form.paymentMethod === "bank_transfer") {
        try {
          await initiatePayment({
            id: bookingId,
            method: "bank_transfer",
            idempotencyKey: `${bookingId}-${Date.now()}`,
            bankAccountId: form.bankAccountId as any,
          });
          toast.success(
            "تم إنشاء الحجز — حالة الدفع «بانتظار التحقق من التحويل البنكي»، حوّل المبلغ إلى الحساب المختار وارفع الإيصال من «حجوزاتي»",
          );
        } catch (paymentError) {
          console.error(paymentError);
          toast.warning(
            "تم إنشاء الحجز، لكن تعذر بدء عملية الدفع — يمكنك إعادة المحاولة من «حجوزاتي»",
          );
        }
      } else {
        toast.success("تم حجز المقاعد — تُدفع قيمة التذاكر عند الانطلاق في محطة الشركة");
      }
      setForm(emptyForm());
      setErrors({});
      onSaved?.();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "تعذر حفظ الحجز، حاول مرة أخرى",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCompany = form.companyId
    ? companyBySlug.get(form.companyId) ?? getCompany(form.companyId)
    : undefined;
  const passengerCount = Number(form.passengers) || 0;
  const split =
    selectedTrip && passengerCount > 0
      ? fareBreakdown(selectedTrip.price * passengerCount)
      : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bus className="size-4" />
            </span>
            حجز رحلة جديدة
          </CardTitle>
          <CardDescription>
            أدخل بيانات المسافر واختر الشركة والوجهة ثم رحلة من المواعيد المتاحة — تُحجز
            المقاعد فوراً وتُحفظ نسخة في «حجوزاتي» مع قيمة التذكرة وطريقة الدفع
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ===== بيانات المسافر ===== */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <User className="size-4 text-primary" />
              بيانات المسافر
            </h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName" className="flex items-center gap-1">
                  <User className="size-3.5 text-muted-foreground" />
                  اسم العميل
                </Label>
                <Input
                  id="customerName"
                  placeholder="الاسم الكامل"
                  value={form.customerName}
                  onChange={(e) => update("customerName", e.target.value)}
                />
                <FieldError message={errors.customerName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile" className="flex items-center gap-1">
                  <Phone className="size-3.5 text-muted-foreground" />
                  رقم الجوال
                </Label>
                <Input
                  id="mobile"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  inputMode="tel"
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                />
                <FieldError message={errors.mobile} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="residencyNumber" className="flex items-center gap-1">
                  <IdCard className="size-3.5 text-muted-foreground" />
                  رقم الإقامة (اختياري)
                </Label>
                <Input
                  id="residencyNumber"
                  dir="ltr"
                  placeholder="رقم الإقامة — اختياري"
                  inputMode="numeric"
                  value={form.residencyNumber}
                  onChange={(e) => update("residencyNumber", e.target.value)}
                />
                <FieldError message={errors.residencyNumber} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="borderNumber" className="flex items-center gap-1">
                  <IdCard className="size-3.5 text-muted-foreground" />
                  رقم الحدود (اختياري)
                </Label>
                <Input
                  id="borderNumber"
                  dir="ltr"
                  placeholder="رقم الحدود — اختياري"
                  inputMode="numeric"
                  value={form.borderNumber}
                  onChange={(e) => update("borderNumber", e.target.value)}
                />
                <FieldError message={errors.borderNumber} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passportNumber" className="flex items-center gap-1">
                  <Plane className="size-3.5 text-muted-foreground" />
                  رقم جواز السفر
                </Label>
                <Input
                  id="passportNumber"
                  dir="ltr"
                  placeholder="رقم جواز السفر"
                  value={form.passportNumber}
                  onChange={(e) => update("passportNumber", e.target.value)}
                />
                <FieldError message={errors.passportNumber} />
              </div>
            </div>
          </div>

          {/* ===== تفاصيل الرحلة ===== */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <MapPin className="size-4 text-primary" />
              تفاصيل الرحلة
            </h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departure" className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  وجهة الانطلاق
                </Label>
                <Select
                  value={form.departure}
                  onValueChange={(v) => update("departure", v)}
                  disabled={citiesLoading}
                >
                  <SelectTrigger id="departure" className="w-full">
                    <SelectValue
                      placeholder={citiesLoading ? "جارٍ تحميل المدن…" : "اختر المدينة (السعودية)"}
                    />
                  </SelectTrigger>
                  <SelectContent>
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
                <FieldError message={errors.departure} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  وجهة الوصول
                </Label>
                <Select
                  value={form.destination}
                  onValueChange={(v) => update("destination", v)}
                  disabled={citiesLoading}
                >
                  <SelectTrigger id="destination" className="w-full">
                    <SelectValue
                      placeholder={citiesLoading ? "جارٍ تحميل المدن…" : "اختر المدينة (اليمن)"}
                    />
                  </SelectTrigger>
                  <SelectContent>
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
                <FieldError message={errors.destination} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company" className="flex items-center gap-1">
                  <Bus className="size-3.5 text-muted-foreground" />
                  شركة النقل
                </Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) => update("companyId", v)}
                  disabled={companiesLoading}
                >
                  <SelectTrigger id="company" className="w-full">
                    <SelectValue
                      placeholder={companiesLoading ? "جارٍ تحميل الشركات…" : "اختر شركة النقل في السعودية"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(activeCompanies ?? []).map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.name}
                        {c.base ? ` — ${c.base}` : ""}
                      </SelectItem>
                    ))}
                    {!companiesLoading && (activeCompanies ?? []).length === 0 ? (
                      <SelectItem value="__no-companies" disabled>
                        لا توجد شركات متاحة حالياً
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {selectedCompany?.routes ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Bus className="size-3" style={{ color: selectedCompany.color }} />
                    {selectedCompany.routes}
                  </p>
                ) : null}
                <FieldError message={errors.companyId} />
              </div>
            </div>
          </div>

          {/* ===== اختيار الرحلة (المواعيد والمقاعد المتاحة) ===== */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Route className="size-4 text-primary" />
              اختر الرحلة
            </h3>

            {!showTrips ? (
              <p className="rounded-xl border border-dashed bg-muted/40 px-4 py-5 text-center text-xs leading-6 text-muted-foreground">
                اختر مدينة الانطلاق والوصول وشركة النقل أولاً لعرض مواعيد الرحلات
                والمقاعد المتاحة لحظياً
              </p>
            ) : trips === undefined ? (
              <div className="flex min-h-24 items-center justify-center rounded-xl border bg-muted/40">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : trips.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-muted/40 px-4 py-5 text-center text-xs leading-6 text-muted-foreground">
                لا توجد رحلات متاحة حالياً على هذا المسار مع الشركة المختارة — جرّب
                تغيير المدينة أو الشركة
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  المقاعد تُحدَّث لحظياً حسب الحجوزات — اختر موعد الانطلاق المناسب
                </p>
                {trips.map((trip) => {
                  const seat = seatAvailability(trip.availableSeats, trip.totalSeats);
                  const isSelected = form.tripId === trip._id;
                  const isFull = trip.availableSeats <= 0;
                  return (
                    <button
                      key={trip._id}
                      type="button"
                      disabled={isFull}
                      onClick={() => update("tripId", trip._id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : isFull
                            ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
                            : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
                          <Clock3 className="size-4 text-primary" />
                          {trip.departureTime}
                        </span>
                        {trip.arrivalTime ? (
                          <span className="text-[11px] text-muted-foreground">
                            وصول ≈ {trip.arrivalTime}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {trip.days.join("، ")}
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                          {toArabicIndic(trip.price)}{" "}
                          <span className="text-[11px] font-medium text-muted-foreground">
                            ريال / راكب
                          </span>
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${seat.badge}`}
                      >
                        {seat.label}
                      </span>
                    </button>
                  );
                })}
                <FieldError message={errors.tripId} />
              </div>
            )}
          </div>

          {/* ===== تاريخ السفر وعدد الركاب ===== */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="travelDate" className="flex items-center gap-1">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                تاريخ السفر
              </Label>
              <Input
                id="travelDate"
                type="date"
                min={todayInputValue()}
                value={form.travelDate}
                onChange={(e) => update("travelDate", e.target.value)}
              />
              <FieldError message={errors.travelDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passengers" className="flex items-center gap-1">
                <Users className="size-3.5 text-muted-foreground" />
                عدد الركاب
              </Label>
              <Input
                id="passengers"
                type="number"
                min={1}
                max={selectedTrip?.availableSeats ?? 45}
                value={form.passengers}
                onChange={(e) => update("passengers", e.target.value)}
              />
              {selectedTrip ? (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Armchair className="size-3" />
                  الحد الأقصى للحجز في هذه الرحلة:{" "}
                  {toArabicIndic(selectedTrip.availableSeats)} مقاعد
                </p>
              ) : null}
              <FieldError message={errors.passengers} />
            </div>
          </div>

          {/* ===== طريقة الدفع ===== */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Wallet className="size-4 text-primary" />
              طريقة الدفع
            </h3>

            {/* الدفع الإلكتروني — غير مفعل حتى تُربط بوابة دفع وتُضبط مفاتيحها */}
            <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3">
              <p className="flex items-start gap-2 text-xs leading-5 text-amber-800">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  {gateway?.configured ? (
                    <>
                      <strong>بوابة الدفع مكوّنة ({gateway.provider})</strong> — تُفعَّل طرق
                      البطاقات بعد ربط عملية الدفع الإلكتروني بالمزود. يمكنك حالياً الدفع
                      عند الانطلاق أو التحويل البنكي.
                    </>
                  ) : (
                    <>
                      <strong>الدفع الإلكتروني غير مفعل حالياً</strong> — سيتم تفعيله بعد
                      إعداد بوابة الدفع. يمكنك حالياً الدفع عند الانطلاق أو التحويل البنكي.
                    </>
                  )}
                </span>
              </p>
            </div>
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">الدفع الإلكتروني</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CARD_METHODS.map((card) => (
                <div
                  key={card.id}
                  className="flex cursor-not-allowed items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 opacity-55"
                  title={
                    gateway?.configured
                      ? "متاح بعد ربط الدفع الإلكتروني"
                      : "متاح بعد تفعيل بوابة الدفع"
                  }
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <CreditCard className="size-3.5" />
                    {card.label}
                  </span>
                  <Lock className="size-3 text-muted-foreground/60" />
                </div>
              ))}
            </div>

            <p className="mb-2 mt-4 text-[11px] font-bold text-muted-foreground">
              طرق الدفع الأخرى
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {AVAILABLE_PAYMENT_METHODS.map((method) => (
                <PaymentMethodCard
                  key={method}
                  method={method}
                  selected={form.paymentMethod === method}
                  onSelect={(m) => update("paymentMethod", m)}
                />
              ))}
            </div>

            {/* ===== التحويل البنكي — اختيار الحساب النشط للمنصة ===== */}
            {form.paymentMethod === "bank_transfer" ? (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Landmark className="size-4 text-primary" />
                  التحويل البنكي — اختر الحساب البنكي للتحويل
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  حوّل مبلغ الحجز إلى الحساب البنكي الموضح أدناه، ثم ارفع إيصال
                  التحويل من «حجوزاتي» لإتمام مراجعة الحجز. يُؤكد المالك أو شركة النقل
                  التحويل وتُصدر التذكرة. تُجلب بيانات الحساب من قاعدة البيانات — لا تكتب
                  رقم الحساب يدوياً.
                </p>

                {bankAccounts === undefined ? (
                  <div className="mt-3 flex min-h-20 items-center justify-center rounded-lg border bg-card">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : activeBankAccounts.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
                    لا توجد حسابات بنكية مفعّلة حالياً — يمكنك إكمال الحجز باختيار
                    طريقة دفع أخرى، أو سيتواصل معك المالك عند المراجعة.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {activeBankAccounts.map((account) => {
                      const isSelected = form.bankAccountId === account._id;
                      return (
                        <button
                          key={account._id}
                          type="button"
                          onClick={() =>
                            update("bankAccountId", isSelected ? "" : account._id)
                          }
                          aria-pressed={isSelected}
                          className={`relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-right transition-colors ${
                            isSelected
                              ? "border-primary bg-card ring-1 ring-primary"
                              : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                              isSelected ? "border-primary" : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-foreground">
                                {account.bankName}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                المستفيد: {account.beneficiaryName}
                              </span>
                            </span>
                            <span className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                              {account.accountNumber ? (
                                <span className="flex items-center gap-1.5">
                                  رقم الحساب:{" "}
                                  <span className="font-mono font-bold text-foreground" dir="ltr">
                                    {account.accountNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyText(account.accountNumber!, "رقم الحساب");
                                    }}
                                    className="rounded-md border bg-muted p-1 text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label="نسخ رقم الحساب"
                                  >
                                    <Copy className="size-3" />
                                  </button>
                                </span>
                              ) : null}
                              {account.iban ? (
                                <span className="flex items-center gap-1.5">
                                  IBAN:{" "}
                                  <span className="font-mono font-bold text-foreground" dir="ltr">
                                    {account.iban}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyText(account.iban!, "الآيبان");
                                    }}
                                    className="rounded-md border bg-muted p-1 text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label="نسخ الآيبان"
                                  >
                                    <Copy className="size-3" />
                                  </button>
                                </span>
                              ) : null}
                            </span>
                            {account.description ? (
                              <span className="mt-1.5 block text-[11px] leading-5 text-muted-foreground">
                                {account.description}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                    <FieldError message={errors.bankAccountId} />
                  </div>
                )}

                {/* المبلغ المطلوب — يُشتق من سعر الرحلة في الخادم ولا يمكن تعديله */}
                {split !== undefined ? (
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-card px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Receipt className="size-4 text-primary" />
                      المبلغ المطلوب تحويله (يُؤكده النظام خادمياً)
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className="text-lg font-extrabold text-foreground">
                        {toArabicIndic(split.fare)}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">ريال سعودي</span>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              {form.paymentMethod === "bank_transfer"
                ? "تُدفع قيمة التذاكر مسبقاً عبر تحويل بنكي — تبدأ عملية دفع «بانتظار التحقق»، ويؤكدها المالك أو شركة النقل بعد مراجعة الإيصال/المرجع، وتُحتسب محصلة فور التأكيد"
                : "يدفع المسافر القيمة عند الانطلاق في محطة الشركة — يبقى الحجز «غير مدفوع» حتى التحصيل"}
            </p>
          </div>

          {/* ===== القيمة المتوقعة ===== */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Receipt className="size-4 text-primary" />
              القيمة المتوقعة
            </h3>
            {split !== undefined ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-medium text-muted-foreground">قيمة الحجز المتوقعة</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-foreground">
                    {toArabicIndic(split.fare)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">ريال سعودي</span>
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Receipt className="size-3" />
                    {toArabicIndic(selectedTrip?.price ?? 0)} ريال ×{" "}
                    {toArabicIndic(passengerCount)}{" "}
                    {passengerCount > 1 ? "ركاب" : "راكب"}
                  </span>
                  {showAccounting ? (
                    <>
                      <span>حصة الشركة: {toArabicIndic(split.companyShare)} ريال (80%)</span>
                      <span>
                        عمولة التطبيق: {toArabicIndic(split.appShare)} ريال (20%) + ضريبة{" "}
                        {toArabicIndic(split.vat)}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground">
                {showAccounting
                  ? "اختر الرحلة وحدّد عدد الركاب لعرض القيمة الإجمالية وتوزيعها (حصة الشركة 80% وعمولة التطبيق 20%)"
                  : "اختر الرحلة وحدّد عدد الركاب لعرض القيمة الإجمالية للتذكرة"}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1">
              <span className="size-3.5" />
              ملاحظات إضافية (اختياري)
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="أي تفاصيل إضافية للشركة (مثل: حمل أمتعة إضافية، نقطة انطلاق محددة...)"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-5 text-muted-foreground">
              بإرسال الحجز توافق على مشاركة بياناتك مع شركة النقل المختارة لتأكيد المقعد،
              ويمكنك إلغاء الحجز في أي وقت من قائمة «حجوزاتي» — وعند الإلغاء تُعاد
              المقاعد المتاحة للرحلة.
            </p>
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2 sm:w-auto"
              disabled={isSaving || citiesLoading || companiesLoading}
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ حجز المقاعد...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  تأكيد الحجز
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
