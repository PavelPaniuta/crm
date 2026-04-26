"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  title?: string;
  horizontal?: boolean;
}

export default function BarChart({ data, height = 220, color = "#6366F1", title, horizontal = false }: Props) {
  const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";

  const options = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "bar",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
      animations: { enabled: true, speed: 500 },
    },
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 5,
        columnWidth: "55%",
        barHeight: "65%",
        distributed: false,
      },
    },
    dataLabels: { enabled: false },
    colors: [color],
    xaxis: {
      categories: data.map((d) => d.label),
      labels: {
        style: { colors: "#94A3B8", fontSize: "11px", fontFamily: "Inter" },
        rotate: horizontal ? 0 : -30,
        hideOverlappingLabels: true,
        trim: true,
        maxHeight: 52,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#94A3B8", fontSize: "11px", fontFamily: "Inter" },
        formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)),
      },
    },
    grid: {
      borderColor: isDark ? "#2D3F53" : "#F1F5F9",
      strokeDashArray: 4,
      yaxis: { lines: { show: !horizontal } },
      xaxis: { lines: { show: horizontal } },
      padding: { left: 8, right: 8 },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: { formatter: (v: number) => v.toLocaleString("ru") },
    },
    fill: { opacity: 0.9 },
  }), [data, color, isDark, horizontal]);

  const series = useMemo(() => [
    { name: title ?? "Значение", data: data.map((d) => d.value) },
  ], [data, title]);

  return (
    <ApexCharts
      type="bar"
      options={options}
      series={series}
      height={height}
    />
  );
}
