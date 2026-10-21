import type {
  ChildRecord,
  DataIssue,
  FamilyRecord,
  FieldLists,
  PsychRecord,
} from "./types";

export type RawSheet = unknown[][];

export const SHEET_LABELS = {
  family: "فحوصات التحقق الصحي للأسرة",
  children: "فحص الأطفال قبل الاستلام",
  psych: "الفحص النفسي",
} as const;

/** يوحّد الكتابة العربية عشان مطابقة العناوين ماتتأثرش بالهمزات والتاء المربوطة. */
export function normalizeArabic(value: string): string {
  return value
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  return s === "-" || s === "—" ? "" : s;
}

type ParsedDate = { iso: string | null; problem?: string };

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

function toIso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** يقبل الرقم التسلسلي بتاع Sheets، أو نص بصيغة يوم/شهر/سنة أو سنة/شهر/يوم. */
export function parseDate(value: unknown): ParsedDate {
  if (value === null || value === undefined || value === "") return { iso: null };
  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      const ms = Math.round((value - 25569) * 86400000);
      return { iso: new Date(ms).toISOString().slice(0, 10) };
    }
    return { iso: null, problem: "قيمة تاريخ غير مفهومة" };
  }
  const s = text(value);
  if (!s) return { iso: null };
  const parts = s.split(/[/\-.]/).map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return { iso: null, problem: `صيغة تاريخ غير مفهومة "${s}"` };
  }
  let [a, b, c] = parts;
  let y: number, m: number, d: number;
  if (a > 31) {
    [y, m, d] = [a, b, c];
  } else {
    [d, m, y] = [a, b, c];
  }
  if (y < 100) y += 2000;
  if (y < 1600) return { iso: null, problem: `تاريخ هجري "${s}" يحتاج تحويل للميلادي` };
  const iso = toIso(y, m, d);
  if (!iso) {
    // احتمال الصيغة شهر/يوم
    [a, b, c] = [m, d, y];
    const swapped = toIso(c, b, a);
    if (swapped) return { iso: swapped };
    return { iso: null, problem: `تاريخ غير صالح "${s}"` };
  }
  return { iso };
}

type Matcher = (h: string) => boolean;

function findHeaderRow(rows: RawSheet, markers: string[]): number {
  const limit = Math.min(rows.length, 6);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map((c) => normalizeArabic(text(c)));
    if (markers.some((m) => cells.includes(m))) return i;
  }
  return 0;
}

