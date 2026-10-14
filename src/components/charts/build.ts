import {
  ageMonths,
  ageYears,
  bucket,
  countBy,
  daysBetween,
  familyKpis,
  isDone,
  label,
  matrix,
  sankeyCityServiceResult,
  shortService,
  timeline,
  uniq,
} from "@/lib/analytics";
import type { ChildRecord, FamilyRecord } from "@/lib/types";
import { PALETTE } from "./Chart";
import {
  columns,
  donut,
  heatmap,
  horizontalBar,
  radar,
  sankey,
  stackedBar,
  timelineChart,
  treemap,
} from "./options";

// إعدادات الرسوم مشتركة بين الداشبورد وتقرير الطباعة، عشان الأرقام تبقى واحدة في الاتنين

export function buildFamilyCharts(filtered: FamilyRecord[], refDate: string) {
  const services = uniq(filtered.map((r) => shortService(r.service)));
  const cities = countBy(filtered, (r) => r.city).map((c) => c.name);
  const cityService = matrix(filtered, (r) => r.city, (r) => shortService(r.service));

  const byCityStack = stackedBar(
    cities,
    services.map((s, i) => ({
      name: s,
      data: cities.map((c) => cityService.get(c, s)),
      color: PALETTE[i % PALETTE.length],
    })),
  );

  const resultLabels = uniq(filtered.map((r) => r.result || "بانتظار النتيجة"));
  const resultByService = stackedBar(
    services,
    resultLabels.map((res) => ({
      name: res,
      data: services.map((s) => filtered.filter((r) => shortService(r.service) === s && (r.result || "بانتظار النتيجة") === res).length),
      color: res === "مناسب" ? "#1F9D6B" : res.startsWith("غير") ? "#D6455D" : "#E39A1E",
    })),
  );

  const doneByCity = stackedBar(cities, [
    { name: "تم رفع التقارير", data: cities.map((c) => filtered.filter((r) => label(r.city) === c && isDone(r.status)).length), color: "#741B8D" },
    { name: "قيد التنفيذ", data: cities.map((c) => filtered.filter((r) => label(r.city) === c && !isDone(r.status)).length), color: "#7FE0F7" },
  ]);

  const tree = countBy(filtered, (r) => r.city).map((c) => ({
    name: c.name,
    value: c.value,
    children: countBy(filtered.filter((r) => label(r.city) === c.name), (r) => r.district),
  }));

  const ages = filtered
    .filter((r) => r.birthDate)
    .filter((r) => r.labDate || refDate)
    .map((r) => ageYears(r.birthDate!, r.labDate ?? refDate));
  const ageBuckets = bucket(ages, [0, 18, 30, 40, 50, 200], ["أقل من 18", "18–29", "30–39", "40–49", "50+"]);

  const tat = filtered
    .filter((r) => r.labDate && r.resultDate)
    .map((r) => daysBetween(r.labDate!, r.resultDate!))
    .filter((d) => d >= 0);
  const tatBuckets = bucket(tat, [0, 2, 4, 6, 8, 10000], ["0–1 يوم", "2–3 أيام", "4–5 أيام", "6–7 أيام", "+8 أيام"]);

  const famSizes = countBy(
    Object.values(
      filtered.reduce<Record<string, number>>((acc, r) => {
        if (r.family) acc[r.family] = (acc[r.family] ?? 0) + 1;
        return acc;
      }, {}),
    ).map((n) => ({ n })),
    (x) => `${x.n} أفراد`,
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // مقارنة المدن على أكتر من مؤشر في نفس الوقت
  const topCities = countBy(filtered, (r) => r.city).slice(0, 4);
  const radarIndicators = [
    { name: "الفحوصات", max: Math.max(1, ...topCities.map((c) => c.value)) },
    { name: "الأسر", max: 1 },
    { name: "الإنجاز %", max: 100 },
    { name: "المناسب %", max: 100 },
    { name: "الأحياء", max: 1 },
  ];
  const radarSeries = topCities.map((c, i) => {
    const rows = filtered.filter((r) => label(r.city) === c.name);
    const k = familyKpis(rows);
    const districts = new Set(rows.map((r) => r.district)).size;
    radarIndicators[1].max = Math.max(radarIndicators[1].max, k.families);
    radarIndicators[4].max = Math.max(radarIndicators[4].max, districts);
    return { name: c.name, value: [c.value, k.families, k.completion, k.suitableRate, districts], color: PALETTE[i % PALETTE.length] };
  });

  return {
    byCityStack,
    resultByService,
    doneByCity,
    sankey: sankey(sankeyCityServiceResult(filtered)),
    heat: heatmap(cityService.rows, cityService.cols, cityService.get),
    services: donut(countBy(filtered, (r) => shortService(r.service)), "فحص"),
    results: donut(countBy(filtered, (r) => r.result || "بانتظار النتيجة"), "نتيجة", true),
    timeline: timelineChart(timeline(filtered)),
    tree: treemap(tree),
    ages: columns(ageBuckets, PALETTE[0], "عدد الأشخاص"),
    tat: columns(tatBuckets, PALETTE[1], "عدد النتائج"),
    famSizes: columns(famSizes, PALETTE[2], "عدد الأسر"),
    radar: radar(radarIndicators, radarSeries),
  };
}

export function buildChildCharts(children: ChildRecord[], refDate: string) {
  const months = refDate ? children.filter((c) => c.birthDate).map((c) => ageMonths(c.birthDate!, refDate)) : [];
  return {
    results: donut(countBy(children, (c) => c.result || "بانتظار النتيجة"), "طفل", true),
    hospitals: horizontalBar(countBy(children, (c) => c.hospital), PALETTE[1], 22),
    ages: columns(bucket(months, [0, 3, 6, 9, 12, 1000], ["0–2 شهر", "3–5", "6–8", "9–11", "سنة+"]), PALETTE[0], "عدد الأطفال"),
    notes: donut(
      [
        { name: "بدون ملاحظات", value: children.filter((c) => !c.notes).length },
        { name: "عليها ملاحظات", value: children.filter((c) => c.notes).length },
      ],
      "حالة",
    ),
  };
}
