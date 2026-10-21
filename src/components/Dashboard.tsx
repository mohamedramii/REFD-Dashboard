"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  applyChildFilters,
  applyFamilyFilters,
  childKpis,
  completeness,
  emptyFilters,
  familyKpis,
  type Filters,
  type Granularity,
  filtersToQuery,
  isDone,
  label,
  PENDING_RESULT,
  shortService,
  uniq,
} from "@/lib/analytics";
import { Chart } from "./charts/Chart";
import { buildChildCharts, buildFamilyCharts } from "./charts/build";
import { REFRESH_MS, useDashboardData } from "./useDashboardData";
import { Icons } from "./icons";
import { ChartCard, EmptyChart, KpiCard, MultiSelect, SectionTitle } from "./ui";
import { RecordsTable } from "./RecordsTable";
import { QualityPanel } from "./QualityPanel";

const TABS = [
  { id: "family", label: "لوحة الأسر" },
  { id: "children", label: "لوحة الأطفال" },
  { id: "quality", label: "جودة البيانات" },
  { id: "records", label: "السجلات" },
] as const;
type TabId = (typeof TABS)[number]["id"];
// التبويبين اللي طلبهم العميل ظاهرين، وجودة البيانات والسجلات متخفيين لحد ما يتطلبوا
const VISIBLE_TABS: TabId[] = ["family", "children"];

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return "الآن";
  if (s < 60) return `منذ ${s} ثانية`;
  const m = Math.round(s / 60);
  return m < 60 ? `منذ ${m} دقيقة` : new Date(iso).toLocaleTimeString("ar-EG");
}

/** The original list in its order, followed by extra values from the data sorted alphabetically */
function withList(list: string[] | undefined, values: string[]): string[] {
  const base = (list ?? []).filter(Boolean);
  const extra = uniq(values.filter((v) => !base.includes(v)));
  return [...base, ...extra];
}

const countActive = (f: Filters) =>
  f.cities.length + f.services.length + f.statuses.length + f.results.length + (f.from ? 1 : 0) + (f.to ? 1 : 0);

