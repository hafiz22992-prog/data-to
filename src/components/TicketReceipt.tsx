import type { Doc } from "@/convex/_generated/dataModel";
import { QRCodeSVG } from "qrcode.react";
import { Phone, Bus, MapPin } from "lucide-react";
import { formatDateDDMMYYYY, toArabicIndic } from "@/lib/arabic";
import {
  BOOKING_STATUS_LABELS,
  getCompany,
  PAYMENT_STATUS_LABELS,
} from "@/lib/transport";
import type { PaymentStatus } from "@/lib/transport";

type BookingRow = Doc<"busBookings">;
type CompanyRow = Doc<"companies">;
interface SaturnPhoneItem { number: string; label?: string; active: boolean; }

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-1.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-[11px] font-bold text-slate-900">{value}</span>
    </div>
  );
}

export function TicketReceipt({
  booking,
  companyBySlug,
  saturnPhones,
}: {
  booking: BookingRow;
  showAccounting: boolean;
  companyBySlug: Map<string, CompanyRow>;
  saturnPhones?: SaturnPhoneItem[];
}) {
  const company = companyBySlug.get(booking.companyId) ?? getCompany(booking.companyId);
  const fare = booking.fareAmount ?? (booking.price ?? 0) * booking.passengers;
  const paymentStatus: PaymentStatus = booking.paymentStatus ?? "unpaid";
  const statusLabel = BOOKING_STATUS_LABELS[booking.status];
  const activePhones = saturnPhones?.filter((p) => p.active) ?? [];
  const mapUrl = company && "mapUrl" in company ? (company as CompanyRow).mapUrl || "" : "";

  return (
    <div
      dir="rtl"
      className="ticket-container mx-auto overflow-hidden bg-white text-slate-900"
      style={{
        width: 960,
        height: 540,
        fontFamily: "'Tajawal', sans-serif",
        borderRadius: 0,
      }}
    >
      {/* ===== HEADER ===== */}
      <div
        className="flex items-center justify-between px-6 py-2.5"
        style={{ background: "linear-gradient(135deg, #0f2355 0%, #1a3a7a 100%)" }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="المنصة" className="size-8 rounded-md bg-white/15 p-0.5" />
          <img src="/saturn-lines-logo.svg" alt="خطوط زحل" className="size-9 rounded-md" />
          <div>
            <p className="text-sm font-extrabold text-white leading-tight">خطوط زحل</p>
            <p className="text-[9px] text-white/50">Saturn Lines — حجوزات النقل البري</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[10px] font-bold text-white/70">التذكرة الإلكترونية</p>
            <p className="font-mono text-[11px] font-extrabold text-white mt-0.5" dir="ltr">
              {booking.bookingNo}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-300">مؤكدة</span>
          </div>
        </div>
      </div>

      {/* ===== ROUTE STRIP ===== */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-2">
        <div className="flex items-center gap-2">
          <MapPin className="size-3.5 text-[#0f2355]" />
          <span className="text-sm font-extrabold text-slate-800">{booking.departure}</span>
        </div>
        <div className="flex flex-1 items-center gap-2 px-4">
          <div className="h-[1.5px] flex-1 bg-slate-300" />
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0f2355] text-white">
            <Bus className="size-3" />
          </div>
          {booking.departureTime ? (
            <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
              انطلاق {booking.departureTime}
            </span>
          ) : null}
          <div className="h-[1.5px] flex-1 bg-slate-300" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-slate-800">{booking.destination}</span>
          <MapPin className="size-3.5 text-emerald-600" />
        </div>
      </div>

      {/* ===== THREE COLUMNS ===== */}
      <div className="flex" style={{ height: 540 - 92 }}>
        {/* Column 1 (Right) — Passenger Data */}
        <div className="flex-1 border-l border-slate-200 px-5 py-4" style={{ minWidth: 280 }}>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0f2355]">
            <span className="size-1.5 rounded-full bg-[#0f2355]" />
            بيانات المسافر
          </h3>
          <div>
            <TRow label="اسم المسافر" value={booking.customerName} />
            <TRow label="رقم الجوال" value={booking.mobile} />
            <TRow label="رقم الحجز" value={booking.bookingNo} />
            <TRow label="تاريخ السفر" value={toArabicIndic(formatDateDDMMYYYY(booking.travelDate))} />
            <TRow label="وقت المغادرة" value={booking.departureTime ?? "—"} />
            <TRow label="مدينة الانطلاق" value={booking.departure} />
            <TRow label="مدينة الوصول" value={booking.destination} />
            <TRow
              label="عدد الركاب"
              value={`${toArabicIndic(booking.passengers)} ${booking.passengers > 1 ? "ركاب" : "راكب"}`}
            />
            <TRow label="حالة الحجز" value={statusLabel} />
          </div>

          {/* Payment info — total only, no financial breakdown */}
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">الإجمالي</span>
              <span className="text-sm font-extrabold text-[#0f2355]">{toArabicIndic(fare)} ريال</span>
            </div>
            <div className="flex items-center justify-between mt-1 border-t border-slate-200 pt-1">
              <span className="text-[10px] text-slate-500">طريقة الدفع</span>
              <span className="text-[10px] font-bold text-slate-700">
                {booking.paymentMethod === "bank_transfer" ? "تحويل بنكي" : "عند الانطلاق"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-500">حالة الدفع</span>
              <span className="text-[10px] font-bold text-slate-700">{PAYMENT_STATUS_LABELS[paymentStatus]}</span>
            </div>
          </div>
        </div>

        {/* Column 2 (Center) — Company Info + Phones */}
        <div className="flex-1 border-l border-slate-200 px-5 py-4" style={{ minWidth: 280 }}>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0f2355]">
            <span className="size-1.5 rounded-full bg-[#0f2355]" />
            بيانات شركة النقل
          </h3>

          {/* Company + Saturn branding */}
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 mb-3">
            {"logo" in (company ?? {}) && (company as CompanyRow).logo ? (
              <img src={(company as CompanyRow).logo} alt={booking.companyName} className="size-9 rounded-md object-contain" />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-md bg-slate-200">
                <Bus className="size-4 text-slate-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400">شركة النقل</p>
              <p className="text-xs font-bold text-slate-800 truncate">{booking.companyName}</p>
            </div>
            <img src="/saturn-lines-logo.svg" alt="خطوط زحل" className="size-7" />
          </div>

          {/* Saturn Lines contact phones */}
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0f2355]">
            <Phone className="size-3" />
            للتواصل مع خطوط زحل
          </h3>
          {activePhones.length > 0 ? (
            <div className="space-y-1.5">
              {activePhones.map((p) => (
                <a
                  key={p.number}
                  href={`tel:${p.number}`}
                  className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-3 py-1.5 text-slate-700 no-underline hover:bg-slate-50"
                  dir="ltr"
                >
                  <Phone className="size-3 shrink-0 text-[#0f2355]" />
                  <span className="font-mono text-[11px] font-bold" dir="ltr">{p.number}</span>
                  {p.label ? (
                    <span className="mr-auto text-[9px] text-slate-400">{p.label}</span>
                  ) : null}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400">لا توجد أرقام متاحة</p>
          )}

          {/* Travel note */}
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[9px] font-bold text-amber-800">⚠ ملاحظة للمسافر</p>
            <p className="text-[8px] leading-4 text-amber-700 mt-0.5">
              يُرجى الحضور قبل موعد المغادرة بساعة على الأقل. قد يؤدي التأخر إلى فقدان حق السفر.
            </p>
          </div>
        </div>

        {/* Column 3 (Left) — QR Codes */}
        <div className="flex flex-col items-center justify-center px-5 py-4 bg-slate-50" style={{ minWidth: 200, maxWidth: 220 }}>
          {/* Ticket Verification QR */}
          <p className="text-[9px] font-bold text-slate-500 mb-1.5">التحقق من التذكرة</p>
          <div className="flex size-[100px] items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
            <QRCodeSVG
              value={`https://saturn-lines.com/verify/${booking.bookingNo}`}
              size={80}
              bgColor="#ffffff"
              fgColor="#0f2355"
              level="M"
            />
          </div>
          <p className="text-center text-[7px] text-slate-400 mt-1 leading-3">
            امسح الرمز للتحقق
            <br />
            من صحة التذكرة
          </p>

          <div className="my-2 h-px w-full bg-slate-200" />

          {/* Google Maps QR */}
          <p className="text-[9px] font-bold text-slate-500 mb-1.5">موقع الشركة</p>
          {mapUrl ? (
            <>
              <div className="flex size-[80px] items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5">
                <QRCodeSVG
                  value={mapUrl}
                  size={64}
                  bgColor="#ffffff"
                  fgColor="#0f2355"
                  level="M"
                />
              </div>
              <p className="text-center text-[7px] text-slate-400 mt-1 leading-3">
                امسح الرمز للوصول
                <br />
                إلى موقع الشركة
              </p>
            </>
          ) : (
            <p className="text-[8px] text-slate-400 text-center">غير متوفر</p>
          )}

          <div className="mt-auto pt-2 text-center">
            <img src="/saturn-lines-logo.svg" alt="خطوط زحل" className="size-6 mx-auto mb-0.5 opacity-60" />
            <p className="text-[7px] text-slate-400">Saturn Lines — خطوط زحل</p>
          </div>
        </div>
      </div>
    </div>
  );
}
