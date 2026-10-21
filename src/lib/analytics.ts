import type { ChildRecord, FamilyRecord } from "./types";

export const UNKNOWN = "غير محدد";

export type Filters = {
  cities: string[];
  services: string[];
  statuses: string[];
  results: string[];
  from: string;
  to: string;
};

export const emptyFilters: Filters = {
  cities: [],
  services: [],
  statuses: [],
  results: [],
  from: "",
  to: "",
};

const FILTER_KEYS = ["cities", "services", "statuses", "results"] as const;

/** الفلاتر ← query string، عشان التقرير يتفتح بنفس اختيارات الداشبورد */
export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  FILTER_KEYS.forEach((k) => f[k].forEach((v) => p.append(k, v)));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return p.toString();
}

export function filtersFromQuery(p: URLSearchParams): Filters {
  return {
    cities: p.getAll("cities"),
    services: p.getAll("services"),
    statuses: p.getAll("statuses"),
    results: p.getAll("results"),
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
  };
}

// Statuses now include "تم التواصل" and "تم جدولة الموعد", so only rows whose reports were uploaded count as done
export const isDone = (status: string) => status.includes("رفع التقارير") || status.trim() === "تمت";
export const isHealthy = (result: string) => result === "سليم";

export const PENDING_RESULT = "بانتظار النتيجة";
export const RESULT_GROUPS = ["مناسب", "غير مناسب", "بحاجة لمتابعة", PENDING_RESULT] as const;
export type ResultGroup = (typeof RESULT_GROUPS)[number];

/**
 * النتايج في الشيت أكتر من قيمتين ("مناسبة للتحفيز"، "لا يوصي بالتحفيز"، "بحاجة لجلسات دعم"...)
 * فبنجمعها في 3 مجموعات ثابتة عشان المؤشرات والألوان ماتتغيرش مع كل قيمة جديدة.
 */
export function resultGroup(result: string): ResultGroup {
  const r = result.trim();
  if (!r) return PENDING_RESULT;
  if (r.startsWith("غير") || r.startsWith("لا ")) return "غير مناسب";
  if (r.startsWith("مناسب") || r === "سليم") return "مناسب";
  return "بحاجة لمتابعة";
}

export const isSuitable = (result: string) => resultGroup(result) === "مناسب";

/** Full service name as written in the sheet list (the client asked for full terms), without extra spaces */
export function shortService(service: string): string {
  if (!service) return UNKNOWN;
  return service.replace(/\s+/g, " ").trim();
}

export function label(value: string): string {
  return value || UNKNOWN;
}

/** الموعد المحجوز = الصف اللي فيه تاريخ نتيجة (حسب تعريف العميل)، والفلتر الزمني بيمشي عليه */
export function applyFamilyFilters(rows: FamilyRecord[], f: Filters): FamilyRecord[] {
  return rows.filter((r) => {
    if (f.cities.length && !f.cities.includes(label(r.city))) return false;
    if (f.services.length && !f.services.includes(shortService(r.service))) return false;
    if (f.statuses.length && !f.statuses.includes(label(r.status))) return false;
    if (f.results.length && !f.results.includes(label(r.result))) return false;
    if (f.from && (!r.resultDate || r.resultDate < f.from)) return false;
    if (f.to && (!r.resultDate || r.resultDate > f.to)) return false;
    return true;
  });
}

/** تاريخ الطفل المستخدم في فلتر الفترة: تاريخ النتيجة، ولو مش موجود تاريخ الاستلام */
export const childDate = (c: ChildRecord) => c.resultDate ?? c.receivedDate ?? null;

export function applyChildFilters(rows: ChildRecord[], f: Filters): ChildRecord[] {
  return rows.filter((c) => {
    if (f.cities.length && !f.cities.includes(label(c.city))) return false;
    if (f.services.length && !f.services.includes(label(c.service))) return false;
    if (f.statuses.length && !f.statuses.includes(label(c.status))) return false;
    if (f.results.length && !f.results.includes(label(c.result || PENDING_RESULT))) return false;
    const d = childDate(c);
    if (f.from && (!d || d < f.from)) return false;
    if (f.to && (!d || d > f.to)) return false;
    return true;
  });
}

