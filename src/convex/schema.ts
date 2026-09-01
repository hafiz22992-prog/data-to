import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** حالة الحجز: قيد الانتظار / مؤكد / ملغي */
export const BOOKING_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const;

export const bookingStatusValidator = v.union(
  v.literal(BOOKING_STATUSES.PENDING),
  v.literal(BOOKING_STATUSES.CONFIRMED),
  v.literal(BOOKING_STATUSES.CANCELLED),
);
export type BookingStatus = Infer<typeof bookingStatusValidator>;

/**
 * حالة الدفع — تُحدَّد في الخادم (وليست من واجهة العميل):
 * - unpaid: لم تبدأ أي عملية دفع (افتراضي عند إنشاء الحجز)
 * - pending: عملية دفع قيد المعالجة
 * - paid: الدفع نجح وتأكد (تأكيد خادمي/Webhook) — الحجز يُؤكد تلقائياً
 * - failed: فشلت عملية الدفع — يمكن للعميل إعادة المحاولة
 * - cancelled: ألغى المستخدم/مزود الدفع العملية — يمكن للعميل إعادة المحاولة
 */
export const PAYMENT_STATUSES = {
  UNPAID: "unpaid",
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const paymentStatusValidator = v.union(
  v.literal(PAYMENT_STATUSES.UNPAID),
  v.literal(PAYMENT_STATUSES.PENDING),
  v.literal(PAYMENT_STATUSES.PAID),
  v.literal(PAYMENT_STATUSES.FAILED),
  v.literal(PAYMENT_STATUSES.CANCELLED),
);
export type PaymentStatus = Infer<typeof paymentStatusValidator>;

/**
 * طريقة الدفع:
 * - on_arrival: الدفع عند الانطلاق (نقداً في المحطة) — يبقى unpaid حتى التحصيل
 * - bank_transfer: التحويل البنكي — يبدأ pending ويؤكده المالك/صاحب الشركة
 *   بعد مراجعة الإيصال/المرجع (لا يتطلب بوابة دفع خارجية)
 * - card: البطاقات والمحافظ (Visa/mada/Apple Pay/STC Pay…) — تتطلب بوابة دفع خارجية
 */
export const PAYMENT_METHODS = {
  ON_ARRIVAL: "on_arrival",
  BANK_TRANSFER: "bank_transfer",
  CARD: "card",
} as const;

export const paymentMethodValidator = v.union(
  v.literal(PAYMENT_METHODS.ON_ARRIVAL),
  v.literal(PAYMENT_METHODS.BANK_TRANSFER),
  v.literal(PAYMENT_METHODS.CARD),
);
export type PaymentMethod = Infer<typeof paymentMethodValidator>;

/** حالة الشركة: نشطة / موقوفة (PHASE 2A) */
export const COMPANY_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export const companyStatusValidator = v.union(
  v.literal(COMPANY_STATUSES.ACTIVE),
  v.literal(COMPANY_STATUSES.INACTIVE),
);
export type CompanyStatus = Infer<typeof companyStatusValidator>;

/** رمز الدولة: السعودية / اليمن */
export const COUNTRY_CODES = {
  SA: "sa",
  YE: "ye",
} as const;

export const countryValidator = v.union(
  v.literal(COUNTRY_CODES.SA),
  v.literal(COUNTRY_CODES.YE),
);
export type CountryCode = Infer<typeof countryValidator>;

/** رقم تواصل الشركة — مع تصنيف وحالة تفعيل */
export const contactPhoneValidator = v.object({
  number: v.string(), // رقم الجوال
  label: v.optional(v.string()), // تصنيف: حجوزات، خدمة عملاء، طوارئ...
  active: v.boolean(), // نشط: يظهر للمسافرين
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // حجوزات النقل البري من السعودية إلى اليمن
    busBookings: defineTable({
      userId: v.id("users"), // صاحب الحجز
      bookingNo: v.string(), // رقم الحجز التلقائي مثل BK-20260814-1030
      customerName: v.string(), // اسم العميل
      mobile: v.string(), // رقم الجوال
      residencyNumber: v.string(), // رقم الإقامة (اختياري الإدخال — يُحفظ فارغاً إن لم يُدخل)
      borderNumber: v.optional(v.string()), // رقم الحدود (اختياري)
      passportNumber: v.string(), // رقم جواز السفر
      departure: v.string(), // وجهة الانطلاق (مدينة في السعودية)
      destination: v.string(), // وجهة الوصول (مدينة في اليمن)
      companyId: v.string(), // معرف شركة النقل
      companyName: v.string(), // اسم شركة النقل (لقطة لحظة الحجز)
      travelDate: v.string(), // تاريخ السفر yyyy-mm-dd
      passengers: v.number(), // عدد الركاب
      tripId: v.optional(v.id("busTrips")), // الرحلة المحجوزة (اختياري للتوافق)
      departureTime: v.optional(v.string()), // وقت انطلاق الرحلة (لقطة)
      price: v.optional(v.number()), // سعر التذكرة للراكب الواحد بالريال (يُشتق من الرحلة في الخادم)
      fareAmount: v.optional(v.number()), // إجمالي قيمة الحجز بالريال (سعر × ركاب)
      paymentStatus: v.optional(paymentStatusValidator), // حالة الدفع (يُحددها الخادم)
      paymentMethod: v.optional(paymentMethodValidator), // طريقة الدفع
      paymentRef: v.optional(v.string()), // مرجع العملية من مزود الدفع / رقم الحجز عند التحصيل اليدوي
      notes: v.optional(v.string()), // ملاحظات إضافية
      // لقطة نسب العمولة سارية وقت إنشاء الحجز — تُستخدم للمحاسبة ولا تتغير
      // لاحقاً عند تعديل إعدادات المنصة (الحجز القديم يبقى محسوباً بنسبته)
      commissionCompanyPercent: v.optional(v.number()), // نسبة حصة الشركة وقت الحجز
      commissionPlatformPercent: v.optional(v.number()), // نسبة عمولة التطبيق وقت الحجز
      vatPercent: v.optional(v.number()), // نسبة ضريبة القيمة المضافة وقت الحجز
      status: bookingStatusValidator, // حالة الحجز
    })
      .index("by_user", ["userId"])
      .index("by_company", ["companyId"]),

    // سجل عمليات الدفع — عملية واحدة أو أكثر لكل حجز (ربط الحجز بالدفع)
    payments: defineTable({
      bookingId: v.id("busBookings"), // الحجز المرتبط
      amount: v.number(), // المبلغ بالريال (يُحسب خادمياً من الحجز — لا يُقبل من العميل)
      currency: v.string(), // العملة (SAR — ثابتة)
      method: paymentMethodValidator, // طريقة الدفع
      status: paymentStatusValidator, // حالة العملية (يُحددها الخادم/Webhook)
      provider: v.optional(v.string()), // مزود الدفع (manual حالياً، أو stripe عند الربط)
      providerRef: v.optional(v.string()), // مرجع العملية من مزود الدفع (إن وُجد)
      idempotencyKey: v.optional(v.string()), // مفتاح منع التكرار (اختياري)
      transferRef: v.optional(v.string()), // رقم مرجع التحويل البنكي الذي أدخله المسافر (اختياري)
      receiptStorageId: v.optional(v.string()), // معرف إيصال التحويل المرفوع في Convex storage (اختياري)
      confirmedBy: v.optional(v.id("users")), // من أكد التحويل (المالك/صاحب الشركة)
      confirmedAt: v.optional(v.number()), // طابع زمني (ms) لتأكيد التحويل
      bankAccountId: v.optional(v.id("bankAccounts")),
      bankAccountSnapshot: v.optional(
        v.object({
          bankName: v.string(),
          accountHolderName: v.string(),
          accountNumber: v.optional(v.string()),
          iban: v.optional(v.string()),
          beneficiaryName: v.string(),
        }),
      ),
      commissionCompanyPercent: v.optional(v.number()),
      commissionPlatformPercent: v.optional(v.number()),
      vatPercent: v.optional(v.number()),
      createdAt: v.number(), // طابع زمني (ms)
      updatedAt: v.number(), // طابع زمني (ms)
    })
      .index("by_booking", ["bookingId"])
      .index("by_status", ["status"])
      .index("by_providerRef", ["providerRef"]),

    platformSettings: defineTable({
      key: v.string(),
      commissionCompanyPercent: v.number(),
      commissionPlatformPercent: v.number(),
      vatPercent: v.number(),
      updatedBy: v.id("users"),
      updatedAt: v.number(),
      saturnPhoneNumbers: v.optional(
        v.array(
          v.object({
            number: v.string(),
            label: v.optional(v.string()),
            active: v.boolean(),
          }),
        ),
      ),
      platformLogo: v.optional(v.string()), // رابط شعار خطوط زحل
    }).index("by_key", ["key"]),

    bankAccounts: defineTable({
      bankName: v.string(),
      accountHolderName: v.string(),
      accountNumber: v.optional(v.string()),
      iban: v.optional(v.string()),
      beneficiaryName: v.string(),
      description: v.optional(v.string()),
      active: v.boolean(),
      displayOrder: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),

    busTrips: defineTable({
      companyId: v.string(),
      from: v.string(),
      to: v.string(),
      departureTime: v.string(),
      arrivalTime: v.optional(v.string()),
      price: v.number(),
      totalSeats: v.number(),
      availableSeats: v.number(),
      days: v.array(v.string()),
      routeId: v.optional(v.id("routes")),
      active: v.optional(v.boolean()),
    }).index("by_company", ["companyId"]),

    // شركات النقل — ملف كل شركة مع بيانات التواصل والموقع
    companies: defineTable({
      slug: v.string(), // معرف الشركة مثل al-afdal
      name: v.string(), // الاسم الرسمي
      base: v.optional(v.string()), // المقر الرئيسي داخل السعودية
      routes: v.optional(v.string()), // وصف المسارات
      color: v.optional(v.string()), // اللون المميز (hex)
      logo: v.optional(v.string()), // رابط شعار الشركة
      emails: v.array(v.string()), // بريدات مسؤولي الشركة
      status: companyStatusValidator, // حالة الشركة: active | inactive
      // === بيانات التواصل والموقع ===
      address: v.optional(v.string()), // عنوان الشركة
      mapUrl: v.optional(v.string()), // رابط Google Maps
      lat: v.optional(v.number()), // خط العرض
      lng: v.optional(v.number()), // خط الطول
      contactPhones: v.optional(v.array(contactPhoneValidator)), // أرقام التواصل النشطة مع تصنيف
      phoneNumbers: v.optional(v.array(v.string())), // الأرقام القديمة (للتوافق)
      // === بيانات البريد الإلكتروني للشركة ===
      companyUrl: v.optional(v.string()), // الرابط العام لصفحة الشركة على المنصة
      emailStatus: v.optional(
        v.union(
          v.literal("not_sent"),
          v.literal("sent"),
          v.literal("failed"),
        ),
      ), // حالة آخر إرسال بريد الدعوة
      lastEmailSentAt: v.optional(v.number()), // طابع زمني آخر إرسال بريد
    }).index("by_slug", ["slug"]),

    // ===== PHASE 1 — بيانات المدن والمحافظات =====
    governorates: defineTable({
      name: v.string(),
      country: countryValidator,
      code: v.optional(v.string()),
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_country", ["country"])
      .index("by_country_name", ["country", "name"]),

    cities: defineTable({
      name: v.string(),
      governorateId: v.id("governorates"),
      country: countryValidator,
      code: v.optional(v.string()),
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_country", ["country"])
      .index("by_governorate", ["governorateId"])
      .index("by_country_name", ["country", "name"]),

    // ===== PHASE 2B — المسارات (Routes) =====
    routes: defineTable({
      companyId: v.id("companies"),
      originCityId: v.id("cities"),
      destinationCityId: v.id("cities"),
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_company", ["companyId"])
      .index("by_origin", ["originCityId"])
      .index("by_destination", ["destinationCityId"])
      .index("by_company_origin_destination", [
        "companyId",
        "originCityId",
        "destinationCityId",
      ]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
