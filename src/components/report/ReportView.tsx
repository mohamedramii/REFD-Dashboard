"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyFamilyFilters,
  childKpis,
  completeness,
  familyKpis,
  filtersFromQuery,
  formatDate,
  isDone,
  shortService,
} from "@/lib/analytics";
import { buildInsights } from "@/lib/insights";
import { Chart } from "../charts/Chart";
import { buildChildCharts, buildFamilyCharts, statusChart } from "../charts/build";
import { horizontalBar } from "../charts/options";
import { Icons } from "../icons";
import { useDashboardData } from "../useDashboardData";

const fmtLong = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));

const maskName = (n: string) => (n ? `${n[0]}•••` : "—");

export function ReportView() {
  const params = useSearchParams();
  const filters = useMemo(() => filtersFromQuery(params), [params]);
  // The report is a fixed snapshot: loaded once with no auto-refresh
  const { data } = useDashboardData(false);

  const [hideNames, setHideNames] = useState(false);
  const [withRecords, setWithRecords] = useState(true);
  const [withQuality, setWithQuality] = useState(true);
  const [ready, setReady] = useState(false);

  // Short delay after data arrives so ECharts finishes drawing every chart before printing
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, [data]);

  const refDate = data?.fetchedAt.slice(0, 10) ?? "";
  const family = useMemo(() => applyFamilyFilters(data?.family ?? [], filters), [data, filters]);
  const children = useMemo(() => data?.children ?? [], [data]);
  const fk = useMemo(() => familyKpis(family, refDate), [family, refDate]);
  const ck = useMemo(() => childKpis(children), [children]);
  const charts = useMemo(() => buildFamilyCharts(family, refDate), [family, refDate]);
  const kids = useMemo(() => buildChildCharts(children, refDate), [children, refDate]);
  const insights = useMemo(() => buildInsights(family, children, data?.issues ?? []), [family, children, data]);
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

  const period = useMemo(() => {
    const dates = family.map((r) => r.labDate).filter((d): d is string => Boolean(d)).sort();
    return dates.length ? `من ${formatDate(dates[0])} إلى ${formatDate(dates[dates.length - 1])}` : "—";
  }, [family]);

  const filterText = [
    filters.cities.length && `المدينة: ${filters.cities.join("، ")}`,
    filters.services.length && `الخدمة: ${filters.services.join("، ")}`,
    filters.statuses.length && `الحالة: ${filters.statuses.join("، ")}`,
    filters.results.length && `النتيجة: ${filters.results.join("، ")}`,
    (filters.from || filters.to) && `الفترة: ${filters.from || "…"} → ${filters.to || "…"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!data) {
    return <div className="refd-backdrop grid min-h-screen place-items-center text-sm text-muted">جاري تحميل البيانات…</div>;
  }

  const issued = fmtLong(data.fetchedAt);
  // Section number in each page header (data quality is optional, so it shifts the records number)
  const recordsNo = withQuality ? 6 : 5;

  return (
    <div className="report-root refd-backdrop min-h-screen pb-10">
      {/* ---------- Toolbar (not printed) ---------- */}
      <div className="no-print sticky top-0 z-40 mb-8 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">معاينة التقرير</p>
            <p className="text-[11px] text-muted">من نافذة الطباعة اختار «Save as PDF»، وفعّل «Background graphics»</p>
          </div>
          <Toggle checked={hideNames} onChange={setHideNames}>إخفاء الأسماء</Toggle>
          <Toggle checked={withQuality} onChange={setWithQuality}>جودة البيانات</Toggle>
          <Toggle checked={withRecords} onChange={setWithRecords}>جدول السجلات</Toggle>
          <button
            type="button"
            disabled={!ready}
            onClick={() => window.print()}
            className="flex h-10 items-center gap-2 rounded-xl bg-refd-purple px-5 text-sm font-semibold text-white shadow-lg shadow-refd-purple/25 transition hover:bg-refd-purple-600 disabled:opacity-60"
          >
            <Icons.printer />
            {ready ? "طباعة / حفظ PDF" : "جاري التجهيز…"}
          </button>
        </div>
      </div>

      {/* ---------- Cover ---------- */}
      <section className="sheet cover">
        <div className="relative h-[168mm] overflow-hidden bg-gradient-to-br from-[#8B2FA8] via-refd-purple to-[#3E0D4D] px-[16mm] pt-[18mm] text-white">
          <span className="absolute -top-[30mm] -left-[26mm] size-[105mm] rounded-full border-[13mm] border-refd-cyan/90" />
          <span className="absolute top-[70mm] -left-[40mm] size-[120mm] rounded-full border-[2px] border-white/15" />
          <span className="absolute -bottom-[50mm] -right-[30mm] size-[110mm] rounded-full bg-white/[0.06]" />
          <span className="inline-flex rounded-full bg-white/15 px-4 py-1.5 text-[11pt] font-medium backdrop-blur">تقرير دوري</span>
          <h1 className="mt-[14mm] text-[34pt] leading-[1.15] font-bold">
            تقرير متابعة
            <br />
            الفحوصات
          </h1>
          <p className="mt-[6mm] max-w-[120mm] text-[12pt] leading-relaxed text-white/80">
            التحقق الصحي للأسر، وفحص الأطفال قبل الاستلام — ملخص المؤشرات والتحليلات وجودة البيانات.
          </p>
          <div className="absolute bottom-[14mm] right-[16mm] flex items-baseline gap-3 text-white/90">
            <span className="text-[10pt] text-white/60">تاريخ الإصدار</span>
            <span className="text-[13pt] font-semibold">{issued}</span>
          </div>
        </div>

        <div className="relative px-[16mm]">
          <div className="-mt-[22mm] flex items-center justify-between rounded-[22px] bg-white p-[7mm] shadow-[0_16px_40px_-16px_rgba(42,16,51,.35)]">
            <Image src="/refd-logo.png" alt="رفد" width={1213} height={646} className="h-[24mm] w-auto" priority />
            <div className="grid grid-cols-2 gap-x-[10mm] gap-y-[3mm] text-[9.5pt]">
              <Meta label="الفترة المغطاة" value={period} />
              <Meta label="مصدر البيانات" value={data.source === "google" ? "Google Sheets (مباشر)" : "بيانات تجريبية"} />
              <Meta label="عدد السجلات" value={`${family.length + children.length} سجل`} />
              <Meta label="الفلاتر" value={filterText || "كل البيانات"} />
            </div>
          </div>

          <div className="mt-[9mm] grid grid-cols-4 gap-[4mm]">
            <BigStat value={fk.total} label="شخص مفحوص" />
            <BigStat value={fk.booked} label="موعد محجوز" />
            <BigStat value={`${fk.suitableRate}%`} label="نتائج مناسبة" />
            <BigStat value={ck.total} label="فحص أطفال" accent />
          </div>

          <div className="mt-[10mm] flex items-center justify-between border-t border-line pt-[4mm] text-[8.5pt] text-muted">
            <span>سري — للاستخدام الداخلي فقط</span>
            <span className="h-[3px] w-[40mm] rounded-full bg-gradient-to-l from-refd-cyan to-refd-purple" />
            <span>رفد · REFD</span>
          </div>
        </div>
      </section>

      {/* ---------- Executive summary ---------- */}
      <Sheet n={1} title="الملخص التنفيذي" subtitle="نفس مؤشرات لوحة المتابعة">
        <h3 className="mb-[2mm] text-[10.5pt] font-bold text-refd-purple">لوحة الأسر</h3>
        <div className="grid grid-cols-5 gap-[3mm]">
          <Kpi label="عدد الأشخاص المفحوصين" value={fk.total} hint={`${fk.families} أسرة · ${fk.cities} مدينة`} />
          <Kpi label="ظهور النتيجة" value={fk.completed} hint={`${pct(fk.completed, fk.booked)}% من المواعيد`} />
          <Kpi label="مناسب" value={fk.suitable} hint={`${fk.suitableRate}% من النتائج`} tone="good" />
          <Kpi label="غير مناسب" value={fk.unsuitable} hint={`${fk.unsuitableRate}% من النتائج`} tone="bad" />
          <Kpi label="بحاجة لمتابعة" value={fk.followUp} hint={`${fk.followUpRate}% من النتائج`} tone="warn" />
        </div>

        <div className="mt-[3mm]">
          <Block title="المواعيد المحجوزة حسب حالة الخدمة">
            <Chart still option={statusChart(family, data.lists?.family.statuses ?? [])} height={170} />
          </Block>
        </div>

        <h3 className="mt-[5mm] mb-[2mm] text-[10.5pt] font-bold text-refd-cyan-600">لوحة الأطفال</h3>
        <div className="grid grid-cols-5 gap-[3mm]">
          <Kpi label="عدد الفحوصات" value={ck.total} />
          <Kpi label="المواعيد المحجوزة" value={ck.booked} />
          <Kpi label="سليم" value={ck.healthy} hint={`${ck.healthyRate}% من النتائج`} tone="good" />
          <Kpi label="غير سليم" value={ck.unhealthy} hint={`${ck.unhealthyRate}% من النتائج`} tone="bad" />
          <Kpi label="من الاستلام للنتيجة" value={ck.avgDuration !== null ? `${ck.avgDuration} يوم` : "—"} hint={ck.avgDuration !== null ? "يوم في المتوسط" : undefined} tone="warn" />
        </div>

        <div className="report-card mt-[5mm]">
          <h3 className="mb-2 text-[11pt] font-bold text-ink">قراءة سريعة في الأرقام</h3>
          <ul className="space-y-[2.2mm]">
            {insights.map((i, idx) => (
              <li key={idx} className="flex gap-2 text-[9.5pt] leading-relaxed text-ink">
                <span
                  className={`mt-[1.6mm] size-[2.4mm] shrink-0 rounded-full ${
                    i.tone === "good" ? "bg-success" : i.tone === "warn" ? "bg-warning" : "bg-refd-cyan"
                  }`}
                />
                {i.text}
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      {/* ---------- Family board ---------- */}
      <Sheet n={2} title="لوحة الأسر" subtitle="الفترة الزمنية والنطاق الجغرافي ونوع البرنامج">
        <Block title="المستفيدين حسب الفترة الزمنية">
          {charts.periodHasData ? <Chart still option={charts.period} height={230} /> : <ReportEmpty text="مافيش مواعيد في الفترة دي" height={230} />}
        </Block>
        <div className="mt-[3mm] grid grid-cols-5 gap-[3mm]">
          <Block title="نوع البرنامج" className="col-span-2">
            <Chart still option={charts.services} height={230} />
          </Block>
          <Block title="تفاصيل النتائج" className="col-span-3">
            <Chart still option={charts.resultDetail} height={230} />
          </Block>
        </div>
        <div className="mt-[3mm]">
          <Block title="النطاق الجغرافي حسب نوع البرنامج">
            <Chart still option={charts.byCityStack} height={250} />
          </Block>
        </div>
      </Sheet>

      <Sheet n={3} title="لوحة الأسر" subtitle="الأعمار والمدة الزمنية والملاحظات" flow>
        <Block title="الفئات العمرية حسب نوع البرنامج">
          <Chart still option={charts.ageByProgram} height={250} />
        </Block>
        <div className="mt-[3mm]">
          <Block title="المدة من الفحص حتى ظهور النتيجة (بالأيام)">
            {charts.hasTat ? <Chart still option={charts.tat} height={200} /> : <ReportEmpty text="محتاج تعبئة تاريخ الفحوصات المخبرية وتاريخ النتيجة" />}
          </Block>
        </div>
        <Notes
          items={family.filter((r) => r.notes).map((r) => ({ id: r.id, name: r.name, result: r.result, notes: r.notes, service: shortService(r.service) }))}
          hideNames={hideNames}
        />
      </Sheet>

      {/* ---------- Children board ---------- */}
      <Sheet n={4} title="لوحة الأطفال" subtitle="فحص الأطفال قبل الاستلام" flow>
        <div className="grid grid-cols-5 gap-[3mm]">
          <Block title="نوع البرنامج" className="col-span-2">
            <Chart still option={kids.services} height={220} />
          </Block>
          <Block title="النتيجة حسب نوع البرنامج" className="col-span-3">
            <Chart still option={kids.serviceResult} height={220} />
          </Block>
        </div>
        <div className="mt-[3mm]">
          <Block title="النطاق الجغرافي لكل خدمة">
            <Chart still option={kids.cityService} height={220} />
          </Block>
        </div>
        <div className="mt-[3mm] grid grid-cols-2 gap-[3mm]">
          <Block title="المدة من الاستلام حتى ظهور النتيجة">
            {ck.hasDurationData ? <Chart still option={kids.duration} height={200} /> : <ReportEmpty text="محتاج تعبئة تاريخ استلام الحالة وتاريخ استلام النتيجة" />}
          </Block>
          <Block title="عدد الفحوصات حسب الفترة الزمنية">
            {kids.periodHasData ? <Chart still option={kids.period} height={200} /> : <ReportEmpty text="محتاج تعبئة تاريخ الاستلام أو تاريخ النتيجة" />}
          </Block>
        </div>
        <Notes
          items={children.filter((c) => c.notes).map((c) => ({ id: c.id, name: c.name, result: c.result, notes: c.notes, service: c.service }))}
          hideNames={hideNames}
        />
      </Sheet>

      {/* ---------- Data quality ---------- */}
      {withQuality && (
        <Sheet n={5} title="جودة البيانات" subtitle="نسبة اكتمال الحقول، والملاحظات برقم الصف في الشيت" flow>
          <div className="grid grid-cols-5 gap-[3mm]">
            <Block title="نسبة اكتمال كل حقل (%)" className="col-span-2">
              <Chart still option={horizontalBar(quality)} height={230} />
            </Block>
            <div className="report-card col-span-3">
              <h3 className="mb-2 text-[10.5pt] font-bold">ملخص</h3>
              <div className="grid grid-cols-2 gap-[2.5mm]">
                <Kpi label="أخطاء" value={data.issues.filter((i) => i.level === "error").length} tone="bad" />
                <Kpi label="تنبيهات" value={data.issues.filter((i) => i.level === "warning").length} />
              </div>
              <p className="mt-3 text-[8.5pt] leading-relaxed text-muted">
                الأخطاء: تواريخ مش مفهومة أو مكتوبة بالهجري. التنبيهات: بيانات ناقصة، أو تاريخ نتيجة قبل تاريخ الفحص، أو أرقام طلبات مكررة أو بصيغة غير معتادة.
              </p>
            </div>
          </div>
          <table className="report-table mt-[4mm] w-full text-[8.5pt]">
            <thead>
              <tr className="bg-refd-purple text-white">
                <th className="rounded-tr-lg px-2 py-1.5 text-start font-medium">النوع</th>
                <th className="px-2 py-1.5 text-start font-medium">الشيت</th>
                <th className="px-2 py-1.5 text-start font-medium">الصف</th>
                <th className="px-2 py-1.5 text-start font-medium">الحقل</th>
                <th className="rounded-tl-lg px-2 py-1.5 text-start font-medium">الملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {data.issues.map((i, idx) => (
                <tr key={idx} className="border-b border-line odd:bg-refd-purple-50/50">
                  <td className={`px-2 py-1.5 font-semibold ${i.level === "error" ? "text-danger" : "text-warning"}`}>
                    {i.level === "error" ? "خطأ" : "تنبيه"}
                  </td>
                  <td className="px-2 py-1.5 text-muted">{i.sheet}</td>
                  <td className="px-2 py-1.5 tabular-nums">{i.row || "—"}</td>
                  <td className="px-2 py-1.5">{i.field}</td>
                  <td className="px-2 py-1.5">{i.message}</td>
                </tr>
              ))}
              {data.issues.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-success">لا توجد ملاحظات على البيانات</td>
                </tr>
              )}
            </tbody>
          </table>
        </Sheet>
      )}

      {/* ---------- Records ---------- */}
      {withRecords && (
        <Sheet n={recordsNo} title="سجل الفحوصات" subtitle={`${family.length} فحص أسري${hideNames ? " · الأسماء مخفية" : ""}`} flow>
          <table className="report-table w-full text-[8.3pt]">
            <thead>
              <tr className="bg-refd-purple text-white">
                {["الأسرة", "الاسم", "الخدمة", "المدينة", "الحي", "الحالة", "النتيجة", "الفحوصات", "النتيجة في"].map((h, i, arr) => (
                  <th
                    key={h + i}
                    className={`px-2 py-1.5 text-start font-medium ${i === 0 ? "rounded-tr-lg" : ""} ${i === arr.length - 1 ? "rounded-tl-lg" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {family.map((r) => (
                <tr key={r.id} className="border-b border-line odd:bg-refd-purple-50/50">
                  <td className="px-2 py-1.5 text-center font-bold text-refd-purple">{r.family ?? "—"}</td>
                  <td className="px-2 py-1.5 font-medium">{hideNames ? maskName(r.name) : r.name}</td>
                  <td className="px-2 py-1.5">{shortService(r.service)}</td>
                  <td className="px-2 py-1.5">{r.city || "—"}</td>
                  <td className="px-2 py-1.5 text-muted">{r.district || "—"}</td>
                  <td className="px-2 py-1.5">{isDone(r.status) ? "مكتمل" : r.status || "—"}</td>
                  <td
                    className={`px-2 py-1.5 font-semibold ${
                      r.result === "مناسب" ? "text-success" : r.result.startsWith("غير") ? "text-danger" : "text-warning"
                    }`}
                  >
                    {r.result || "بانتظار"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{formatDate(r.labDate)}</td>
                  <td
                    className={`px-2 py-1.5 tabular-nums ${
                      r.labDate && r.resultDate && r.resultDate < r.labDate ? "font-bold text-danger" : ""
                    }`}
                  >
                    {formatDate(r.resultDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-[4mm] text-[8pt] text-muted">التواريخ باللون الأحمر: تاريخ النتيجة قبل تاريخ الفحص المخبري، ومحتاجة مراجعة في الشيت.</p>
        </Sheet>
      )}
    </div>
  );
}

function Sheet({
  n,
  title,
  subtitle,
  children,
  flow = false,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  flow?: boolean;
}) {
  return (
    <section className={`sheet ${flow ? "flow" : ""}`}>
      <span className="absolute inset-x-0 top-0 h-[2.2mm] bg-gradient-to-l from-refd-cyan via-refd-purple-300 to-refd-purple" />
      <header className="mb-[5mm] flex items-center justify-between border-b border-line pb-[3mm]">
        <div className="flex items-center gap-3">
          <span className="grid size-[10mm] place-items-center rounded-[3.5mm] bg-refd-purple text-[13pt] font-bold text-white">
            {String(n).padStart(2, "0")}
          </span>
          <div>
            <h2 className="text-[15pt] leading-tight font-bold text-ink">{title}</h2>
            {subtitle && <p className="text-[8.5pt] text-muted">{subtitle}</p>}
          </div>
        </div>
        <Image src="/refd-logo.png" alt="رفد" width={1213} height={646} className="h-[10mm] w-auto" />
      </header>
      {children}
    </section>
  );
}

function Block({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`report-card ${className}`}>
      <h3 className="mb-1 text-[10pt] font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="report-card relative overflow-hidden">
      <span
        className={`absolute inset-y-0 right-0 w-[1.3mm] ${tone === "good" ? "bg-success" : tone === "bad" ? "bg-danger" : tone === "warn" ? "bg-warning" : "bg-refd-purple"}`}
      />
      <p className="text-[8pt] text-muted">{label}</p>
      <p className="text-[18pt] leading-tight font-bold text-ink tabular-nums">{value}</p>
      {hint && <p className="text-[7.5pt] text-muted">{hint}</p>}
    </div>
  );
}

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

function ReportEmpty({ text, height = 200 }: { text: string; height?: number }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-refd-purple-300 bg-refd-purple-50/60 p-4 text-center" style={{ height }}>
      <p className="max-w-[50mm] text-[8.5pt] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

type NoteItem = { id: string; name: string; result: string; notes: string; service: string };

function Notes({ items, hideNames }: { items: NoteItem[]; hideNames: boolean }) {
  return (
    <div className="report-card mt-[3mm]">
      <h3 className="mb-2 text-[10.5pt] font-bold">ملاحظات</h3>
      {items.length === 0 ? (
        <p className="text-[9pt] text-muted">لا توجد ملاحظات</p>
      ) : (
        <div className="grid grid-cols-2 gap-[2.5mm]">
          {items.map((n) => (
            <div key={n.id} className="avoid-break rounded-xl bg-refd-purple-50 px-3 py-2">
              <div className="flex justify-between gap-2 text-[9pt] font-semibold">
                <span>{hideNames ? maskName(n.name) : n.name}</span>
                <span className={noteTone(n.result)}>{n.result || "—"}</span>
              </div>
              <p className="text-[8.5pt] text-muted">{n.notes}</p>
              <p className="text-[8pt] text-refd-purple">{n.service}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function noteTone(result: string): string {
  if (result === "مناسب" || result === "سليم" || result.startsWith("مناسب")) return "text-success";
  if (result.startsWith("غير") || result.startsWith("لا ")) return "text-danger";
  return "text-warning";
}

function BigStat({ value, label, accent = false }: { value: ReactNode; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-[18px] px-[4mm] py-[4mm] ${accent ? "bg-refd-cyan-100" : "bg-refd-purple-50"}`}>
      <p className={`text-[24pt] leading-none font-bold tabular-nums ${accent ? "text-refd-cyan-600" : "text-refd-purple"}`}>{value}</p>
      <p className="mt-[2mm] text-[9pt] text-muted">{label}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[8pt] text-muted">{label}</p>
      <p className="max-w-[55mm] truncate font-semibold text-ink">{value}</p>
    </div>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--refd-purple)]" />
      {children}
    </label>
  );
}
