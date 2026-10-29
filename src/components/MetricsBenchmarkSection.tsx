"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Download } from "lucide-react";
import {
  api,
  CompareSeriesPoint,
  MetricItem,
  MODEL_COLORS,
  MODEL_FAMILIES,
  StationMetadata,
} from "@/lib/api";

interface MetricsBenchmarkSectionProps {
  metrics: MetricItem[];
  stations: StationMetadata[];
  selectedStation: string;
}

const ALL_MODELS = [
  "LSTM",
  "Bi-LSTM",
  "Transformer",
  "ARIMAX",
  "TimesFM",
  "AutoARIMA",
  "SimpleML",
];

export default function MetricsBenchmarkSection({
  metrics,
  stations,
  selectedStation,
}: MetricsBenchmarkSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const [testTimeline, setTestTimeline] = useState<CompareSeriesPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState<boolean>(true);
  const [windowDays, setWindowDays] = useState<86 | 35>(86);
  const [chartView, setChartView] = useState<"curves" | "errors">("curves");
  const [focusedModel, setFocusedModel] = useState<string | null>(null);

  const [visibleModels, setVisibleModels] = useState<Record<string, boolean>>({
    LSTM: true,
    "Bi-LSTM": true,
    Transformer: true,
    ARIMAX: true,
    TimesFM: false,
    AutoARIMA: false,
    SimpleML: true,
  });

  const stationObj = stations.find((s) => s.id === selectedStation);

  // Fetch 86-day test set series whenever station changes
  useEffect(() => {
    let mounted = true;
    setLoadingChart(true);
    api
      .getCompareSeries(selectedStation, 86)
      .then((res) => {
        if (mounted) {
          // Keep only the historical/test points (2024-12-01 to 2025-02-24)
          const testPoints = res.timeline.filter((pt) => !pt.es_prediccion);
          setTestTimeline(testPoints);
          setLoadingChart(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingChart(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedStation]);

  const toggleModel = (model: string) => {
    setFocusedModel(null);
    setVisibleModels((prev) => ({ ...prev, [model]: !prev[model] }));
  };

  const handleSelectAllModels = (enableAll: boolean) => {
    setFocusedModel(null);
    const next: Record<string, boolean> = {};
    for (const m of ALL_MODELS) {
      next[m] = enableAll;
    }
    setVisibleModels(next);
  };

  const handleFocusSingleModel = (model: string) => {
    if (focusedModel === model) {
      setFocusedModel(null);
    } else {
      setFocusedModel(model);
      setVisibleModels((prev) => ({ ...prev, [model]: true }));
    }
  };

  const activeModels = useMemo(() => {
    if (focusedModel) return [focusedModel];
    return ALL_MODELS.filter((m) => visibleModels[m]);
  }, [focusedModel, visibleModels]);

  const chartData = useMemo(() => {
    const sliced =
      windowDays === 35 ? testTimeline.slice(-35) : testTimeline;
    return sliced.map((pt) => {
      const row: Record<string, any> = {
        fecha: pt.fecha,
        real: pt.real,
      };
      for (const m of ALL_MODELS) {
        const predVal = typeof pt[m] === "number" ? (pt[m] as number) : null;
        if (chartView === "curves") {
          row[m] = predVal;
        } else {
          row[m] =
            predVal !== null && typeof pt.real === "number"
              ? Number(Math.abs(pt.real - predVal).toFixed(4))
              : null;
        }
      }
      return row;
    });
  }, [testTimeline, windowDays, chartView]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ["auto", "auto"];
    if (chartView === "errors") {
      let maxErr = 0.1;
      for (const row of chartData) {
        for (const m of activeModels) {
          if (typeof row[m] === "number" && row[m] > maxErr) {
            maxErr = row[m];
          }
        }
      }
      return [0, Number((maxErr * 1.12).toFixed(2))];
    }

    let min = Infinity;
    let max = -Infinity;
    for (const row of chartData) {
      if (typeof row.real === "number") {
        if (row.real < min) min = row.real;
        if (row.real > max) max = row.real;
      }
      for (const m of activeModels) {
        if (typeof row[m] === "number") {
          if (row[m] < min) min = row[m];
          if (row[m] > max) max = row[m];
        }
      }
    }
    if (!isFinite(min) || !isFinite(max)) return ["auto", "auto"];
    const pad = Math.max((max - min) * 0.08, 0.2);
    return [Number((min - pad).toFixed(2)), Number((max + pad).toFixed(2))];
  }, [chartData, activeModels, chartView]);

  const rows = useMemo(() => {
    const filtered = showAll
      ? metrics
      : metrics.filter((m) => m.station_id === selectedStation);
    return [...filtered].sort((a, b) => a.rmse - b.rmse);
  }, [metrics, selectedStation, showAll]);

  const handleDownloadTestCSV = () => {
    if (!testTimeline.length || !stationObj) return;
    const headers = ["Fecha", "Real_msnm", ...ALL_MODELS];
    const csvRows = testTimeline.map((pt) => [
      pt.fecha,
      pt.real ?? "",
      ...ALL_MODELS.map((m) => pt[m] ?? ""),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `evaluacion_testset_${stationObj.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Test Set Interactive Curve Comparison */}
      <div className="rounded-xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {stationObj?.name ?? "Estación"} — Comportamiento en Set de Pruebas vs. Curva Real
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500">
                Test Set ({windowDays} días)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {windowDays === 86
                ? "Evaluación completa: 2024-12-01 al 2025-02-24 (86 días)"
                : "Última ventana equivalente al horizonte de pronóstico: 2025-01-21 al 2025-02-24 (35 días)"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switch: Curvas vs Error Absoluto */}
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-800">
              <button
                type="button"
                onClick={() => setChartView("curves")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  chartView === "curves"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Curvas (m s.n.m.)
              </button>
              <button
                type="button"
                onClick={() => setChartView("errors")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  chartView === "errors"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Error |y - ŷ|
              </button>
            </div>

            {/* Window Size Selector */}
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-800">
              {[
                { label: "86d (Completo)", val: 86 as const },
                { label: "35d (Horizonte)", val: 35 as const },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setWindowDays(opt.val)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    windowDays === opt.val
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadTestCSV}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
              title="Descargar CSV del Test Set"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Model Selector & Quick Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {chartView === "curves" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: MODEL_COLORS.real }}
                />
                Curva Real (Test Set)
              </span>
            )}

            {ALL_MODELS.map((model) => {
              const isShown = activeModels.includes(model);
              const isFocused = focusedModel === model;
              const color = MODEL_COLORS[model] || "#94a3b8";
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => toggleModel(model)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    isFocused
                      ? "ring-2 ring-sky-500 bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : isShown
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                      : "text-slate-400 opacity-50 hover:opacity-100 dark:text-slate-500"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: isShown ? color : "#64748b" }}
                  />
                  {model === "SimpleML" ? "Simple-ML" : model}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            {focusedModel && (
              <button
                type="button"
                onClick={() => setFocusedModel(null)}
                className="rounded px-2 py-0.5 font-medium text-sky-500 hover:bg-sky-500/10"
              >
                Salir de vista individual
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSelectAllModels(true)}
              className="rounded px-2 py-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Todos
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={() => {
                setFocusedModel(null);
                setVisibleModels({
                  LSTM: true,
                  "Bi-LSTM": false,
                  Transformer: true,
                  ARIMAX: true,
                  TimesFM: false,
                  AutoARIMA: false,
                  SimpleML: true,
                });
              }}
              className="rounded px-2 py-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Top + Baseline
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="mt-4 h-[380px] w-full">
          {loadingChart ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              Cargando evaluación del set de pruebas...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.18}
                  vertical={false}
                />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickMargin={8}
                  minTickGap={32}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain as [number, number]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(v) => `${v}m`}
                  width={48}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.92)",
                    borderColor: "rgba(51, 65, 85, 0.6)",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  formatter={(value: any, name: string) => [
                    typeof value === "number" ? `${value.toFixed(3)} m` : "--",
                    name === "real"
                      ? "Real (Test Set)"
                      : chartView === "errors"
                      ? `${name} (|Error|)`
                      : name,
                  ]}
                />

                {chartView === "errors" && (
                  <ReferenceLine
                    y={0}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                  />
                )}

                {chartView === "curves" && (
                  <Line
                    type="monotone"
                    dataKey="real"
                    name="real"
                    stroke={MODEL_COLORS.real}
                    strokeWidth={3}
                    dot={false}
                    connectNulls={false}
                  />
                )}

                {ALL_MODELS.map((model) =>
                  activeModels.includes(model) ? (
                    <Line
                      key={model}
                      type="monotone"
                      dataKey={model}
                      name={model === "SimpleML" ? "Simple-ML" : model}
                      stroke={MODEL_COLORS[model]}
                      strokeWidth={focusedModel === model ? 2.5 : 1.8}
                      strokeDasharray={
                        model === "SimpleML"
                          ? "5 4"
                          : model === "AutoARIMA"
                          ? "3 3"
                          : undefined
                      }
                      dot={false}
                      connectNulls
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Metrics Table with Click-to-Focus */}
      <div className="rounded-xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Tabla Comparativa en Test Set —{" "}
              {showAll ? "Todas las estaciones" : stationObj?.name}
            </h2>
            <p className="text-xs text-slate-400">
              Ordenado por menor error RMSE • Haz clic en un modelo para aislar su curva arriba
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            {showAll ? "Ver estación actual" : "Ver todas las estaciones"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
              <tr>
                {showAll && <th className="pb-2.5 font-medium">Estación</th>}
                <th className="pb-2.5 font-medium">Modelo</th>
                <th className="pb-2.5 font-medium hidden sm:table-cell">Familia</th>
                <th className="pb-2.5 text-right font-medium">RMSE (m)</th>
                <th className="pb-2.5 text-right font-medium">MAE (m)</th>
                <th className="pb-2.5 text-right font-medium">MAPE (%)</th>
                <th className="pb-2.5 text-right font-medium">R²</th>
                <th className="pb-2.5 text-right font-medium">Curva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rows.map((row, idx) => {
                const isBest = !showAll && idx === 0;
                const isFocused = focusedModel === row.modelo;
                return (
                  <tr
                    key={`${row.station_id}-${row.modelo}`}
                    onClick={() => handleFocusSingleModel(row.modelo)}
                    className={`cursor-pointer transition-colors ${
                      isFocused
                        ? "bg-sky-500/10 dark:bg-sky-500/15"
                        : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    }`}
                  >
                    {showAll && (
                      <td className="py-3 text-slate-500 dark:text-slate-400">
                        {row.station_name === "Caicara el mini mini"
                          ? "Caicara"
                          : row.station_name}
                      </td>
                    )}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              MODEL_COLORS[row.modelo] || "#94a3b8",
                          }}
                        />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {row.modelo === "SimpleML" ? "Simple-ML" : row.modelo}
                        </span>
                        {isBest && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                            Mejor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-slate-400 hidden sm:table-cell">
                      {MODEL_FAMILIES[row.modelo] ?? "Modelo"}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {row.rmse.toFixed(3)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                      {row.mae.toFixed(3)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                      {row.mape.toFixed(2)}%
                    </td>
                    <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                      {row.r2.toFixed(3)}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                          isFocused
                            ? "bg-sky-500 text-white"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {isFocused ? "Viendo solo este" : "Aislar vs Real"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

