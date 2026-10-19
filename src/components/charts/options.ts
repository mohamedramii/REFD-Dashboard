import type { EChartsOption } from "echarts";
import type { NameValue } from "@/lib/analytics";
import { axisStyle, PALETTE, STATUS_COLORS } from "./Chart";

const legendBottom = {
  bottom: 0,
  icon: "circle",
  itemWidth: 9,
  itemHeight: 9,
  itemGap: 14,
  textStyle: { color: "#74627C", fontSize: 11 },
  formatter: (name: string) => `‏${name}`,
};

export function donut(data: NameValue[], centerLabel: string, colorByStatus = false): EChartsOption {
  const total = data.reduce((s, d) => s + d.value, 0);
  return {
    tooltip: { trigger: "item", formatter: "{b}<br/><b>{c}</b> ({d}%)" },
    legend: { ...legendBottom, type: "scroll" },
    title: {
      text: String(total),
      subtext: centerLabel,
      left: "center",
      top: "36%",
      textStyle: { fontSize: 26, fontWeight: 700, color: "#2A1033" },
      subtextStyle: { fontSize: 11, color: "#74627C" },
      itemGap: 4,
    },
    series: [
      {
        type: "pie",
        radius: ["58%", "80%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 3 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 6 },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: (colorByStatus && STATUS_COLORS[d.name]) || PALETTE[i % PALETTE.length] },
        })),
      },
    ],
  };
}

export function horizontalBar(data: NameValue[], color = PALETTE[0], maxLabel = 18): EChartsOption {
  const rows = [...data].reverse();
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 36, right: 12, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", inverse: true, minInterval: 1, ...axisStyle },
    yAxis: {
      type: "category",
      position: "right",
      data: rows.map((d) => d.name),
      ...axisStyle,
      axisLabel: {
        ...axisStyle.axisLabel,
        formatter: (v: string) => `‏${v.length > maxLabel ? `${v.slice(0, maxLabel)}…` : v}`,
      },
    },
    series: [
      {
        type: "bar",
        data: rows.map((d) => d.value),
        barMaxWidth: 22,
        itemStyle: {
          borderRadius: [8, 0, 0, 8],
          color: {
            type: "linear", x: 1, y: 0, x2: 0, y2: 0,
            colorStops: [
              { offset: 0, color },
              { offset: 1, color: color === PALETTE[0] ? "#B465CC" : "#7FE0F7" },
            ],
          },
        },
        label: { show: true, position: "left", color: "#2A1033", fontWeight: 600, fontSize: 11 },
      },
    ],
  };
}

export function stackedBar(
  categories: string[],
  series: { name: string; data: number[]; color?: string }[],
): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: legendBottom,
    grid: { left: 8, right: 8, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: "category", data: categories, inverse: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, interval: 0, hideOverlap: false, width: 96, overflow: "break" as const, lineHeight: 14 } },
    yAxis: { type: "value", minInterval: 1, position: "right", ...axisStyle },
    series: series.map((s, i) => ({
      name: s.name,
      type: "bar",
      stack: "total",
      barMaxWidth: 36,
      data: s.data,
      itemStyle: {
        color: s.color ?? PALETTE[i % PALETTE.length],
        borderRadius: i === series.length - 1 ? [8, 8, 0, 0] : 0,
      },
      emphasis: { focus: "series" },
    })),
  };
}

export function sankey(data: { nodes: { name: string }[]; links: { source: string; target: string; value: number }[] }): EChartsOption {
  const colorFor = (name: string) => {
    if (name.startsWith("نتيجة: مناسب")) return "#1F9D6B";
    if (name.startsWith("نتيجة: غير")) return "#D6455D";
    if (name.startsWith("نتيجة")) return "#E39A1E";
    if (name.startsWith("خدمة")) return "#0BC8F2";
    return "#741B8D";
  };
  return {
    tooltip: { trigger: "item", triggerOn: "mousemove" },
    series: [
      {
        type: "sankey",
        left: 96,
        right: 120,
        top: 8,
        bottom: 8,
        nodeWidth: 14,
        nodeGap: 12,
        layoutIterations: 64,
        emphasis: { focus: "adjacency" },
        data: data.nodes.map((n) => {
          const isCity = !n.name.startsWith("خدمة") && !n.name.startsWith("نتيجة");
          return {
            ...n,
            itemStyle: { color: colorFor(n.name), borderWidth: 0 },
            // المدن على الطرف الشمال، فاسمها يتكتب برّه العمود عشان مايتغطاش بالخطوط
            label: isCity ? { position: "left" as const } : undefined,
          };
        }),
        links: data.links,
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.28 },
        label: {
          color: "#2A1033",
          fontSize: 11,
          fontWeight: 500,
          formatter: (p: unknown) => (p as { name: string }).name.replace(/^(خدمة|نتيجة): /, ""),
        },
      },
    ],
  };
}

