import React, { useMemo } from "react";
import Chart from "react-apexcharts";
import { format, parseISO, isValid } from "date-fns";

function formatBucketLabel(value) {
  // value can be "YYYY-MM-DD" or ISO datetime; normalize
  try {
    const d = typeof value === "string" ? parseISO(value) : new Date(value);
    if (!isValid(d)) return String(value);
    return format(d, "dd MMM"); // e.g. "06 Jan"
  } catch {
    return String(value);
  }
}

export default function ApexLine({
  series,
  categories,
  height = 280,
  ySuffix,
}) {
  const options = useMemo(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: true },
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        fontFamily: "inherit",
      },
      stroke: { curve: "smooth", width: 3 },
      dataLabels: { enabled: false },
      grid: { strokeDashArray: 4, padding: { left: 8, right: 8 } },
      legend: {
        position: "top",
        horizontalAlign: "left",
        fontSize: "12px",
        markers: { width: 10, height: 10, radius: 10 },
      },
      tooltip: {
        shared: true,
        x: {
          formatter: (val) => formatBucketLabel(val),
        },
      },
      xaxis: {
        categories,
        labels: {
          formatter: (val) => formatBucketLabel(val),
          rotate: -35,
          hideOverlappingLabels: true,
          trim: true,
          style: { fontSize: "11px" },
        },
        tickAmount: Math.min(categories?.length || 6, 6),
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (v) =>
            ySuffix ? `${Math.round(v)}${ySuffix}` : `${Math.round(v)}`,
          style: { fontSize: "11px" },
        },
      },
    }),
    [categories, ySuffix]
  );

  return (
    <Chart options={options} series={series} type="line" height={height} />
  );
}
