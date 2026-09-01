import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { SAUDI_CITIES, YEMEN_CITIES } from "../lib/transport";
import type { Id } from "./_generated/dataModel";

/**
 * PHASE 1 — نقل بيانات المدن والمحافظات من src/lib/transport.ts إلى قاعدة البيانات.
 *
 * المصدر الحقيقي للبيانات هو transport.ts:
 * - SAUDI_CITIES (14 مدينة سعودية)
 * - YEMEN_CITIES (14 وجهة يمنية)
 *
 * تُنشأ المحافظات والمدن في الجداول الجديدة `governorates` و `cities` بدون فقدان
 * أي مدينة أو محافظة، مع الحفاظ على transport.ts كما هو (لا يُستبدل في هذه المرحلة).
 *
 * - `seed`: بذر Idempotent — مفتاح منطقي ثابت (country, name)؛ التشغيل المتكرر
 *   لا يُنتج تكرارات، بل يحدّث السجلات الموجودة فقط.
 * - `verify`: استعلام تحقق يقارن المصدر بقاعدة البيانات (أعداد، تكرارات، مفقود،
 *   مدن يتيمة، ومراجع الرحلات/الحجوزات) دون لمس أي جدول آخر.
 */

// مناطق المملكة العربية السعودية الإدارية الثلاث عشرة (بيانات رسمية أساسية —
// transport.ts لا يحتوي محافظات سعودية صريحة، وهذه هي البنية الإدارية المعتمدة).
const SAUDI_REGIONS = [
  "الرياض",
  "مكة المكرمة",
  "المدينة المنورة",
  "القصيم",
  "الشرقية",
  "عسير",
  "تبوك",
  "حائل",
  "الحدود الشمالية",
  "جازان",
  "نجران",
  "الباحة",
  "الجوف",
];

// محافظات الوجهات اليمنية — 1:1 مع YEMEN_CITIES في transport.ts (كل وجهة
// تُعامل كمحافظة باسمها نفسه، بما فيها المكلا وسيئون، دون تغيير أي اسم مصدر).
const YEMEN_GOVERNORATES = [...YEMEN_CITIES];

// تخطيط كل مدينة سعودية إلى منطقتها الإدارية (تغطية كاملة لـ 14 مدينة مصدر).
const SAUDI_CITY_GOVERNORATE: Record<string, string> = {
  "الرياض": "الرياض",
  "جدة": "مكة المكرمة",
  "مكة المكرمة": "مكة المكرمة",
  "المدينة المنورة": "المدينة المنورة",
  "الدمام": "الشرقية",
  "الخبر": "الشرقية",
  "الطائف": "مكة المكرمة",
  "أبها": "عسير",
  "خميس مشيط": "عسير",
  "جازان": "جازان",
  "نجران": "نجران",
  "بريدة": "القصيم",
  "تبوك": "تبوك",
  "حائل": "حائل",
};

