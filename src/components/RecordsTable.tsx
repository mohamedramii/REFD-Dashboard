"use client";

import { useMemo, useState } from "react";
import { formatDate, shortService } from "@/lib/analytics";
import type { ChildRecord, FamilyRecord } from "@/lib/types";
import { Icons } from "./icons";
import { Badge, resultTone } from "./ui";

type Mode = "family" | "children";

export function RecordsTable({ family, childRecords: children }: { family: FamilyRecord[]; childRecords: ChildRecord[] }) {
  const [mode, setMode] = useState<Mode>("family");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim();
    const list = mode === "family" ? family : children;
    if (!term) return list;
    return list.filter((r) => Object.values(r).some((v) => typeof v === "string" && v.includes(term)));
  }, [mode, q, family, children]);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="flex rounded-xl bg-refd-purple-50 p-1">
          {(["family", "children"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${mode === m ? "bg-white text-refd-purple shadow" : "text-muted"}`}
            >
              {m === "family" ? `الأسر (${family.length})` : `الأطفال (${children.length})`}
            </button>
          ))}
        </div>
        <label className="flex h-10 min-w-60 flex-1 items-center gap-2 rounded-xl border border-line px-3 text-muted focus-within:border-refd-purple">
          <Icons.search />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم، المدينة، المستشفى…" className="w-full bg-transparent text-sm text-ink outline-none" />
        </label>
        <span className="text-xs text-muted">{rows.length} سجل</span>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-refd-purple-50/70 text-xs text-muted">
            {mode === "family" ? (
              <tr>
                {["الأسرة", "الاسم", "الخدمة", "المدينة", "الحي", "الحالة", "النتيجة", "تاريخ الفحوصات", "تاريخ النتيجة"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            ) : (
              <tr>
                {["الاسم", "تاريخ الميلاد", "المستشفى", "الحالة", "النتيجة", "ملاحظات"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-line">
            {mode === "family"
              ? (rows as FamilyRecord[]).map((r) => (
                  <tr key={r.id} className="hover:bg-refd-purple-50/50">
                    <td className="px-4 py-3">
                      <span className="grid size-7 place-items-center rounded-full bg-refd-purple-100 text-xs font-bold text-refd-purple">{r.family ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">{shortService(r.service)}</td>
                    <td className="px-4 py-3">{r.city || "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.district || "—"}</td>
                    <td className="px-4 py-3"><Badge tone={r.status.includes("تم") ? "purple" : "warning"}>{r.status || "—"}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={resultTone(r.result)}>{r.result || "بانتظار"}</Badge></td>
                    <td className="px-4 py-3 tabular-nums">{formatDate(r.labDate)}</td>
                    <td className={`px-4 py-3 tabular-nums ${r.labDate && r.resultDate && r.resultDate < r.labDate ? "font-semibold text-danger" : ""}`}>{formatDate(r.resultDate)}</td>
                  </tr>
                ))
              : (rows as ChildRecord[]).map((r) => (
                  <tr key={r.id} className="hover:bg-refd-purple-50/50">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDate(r.birthDate)}</td>
                    <td className="px-4 py-3">{r.hospital || "—"}</td>
                    <td className="px-4 py-3"><Badge tone={r.status.includes("تم") ? "purple" : "warning"}>{r.status || "—"}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={resultTone(r.result)}>{r.result || "بانتظار"}</Badge></td>
                    <td className="max-w-[320px] px-4 py-3 text-xs text-muted">{r.notes || "—"}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-muted">لا توجد نتائج</p>}
      </div>
    </section>
  );
}
