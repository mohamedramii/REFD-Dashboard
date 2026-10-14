"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  applyFamilyFilters,
  childKpis,
  completeness,
  emptyFilters,
  familyKpis,
  type Filters,
  filtersToQuery,
  isDone,
  label,
  shortService,
  uniq,
} from "@/lib/analytics";
import { Chart } from "./charts/Chart";
import { buildChildCharts, buildFamilyCharts } from "./charts/build";
import { gauge } from "./charts/options";
import { REFRESH_MS, useDashboardData } from "./useDashboardData";
import { Icons } from "./icons";
import { ChartCard, KpiCard, MultiSelect } from "./ui";
import { RecordsTable } from "./RecordsTable";
import { QualityPanel } from "./QualityPanel";


const TABS = [
  { id: "overview", label: "نظرة عامة" },
  { id: "family", label: "فحوصات الأسرة" },
  { id: "children", label: "فحص الأطفال" },
  { id: "quality", label: "جودة البيانات" },
  { id: "records", label: "السجلات" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return "الآن";
  if (s < 60) return `منذ ${s} ثانية`;
  const m = Math.round(s / 60);
  return m < 60 ? `منذ ${m} دقيقة` : new Date(iso).toLocaleTimeString("ar-EG");
}

export function Dashboard() {
  const { data, loading, netError, reload } = useDashboardData();
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // الوقت الحالي بيتقرا في المتصفح بس، عشان الصفحة تتبني مسبقًا من غير قيمة متغيرة
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
  const filtered = useMemo(() => applyFamilyFilters(family, filters), [family, filters]);

  const options = useMemo(
    () => ({
      cities: uniq(family.map((r) => label(r.city))),
      services: uniq(family.map((r) => shortService(r.service))),
      statuses: uniq(family.map((r) => label(r.status))),
      results: uniq(family.map((r) => label(r.result))),
    }),
    [family],
  );

  const fk = useMemo(() => familyKpis(filtered), [filtered]);
  const ck = useMemo(() => childKpis(children), [children]);
  const activeFilters =
    filters.cities.length + filters.services.length + filters.statuses.length + filters.results.length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0);

  const toggleIn = (key: "cities" | "services" | "results", value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  const charts = useMemo(() => buildFamilyCharts(filtered, refDate), [filtered, refDate]);
  const childCharts = useMemo(() => buildChildCharts(children, refDate), [children, refDate]);

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
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 md:px-8">
          <Image src="/refd-logo.png" alt="رفد" width={1213} height={646} priority className="h-12 w-auto" />
          <div className="hidden h-9 w-px bg-line md:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-ink md:text-xl">لوحة متابعة الفحوصات</h1>
            <p className="truncate text-xs text-muted">التحقق الصحي للأسر · فحص الأطفال قبل الاستلام · الفحص النفسي</p>
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
              href={`/report?${filtersToQuery(filters)}`}
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
          {/* Keep the other tabs implemented; only overview is currently visible. */}
          {TABS.filter((t) => t.id === "overview").map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition ${
                tab === t.id ? "text-refd-purple" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.id === "quality" && data && data.issues.length > 0 && (
                <span className="ms-1.5 rounded-full bg-[#FDF1DC] px-1.5 text-[10px] font-bold text-warning">{data.issues.length}</span>
              )}
              {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-gradient-to-l from-refd-cyan to-refd-purple" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 md:px-0">
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

        {data && (tab === "overview" || tab === "family") && (
          <FiltersBar filters={filters} setFilters={setFilters} options={options} active={activeFilters} />
        )}

        {data && tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 2xl:grid-cols-8">
              <KpiCard label="إجمالي الفحوصات" value={fk.total} hint={`${fk.cities} مدن`} icon={<Icons.clipboard />} />
              <KpiCard label="عدد الأسر" value={fk.families} hint={`متوسط ${fk.avgMembers} فرد للأسرة`} tone="cyan" icon={<Icons.home />} />
              <KpiCard label="تم رفع التقارير" value={fk.done} hint={`${fk.pending} قيد التنفيذ`} tone="success" icon={<Icons.check />} progress={fk.completion} />
              <KpiCard label="نسبة المناسب" value={`${fk.suitableRate}%`} hint={`${fk.suitable} مناسب · ${fk.unsuitable} غير مناسب`} tone="success" icon={<Icons.heart />} progress={fk.suitableRate} />
              <KpiCard label="متوسط زمن النتيجة" value={fk.avgTurnaround ?? "—"} hint="يوم من الفحص للنتيجة" tone="warning" icon={<Icons.clock />} />
              <KpiCard label="فحص الأطفال" value={ck.total} hint={`${ck.hospitals} مستشفى`} tone="cyan" icon={<Icons.baby />} />
              <KpiCard label="أطفال سليمين" value={`${ck.healthyRate}%`} hint={`${ck.healthy} من ${ck.healthy + ck.unhealthy}`} tone="success" icon={<Icons.heart />} progress={ck.healthyRate} />
              <KpiCard label="الفحص النفسي" value={data.psych.length} hint={`${data.psych.filter((p) => isDone(p.status)).length} مكتمل`} tone="purple" icon={<Icons.brain />} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="مسار الحالات" subtitle="من المدينة ← نوع الخدمة ← النتيجة" className="lg:col-span-2">
                <Chart option={charts.sankey} height={360} />
              </ChartCard>
              <div className="grid gap-5">
                <ChartCard title="نسبة الإنجاز" subtitle="الحالات اللي تم رفع تقاريرها">
                  <Chart option={gauge(fk.completion, `${fk.done} من ${fk.total}`)} height={150} />
                </ChartCard>
                <ChartCard title="نسبة المناسب" subtitle="من الحالات اللي صدرت نتيجتها">
                  <Chart option={gauge(fk.suitableRate, `${fk.suitable} حالة`, "#0BC8F2")} height={150} />
                </ChartCard>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-5">
              <ChartCard title="حركة الفحوصات والنتائج" subtitle="يوميًا مع الإجمالي التراكمي" className="lg:col-span-3">
                <Chart option={charts.timeline} height={320} />
              </ChartCard>
              <ChartCard title="المدينة × نوع الخدمة" subtitle="خريطة كثافة لعدد الفحوصات" className="lg:col-span-2">
                <Chart option={charts.heat} height={320} />
              </ChartCard>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <ChartCard title="توزيع الخدمات" subtitle="اضغط على شريحة للفلترة">
                <Chart option={charts.services} height={280} onClickName={(n) => toggleIn("services", n)} />
              </ChartCard>
              <ChartCard title="مقارنة المدن" subtitle="أعلى 4 مدن على 5 مؤشرات">
                <Chart option={charts.radar} height={280} />
              </ChartCard>
              <ChartCard title="نتائج فحص الأطفال" subtitle="سليم مقابل غير سليم">
                <Chart option={childCharts.results} height={280} />
              </ChartCard>
            </div>
          </>
        )}

        {data && tab === "family" && (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard title="الفحوصات حسب المدينة" subtitle="مقسمة حسب نوع الخدمة · اضغط على مدينة للفلترة">
                <Chart option={charts.byCityStack} height={320} onClickName={(n) => toggleIn("cities", n)} />
              </ChartCard>
              <ChartCard title="المدن والأحياء" subtitle="مساحة كل مربع = عدد الفحوصات">
                <Chart option={charts.tree} height={320} />
              </ChartCard>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="النتائج حسب نوع الخدمة">
                <Chart option={charts.resultByService} height={290} />
              </ChartCard>
              <ChartCard title="حالة الخدمة حسب المدينة">
                <Chart option={charts.doneByCity} height={290} />
              </ChartCard>
              <ChartCard title="توزيع النتائج" subtitle="اضغط على شريحة للفلترة">
                <Chart option={charts.results} height={290} onClickName={(n) => n !== "بانتظار النتيجة" && toggleIn("results", n)} />
              </ChartCard>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="الفئات العمرية" subtitle="العمر وقت الفحص">
                <Chart option={charts.ages} height={260} />
              </ChartCard>
              <ChartCard title="زمن صدور النتيجة" subtitle="عدد الأيام من الفحص المخبري للنتيجة">
                <Chart option={charts.tat} height={260} />
              </ChartCard>
              <ChartCard title="حجم الأسر" subtitle="عدد الأفراد المفحوصين في كل أسرة">
                <Chart option={charts.famSizes} height={260} />
              </ChartCard>
            </div>
          </>
        )}

        {data && tab === "children" && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiCard label="إجمالي الأطفال" value={ck.total} icon={<Icons.baby />} />
              <KpiCard label="سليم" value={ck.healthy} tone="success" icon={<Icons.heart />} progress={ck.healthyRate} />
              <KpiCard label="غير سليم" value={ck.unhealthy} tone="danger" icon={<Icons.alert />} />
              <KpiCard label="حالات عليها ملاحظات" value={ck.withNotes} tone="warning" icon={<Icons.clipboard />} />
              <KpiCard label="المستشفيات" value={ck.hospitals} tone="cyan" icon={<Icons.hospital />} />
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="الحالات حسب المستشفى" className="lg:col-span-2">
                <Chart option={childCharts.hospitals} height={Math.max(260, ck.hospitals * 34)} />
              </ChartCard>
              <ChartCard title="نتائج الفحص">
                <Chart option={childCharts.results} height={280} />
              </ChartCard>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <ChartCard title="عمر الطفل حاليًا" subtitle="بالشهور">
                <Chart option={childCharts.ages} height={260} />
              </ChartCard>
              <ChartCard title="الملاحظات الطبية">
                <Chart option={childCharts.notes} height={260} />
              </ChartCard>
              <ChartCard title="ملاحظات تحتاج متابعة">
                <ul className="scrollbar-thin max-h-[260px] space-y-2 overflow-auto">
                  {children.filter((c) => c.notes).map((c) => (
                    <li key={c.id} className="rounded-2xl border border-line bg-refd-purple-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <span className={`text-[11px] font-medium ${c.result === "سليم" ? "text-success" : "text-danger"}`}>{c.result || "بانتظار النتيجة"}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{c.notes}</p>
                      <p className="mt-1 text-[11px] text-refd-purple">{c.hospital}</p>
                    </li>
                  ))}
                  {ck.withNotes === 0 && <p className="text-sm text-muted">لا توجد ملاحظات</p>}
                </ul>
              </ChartCard>
            </div>
            {data.psych.length > 0 && (
              <ChartCard title="الفحص النفسي" subtitle={`${data.psych.length} حالة`}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.psych.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-line p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{p.caseType || p.service}</span>
                        <span className={`text-xs font-medium ${isDone(p.status) ? "text-success" : "text-warning"}`}>{p.status || "—"}</span>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-muted">
                        <dt>المدينة</dt><dd className="text-ink">{p.city || "—"}</dd>
                        <dt>العمر</dt><dd className="text-ink">{p.age ?? "—"}</dd>
                        <dt>الأخصائي</dt><dd className="text-ink">{p.specialist || "—"}</dd>
                        <dt>رفع التقارير</dt><dd className="text-ink">{p.reports || "—"}</dd>
                      </dl>
                    </div>
                  ))}
                </div>
              </ChartCard>
            )}
          </>
        )}

        {data && tab === "quality" && <QualityPanel issues={data.issues} completeness={quality} />}
        {data && tab === "records" && <RecordsTable family={family} childRecords={children} />}

        <footer className="pb-4 pt-2 text-center text-[11px] text-muted">
          البيانات بتتحدث تلقائيًا كل {Math.round(REFRESH_MS / 1000)} ثانية من الشيت · رفد
        </footer>
      </main>
    </div>
  );
}

