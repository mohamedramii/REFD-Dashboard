"use client";

import type { NameValue } from "@/lib/analytics";
import type { DataIssue } from "@/lib/types";
import { Chart } from "./charts/Chart";
import { horizontalBar } from "./charts/options";
import { Icons } from "./icons";
import { Badge, ChartCard, KpiCard } from "./ui";

export function QualityPanel({ issues, completeness }: { issues: DataIssue[]; completeness: NameValue[] }) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const avg = completeness.length ? Math.round(completeness.reduce((s, c) => s + c.value, 0) / completeness.length) : 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="اكتمال البيانات" value={`${avg}%`} hint="متوسط الحقول المعبأة في شيت الأسرة" tone="cyan" icon={<Icons.check />} progress={avg} />
        <KpiCard label="أخطاء لازم تتصلح" value={errors.length} hint="تواريخ مش مفهومة أو هجري" tone="danger" icon={<Icons.alert />} />
        <KpiCard label="تنبيهات للمراجعة" value={warnings.length} hint="بيانات ناقصة أو غير منطقية" tone="warning" icon={<Icons.clipboard />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <ChartCard title="نسبة اكتمال كل حقل" subtitle="شيت فحوصات الأسرة" className="lg:col-span-2">
          <Chart option={horizontalBar(completeness)} height={300} />
        </ChartCard>
        <ChartCard title="الملاحظات على البيانات" subtitle="رقم الصف هو نفس رقم الصف في الشيت" className="lg:col-span-3">
          {issues.length === 0 ? (
            <p className="py-10 text-center text-sm text-success">البيانات سليمة، مافيش ملاحظات 🎉</p>
          ) : (
            <ul className="scrollbar-thin max-h-[300px] divide-y divide-line overflow-auto">
              {[...errors, ...warnings].map((i, idx) => (
                <li key={idx} className="flex items-start gap-3 py-2.5">
                  <Badge tone={i.level === "error" ? "danger" : "warning"}>{i.level === "error" ? "خطأ" : "تنبيه"}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{i.message}</p>
                    <p className="text-[11px] text-muted">
                      {i.sheet} · {i.field}
                      {i.row > 0 && ` · صف ${i.row}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
