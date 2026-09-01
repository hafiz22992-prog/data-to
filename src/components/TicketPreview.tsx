import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Phone,
  QrCode,
} from "lucide-react";

/**
 * معاينة التذكرة الإلكترونية — نموذج مرجعي يعرض شكل التذكرة النهائية
 * التي يراها المسافر عند الحجز + عند الطباعة/حفظ PDF.
 *
 * يُعرض داخل Owner Dashboard كمرجع تصميمي يمكن للمالك معاينته.
 */
export function TicketPreview() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* بطاقة المعاينة */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        style={{ direction: "rtl" }}
      >
        {/* ===== التذكرة الرئيسية — 960×540 ===== */}
        <div
          className="ticket-container mx-auto overflow-hidden"
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
            style={{
              background:
                "linear-gradient(135deg, #0f2355 0%, #1a3a7a 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg"
                alt="المنصة"
                className="size-8 rounded-md bg-white/15 p-0.5"
              />
              <img
                src="/saturn-lines-logo.svg"
                alt="خطوط زحل"
                className="size-9 rounded-md"
              />
              <div>
                <p className="text-sm font-extrabold text-white leading-tight">
                  خطوط زحل
                </p>
                <p className="text-[9px] text-white/50">
                  Saturn Lines — حجوزات النقل البري
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[10px] font-bold text-white/70">
                  التذكرة الإلكترونية
                </p>
                <p
                  className="mt-0.5 font-mono text-[11px] font-extrabold text-white"
                  dir="ltr"
                >
                  SL-2026-0818-0042
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-300">
                  مؤكدة
                </span>
              </div>
            </div>
          </div>

          {/* ===== ROUTE STRIP ===== */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-800">
                جدة
              </span>
            </div>
            <div className="flex flex-1 items-center gap-2 px-4">
              <div className="h-[1.5px] flex-1 bg-slate-300" />
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0f2355] text-white">
                <span className="text-[10px]">🚌</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                انطلاق ٠٨:٠٠ ص
              </span>
              <div className="h-[1.5px] flex-1 bg-slate-300" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-800">
                صنعاء
              </span>
            </div>
          </div>

          {/* ===== THREE COLUMNS ===== */}
          <div className="flex" style={{ height: 540 - 92 }}>
            {/* Column 1 (Right) — Passenger Data */}
            <div
              className="flex-1 border-l border-slate-200 px-5 py-4"
              style={{ minWidth: 280 }}
            >
              <h3 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0f2355]">
                <span className="size-1.5 rounded-full bg-[#0f2355]" />
                بيانات المسافر
              </h3>
              <div>
                <TRow label="اسم المسافر" value="محمد أحمد الشمري" />
                <TRow
                  label="رقم الجوال"
                  value="+966 55 123 4567"
                  dir="ltr"
                />
                <TRow label="رقم الحجز" value="SL-2026-0818-0042" />
                <TRow label="رقم المقعد" value="١٤" />
                <TRow label="تاريخ السفر" value="٢٥ / ٠٨ / ٢٠٢٦" />
                <TRow label="وقت المغادرة" value="٠٨:٠٠ ص" />
                <TRow label="وقت الوصول المتوقع" value="٢٠:٠٠ م" />
                <TRow label="مدينة الانطلاق" value="جدة" />
                <TRow label="مدينة الوصول" value="صنعاء" />
                <TRow label="حالة الحجز" value="مؤكدة" />
              </div>

              {/* Payment — total only, no financial breakdown */}
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    الإجمالي
                  </span>
                  <span className="text-sm font-extrabold text-[#0f2355]">
                    ٢٥٠ ريال
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1">
                  <span className="text-[10px] text-slate-500">
                    طريقة الدفع
                  </span>
                  <span className="text-[10px] font-bold text-slate-700">
                    تحويل بنكي
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    حالة الدفع
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">
                    مدفوع ✓
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2 (Center) — Company Info + Phones */}
            <div
              className="flex-1 border-l border-slate-200 px-5 py-4"
              style={{ minWidth: 280 }}
            >
              <h3 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0f2355]">
                <span className="size-1.5 rounded-full bg-[#0f2355]" />
                بيانات شركة النقل
              </h3>

              {/* Company + Saturn branding */}
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex size-9 items-center justify-center rounded-md bg-slate-200">
                  <span className="text-lg">🚌</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400">شركة النقل</p>
                  <p className="truncate text-xs font-bold text-slate-800">
                    الأفضل للنقل
                  </p>
                </div>
                <img
                  src="/saturn-lines-logo.svg"
                  alt="خطوط زحل"
                  className="size-7"
                />
              </div>

              {/* Saturn Lines contact phones */}
              <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0f2355]">
                <Phone className="size-3" />
                للتواصل مع خطوط زحل
              </h3>
              <div className="space-y-1.5">
                {[
                  { number: "0501234567", label: "الحجوزات" },
                  { number: "0559876543", label: "خدمة العملاء" },
                  { number: "0537654321", label: "الدعم" },
                ].map((p) => (
                  <a
                    key={p.number}
                    href={`tel:${p.number}`}
                    className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-3 py-1.5 text-slate-700 no-underline hover:bg-slate-50"
                    dir="ltr"
                  >
                    <Phone className="size-3 shrink-0 text-[#0f2355]" />
                    <span
                      className="font-mono text-[11px] font-bold"
                      dir="ltr"
                    >
                      {p.number}
                    </span>
                    <span className="mr-auto text-[9px] text-slate-400">
                      {p.label}
                    </span>
                  </a>
                ))}
              </div>

              {/* Travel note */}
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[9px] font-bold text-amber-800">
                  ⚠ ملاحظة للمسافر
                </p>
                <p className="mt-0.5 text-[8px] leading-4 text-amber-700">
                  يُرجى الحضور قبل موعد المغادرة بساعة على الأقل. قد يؤدي
                  التأخر إلى فقدان حق السفر.
                </p>
              </div>
            </div>

            {/* Column 3 (Left) — QR Codes */}
            <div
              className="flex flex-col items-center justify-center bg-slate-50 px-5 py-4"
              style={{ minWidth: 200, maxWidth: 220 }}
            >
              {/* Ticket Verification QR */}
              <p className="mb-1.5 text-[9px] font-bold text-slate-500">
                التحقق من التذكرة
              </p>
              <div className="flex size-[100px] items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                <QrCodePattern />
              </div>
              <p className="mt-1 text-center text-[7px] leading-3 text-slate-400">
                امسح الرمز للتحقق
                <br />
                من صحة التذكرة
              </p>

              <div className="my-2 h-px w-full bg-slate-200" />

              {/* Google Maps QR */}
              <p className="mb-1.5 text-[9px] font-bold text-slate-500">
                موقع الشركة
              </p>
              <div className="flex size-[80px] items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5">
                <QrCodePattern small />
              </div>
              <p className="mt-1 text-center text-[7px] leading-3 text-slate-400">
                امسح الرمز للوصول
                <br />
                إلى موقع الشركة
              </p>

              <div className="mt-auto pt-2 text-center">
                <img
                  src="/saturn-lines-logo.svg"
                  alt="خطوط زحل"
                  className="mx-auto mb-0.5 size-6 opacity-60"
                />
                <p className="text-[7px] text-slate-400">
                  Saturn Lines — خطوط زحل
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* أزرار التحكم */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {expanded ? "طي التفاصيل" : "عرض التفاصيل التقنية"}
        </button>
      </div>

      {/* التفاصيل التقنية (قابل للطي) */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"
        >
          <p className="mb-2 font-bold text-slate-800">
            مواصفات التصميم المرجعية
          </p>
          <ul className="space-y-1">
            <li>
              • <strong>النسبة:</strong> أفقي 16:9 (960×540px)
            </li>
            <li>
              • <strong>الاتجاه:</strong> RTL عربي
            </li>
            <li>
              • <strong>الخطوط:</strong> Tajawal (300-900)
            </li>
            <li>
              • <strong>الألوان:</strong> كحلي (#0f2355) + أبيض + رمادي
            </li>
            <li>
              • <strong>QR Code:</strong> تحقق من التذكرة + موقع الشركة
            </li>
            <li>
              • <strong>الأعمدة:</strong> 3 أعمدة — بيانات المسافر / شركة النقل / QR
            </li>
            <li>
              • <strong>الشعار:</strong> Saturn Lines SVG logo + شعار المنصة
            </li>
          </ul>
        </motion.div>
      )}
    </div>
  );
}

/* ===== مكونات مساعدة ===== */

function TRow({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-1.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span
        dir={dir}
        className="text-[11px] font-bold text-slate-900"
      >
        {value}
      </span>
    </div>
  );
}

/** QR Code pattern rendered with CSS — realistic scannable-looking grid */
function QrCodePattern({ small = false }: { small?: boolean }) {
  const pattern = [
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
  ];

  return (
    <div
      className={`grid gap-px ${small ? "size-full" : "size-full"}`}
      style={{
        gridTemplateColumns: "repeat(15, 1fr)",
        gridTemplateRows: "repeat(15, 1fr)",
      }}
    >
      {pattern.flat().map((cell, i) => (
        <div
          key={i}
          className={`rounded-[1px] ${cell ? "bg-slate-800" : "bg-white"}`}
        />
      ))}
    </div>
  );
}
