"use client";

import { useEffect } from "react";
import { formatDate, PENDING_RESULT, shortService } from "@/lib/analytics";
import type { ChildRecord, FamilyRecord } from "@/lib/types";
import { Icons } from "./icons";
import { Badge, resultTone } from "./ui";

/** What a click on a chart or card opens: the people behind that number */
export type PeopleList =
  | { kind: "family"; title: string; rows: FamilyRecord[]; onFilter?: () => void }
  | { kind: "children"; title: string; rows: ChildRecord[]; onFilter?: () => void };

const FAMILY_HEADERS = ["#", "الاسم", "نوع البرنامج", "المنطقة", "حالة الخدمة", "النتيجة", "تاريخ الفحص"];
const CHILD_HEADERS = ["#", "الاسم", "نوع الفحص", "المستشفى", "المنطقة", "النتيجة", "تاريخ الاستلام"];

export function PeopleModal({ list, onClose }: { list: PeopleList; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cell = "px-4 py-2.5";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={list.title}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-ink">{list.title}</h3>
            <p className="text-xs text-muted">{list.rows.length} شخص</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {list.onFilter && (
              <button
                type="button"
                onClick={() => {
                  list.onFilter!();
                  onClose();
                }}
                className="h-8 rounded-lg border border-line px-3 text-xs font-medium text-refd-purple hover:bg-refd-purple-50"
              >
                تصفية اللوحة بهذا الاختيار
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-refd-purple-50">
              <Icons.x />
            </button>
          </div>
        </div>
        <div className="scrollbar-thin overflow-auto">
          {list.rows.length ? (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-refd-purple-50 text-xs text-muted">
                <tr>
                  {(list.kind === "family" ? FAMILY_HEADERS : CHILD_HEADERS).map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.kind === "family"
                  ? list.rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-refd-purple-50/50">
                        <td className={`${cell} text-muted tabular-nums`}>{i + 1}</td>
                        <td className={`${cell} font-medium`}>{r.name}</td>
                        <td className={cell}>{shortService(r.service)}</td>
                        <td className={cell}>{r.city || "—"}</td>
                        <td className={`${cell} text-muted`}>{r.status || "—"}</td>
                        <td className={cell}><Badge tone={resultTone(r.result)}>{r.result || PENDING_RESULT}</Badge></td>
                        <td className={`${cell} tabular-nums`}>{formatDate(r.labDate)}</td>
                      </tr>
                    ))
                  : list.rows.map((c, i) => (
                      <tr key={c.id} className="hover:bg-refd-purple-50/50">
                        <td className={`${cell} text-muted tabular-nums`}>{i + 1}</td>
                        <td className={`${cell} font-medium`}>{c.name}</td>
                        <td className={cell}>{c.service || "—"}</td>
                        <td className={`${cell} text-muted`}>{c.hospital || "—"}</td>
                        <td className={cell}>{c.city || "—"}</td>
                        <td className={cell}><Badge tone={c.result === "سليم" ? "success" : c.result ? "danger" : "warning"}>{c.result || PENDING_RESULT}</Badge></td>
                        <td className={`${cell} tabular-nums`}>{formatDate(c.receivedDate)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">لا يوجد أشخاص هنا</p>
          )}
        </div>
      </div>
    </div>
  );
}
