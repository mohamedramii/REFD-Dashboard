import "server-only";
import { createSign } from "node:crypto";
import { demoChildren, demoFamily, demoLists, demoPsych } from "./demo-data";
import {
  fieldListsFromColumns,
  normalizeArabic,
  normalizeChildren,
  normalizeFamily,
  normalizePsych,
  SHEET_LABELS,
  type RawSheet,
} from "./normalize";
import type { DashboardData, DataIssue, FieldLists } from "./types";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const CACHE_SECONDS = Number(process.env.SHEET_CACHE_SECONDS ?? 30);

function config() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!email || !key || !sheetId) return null;
  return {
    email,
    key,
    sheetId,
    tabs: {
      family: process.env.SHEET_TAB_FAMILY ?? SHEET_LABELS.family,
      children: process.env.SHEET_TAB_CHILDREN ?? "فحص الاطفال قبل الاستلام",
      psych: process.env.SHEET_TAB_PSYCH ?? SHEET_LABELS.psych,
    },
  };
}

export function isGoogleConfigured(): boolean {
  return config() !== null;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(email: string, key: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) return tokenCache.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key).toString("base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`فشل تسجيل الدخول لـ Google (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

/** Fetches the actual tab names and matches them loosely (hamza, extra spaces, taa marbuta). */
async function resolveTabs(cfg: NonNullable<ReturnType<typeof config>>, token: string) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`تعذّر قراءة أسماء الشيتات (${res.status})`);
  const json = (await res.json()) as { sheets: { properties: { title: string } }[] };
  const titles = json.sheets.map((s) => s.properties.title);
  const norm = (s: string) => normalizeArabic(s).replace(/\s/g, "");

  const pick = (wanted: string, keywords: string[]) =>
    titles.find((t) => norm(t) === norm(wanted)) ??
    titles.find((t) => keywords.every((k) => norm(t).includes(norm(k))));

  return {
    family: pick(cfg.tabs.family, ["التحقق"]) ?? pick(cfg.tabs.family, ["الاسره"]),
    children: pick(cfg.tabs.children, ["الاطفال"]),
    psych: pick(cfg.tabs.psych, ["النفسي"]),
    titles,
  };
}

async function fetchGoogleSheets(cfg: NonNullable<ReturnType<typeof config>>) {
  const token = await getAccessToken(cfg.email, cfg.key);
  const tabs = await resolveTabs(cfg, token);
  if (!tabs.family) {
    throw new Error(`مالقيتش شيت فحوصات الأسرة. الشيتات الموجودة: ${tabs.titles.join("، ")}`);
  }
  // Missing tabs come back empty instead of failing the whole request
  const wanted = [tabs.family, tabs.children, tabs.psych];
  const present = wanted.filter((t): t is string => Boolean(t));
  const ranges = present.map((t) => `'${t.replace(/'/g, "''")}'!A1:Z2000`);
  const params = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  ranges.forEach((r) => params.append("ranges", r));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}/values:batchGet?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets رجّع ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { valueRanges: { values?: RawSheet }[] };
  const byTab = new Map(present.map((t, i) => [t, json.valueRanges[i]?.values ?? []]));
  const get = (t: string | undefined): RawSheet => (t ? byTab.get(t) ?? [] : []);

  // Dropdown lists are optional: if they fail, filters show only the values present in the data
  const [famLists, kidLists] = await Promise.all([
    tabs.family ? fetchDropdowns(cfg.sheetId, tabs.family, token).catch(() => null) : null,
    tabs.children ? fetchDropdowns(cfg.sheetId, tabs.children, token).catch(() => null) : null,
  ]);
  const empty: FieldLists = { services: [], statuses: [], results: [], cities: [] };
  return {
    family: get(tabs.family),
    children: get(tabs.children),
    psych: get(tabs.psych),
    lists: { family: famLists ?? empty, children: kidLists ?? empty },
  };
}

type GridCell = {
  formattedValue?: string;
  dataValidation?: { condition?: { type?: string; values?: { userEnteredValue?: string }[] } };
};

/** Reads dropdown options (data validation) from the first rows of the sheet */
async function fetchDropdowns(sheetId: string, tab: string, token: string): Promise<FieldLists> {
  const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    ranges: `${q(tab)}!A1:Z6`,
    fields: "sheets.data.rowData.values(formattedValue,dataValidation.condition)",
  });
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`dropdowns ${res.status}`);
  const json = (await res.json()) as { sheets?: { data?: { rowData?: { values?: GridCell[] }[] }[] }[] };
  const rows = (json.sheets?.[0]?.data?.[0]?.rowData ?? []).map((r) => r.values ?? []);
  const headerIdx = Math.max(
    0,
    rows.findIndex((r) => r.some((c) => ["الاسم", "اسم الحاضنه"].includes(normalizeArabic(c.formattedValue ?? "")))),
  );
  const headers = rows[headerIdx] ?? [];

  const columns: { header: string; list: string[] }[] = [];
  for (let col = 0; col < headers.length; col++) {
    const header = headers[col]?.formattedValue ?? "";
    const cond = rows.slice(headerIdx + 1).map((r) => r[col]?.dataValidation?.condition).find(Boolean);
    if (!header || !cond?.values?.length) continue;
    if (cond.type === "ONE_OF_LIST") {
      columns.push({ header, list: cond.values.map((v) => v.userEnteredValue ?? "") });
    } else if (cond.type === "ONE_OF_RANGE") {
      // The list comes from a range in the sheet (as in converted Excel files): read that range
      const range = (cond.values[0].userEnteredValue ?? "").replace(/^=/, "").replace(/\$/g, "");
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?majorDimension=COLUMNS`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (r.ok) {
        const v = (await r.json()) as { values?: string[][] };
        columns.push({ header, list: (v.values ?? []).flat() });
      }
    }
  }
  return fieldListsFromColumns(columns);
}

function build(
  raw: { family: RawSheet; children: RawSheet; psych: RawSheet; lists?: DashboardData["lists"] },
  source: DashboardData["source"],
): DashboardData {
  const issues: DataIssue[] = [];
  return {
    source,
    fetchedAt: new Date().toISOString(),
    family: normalizeFamily(raw.family, issues),
    children: normalizeChildren(raw.children, issues),
    psych: normalizePsych(raw.psych),
    issues,
    lists: raw.lists,
  };
}

let dataCache: { data: DashboardData; at: number } | null = null;

/** One request to Google every CACHE_SECONDS, however many people have the dashboard open. */
export async function getDashboardData(force = false): Promise<DashboardData> {
  const cfg = config();
  if (!cfg) return build({ family: demoFamily, children: demoChildren, psych: demoPsych, lists: demoLists }, "demo");

  const fresh = dataCache && Date.now() - dataCache.at < CACHE_SECONDS * 1000;
  if (fresh && !force) return dataCache!.data;

  try {
    const data = build(await fetchGoogleSheets(cfg), "google");
    dataCache = { data, at: Date.now() };
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    // If Google fails, show the last successful copy instead of an empty screen
    if (dataCache) return { ...dataCache.data, error: message };
    return { ...build({ family: [], children: [], psych: [] }, "google"), error: message };
  }
}
