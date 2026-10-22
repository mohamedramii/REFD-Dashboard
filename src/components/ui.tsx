"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`card flex min-w-0 flex-col p-5 ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

type Tone = "purple" | "cyan" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  purple: { bg: "bg-refd-purple-100", fg: "text-refd-purple" },
  cyan: { bg: "bg-refd-cyan-100", fg: "text-refd-cyan-600" },
  success: { bg: "bg-[#E3F5EC]", fg: "text-success" },
  warning: { bg: "bg-[#FDF1DC]", fg: "text-warning" },
  danger: { bg: "bg-[#FBE5E9]", fg: "text-danger" },
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "purple",
  icon,
  progress,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon: ReactNode;
  progress?: number;
}) {
  const t = toneStyles[tone];
  return (
    <div className="card relative flex h-full flex-col overflow-hidden p-4">
      <div className="flex h-10 items-center justify-between gap-3">
        <p className="line-clamp-2 min-w-0 text-xs leading-snug font-medium text-muted">{label}</p>
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${t.bg} ${t.fg}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[28px] leading-none font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {/* Fixed-height footer slot so every card has the same height and the numbers line up */}
      <div className="mt-3 flex h-7 flex-col justify-end gap-1.5">
        {hint && <p className="truncate text-[11px] leading-none text-muted">{hint}</p>}
        {progress !== undefined && (
          <div className="h-1.5 overflow-hidden rounded-full bg-refd-purple-50">
            <div
              className="h-full rounded-full bg-gradient-to-l from-refd-cyan to-refd-purple transition-all duration-700"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm transition ${
          value.length
            ? "border-refd-purple bg-refd-purple-50 text-refd-purple"
            : "border-line bg-white text-ink hover:border-refd-purple-300"
        }`}
      >
        <span className="truncate">
          {label}
          {value.length > 0 && <span className="ms-1 font-semibold">({value.length})</span>}
        </span>
        <svg className="size-4 shrink-0 opacity-60" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      {open && (
        <div className="scrollbar-thin absolute z-30 mt-2 max-h-80 w-max min-w-full max-w-[min(22rem,90vw)] overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          {options.length === 0 && <p className="p-3 text-xs text-muted">لا توجد قيم</p>}
          {options.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-refd-purple-50"
            >
              <input
                type="checkbox"
                checked={value.includes(o)}
                onChange={() => toggle(o)}
                className="size-4 accent-[var(--refd-purple)]"
              />
              <span className="leading-snug">{o}</span>
            </label>
          ))}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-lg px-2.5 py-2 text-start text-xs font-medium text-refd-purple hover:bg-refd-purple-50"
            >
              مسح الاختيار
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Per-chart filter: narrows one chart on top of the board filters */
export function ChartFilter<K extends string>({
  dims,
  labels,
  options,
  value,
  onChange,
}: {
  dims: K[];
  labels: Record<K, string>;
  options: Record<K, string[]>;
  value: Partial<Record<K, string[]>>;
  onChange: (v: Partial<Record<K, string[]>>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = dims.reduce((n, d) => n + (value[d]?.length ?? 0), 0);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="تصفية الرسم"
        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${
          active ? "border-refd-purple bg-refd-purple-50 text-refd-purple" : "border-line bg-white text-muted hover:border-refd-purple-300"
        }`}
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />
        </svg>
        تصفية
        {active > 0 && <span className="font-semibold">({active})</span>}
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-2 w-72 max-w-[85vw] space-y-2 rounded-2xl border border-line bg-white p-3 shadow-xl">
          {dims.map((d) => (
            <MultiSelect
              key={d}
              label={labels[d]}
              options={options[d]}
              value={value[d] ?? []}
              onChange={(v) => onChange({ ...value, [d]: v })}
            />
          ))}
          {active > 0 && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="w-full rounded-lg px-2.5 py-2 text-start text-xs font-medium text-refd-purple hover:bg-refd-purple-50"
            >
              مسح تصفية الرسم
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Badge({ children, tone = "purple" }: { children: ReactNode; tone?: Tone }) {
  const t = toneStyles[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.bg} ${t.fg}`}>
      {children}
    </span>
  );
}

export function resultTone(result: string): Tone {
  if (result === "مناسب" || result === "سليم") return "success";
  if (result.startsWith("غير")) return "danger";
  return "warning";
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end gap-3 pt-2">
      <span className="mb-1 h-6 w-1.5 rounded-full bg-gradient-to-b from-refd-cyan to-refd-purple" />
      <div>
        <h2 className="text-base font-bold text-ink md:text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

/** Chart placeholder for when the required data is not in the sheet yet */
export function EmptyChart({ text, height = 260 }: { text: string; height?: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl border border-dashed border-refd-purple-300 bg-refd-purple-50/60 p-6 text-center"
      style={{ height }}
    >
      <p className="max-w-64 text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
