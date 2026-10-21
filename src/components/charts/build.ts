import {
  ageMonths,
  bucket,
  childDate,
  countBy,
  daysBetween,
  familyAges,
  familyKpis,
  fullYearMonths,
  isDone,
  label,
  matrix,
  PENDING_RESULT,
  type Granularity,
  periodKey,
  periodKeyBy,
  periodLabel,
  RESULT_GROUPS,
  resultGroup,
  sankeyCityServiceResult,
  shortService,
  timeline,
  uniq,
} from "@/lib/analytics";
import type { ChildRecord, FamilyRecord } from "@/lib/types";
import { PALETTE, STATUS_COLORS } from "./Chart";
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

// Chart options are shared by the dashboard and the print report so both show the same numbers

const AGE_EDGES = [0, 18, 30, 40, 50, 200];
const AGE_LABELS = ["أقل من 18", "18–29", "30–39", "40–49", "50+"];

/** Beneficiaries per period, split by group (result, test type...) */
function periodStack<T>(
  rows: T[],
  date: (r: T) => string | null,
  group: (r: T) => string,
  groups: string[],
  colors?: Record<string, string>,
  granularity?: Granularity,
) {
  const dated = rows.filter((r) => date(r));
  // Without granularity: by day or by month depending on the range
  const keyOf = granularity ? periodKeyBy(granularity) : periodKey(dated.map((r) => date(r)!));
  const present = uniq(dated.map((r) => keyOf(date(r)!))).sort();
  const keys = granularity === "month" ? fullYearMonths(present) : present;
  const option = stackedBar(
    // Month on one line and year under it, so a full year of months fits
    keys.map((k) => (granularity === "month" ? periodLabel(k).replace(" ", "\n") : periodLabel(k))),
    groups.map((g, i) => ({
      name: g,
      data: keys.map((k) => dated.filter((r) => keyOf(date(r)!) === k && group(r) === g).length),
      color: colors?.[g] ?? PALETTE[i % PALETTE.length],
    })),
  );
  if (granularity === "month") {
    // On narrow screens skip labels that would overlap instead of drawing them on top of each other
    const x = option.xAxis as { axisLabel?: Record<string, unknown> };
    x.axisLabel = { ...x.axisLabel, interval: "auto", hideOverlap: true, width: undefined, overflow: undefined };
  }
  return { option, hasData: dated.length > 0, missing: rows.length - dated.length };
}

