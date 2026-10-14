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

export const isDone =(status: string) => status.includes("تم");
export const isSuitable = (result: string) => result === "مناسب";
export const isHealthy = (result: string) => result === "سليم";

/** "التحقق الصحي للأسرة ( الأم )" ← "الأم" */
export function shortService(service: string): string {
  if (!service) return UNKNOWN;
  if (service.includes("الأم") || service.includes("الام")) return "الأم";
  if (service.includes("الأب") || service.includes("الاب")) return "الأب";
  if (service.includes("الأبناء") || service.includes("للابناء") || service.includes("18")) return "الأبناء";
  return service;
}

export function label(value: string): string {
  return value || UNKNOWN;
}

export function applyFamilyFilters(rows: FamilyRecord[], f: Filters): FamilyRecord[] {
  return rows.filter((r) => {
    if (f.cities.length && !f.cities.includes(label(r.city))) return false;
    if (f.services.length && !f.services.includes(shortService(r.service))) return false;
    if (f.statuses.length && !f.statuses.includes(label(r.status))) return false;
    if (f.results.length && !f.results.includes(label(r.result))) return false;
    if (f.from && (!r.labDate || r.labDate < f.from)) return false;
    if (f.to && (!r.labDate || r.labDate > f.to)) return false;
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

export function familyKpis(rows: FamilyRecord[]) {
  const families = new Set(rows.map((r) => r.family).filter(Boolean));
  const done = rows.filter((r) => isDone(r.status)).length;
  const withResult = rows.filter((r) => r.result);
  const suitable = withResult.filter((r) => isSuitable(r.result)).length;
  const turnaround = rows
    .filter((r) => r.labDate && r.resultDate)
    .map((r) => daysBetween(r.labDate!, r.resultDate!))
    .filter((d) => d >= 0);
  const avgTurnaround = turnaround.length
    ? Math.round((turnaround.reduce((s, d) => s + d, 0) / turnaround.length) * 10) / 10
    : null;
  return {
    total: rows.length,
    families: families.size,
    avgMembers: families.size ? Math.round((rows.length / families.size) * 10) / 10 : 0,
    done,
    pending: rows.length - done,
    completion: pct(done, rows.length),
    suitable,
    unsuitable: withResult.length - suitable,
    suitableRate: pct(suitable, withResult.length),
    avgTurnaround,
    cities: new Set(rows.map((r) => r.city).filter(Boolean)).size,
  };
}

export function childKpis(rows: ChildRecord[]) {
  const withResult = rows.filter((r) => r.result);
  const healthy = withResult.filter((r) => isHealthy(r.result)).length;
  return {
    total: rows.length,
    healthy,
    unhealthy: withResult.length - healthy,
    healthyRate: pct(healthy, withResult.length),
    withNotes: rows.filter((r) => r.notes).length,
    hospitals: new Set(rows.map((r) => r.hospital).filter(Boolean)).size,
    done: rows.filter((r) => isDone(r.status)).length,
  };
}

/** روابط Sankey: المدينة ← نوع الخدمة ← النتيجة */
export function sankeyCityServiceResult(rows: FamilyRecord[]) {
  const links = new Map<string, number>();
  const add = (s: string, t: string) => links.set(`${s}→${t}`, (links.get(`${s}→${t}`) ?? 0) + 1);
  rows.forEach((r) => {
    const city = label(r.city);
    const service = `خدمة: ${shortService(r.service)}`;
    const result = `نتيجة: ${r.result || "بانتظار النتيجة"}`;
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
