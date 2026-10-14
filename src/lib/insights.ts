import { childKpis, countBy, daysBetween, familyKpis, pct, shortService } from "./analytics";
import type { ChildRecord, DataIssue, FamilyRecord } from "./types";

export type Insight = { tone: "good" | "warn" | "info"; text: string };

/** ملاحظات مكتوبة تلقائيًا من البيانات، للملخص التنفيذي في التقرير */
export function buildInsights(family: FamilyRecord[], children: ChildRecord[], issues: DataIssue[]): Insight[] {
  const out: Insight[] = [];
  const fk = familyKpis(family);
  const ck = childKpis(children);

  const topCity = countBy(family, (r) => r.city)[0];
  if (topCity && fk.total) {
    out.push({
      tone: "info",
      text: `${topCity.name} هي الأعلى في عدد الفحوصات بـ ${topCity.value} فحص (${pct(topCity.value, fk.total)}% من الإجمالي) موزعين على ${fk.cities} مدن.`,
    });
  }

  if (fk.total) {
    out.push(
      fk.pending === 0
        ? { tone: "good", text: `كل الفحوصات (${fk.total}) تم رفع تقاريرها بنسبة إنجاز 100%.` }
        : { tone: "warn", text: `نسبة الإنجاز ${fk.completion}%: لسه ${fk.pending} حالة قيد التنفيذ ومحتاجة متابعة.` },
    );
  }

  if (fk.suitable + fk.unsuitable > 0) {
    out.push(
      fk.unsuitable === 0
        ? { tone: "good", text: `كل النتائج اللي صدرت (${fk.suitable}) نتيجتها «مناسب».` }
        : { tone: "warn", text: `${fk.unsuitable} حالة نتيجتها «غير مناسب»، مقابل ${fk.suitable} مناسب (${fk.suitableRate}%).` },
    );
  }

  const tats = family
    .filter((r) => r.labDate && r.resultDate)
    .map((r) => ({ r, d: daysBetween(r.labDate!, r.resultDate!) }))
    .filter((x) => x.d >= 0);
  if (tats.length && fk.avgTurnaround !== null) {
    const max = Math.max(...tats.map((t) => t.d));
    out.push({ tone: "info", text: `النتيجة بتصدر في المتوسط بعد ${fk.avgTurnaround} يوم من الفحص المخبري، وأطول مدة كانت ${max} يوم.` });
  }

  const topService = countBy(family, (r) => shortService(r.service))[0];
  if (topService && fk.families) {
    out.push({ tone: "info", text: `${fk.families} أسرة اتفحصت بمتوسط ${fk.avgMembers} فرد للأسرة، وأكتر خدمة كانت «${topService.name}» (${topService.value}).` });
  }

  if (ck.total) {
    out.push(
      ck.unhealthy === 0
        ? { tone: "good", text: `كل الأطفال اللي صدرت نتيجتهم سليمين (${ck.healthy} من ${ck.total}).` }
        : { tone: "warn", text: `${ck.unhealthy} طفل نتيجته «غير سليم» من ${ck.healthy + ck.unhealthy}، و${ck.withNotes} حالات عليها ملاحظات طبية.` },
    );
  }

  const errors = issues.filter((i) => i.level === "error").length;
  if (issues.length) {
    out.push({
      tone: "warn",
      text: `في ${issues.length} ملاحظة على جودة البيانات${errors ? ` منهم ${errors} أخطاء` : ""}، تفاصيلها في صفحة جودة البيانات.`,
    });
  } else {
    out.push({ tone: "good", text: "البيانات مكتملة ومافيهاش مشاكل في التواريخ أو أرقام الطلبات." });
  }
  return out;
}
