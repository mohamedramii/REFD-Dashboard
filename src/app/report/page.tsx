import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportView } from "@/components/report/ReportView";

export const metadata: Metadata = {
  title: "تقرير الفحوصات",
};

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-muted">جاري تجهيز التقرير…</div>}>
      <ReportView />
    </Suspense>
  );
}