export type NameValue = { name: string; value: number };

export function countBy<T>(rows: T[], key: (r: T) => string): NameValue[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r) || UNKNOWN;
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function uniq(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ar"));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
}

export function ageYears(birthIso: string, atIso: string): number {
  const b = new Date(birthIso);
  const a = new Date(atIso);
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const m = a.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function ageMonths(birthIso: string, atIso: string): number {
  const b = new Date(birthIso);
  const a = new Date(atIso);
  let months = (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + (a.getUTCMonth() - b.getUTCMonth());
  if (a.getUTCDate() < b.getUTCDate()) months--;
  return Math.max(0, months);
}

export function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

/** العمر وقت الموعد (تاريخ النتيجة)، ولو مش موجود وقت آخر تحديث للبيانات */
export function familyAges(rows: FamilyRecord[], refDate: string): number[] {
  return rows
    .filter((r) => r.birthDate && (r.resultDate || r.labDate || refDate))
    .map((r) => ageYears(r.birthDate!, r.resultDate ?? r.labDate ?? refDate))
    .filter((a) => a >= 0 && a < 120);
}

export function familyKpis(rows: FamilyRecord[], refDate = "") {
  const families = new Set(rows.map((r) => r.family).filter(Boolean));
  const done = rows.filter((r) => isDone(r.status)).length;
  const booked = rows.filter((r) => r.resultDate);
  const completed = booked.filter((r) => r.result);
  const groups = countBy(completed, (r) => resultGroup(r.result));
  const g = (name: ResultGroup) => groups.find((x) => x.name === name)?.value ?? 0;
  const suitable = g("مناسب");
  const turnaround = rows
    .filter((r) => r.labDate && r.resultDate)
    .map((r) => daysBetween(r.labDate!, r.resultDate!))
    .filter((d) => d >= 0);
  return {
    total: rows.length,
    families: families.size,
    avgMembers: families.size ? Math.round((rows.length / families.size) * 10) / 10 : 0,
    booked: booked.length,
    completed: completed.length,
    pendingResult: booked.length - completed.length,
    done,
    pending: rows.length - done,
    completion: pct(done, rows.length),
    suitable,
    unsuitable: g("غير مناسب"),
    followUp: g("بحاجة لمتابعة"),
    suitableRate: pct(suitable, completed.length),
    avgTurnaround: avg(turnaround),
    avgAge: avg(familyAges(rows, refDate)),
    cities: new Set(rows.map((r) => r.city).filter(Boolean)).size,
    programs: new Set(rows.map((r) => shortService(r.service))).size,
  };
}

export const isBeforeReceipt = (service: string) => service.includes("قبل الاستلام");

export function childKpis(rows: ChildRecord[]) {
  const withResult = rows.filter((r) => r.result);
  const healthy = withResult.filter((r) => isHealthy(r.result)).length;
  const durations = rows
    .filter((r) => r.receivedDate && r.resultDate)
    .map((r) => daysBetween(r.receivedDate!, r.resultDate!))
    .filter((d) => d >= 0);
  return {
    total: rows.length,
    beforeReceipt: rows.filter((r) => isBeforeReceipt(r.service)).length,
    // عمود الخدمة (H) = نوع الفحص، وكل صف فيه خدمة = موعد محجوز
    booked: rows.filter((r) => r.service).length,
    services: new Set(rows.map((r) => r.service).filter(Boolean)).size,
    healthy,
    unhealthy: withResult.length - healthy,
    healthyRate: pct(healthy, withResult.length),
    withNotes: rows.filter((r) => r.notes).length,
    hospitals: new Set(rows.map((r) => r.hospital).filter(Boolean)).size,
    citiesFilled: rows.filter((r) => r.city).length,
    done: rows.filter((r) => isDone(r.status)).length,
    hasDurationData: durations.length > 0,
    durations,
    avgDuration: avg(durations),
  };
}

/** يجمّع التواريخ بالشهر لو المدى أكبر من شهرين، وإلا باليوم */
export function periodKey(dates: string[]): (iso: string) => string {
  const sorted = [...dates].sort();
  const span = sorted.length ? daysBetween(sorted[0], sorted[sorted.length - 1]) : 0;
  return span > 62 ? (iso) => iso.slice(0, 7) : (iso) => iso;
}

export type Granularity = "month" | "year";

export function periodKeyBy(granularity: Granularity): (iso: string) => string {
  return granularity === "year" ? (iso) => iso.slice(0, 4) : (iso) => iso.slice(0, 7);
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function periodLabel(key: string): string {
  const [y, m, d] = key.split("-");
  if (d) return `${Number(d)}/${Number(m)}`;
  if (m) return `${MONTHS_AR[Number(m) - 1]} ${y}`;
  return y;
}

/** روابط Sankey: المدينة ← نوع الخدمة ← النتيجة */
export function sankeyCityServiceResult(rows: FamilyRecord[]) {
  const links = new Map<string, number>();
  const add = (s: string, t: string) => links.set(`${s}→${t}`, (links.get(`${s}→${t}`) ?? 0) + 1);
  rows.forEach((r) => {
    const city = label(r.city);
    const service = `خدمة: ${shortService(r.service)}`;
    const result = `نتيجة: ${resultGroup(r.result)}`;
    add(city, service);
    add(service, result);
  });
  const nodes = new Set<string>();
  const out = [...links.entries()].map(([k, value]) => {
    const [source, target] = k.split("→");
    nodes.add(source);
    nodes.add(target);
    return { source, target, value };
  });
  return { nodes: [...nodes].map((name) => ({ name })), links: out };
}

export function matrix<T>(rows: T[], rowKey: (r: T) => string, colKey: (r: T) => string) {
  const rowsLabels = uniq(rows.map((r) => rowKey(r) || UNKNOWN));
  const colLabels = uniq(rows.map((r) => colKey(r) || UNKNOWN));
  const cells = new Map<string, number>();
  rows.forEach((r) => {
    const k = `${rowKey(r) || UNKNOWN}|${colKey(r) || UNKNOWN}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  });
  return {
    rows: rowsLabels,
    cols: colLabels,
    get: (rLabel: string, cLabel: string) => cells.get(`${rLabel}|${cLabel}`) ?? 0,
  };
}

export function timeline(rows: FamilyRecord[]) {
  const lab = new Map<string, number>();
  const res = new Map<string, number>();
  rows.forEach((r) => {
    if (r.labDate) lab.set(r.labDate, (lab.get(r.labDate) ?? 0) + 1);
    if (r.resultDate) res.set(r.resultDate, (res.get(r.resultDate) ?? 0) + 1);
  });
  const dates = uniq([...lab.keys(), ...res.keys()]).sort();
  let cumLab = 0;
  let cumRes = 0;
  return dates.map((d) => {
    cumLab += lab.get(d) ?? 0;
    cumRes += res.get(d) ?? 0;
    return { date: d, lab: lab.get(d) ?? 0, result: res.get(d) ?? 0, cumLab, cumRes };
  });
}

export function bucket(values: number[], edges: number[], labels: string[]): NameValue[] {
  const counts = labels.map((name) => ({ name, value: 0 }));
  values.forEach((v) => {
    const i = edges.findIndex((e) => v < e);
    const idx = i === -1 ? labels.length - 1 : Math.max(0, i - 1);
    counts[idx].value++;
  });
  return counts;
}

export function completeness<T extends Record<string, unknown>>(rows: T[], fields: { key: keyof T; label: string }[]) {
  return fields.map((f) => {
    const filled = rows.filter((r) => {
      const v = r[f.key];
      return v !== null && v !== undefined && v !== "";
    }).length;
    return { name: f.label, value: pct(filled, rows.length) };
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}