/** قائمة المحافظات/المناطق — استعلام عام (بيانات مرجعية عامة). */
export const listGovernorates = query({
  args: { country: v.optional(v.string()) },
  handler: async (ctx, { country }) => {
    const rows = await ctx.db.query("governorates").collect();
    const filtered = country ? rows.filter((r) => r.country === country) : rows;
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
});

/**
 * قائمة المدن — استعلام عام (بيانات مرجعية عامة).
 * الترتيب: ترتيب الإدراج (نفس ترتيب قائمتَي المصدر في transport.ts) للحفاظ
 * على ترتيب العرض الحالي في الواجهة — تُضاف المدن الجديدة في نهاية القائمة.
 */
export const listCities = query({
  args: {
    country: v.optional(v.string()),
    governorateId: v.optional(v.id("governorates")),
  },
  handler: async (ctx, { country, governorateId }) => {
    let rows = await ctx.db.query("cities").collect();
    if (country) rows = rows.filter((c) => c.country === country);
    if (governorateId) rows = rows.filter((c) => c.governorateId === governorateId);
    return rows;
  },
});

/**
 * بذر المحافظات والمدن — Idempotent وآمن للتكرار.
 * المفتاح المنطقي الثابت: (country, name).
 * - المحافظة الموجودة: تُفعَّل وتُحدَّث updatedAt فقط (لا تكرار).
 * - المدينة الموجودة: يُصحَّح ارتباطها بمحافظتها وتُفعَّل فقط (لا تكرار).
 * - أي مدينة مصدر بلا تخطيط محافظة → إيقاف فوري (معاملة Convex تُرجع كل شيء).
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const govCache = new Map<string, Id<"governorates">>();
    let govInserted = 0;
    let govUpdated = 0;
    let cityInserted = 0;
    let cityUpdated = 0;

    const upsertGovernorate = async (
      name: string,
      country: "sa" | "ye",
    ): Promise<Id<"governorates">> => {
      const existing = await ctx.db
        .query("governorates")
        .withIndex("by_country_name", (q) => q.eq("country", country).eq("name", name))
        .first();
      if (existing) {
        if (!existing.active || existing.updatedAt !== now) {
          await ctx.db.patch(existing._id, { active: true, updatedAt: now });
          govUpdated += 1;
        }
        return existing._id;
      }
      const id = await ctx.db.insert("governorates", {
        name,
        country,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      govInserted += 1;
      return id;
    };

    for (const name of SAUDI_REGIONS) {
      govCache.set(`sa|${name}`, await upsertGovernorate(name, "sa"));
    }
    for (const name of YEMEN_GOVERNORATES) {
      govCache.set(`ye|${name}`, await upsertGovernorate(name, "ye"));
    }

    const upsertCity = async (
      name: string,
      country: "sa" | "ye",
      governorateId: Id<"governorates">,
    ) => {
      const existing = await ctx.db
        .query("cities")
        .withIndex("by_country_name", (q) => q.eq("country", country).eq("name", name))
        .first();
      if (existing) {
        if (existing.governorateId !== governorateId || !existing.active) {
          await ctx.db.patch(existing._id, { governorateId, active: true, updatedAt: now });
          cityUpdated += 1;
        }
        return;
      }
      await ctx.db.insert("cities", {
        name,
        governorateId,
        country,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      cityInserted += 1;
    };

    // المدن السعودية — من المصدر مع تخطيط المحافظة
    for (const name of SAUDI_CITIES) {
      const govName = SAUDI_CITY_GOVERNORATE[name];
      if (!govName) {
        throw new Error(
          `لا يمكن تحويل المدينة «${name}» — لا يوجد تخطيط محافظة لها. أُلغيت العملية بالكامل.`,
        );
      }
      const govId = govCache.get(`sa|${govName}`);
      if (!govId) throw new Error(`المحافظة «${govName}» غير موجودة في التخطيط`);
      await upsertCity(name, "sa", govId);
    }

    // المدن اليمنية — كل وجهة مرتبطة بمحافظة تحمل اسمها
    for (const name of YEMEN_CITIES) {
      const govId = govCache.get(`ye|${name}`);
      if (!govId) throw new Error(`المحافظة «${name}» غير موجودة في التخطيط`);
      await upsertCity(name, "ye", govId);
    }

    return {
      governorates: { inserted: govInserted, updated: govUpdated },
      cities: { inserted: cityInserted, updated: cityUpdated },
    };
  },
});

/**
 * التحقق من البيانات — يقارن المصدر (transport.ts) بقاعدة البيانات.
 * لا يعدّل أي شيء: قراءة فقط.
 */
export const verify = query({
  args: {},
  handler: async (ctx) => {
    const [governorates, cities, trips, bookings] = await Promise.all([
      ctx.db.query("governorates").collect(),
      ctx.db.query("cities").collect(),
      ctx.db.query("busTrips").collect(),
      ctx.db.query("busBookings").collect(),
    ]);

    const source = {
      saGovernorates: SAUDI_REGIONS.length,
      yeGovernorates: YEMEN_GOVERNORATES.length,
      saCities: SAUDI_CITIES.length,
      yeCities: YEMEN_CITIES.length,
      cities: SAUDI_CITIES.length + YEMEN_CITIES.length,
    };

    const db = {
      saGovernorates: governorates.filter((g) => g.country === "sa").length,
      yeGovernorates: governorates.filter((g) => g.country === "ye").length,
      saCities: cities.filter((c) => c.country === "sa").length,
      yeCities: cities.filter((c) => c.country === "ye").length,
      cities: cities.length,
    };

    // عدد السجلات الزائدة عن مرة واحدة لكل مفتاح (country, name)
    const duplicateCount = (rows: { country: string; name: string }[]) => {
      const counts = new Map<string, number>();
      for (const r of rows) {
        const key = `${r.country}|${r.name}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let extra = 0;
      for (const n of counts.values()) if (n > 1) extra += n - 1;
      return extra;
    };

    const duplicateGovernorates = duplicateCount(governorates);
    const duplicateCities = duplicateCount(cities);

    // مفقود: اسماء المصدر غير الموجودة في DB
    const govKeys = new Set(governorates.map((g) => `${g.country}|${g.name}`));
    const cityKeys = new Set(cities.map((c) => `${c.country}|${c.name}`));
    const missingGovernorates = [
      ...SAUDI_REGIONS.filter((n) => !govKeys.has(`sa|${n}`)).map((n) => `sa|${n}`),
      ...YEMEN_GOVERNORATES.filter((n) => !govKeys.has(`ye|${n}`)).map((n) => `ye|${n}`),
    ];
    const missingCities = [
      ...SAUDI_CITIES.filter((n) => !cityKeys.has(`sa|${n}`)).map((n) => `sa|${n}`),
      ...YEMEN_CITIES.filter((n) => !cityKeys.has(`ye|${n}`)).map((n) => `ye|${n}`),
    ];

    // مدن يتيمة: governorateId لا يشير إلى محافظة موجودة
    const govIds = new Set(governorates.map((g) => g._id));
    const orphanCities = cities.filter((c) => !govIds.has(c.governorateId)).length;

    // مراجع الرحلات والحجوزات: أسماء مدنها موجودة في جدول المدن (لا مراجع مكسورة)
    const tripsWithUnknownCity = trips.filter(
      (t) => !cityKeys.has(`sa|${t.from}`) || !cityKeys.has(`ye|${t.to}`),
    ).length;
    const bookingsWithUnknownCity = bookings.filter(
      (b) => !cityKeys.has(`sa|${b.departure}`) || !cityKeys.has(`ye|${b.destination}`),
    ).length;

    return {
      source,
      db,
      duplicateGovernorates,
      duplicateCities,
      missingGovernorates,
      missingCities,
      orphanCities,
      tripsWithUnknownCity,
      bookingsWithUnknownCity,
      pass:
        db.saGovernorates === source.saGovernorates &&
        db.yeGovernorates === source.yeGovernorates &&
        db.cities === source.cities &&
        duplicateGovernorates === 0 &&
        duplicateCities === 0 &&
        missingGovernorates.length === 0 &&
        missingCities.length === 0 &&
        orphanCities === 0,
    };
  },
});
