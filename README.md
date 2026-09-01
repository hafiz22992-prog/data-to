# 🪐 خطوط زحل — SaturnLines

منصة حجوزات النقل البري من السعودية إلى اليمن. توفر واجهة رقمية متكاملة لإدارة شركات النقل والرحلات والحجوزات والمدفوعات.

---

## التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| **React 19** | واجهة المستخدم |
| **TypeScript** | لغة البرمجة |
| **Vite** | بناء التطبيق |
| **Tailwind CSS v4** | التنسيق |
| **Shadcn UI** | مكتبة المكونات |
| **Framer Motion** | الحركات |
| **React Router v7** | التوجيه |
| **Convex** | قاعدة البيانات والخادم |
| **Convex Auth** | المصادقة (OTP عبر البريد) |
| **VLY Integrations** | إرسال البريد الإلكتروني |
| **Stripe** | المدفوعات (اختياري) |

---

## التشغيل المحلي

### المتطلبات

- Node.js 18+
- حساب Convex مجاني (convex.dev)

### خطوات التشغيل

```bash
# 1. تثبيت التبعيات
npm install

# 2. إعداد المتغيرات البيئية
cp .env.example .env.local
# عدّل .env.local وأدخل القيم الصحيحة

# 3. تشغيل قاعدة البيانات
npx convex dev

# 4. في terminal منفصل — تشغيل الواجهة
npm run dev
```

سيفتح التطبيق على `http://localhost:5173`.

---

## المتغيرات البيئية

### للواجهة (Frontend)

| المتغير | الوصف | مثال |
|---------|-------|------|
| `VITE_CONVEX_URL` | رابط Convex Cloud | `https://xxx.convex.cloud` |
| `VITE_SITE_URL` | رابط الموقع النهائي | `https://satrunlines.com` |

### للخادم (Convex Backend)

يتم إعدادها من خلال Convex Dashboard:

| المتغير | الوصف |
|---------|-------|
| `VLY_INTEGRATION_KEY` | مفتاح VLY لإرسال البريد |
| `OWNER_EMAILS` | بريد المالك الرئيسي (للصلاحيات) |

---

## بناء التطبيق

```bash
npm run build
```

ستُنشأ مجلد `dist/` جاهز للنشر.

---

## النشر على Vercel

### الخطوات:

1. **ارفع الكود إلى GitHub**

2. **اربط المستودع بـ Vercel:**
   - افتح [vercel.com](https://vercel.com)
   - اضغط "Add New Project"
   - اختر مستودع GitHub
   - اختر "Other" كنوع المشروع (Vite)
   - اضغط Deploy

3. **أضف النطاق المخصص:**
   - اذهب إلى Project Settings → Domains
   - أضف `satrunlines.com`
   - أضف `www.satrunlines.com` (اختياري)

4. **إعداد DNS على مزود النطاق:**

   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

5. **أضف المتغيرات البيئية في Vercel:**
   - اذهب إلى Project Settings → Environment Variables
   - أضف `VITE_CONVEX_URL` (قيمة الإنتاج)
   - أضف `VITE_SITE_URL` = `https://satrunlines.com`
   - أضف `VLY_INTEGRATION_KEY` (من Convex Dashboard)

---

## هيكل المشروع

```
src/
├── components/        # مكونات React
│   ├── ui/            # مكونات Shadcn UI
│   ├── AdminShell.tsx  # هيكل لوحة الإدارة
│   ├── CompaniesManager.tsx  # إدارة الشركات
│   ├── TripsManager.tsx      # إدارة الرحلات
│   ├── BookingsList.tsx      # قائمة الحجوزات
│   └── ...
├── convex/            # backend Convex
│   ├── schema.ts      # هيكل قاعدة البيانات
│   ├── companies.ts   # مقارير الشركات
│   ├── bookings.ts    # مقارير الحجوزات
│   ├── trips.ts       # مقارير الرحلات
│   └── ...
├── hooks/             # Custom hooks
├── lib/               # مكتبات مساعدة
├── pages/             # صفحات التطبيق
│   ├── Landing.tsx    # الصفحة الرئيسية
│   ├── Auth.tsx       # تسجيل الدخول
│   ├── OwnerDashboard.tsx   # لوحة المالك
│   ├── CompanyDashboard.tsx # لوحة الشركة
│   └── CustomerHome.tsx     # لوحة العميل
└── main.tsx           # نقطة الدخول
```

---

## الأدوار والصلاحيات

| الدور | الوصول |
|-------|--------|
| **Owner** | كامل — إدارة الشركات والرحلات والحجوزات والمدفوعات |
| **Company** | إدارة الشركة المرتبطة — الرحلات والحجوزات |
| **Customer** | حجز الرحلات ومتابعة الحجوزات |

---

## ملاحظات تقنية

- لا تعدّل ملفات `src/convex/auth.config.ts` و `src/convex/auth.ts` — هذه ملفات Authentication الجاهزة
- لا تعدّل `src/convex/auth/emailOtp.ts` — إعدادات OTP
- لصحة المشروع، نفّذ `npx tsc -b --noEmit` للتأكد من عدم وجود أخطاء TypeScript
- لنشر التغييرات على Convex: `npx convex dev --once`

---

## الترخيص

مشروع خاص — خطوط زحل © {السنة}
