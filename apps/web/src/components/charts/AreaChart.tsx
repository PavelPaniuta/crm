"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  title?: string;
}

export default function AreaChart({ data, height = 220, color = "#6366F1", title }: Props) {
  const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";

  const options = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 600 },
      background: "transparent",
      sparkline: { enabled: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2.5 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 90, 100],
      },
    },
    colors: [color],
    xaxis: {
      categories: data.map((d) => d.label),
      labels: {
        style: { colors: "#94A3B8", fontSize: "11px", fontFamily: "Inter" },
        rotate: 0,
        hideOverlappingLabels: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#94A3B8", fontSize: "11px", fontFamily: "Inter" },
        formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    grid: {
      borderColor: isDark ? "#2D3F53" : "#F1F5F9",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
      padding: { left: 8, right: 8 },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: { formatter: (v: number) => v.toLocaleString("ru") },
    },
    markers: { size: 0 },
  }), [data, color, isDark]);

  const series = useMemo(() => [
    { name: title ?? "Значение", data: data.map((d) => d.value) },
  ], [data, title]);

  return (
    <ApexCharts
      type="area"
      options={options}
      series={series}
      height={height}
    />
  );
}