function mapColumns<K extends string>(
  headers: string[],
  matchers: Record<K, Matcher>,
): Record<K, number> {
  const used = new Set<number>();
  const out = {} as Record<K, number>;
  for (const key of Object.keys(matchers) as K[]) {
    const idx = headers.findIndex((h, i) => !used.has(i) && h && matchers[key](h));
    out[key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

function cell(row: unknown[], idx: number): unknown {
  return idx >= 0 ? row[idx] : undefined;
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((c) => text(c) === "");
}

export function normalizeFamily(rows: RawSheet, issues: DataIssue[]): FamilyRecord[] {
  const sheet = SHEET_LABELS.family;
  const headerRow = findHeaderRow(rows, ["الاسم"]);
  const headers = (rows[headerRow] ?? []).map((c) => normalizeArabic(text(c)));
  // الترتيب مهم: الحقول الأدق الأول عشان "تاريخ النتيجة" مايتاخدش كـ "النتيجة"
  const col = mapColumns(headers, {
    resultDate: (h) => h.includes("تاريخ") && h.includes("النتيجه"),
    labDate: (h) => h.includes("الفحوصات") || h.includes("المخبريه"),
    birthDate: (h) => h.includes("الميلاد"),
    requestNo: (h) => h.includes("رقم الطلب"),
    status: (h) => h.includes("حاله الخدمه"),
    service: (h) => h.includes("الخدمه"),
    result: (h) => h === "النتيجه",
    notes: (h) => h.startsWith("ملاحظات"),
    city: (h) => h === "المدينه",
    district: (h) => h.includes("الحي"),
    name: (h) => h === "الاسم",
    family: (h) => h.includes("الاسره"),
  });

  const out: FamilyRecord[] = [];
  let lastFamily: string | null = null;
  rows.slice(headerRow + 1).forEach((row, i) => {
    if (!row || isEmptyRow(row)) return;
    const sheetRow = headerRow + i + 2;
    const name = text(cell(row, col.name));
    if (!name) return;

    // الخلايا المدموجة بترجع قيمة في أول صف بس، فبنكمّل رقم الأسرة للصفوف اللي بعده
    const rawFamily = text(cell(row, col.family));
    const family = rawFamily || lastFamily;
    if (rawFamily) lastFamily = rawFamily;

    const dates = {
      birthDate: parseDate(cell(row, col.birthDate)),
      labDate: parseDate(cell(row, col.labDate)),
      resultDate: parseDate(cell(row, col.resultDate)),
    };
    const labels = { birthDate: "تاريخ الميلاد", labDate: "تاريخ الفحوصات", resultDate: "تاريخ النتيجة" };
    for (const k of Object.keys(dates) as (keyof typeof dates)[]) {
      if (dates[k].problem) {
        issues.push({ sheet, row: sheetRow, field: labels[k], message: dates[k].problem!, level: "error" });
      }
    }

    const record: FamilyRecord = {
      id: `f-${sheetRow}`,
      family,
      name,
      city: text(cell(row, col.city)),
      district: text(cell(row, col.district)),
      service: text(cell(row, col.service)),
      status: text(cell(row, col.status)),
      result: text(cell(row, col.result)),
      notes: text(cell(row, col.notes)),
      requestNo: text(cell(row, col.requestNo)),
      birthDate: dates.birthDate.iso,
      labDate: dates.labDate.iso,
      resultDate: dates.resultDate.iso,
    };

    if (record.labDate && record.resultDate && record.resultDate < record.labDate) {
      issues.push({
        sheet,
        row: sheetRow,
        field: "تاريخ النتيجة",
        message: `تاريخ النتيجة (${dmy(record.resultDate)}) قبل تاريخ الفحوصات (${dmy(record.labDate)})`,
        level: "warning",
      });
    }
    if (!record.labDate && !dates.labDate.problem) {
      issues.push({ sheet, row: sheetRow, field: "تاريخ الفحوصات", message: "تاريخ الفحوصات غير مسجل", level: "warning" });
    }
    if (record.requestNo && !/^[A-Za-z]{2,}\d+$/.test(record.requestNo)) {
      issues.push({
        sheet,
        row: sheetRow,
        field: "رقم الطلب",
        message: `رقم الطلب "${record.requestNo}" مش بالصيغة المعتادة`,
        level: "warning",
      });
    }
    out.push(record);
  });

  // رقم طلب متكرر لأكثر من شخص
  const seen = new Map<string, number>();
  out.forEach((r) => {
    if (!r.requestNo || !/^[A-Za-z]{2,}\d+$/.test(r.requestNo)) return;
    seen.set(r.requestNo, (seen.get(r.requestNo) ?? 0) + 1);
  });
  seen.forEach((count, req) => {
    if (count > 1) {
      issues.push({ sheet, row: 0, field: "رقم الطلب", message: `رقم الطلب ${req} مكرر ${count} مرات`, level: "warning" });
    }
  });
  return out;
}

export function normalizeChildren(rows: RawSheet, issues: DataIssue[]): ChildRecord[] {
  const sheet = SHEET_LABELS.children;
  const headerRow = findHeaderRow(rows, ["الاسم"]);
  const headers = (rows[headerRow] ?? []).map((c) => normalizeArabic(text(c)));
  const col = mapColumns(headers, {
    // الأعمدة الاختيارية الأول عشان "تاريخ النتيجة" مايتاخدش كـ "النتيجة"
    resultDate: (h) => h.includes("تاريخ") && h.includes("النتيجه"),
    receivedDate: (h) => h.includes("الاستلام") && !h.includes("قبل"),
    birthDate: (h) => h.includes("الميلاد"),
    status: (h) => h.includes("حاله الخدمه"),
    service: (h) => h.includes("الخدمه"),
    result: (h) => h === "النتيجه",
    notes: (h) => h.startsWith("ملاحظات"),
    hospital: (h) => h.includes("المستشفي"),
    city: (h) => h === "المدينه",
    gender: (h) => h.includes("الجنس"),
    guardian: (h) => h.includes("الحاضنه"),
    name: (h) => h === "الاسم",
  });

  const out: ChildRecord[] = [];
  rows.slice(headerRow + 1).forEach((row, i) => {
    if (!row || isEmptyRow(row)) return;
    const sheetRow = headerRow + i + 2;
    const name = text(cell(row, col.name));
    if (!name) return;
    const birth = parseDate(cell(row, col.birthDate));
    const received = parseDate(cell(row, col.receivedDate));
    const resultAt = parseDate(cell(row, col.resultDate));
    const dateProblems: [string, ParsedDate][] = [["تاريخ الميلاد", birth], ["تاريخ الاستلام", received], ["تاريخ النتيجة", resultAt]];
    for (const [field, d] of dateProblems) {
      if (d.problem) issues.push({ sheet, row: sheetRow, field, message: d.problem, level: "error" });
    }
    if (received.iso && resultAt.iso && resultAt.iso < received.iso) {
      issues.push({
        sheet,
        row: sheetRow,
        field: "تاريخ النتيجة",
        message: `تاريخ النتيجة (${dmy(resultAt.iso)}) قبل تاريخ الاستلام (${dmy(received.iso)})`,
        level: "warning",
      });
    }
    out.push({
      id: `c-${sheetRow}`,
      name,
      gender: text(cell(row, col.gender)),
      birthDate: birth.iso,
      hospital: text(cell(row, col.hospital)),
      city: text(cell(row, col.city)),
      service: text(cell(row, col.service)),
      status: text(cell(row, col.status)),
      result: text(cell(row, col.result)),
      notes: text(cell(row, col.notes)),
      guardian: text(cell(row, col.guardian)),
      receivedDate: received.iso,
      resultDate: resultAt.iso,
    });
  });

  if (out.length && out.some((r) => !r.city) && out.some((r) => r.city)) {
    const missing = out.filter((r) => !r.city).length;
    issues.push({ sheet, row: 0, field: "المدينة", message: `عمود المدينة فاضي في ${missing} من ${out.length} حالات`, level: "warning" });
  }
  if (out.length && out.every((r) => !r.city)) {
    issues.push({ sheet, row: 0, field: "المدينة", message: "عمود المدينة فاضي لكل الحالات", level: "warning" });
  }
  if (out.length && out.every((r) => !r.gender)) {
    issues.push({ sheet, row: 0, field: "الجنس", message: "عمود الجنس فاضي لكل الحالات", level: "warning" });
  }
  return out;
}

export function normalizePsych(rows: RawSheet): PsychRecord[] {
  const headerRow = findHeaderRow(rows, ["اسم الحاضنه"]);
  const headers = (rows[headerRow] ?? []).map((c) => normalizeArabic(text(c)));
  const col = mapColumns(headers, {
    guardian: (h) => h.includes("الحاضنه"),
    status: (h) => h.includes("حاله الخدمه"),
    caseType: (h) => h === "الحاله",
    age: (h) => h.includes("العمر"),
    city: (h) => h.includes("المدينه"),
    specialist: (h) => h.includes("الاخصائي"),
    service: (h) => h.includes("الخدمه"),
    reports: (h) => h.includes("التقارير"),
  });
  // عمود العمر في الشيت أحيانًا من غير عنوان، وبييجي بعد عمود الحالة مباشرة
  const ageIdx = col.age >= 0 ? col.age : col.caseType >= 0 ? col.caseType + 1 : -1;

  const out: PsychRecord[] = [];
  rows.slice(headerRow + 1).forEach((row, i) => {
    if (!row || isEmptyRow(row)) return;
    const guardian = text(cell(row, col.guardian));
    const caseType = text(cell(row, col.caseType));
    if (!guardian && !caseType) return;
    const ageNum = Number(text(cell(row, ageIdx)));
    out.push({
      id: `p-${headerRow + i + 2}`,
      guardian,
      caseType,
      age: Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null,
      city: text(cell(row, col.city)),
      specialist: text(cell(row, col.specialist)),
      service: text(cell(row, col.service)),
      status: text(cell(row, col.status)),
      reports: text(cell(row, col.reports)),
    });
  });
  return out;
}

/** Converts sheet dropdown lists (column header + options) into filter options */
export function fieldListsFromColumns(columns: { header: string; list: string[] }[]): FieldLists {
  const find = (match: (h: string) => boolean) => {
    const col = columns.find((c) => match(normalizeArabic(c.header)));
    return col ? [...new Set(col.list.map((v) => text(v)).filter(Boolean))] : [];
  };
  return {
    services: find((h) => h.includes("الخدمه") && !h.includes("حاله")),
    statuses: find((h) => h.includes("حاله الخدمه")),
    results: find((h) => h === "النتيجه"),
    cities: find((h) => h === "المدينه"),
  };
}