export function heatmap(rows: string[], cols: string[], get: (r: string, c: string) => number): EChartsOption {
  const values: [number, number, number][] = [];
  let max = 1;
  rows.forEach((r, y) =>
    cols.forEach((c, x) => {
      const v = get(r, c);
      max = Math.max(max, v);
      values.push([x, y, v]);
    }),
  );
  return {
    tooltip: {
      formatter: (p: unknown) => {
        const { value } = p as { value: [number, number, number] };
        return `${rows[value[1]]} · ${cols[value[0]]}<br/><b>${value[2]}</b> فحص`;
      },
    },
    grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
    xAxis: { type: "category", data: cols, inverse: true, ...axisStyle, splitArea: { show: false } },
    yAxis: {
      type: "category",
      data: rows,
      position: "right",
      ...axisStyle,
      axisLabel: { ...axisStyle.axisLabel, width: 90, overflow: "truncate" as const },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 10,
      itemHeight: 120,
      inRange: { color: ["#FAF5FC", "#C58AD8", "#741B8D"] },
      textStyle: { color: "#74627C", fontSize: 10 },
    },
    series: [
      {
        type: "heatmap",
        data: values,
        label: { show: true, color: "#2A1033", fontSize: 11, formatter: (p: unknown) => String((p as { value: number[] }).value[2] || "") },
        itemStyle: { borderColor: "#fff", borderWidth: 3, borderRadius: 6 },
      },
    ],
  };
}

export function timelineChart(points: { date: string; lab: number; result: number; cumLab: number; cumRes: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    legend: legendBottom,
    grid: { left: 8, right: 8, top: 16, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      inverse: true,
      data: points.map((p) => {
        const [, m, d] = p.date.split("-");
        return `${Number(d)}/${Number(m)}`;
      }),
      ...axisStyle,
    },
    yAxis: [
      { type: "value", minInterval: 1, position: "right", ...axisStyle },
      { type: "value", minInterval: 1, position: "left", ...axisStyle, splitLine: { show: false } },
    ],
    series: [
      { name: "فحوصات مخبرية", type: "bar", data: points.map((p) => p.lab), barMaxWidth: 14, itemStyle: { color: "#741B8D", borderRadius: [6, 6, 0, 0] } },
      { name: "نتائج صدرت", type: "bar", data: points.map((p) => p.result), barMaxWidth: 14, itemStyle: { color: "#0BC8F2", borderRadius: [6, 6, 0, 0] } },
      {
        name: "تراكمي الفحوصات",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: points.map((p) => p.cumLab),
        lineStyle: { width: 2.5, color: "#B465CC" },
        itemStyle: { color: "#B465CC" },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(180,101,204,.22)" }, { offset: 1, color: "rgba(180,101,204,0)" }] },
        },
      },
      {
        name: "تراكمي النتائج",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: points.map((p) => p.cumRes),
        lineStyle: { width: 2.5, color: "#0A8FB0", type: "dashed" },
        itemStyle: { color: "#0A8FB0" },
      },
    ],
  };
}

export function gauge(value: number, label: string, color = "#741B8D"): EChartsOption {
  return {
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: "92%",
        center: ["50%", "58%"],
        progress: { show: true, width: 14, roundCap: true, itemStyle: { color } },
        axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, "#F3E6F8"]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, "34%"], fontSize: 12, color: "#74627C" },
        detail: {
          offsetCenter: [0, "-4%"],
          valueAnimation: true,
          fontSize: 30,
          fontWeight: 700,
          color: "#2A1033",
          formatter: "{value}%",
        },
        // علامة RLM عشان النص المختلط (أرقام + عربي) يتقري صح جوه الحاوية LTR
        data: [{ value, name: `‏${label}` }],
      },
    ],
  };
}

export function treemap(data: { name: string; value: number; children: NameValue[] }[]): EChartsOption {
  return {
    tooltip: { formatter: "{b}: <b>{c}</b>" },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        levels: [
          { itemStyle: { borderColor: "#fff", borderWidth: 4, gapWidth: 4, borderRadius: 12 } },
          { itemStyle: { borderColor: "rgba(255,255,255,.6)", borderWidth: 2, gapWidth: 2, borderRadius: 8 }, colorSaturation: [0.35, 0.6] },
        ],
        upperLabel: { show: true, height: 22, color: "#fff", fontWeight: 600, fontSize: 12 },
        label: { fontSize: 11, formatter: "{b}\n{c}" },
        data: data.map((d, i) => ({ ...d, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
    ],
  };
}

export function columns(data: NameValue[], color = PALETTE[0], name = "العدد"): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.name), inverse: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, interval: 0, hideOverlap: false, width: 96, overflow: "break" as const, lineHeight: 14 } },
    yAxis: { type: "value", minInterval: 1, position: "right", ...axisStyle },
    series: [
      {
        name,
        type: "bar",
        data: data.map((d) => d.value),
        barMaxWidth: 34,
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: color === PALETTE[0] ? "#C58AD8" : "#9BE8F9" }] },
        },
        label: { show: true, position: "top", color: "#2A1033", fontSize: 11, fontWeight: 600, formatter: (p: unknown) => String((p as { value: number }).value || "") },
      },
    ],
  };
}

export function radar(indicators: { name: string; max: number }[], series: { name: string; value: number[]; color: string }[]): EChartsOption {
  return {
    tooltip: {},
    legend: legendBottom,
    radar: {
      indicator: indicators,
      radius: "62%",
      center: ["50%", "46%"],
      splitNumber: 4,
      axisName: { color: "#74627C", fontSize: 11 },
      splitLine: { lineStyle: { color: "#EBDFF1" } },
      splitArea: { areaStyle: { color: ["#fff", "#FAF5FC"] } },
      axisLine: { lineStyle: { color: "#EBDFF1" } },
    },
    series: [
      {
        type: "radar",
        data: series.map((s) => ({
          name: s.name,
          value: s.value,
          lineStyle: { color: s.color, width: 2 },
          itemStyle: { color: s.color },
          areaStyle: { color: s.color, opacity: 0.15 },
          symbolSize: 5,
        })),
      },
    ],
  };
}
