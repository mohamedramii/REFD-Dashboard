"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-refd-purple-50" />,
});

// Color order: purple and cyan first, then their shades
export const PALETTE = [
  "#741B8D",
  "#0BC8F2",
  "#B465CC",
  "#7FE0F7",
  "#45105A",
  "#0A8FB0",
  "#E3B8EE",
  "#F2A541",
];

export const STATUS_COLORS: Record<string, string> = {
  مناسب: "#1F9D6B",
  سليم: "#1F9D6B",
  "غير مناسب": "#D6455D",
  "غير سليم": "#D6455D",
  "بحاجة لمتابعة": "#E39A1E",
  "بانتظار النتيجة": "#C58AD8",
};

// next/font gives the font a generated internal name, so read it from the page so charts use the dashboard font
const FALLBACK_FONT = "Readex Pro, system-ui, sans-serif";
const FONT = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily || FALLBACK_FONT : FALLBACK_FONT;

const base: EChartsOption = {
  color: PALETTE,
  textStyle: { fontFamily: FONT, color: "#2A1033" },
  tooltip: {
    backgroundColor: "#2A1033",
    borderWidth: 0,
    padding: [8, 12],
    textStyle: { color: "#fff", fontFamily: FONT, fontSize: 12 },
    extraCssText: "border-radius:12px;box-shadow:0 8px 24px rgba(42,16,51,.25);direction:rtl;text-align:right;",
  },
  animationDuration: 700,
};

type Props = {
  option: EChartsOption;
  height?: number;
  onClickName?: (name: string) => void;
  /** For printing: no animation, so the chart is complete at print time */
  still?: boolean;
};

export function Chart({ option, height = 300, onClickName, still = false }: Props) {
  // dir="ltr" because the page's RTL direction flips SVG text alignment inside ECharts and clips it.
  // Right-to-left display order is handled by the axis options themselves (inverse/position).
  return (
    <div dir="ltr" style={{ height, width: "100%" }}>
    <ReactECharts
      option={{ ...base, ...option, ...(still ? { animation: false } : {}) }}
      style={{ height, width: "100%" }}
      notMerge
      lazyUpdate
      opts={{ renderer: "svg" }}
      onEvents={
        onClickName
          ? { click: (p: { name?: string }) => p.name && onClickName(p.name) }
          : undefined
      }
    />
    </div>
  );
}

export const axisStyle = {
  axisLine: { lineStyle: { color: "#EBDFF1" } },
  axisTick: { show: false },
  // RLM before the text so "2 أفراد" is not reversed inside the LTR container
  axisLabel: { color: "#74627C", fontFamily: FONT, fontSize: 11, formatter: (v: string | number) => `‏${v}` },
  splitLine: { lineStyle: { color: "#F3E6F8", type: "dashed" as const } },
};
