"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: { label: string; value: number; color: string }[];
  height?: number;
  title?: string;
  totalLabel?: string;
}

export default function DonutChart({ data, height = 260, title, totalLabel }: Props) {
  const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";

  const options = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      toolbar: { show: false },
      background: "transparent",
      animations: { enabled: true, speed: 600 },
    },
    colors: data.map((d) => d.color),
    labels: data.map((d) => d.label),
    dataLabels: { enabled: false },
    legend: {
      position: "bottom",
      fontFamily: "Inter",
      fontSize: "12px",
      fontWeight: 500,
      labels: { colors: isDark ? "#8899AE" : "#64748B" },
      markers: { offsetX: -2 },
      itemMargin: { horizontal: 10, vertical: 4 },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "12px",
              fontFamily: "Inter",
              color: isDark ? "#8899AE" : "#64748B",
              offsetY: -8,
            },
            value: {
              show: true,
              fontSize: "24px",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: isDark ? "#E8ECF1" : "#1E293B",
              offsetY: 6,
              formatter: (v: string) => Number(v).toLocaleString("ru"),
            },
            total: {
              show: true,
              label: totalLabel ?? "Всего",
              fontSize: "12px",
              fontFamily: "Inter",
              color: isDark ? "#8899AE" : "#64748B",
              formatter: (w: any) => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString("ru"),
            },
          },
        },
      },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: { formatter: (v: number) => v.toLocaleString("ru") },
    },
    stroke: { show: false },
  }), [data, isDark, totalLabel]);

  const series = useMemo(() => data.map((d) => d.value), [data]);

  return (
    <ApexCharts
      type="donut"
      options={options}
      series={series}
      height={height}
    />
  );
}