function FiltersBar({
  filters,
  setFilters,
  options,
  active,
}: {
  filters: Filters;
  setFilters: (f: Filters | ((f: Filters) => Filters)) => void;
  options: { cities: string[]; services: string[]; statuses: string[]; results: string[] };
  active: number;
}) {
  return (
    <div className="card grid grid-cols-2 gap-2.5 p-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto_auto] lg:items-center">
      <MultiSelect label="المدينة" options={options.cities} value={filters.cities} onChange={(v) => setFilters((f) => ({ ...f, cities: v }))} />
      <MultiSelect label="نوع الخدمة" options={options.services} value={filters.services} onChange={(v) => setFilters((f) => ({ ...f, services: v }))} />
      <MultiSelect label="حالة الخدمة" options={options.statuses} value={filters.statuses} onChange={(v) => setFilters((f) => ({ ...f, statuses: v }))} />
      <MultiSelect label="النتيجة" options={options.results} value={filters.results} onChange={(v) => setFilters((f) => ({ ...f, results: v }))} />
      <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs text-muted">
        من
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="bg-transparent text-sm text-ink outline-none" />
      </label>
      <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs text-muted">
        إلى
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="bg-transparent text-sm text-ink outline-none" />
      </label>
      <button
        type="button"
        disabled={!active}
        onClick={() => setFilters(emptyFilters)}
        className="col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-refd-purple lg:col-span-1 transition hover:bg-refd-purple-50 disabled:text-muted/50 disabled:hover:bg-transparent"
      >
        <Icons.x />
        مسح {active > 0 && `(${active})`}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card h-28 animate-pulse bg-white/60" />
      ))}
    </div>
  );
}