export function buildFamilyCharts(filtered: FamilyRecord[], refDate: string) {
  const services = uniq(filtered.map((r) => shortService(r.service)));
  const cities = countBy(filtered, (r) => r.city).map((c) => c.name);
  const cityService = matrix(filtered, (r) => r.city, (r) => shortService(r.service));
  const groupsPresent = RESULT_GROUPS.filter((g) => filtered.some((r) => resultGroup(r.result) === g));

  const byCityStack = stackedBar(
    cities,
    services.map((s, i) => ({
      name: s,
      data: cities.map((c) => cityService.get(c, s)),
      color: PALETTE[i % PALETTE.length],
    })),
  );

  const cityResult = stackedBar(
    cities,
    groupsPresent.map((g) => ({
      name: g,
      data: cities.map((c) => filtered.filter((r) => label(r.city) === c && resultGroup(r.result) === g).length),
      color: STATUS_COLORS[g],
    })),
  );

  const resultByService = stackedBar(
    services,
    groupsPresent.map((res) => ({
      name: res,
      data: services.map((s) => filtered.filter((r) => shortService(r.service) === s && resultGroup(r.result) === res).length),
      color: STATUS_COLORS[res],
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

  const ageBuckets = bucket(familyAges(filtered, refDate), AGE_EDGES, AGE_LABELS);

  // Age × program type: who benefits from which program
  const ageOf = (r: FamilyRecord) => familyAges([r], refDate)[0];
  const ageGroupOf = (r: FamilyRecord) => {
    const a = ageOf(r);
    if (a === undefined) return "";
    return bucket([a], AGE_EDGES, AGE_LABELS).find((b) => b.value)?.name ?? "";
  };
  const ageByProgram = stackedBar(
    AGE_LABELS,
    services.map((s, i) => ({
      name: s,
      data: AGE_LABELS.map((g) => filtered.filter((r) => shortService(r.service) === s && ageGroupOf(r) === g).length),
      color: PALETTE[i % PALETTE.length],
    })),
  );

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

  // Compare cities across several metrics at once
  const topCities = countBy(filtered, (r) => r.city).slice(0, 4);
  const radarIndicators = [
    { name: "الفحوصات", max: Math.max(1, ...topCities.map((c) => c.value)) },
    { name: "الأسر", max: 1 },
    { name: "المواعيد", max: 1 },
    { name: "المناسب %", max: 100 },
    { name: "الأحياء", max: 1 },
  ];
  const radarSeries = topCities.map((c, i) => {
    const rows = filtered.filter((r) => label(r.city) === c.name);
    const k = familyKpis(rows);
    const districts = new Set(rows.map((r) => r.district)).size;
    radarIndicators[1].max = Math.max(radarIndicators[1].max, k.families);
    radarIndicators[2].max = Math.max(radarIndicators[2].max, k.booked);
    radarIndicators[4].max = Math.max(radarIndicators[4].max, districts);
    return { name: c.name, value: [c.value, k.families, k.booked, k.suitableRate, districts], color: PALETTE[i % PALETTE.length] };
  });

  const period = periodStack(filtered, (r) => r.resultDate, (r) => resultGroup(r.result), [...groupsPresent], STATUS_COLORS, "month");
  const periodYear = periodStack(filtered, (r) => r.resultDate, (r) => resultGroup(r.result), [...groupsPresent], STATUS_COLORS, "year");

  return {
    byCityStack,
    cityResult,
    resultByService,
    doneByCity,
    period: period.option,
    periodYear: periodYear.option,
    periodHasData: period.hasData,
    periodMissing: period.missing,
    sankey: sankey(sankeyCityServiceResult(filtered)),
    heat: heatmap(cityService.rows, cityService.cols, cityService.get),
    services: donut(countBy(filtered, (r) => shortService(r.service)), "مستفيد", false, true),
    results: donut(countBy(filtered, (r) => resultGroup(r.result)), "نتيجة", true),
    resultDetail: horizontalBar(countBy(filtered.filter((r) => r.result), (r) => r.result), PALETTE[0], 20),
    timeline: timelineChart(timeline(filtered)),
    tree: treemap(tree),
    ages: columns(ageBuckets, PALETTE[0], "عدد الأشخاص"),
    ageByProgram,
    tat: columns(tatBuckets, PALETTE[1], "عدد النتائج"),
    famSizes: columns(famSizes, PALETTE[2], "عدد الأسر"),
    radar: radar(radarIndicators, radarSeries),
  };
}

export function buildChildCharts(children: ChildRecord[], refDate: string) {
  const months = refDate ? children.filter((c) => c.birthDate).map((c) => ageMonths(c.birthDate!, refDate)) : [];
  const services = countBy(children, (c) => c.service).map((s) => s.name);
  const results = uniq(children.map((c) => c.result || PENDING_RESULT));

  const serviceResult = stackedBar(
    services,
    results.map((res, i) => ({
      name: res,
      data: services.map((s) => children.filter((c) => label(c.service) === s && (c.result || PENDING_RESULT) === res).length),
      color: STATUS_COLORS[res] ?? PALETTE[i % PALETTE.length],
    })),
  );

  const durations = children
    .filter((c) => c.receivedDate && c.resultDate)
    .map((c) => daysBetween(c.receivedDate!, c.resultDate!))
    .filter((d) => d >= 0);

  const period = periodStack(children, childDate, (c) => c.result || PENDING_RESULT, results, STATUS_COLORS);

  return {
    results: donut(countBy(children, (c) => c.result || PENDING_RESULT), "طفل", true),
    services: donut(countBy(children, (c) => c.service), "فحص", false, true),
    serviceResult,
    cities: horizontalBar(countBy(children, (c) => c.city), PALETTE[1], 20),
    hospitals: horizontalBar(countBy(children, (c) => c.hospital), PALETTE[1], 22),
    duration: columns(bucket(durations, [0, 3, 7, 14, 30, 10000], ["0–2 يوم", "3–6 أيام", "1–2 أسبوع", "2–4 أسابيع", "+شهر"]), PALETTE[1], "عدد الحالات"),
    period: period.option,
    periodHasData: period.hasData,
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
