import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";

/**
 * PHASE 1.5 — مصدر المدن في الواجهة من Convex (locations.listCities)
 * بدلاً من الثوابت في transport.ts (التي بقيت كمرجع احتياطي في هذه المرحلة).
 *
 * يعيد قائمتي أسماء المدن (سعودية/يمنية) بنفس القيم التي كانت تأتي من
 * transport.ts (البيانات منقولة 1:1 إلى قاعدة البيانات في PHASE 1)،
 * مع حالة تحميل تُستخدم لتعطيل القوائم وزر الإرسال حتى توفر البيانات.
 */
export function useLocations() {
  const cities = useQuery(api.locations.listCities, {});

  const saudiCities = useMemo(
    () => (cities ?? []).filter((c) => c.country === "sa").map((c) => c.name),
    [cities],
  );
  const yemenCities = useMemo(
    () => (cities ?? []).filter((c) => c.country === "ye").map((c) => c.name),
    [cities],
  );

  return {
    /** صحيح حتى تصل بيانات المدن من Convex لأول مرة. */
    isLoading: cities === undefined,
    saudiCities,
    yemenCities,
  };
}
