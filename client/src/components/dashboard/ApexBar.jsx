import React from "react";
import Chart from "react-apexcharts";

export default function ApexBar({
  series,
  categories,
  height = 320,
  horizontal,
}) {
  const options = {
    chart: {
      id: "apex-bar",
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    plotOptions: {
      bar: {
        horizontal: Boolean(horizontal),
        borderRadius: 6,
      },
    },
    xaxis: { categories },
    dataLabels: { enabled: false },
    grid: { strokeDashArray: 4 },
    legend: { position: "top" },
  };

  return <Chart options={options} series={series} type="bar" height={height} />;
}