export function Dashboard() {
  const { data, loading, netError, reload } = useDashboardData();
  const [tab, setTab] = useState<TabId>("family");
  const [famFilters, setFamFilters] = useState<Filters>(emptyFilters);
  const [kidFilters, setKidFilters] = useState<Filters>(emptyFilters);
  const [granularity, setGranularity] = useState<Granularity>("month");
  // The current time is read in the browser only, so the page can be prerendered without a changing value
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // تاريخ مرجعي لحساب الأعمار: وقت آخر جلب للبيانات
  const refDate = data?.fetchedAt.slice(0, 10) ?? "";

  const family = useMemo(() => data?.family ?? [], [data]);
  const children = useMemo(() => data?.children ?? [], [data]);
  const fam = useMemo(() => applyFamilyFilters(family, famFilters), [family, famFilters]);
  const kids = useMemo(() => applyChildFilters(children, kidFilters), [children, kidFilters]);

  // Options = the sheet dropdown list in order (including unused values), then any extra values found in the data
  const famLists = data?.lists?.family;
  const kidLists = data?.lists?.children;
  const famOptions = useMemo(
    () => ({
      cities: withList(famLists?.cities, family.map((r) => label(r.city))),
      services: withList(famLists?.services.map(shortService), family.map((r) => shortService(r.service))),
      statuses: withList(famLists?.statuses, family.map((r) => label(r.status))),
      results: withList(famLists?.results, family.map((r) => label(r.result))),
    }),
    [family, famLists],
  );
  const kidOptions = useMemo(
    () => ({
      cities: withList(kidLists?.cities, children.map((c) => label(c.city))),
      services: withList(kidLists?.services, children.map((c) => label(c.service))),
      statuses: withList(kidLists?.statuses, children.map((c) => label(c.status))),
      results: withList(kidLists?.results, children.map((c) => c.result || PENDING_RESULT)),
    }),
    [children, kidLists],
  );

  const fk = useMemo(() => familyKpis(fam, refDate), [fam, refDate]);
  const ck = useMemo(() => childKpis(kids), [kids]);
  const charts = useMemo(() => buildFamilyCharts(fam, refDate), [fam, refDate]);
  const kidCharts = useMemo(() => buildChildCharts(kids, refDate), [kids, refDate]);
  const kidsHaveDates = children.some((c) => c.receivedDate || c.resultDate);

  const toggleFam = (key: "cities" | "services" | "results", value: string) =>
    setFamFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));
  const toggleKid = (key: "cities" | "services" | "results", value: string) =>
    setKidFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  const quality = useMemo(
    () =>
      completeness(family, [
        { key: "requestNo", label: "رقم الطلب" },
        { key: "birthDate", label: "تاريخ الميلاد" },
        { key: "city", label: "المدينة" },
        { key: "district", label: "الحي" },
        { key: "result", label: "النتيجة" },
        { key: "labDate", label: "تاريخ الفحوصات" },
        { key: "resultDate", label: "تاريخ النتيجة" },
      ]),
    [family],
  );

  return (
    <div className="refd-backdrop min-h-screen">
      {/* ---------- الهيدر ---------- */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 md:px-8">
          <Image src="/refd-logo.png" alt="رفد" width={1213} height={646} priority className="h-12 w-auto" />
          <div className="hidden h-9 w-px bg-line md:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-ink md:text-xl">لوحة متابعة الفحوصات</h1>
            <p className="truncate text-xs text-muted">التحقق الصحي للأسر · فحص الأطفال قبل الاستلام</p>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <div className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs sm:flex">
                <span className={`live-dot relative size-2 rounded-full ${data.source === "google" && !data.error ? "text-success bg-success" : "text-warning bg-warning"}`} />
                <span className="font-medium text-ink">{data.source === "google" ? "متصل بـ Google Sheets" : "بيانات تجريبية"}</span>
                <span className="text-muted">· آخر تحديث {timeAgo(data.fetchedAt, now)}</span>
              </div>
            )}
            <a
              href={`/report?${filtersToQuery(famFilters)}`}
              target="_blank"
              rel="noopener"
              className="flex h-10 items-center gap-2 rounded-xl border border-refd-purple/30 bg-white px-4 text-sm font-medium text-refd-purple transition hover:bg-refd-purple-50"
            >
              <Icons.printer />
              <span className="hidden sm:inline">تقرير PDF</span>
            </a>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl bg-refd-purple px-4 text-sm font-medium text-white shadow-lg shadow-refd-purple/25 transition hover:bg-refd-purple-600 disabled:opacity-70"
            >
              <span className={loading ? "animate-spin" : ""}>
                <Icons.refresh />
              </span>
              <span className="hidden sm:inline">تحديث</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 md:px-8 scrollbar-thin">
          {TABS.filter((t) => VISIBLE_TABS.includes(t.id)).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition ${
                tab === t.id ? "text-refd-purple" : "text-muted hover:text-ink"
              }`}
            >
              {t.id === "family" ? <Icons.home /> : t.id === "children" ? <Icons.baby /> : null}
              {t.label}
              {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-gradient-to-l from-refd-cyan to-refd-purple" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 md:px-8">
        {(netError || data?.error) && (
          <div className="card flex items-center gap-3 border-danger/30 bg-[#FBE5E9] p-4 text-sm text-danger">
            <Icons.alert />
            <span>
              {data?.error ? `تعذّر جلب أحدث بيانات من Google، وبيظهر آخر نسخة ناجحة. (${data.error})` : `تعذّر الاتصال بالسيرفر: ${netError}`}
            </span>
          </div>
        )}
        {data?.source === "demo" && (
          <div className="card flex flex-wrap items-center gap-3 border-refd-cyan/40 bg-refd-cyan-100/60 p-4 text-sm text-ink">
            <span className="grid size-8 place-items-center rounded-xl bg-white text-refd-cyan-600">
              <Icons.alert />
            </span>
            <span className="flex-1">
              اللوحة بتعرض <b>بيانات تجريبية وهمية</b>. أضف بيانات حساب الخدمة في ملف <code className="rounded bg-white px-1.5">.env.local</code> عشان تتحول للشيت الحقيقي.
            </span>
          </div>
        )}

        {!data && <LoadingState />}

        {/* ================= لوحة الأسر ================= */}
        {data && tab === "family" && (
          <>
            <FiltersBar
              filters={famFilters}
              setFilters={setFamFilters}
              options={famOptions}
              labels={{ cities: "المدينة", services: "نوع البرنامج", statuses: "حالة الخدمة", results: "النتيجة" }}
              periodLabel="فترة الموعد"
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="عدد الأشخاص المفحوصين" value={fk.total} hint={`${fk.families} أسرة · ${fk.cities} مدن`} icon={<Icons.clipboard />} />
              <KpiCard label="المواعيد المحجوزة" value={fk.booked} hint="حسب تاريخ النتيجة" tone="cyan" icon={<Icons.calendar />} />
              <KpiCard
                label="تمت وظهرت نتيجتها"
                value={fk.completed}
                hint={fk.pendingResult ? `${fk.pendingResult} بانتظار النتيجة` : "كل المواعيد ليها نتيجة"}
                tone="purple"
                icon={<Icons.check />}
                progress={fk.booked ? (fk.completed / fk.booked) * 100 : 0}
              />
              <KpiCard label="مناسب" value={fk.suitable} hint={`${fk.suitableRate}% من النتايج`} tone="success" icon={<Icons.heart />} progress={fk.suitableRate} />
              <KpiCard label="غير مناسب" value={fk.unsuitable} hint="محتاج مراجعة" tone="danger" icon={<Icons.alert />} />
              <KpiCard label="بحاجة لمتابعة" value={fk.followUp} hint={fk.avgAge !== null ? `متوسط العمر ${fk.avgAge} سنة` : undefined} tone="warning" icon={<Icons.clock />} />
            </div>

            <SectionTitle title="المستفيدين حسب الفترة" subtitle="عدد المواعيد في كل فترة، مقسمة حسب النتيجة · غيّر الفترة من الفلتر فوق" />
            <ChartCard
              title="المواعيد المحجوزة على مدار الوقت"
              action={<GranularityToggle value={granularity} onChange={setGranularity} />}
            >
              {charts.periodHasData ? (
                <Chart option={granularity === "year" ? charts.periodYear : charts.period} height={300} />
              ) : (
                <EmptyChart text="مافيش مواعيد في الفترة دي" />
              )}
            </ChartCard>

            <SectionTitle title="المدن ونوع البرنامج" subtitle="اضغط على أي مدينة أو برنامج عشان تفلتر اللوحة كلها" />
            <div className="grid gap-5 lg:grid-cols-5">
              <ChartCard title="المستفيدين حسب المدينة" subtitle="مقسمين حسب النتيجة" className="lg:col-span-3">
                <Chart option={charts.cityResult} height={300} onClickName={(n) => toggleFam("cities", n)} />
              </ChartCard>
              <ChartCard title="نوع البرنامج" subtitle="الخدمة المقدمة" className="lg:col-span-2">
                <Chart option={charts.services} height={300} onClickName={(n) => toggleFam("services", n)} />
              </ChartCard>
            </div>

            <SectionTitle title="العمر والنتائج" />
            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="الفئات العمرية" subtitle="العمر وقت الموعد، محسوب من تاريخ الميلاد">
                <Chart option={charts.ages} height={270} />
              </ChartCard>
              <ChartCard title="العمر × نوع البرنامج">
                <Chart option={charts.ageByProgram} height={270} />
              </ChartCard>
              <ChartCard title="النتائج" subtitle="مناسب / غير مناسب / بحاجة لمتابعة">
                <Chart option={charts.results} height={270} onClickName={(n) => toggleFam("results", n)} />
              </ChartCard>
            </div>

            <div className="grid gap-5 lg:grid-cols-5">
              <ChartCard title="مسار الحالات" subtitle="المدينة ← نوع البرنامج ← النتيجة" className="lg:col-span-3">
                <Chart option={charts.sankey} height={330} />
              </ChartCard>
              <ChartCard title="تفاصيل النتايج" subtitle="كل نتيجة زي ما مكتوبة في الشيت" className="lg:col-span-2">
                <Chart option={charts.resultDetail} height={330} />
              </ChartCard>
            </div>
          </>
        )}

        {/* ================= لوحة الأطفال ================= */}
        {data && tab === "children" && (
          <>
            <FiltersBar
              filters={kidFilters}
              setFilters={setKidFilters}
              options={kidOptions}
              labels={{ cities: "المدينة", services: "نوع الفحص", statuses: "حالة الخدمة", results: "نتيجة الفحص" }}
              periodLabel="الفترة"
              periodDisabled={!kidsHaveDates}
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="عدد الفحوصات" value={ck.total} hint={`${ck.services} أنواع فحص`} icon={<Icons.clipboard />} />
              <KpiCard label="فحص قبل الاستلام" value={ck.beforeReceipt} hint={`من ${ck.total} فحص`} tone="cyan" icon={<Icons.baby />} progress={ck.total ? (ck.beforeReceipt / ck.total) * 100 : 0} />
              <KpiCard label="المواعيد المحجوزة" value={ck.booked} hint="حسب نوع الفحص" tone="purple" icon={<Icons.calendar />} />
              <KpiCard label="سليم" value={ck.healthy} hint={`${ck.healthyRate}% من النتايج`} tone="success" icon={<Icons.heart />} progress={ck.healthyRate} />
              <KpiCard label="غير سليم" value={ck.unhealthy} hint={`${ck.withNotes} عليها ملاحظات`} tone="danger" icon={<Icons.alert />} />
              <KpiCard
                label="من الاستلام للنتيجة"
                value={ck.avgDuration !== null ? `${ck.avgDuration}` : "—"}
                hint={ck.hasDurationData ? "متوسط بالأيام" : "بانتظار عمود تاريخ الاستلام"}
                tone="warning"
                icon={<Icons.clock />}
              />
            </div>

            <SectionTitle title="نوع الفحص والنتيجة" subtitle="اضغط على أي نوع فحص أو نتيجة عشان تفلتر" />
            <div className="grid gap-5 lg:grid-cols-5">
              <ChartCard title="المواعيد المحجوزة حسب نوع الفحص" subtitle="عمود الخدمة المقدمة" className="lg:col-span-3">
                <Chart option={kidCharts.services} height={Math.max(240, ck.services * 46)} onClickName={(n) => toggleKid("services", n)} />
              </ChartCard>
              <ChartCard title="نتيجة الفحص" className="lg:col-span-2">
                <Chart option={kidCharts.results} height={Math.max(240, ck.services * 46)} onClickName={(n) => toggleKid("results", n)} />
              </ChartCard>
            </div>
            <ChartCard title="النتيجة حسب نوع الفحص">
              <Chart option={kidCharts.serviceResult} height={280} />
            </ChartCard>

            <SectionTitle title="المدينة والمدة الزمنية" />
            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="الحالات حسب المدينة" subtitle={ck.citiesFilled < ck.total ? `المدينة مكتوبة في ${ck.citiesFilled} من ${ck.total} حالات بس` : undefined}>
                <Chart option={kidCharts.cities} height={260} onClickName={(n) => toggleKid("cities", n)} />
              </ChartCard>
              <ChartCard title="المدة من الاستلام حتى ظهور النتيجة" subtitle="بالأيام">
                {ck.hasDurationData ? (
                  <Chart option={kidCharts.duration} height={260} />
                ) : (
                  <EmptyChart text="ضيفوا في شيت الأطفال عمودين «تاريخ الاستلام» و«تاريخ النتيجة»، والرسم هيظهر لوحده" />
                )}
              </ChartCard>
              <ChartCard title="الحالات حسب الفترة">
                {kidCharts.periodHasData ? (
                  <Chart option={kidCharts.period} height={260} />
                ) : (
                  <EmptyChart text="محتاج تاريخ استلام أو تاريخ نتيجة لكل حالة" />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="الحالات حسب المستشفى" className="lg:col-span-2">
                <Chart option={kidCharts.hospitals} height={Math.max(240, ck.hospitals * 32)} />
              </ChartCard>
              <ChartCard title="ملاحظات تحتاج متابعة">
                <ul className="scrollbar-thin max-h-[300px] space-y-2 overflow-auto">
                  {kids.filter((c) => c.notes).map((c) => (
                    <li key={c.id} className="rounded-2xl border border-line bg-refd-purple-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <span className={`text-[11px] font-medium ${c.result === "سليم" ? "text-success" : "text-danger"}`}>{c.result || PENDING_RESULT}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{c.notes}</p>
                      <p className="mt-1 text-[11px] text-refd-purple">{c.service}</p>
                    </li>
                  ))}
                  {ck.withNotes === 0 && <p className="text-sm text-muted">لا توجد ملاحظات</p>}
                </ul>
              </ChartCard>
            </div>
          </>
        )}

        {data && tab === "quality" && <QualityPanel issues={data.issues} completeness={quality} />}
        {data && tab === "records" && <RecordsTable family={family} childRecords={children} />}

        <footer className="pb-4 pt-2 text-center text-[11px] text-muted">
          البيانات بتتحدث تلقائيًا كل {Math.round(REFRESH_MS / 1000)} ثانية من الشيت · رفد
          {data && data.psych.length > 0 && ` · الفحص النفسي: ${data.psych.length} حالة (${data.psych.filter((p) => isDone(p.status)).length} مكتملة)`}
        </footer>
      </main>
    </div>
  );
}

function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  const items: { id: Granularity; label: string }[] = [
    { id: "month", label: "شهري" },
    { id: "year", label: "سنوي" },
  ];
  return (
    <div className="flex rounded-xl bg-refd-purple-50 p-1">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onChange(i.id)}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${value === i.id ? "bg-white text-refd-purple shadow" : "text-muted"}`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

type OptionKey = "cities" | "services" | "statuses" | "results";

function FiltersBar({
  filters,
  setFilters,
  options,
  labels,
  periodLabel,
  periodDisabled = false,
}: {
  filters: Filters;
  setFilters: (f: Filters | ((f: Filters) => Filters)) => void;
  options: Record<OptionKey, string[]>;
  labels: Record<OptionKey, string>;
  periodLabel: string;
  periodDisabled?: boolean;
}) {
  const active = countActive(filters);
  const keys: OptionKey[] = ["cities", "services", "statuses", "results"];
  return (
    <div className="card grid grid-cols-2 gap-2.5 p-3 md:grid-cols-4 md:items-center 2xl:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto_auto_auto]">
      {keys.map((k) => (
        <MultiSelect key={k} label={labels[k]} options={options[k]} value={filters[k]} onChange={(v) => setFilters((f) => ({ ...f, [k]: v }))} />
      ))}
      <span
        className="col-span-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-refd-purple md:col-span-1"
        title={periodDisabled ? "مافيش تواريخ في الشيت ده لسه" : undefined}
      >
        <Icons.calendar />
        {periodLabel}
      </span>
      <label className={`flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs text-muted ${periodDisabled ? "opacity-50" : ""}`}>
        من
        <input
          type="date"
          disabled={periodDisabled}
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="bg-transparent text-sm text-ink outline-none"
        />
      </label>
      <label className={`flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs text-muted ${periodDisabled ? "opacity-50" : ""}`}>
        إلى
        <input
          type="date"
          disabled={periodDisabled}
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="bg-transparent text-sm text-ink outline-none"
        />
      </label>
      <button
        type="button"
        disabled={!active}
        onClick={() => setFilters(emptyFilters)}
        className="col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-refd-purple transition hover:bg-refd-purple-50 disabled:text-muted/50 disabled:hover:bg-transparent md:col-span-1"
      >
        <Icons.x />
        مسح {active > 0 && `(${active})`}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card h-28 animate-pulse bg-white/60" />
      ))}
    </div>
  );
}
