"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Download } from "lucide-react";
import {
  CompareSeriesPoint,
  MODEL_COLORS,
  StationMetadata,
} from "@/lib/api";

interface ForecastComparisonChartProps {
  station: StationMetadata | undefined;
  timeline: CompareSeriesPoint[];
  historyDays: number;
  onChangeHistoryDays: (days: number) => void;
  loading: boolean;
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

export default function ForecastComparisonChart({
  station,
  timeline,
  historyDays,
  onChangeHistoryDays,
  loading,
}: ForecastComparisonChartProps) {
  // Default to the best-performing models + baseline for a clean view
  const [visibleModels, setVisibleModels] = useState<Record<string, boolean>>({
    LSTM: true,
    "Bi-LSTM": false,
    Transformer: true,
    ARIMAX: true,
    TimesFM: false,
    AutoARIMA: false,
    SimpleML: true,
  });

  const [showTestPreds, setShowTestPreds] = useState<boolean>(false);

  const toggleModel = (model: string) => {
    setVisibleModels((prev) => ({ ...prev, [model]: !prev[model] }));
  };

  const handleToggleTestPreds = () => {
    setShowTestPreds((prev) => {
      const next = !prev;
      if (next && historyDays < 86) {
        onChangeHistoryDays(86);
      }
      return next;
    });
  };

  const chartData = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    return timeline.map((pt, idx) => {
      const isForecast = pt.es_prediccion;
      const isLastReal =
        !isForecast &&
        idx + 1 < timeline.length &&
        timeline[idx + 1].es_prediccion;

      const row: Record<string, any> = {
        fecha: pt.fecha,
        real: pt.real,
        es_prediccion: pt.es_prediccion,
      };

      for (const m of ALL_MODELS) {
        if (isForecast) {
          row[m] = pt[m] ?? null;
        } else if (showTestPreds) {
          row[m] = pt[m] ?? null;
        } else if (isLastReal) {
          row[m] = pt.real;
        } else {
          row[m] = null;
        }
      }
      return row;
    });
  }, [timeline, showTestPreds]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ["auto", "auto"];
    let min = Infinity;
    let max = -Infinity;

    for (const row of chartData) {
      if (typeof row.real === "number") {
        if (row.real < min) min = row.real;
        if (row.real > max) max = row.real;
      }
      for (const m of ALL_MODELS) {
        if (visibleModels[m] && typeof row[m] === "number") {
          if (row[m] < min) min = row[m];
          if (row[m] > max) max = row[m];
        }
      }
    }
    if (!isFinite(min) || !isFinite(max)) return ["auto", "auto"];
    const pad = Math.max((max - min) * 0.1, 0.25);
    return [Number((min - pad).toFixed(2)), Number((max + pad).toFixed(2))];
  }, [chartData, visibleModels]);

  const handleDownloadCSV = () => {
    if (!timeline.length || !station) return;
    const headers = ["Fecha", "Tipo", "Real_msnm", ...ALL_MODELS];
    const rows = timeline.map((pt) => [
      pt.fecha,
      pt.es_prediccion ? "Forecast_35d" : "Historico",
      pt.real ?? "",
      ...ALL_MODELS.map((m) => pt[m] ?? ""),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `pronostico_${station.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {station?.name ?? "Estación"} — Pronóstico 35 días
          </h2>
          <p className="text-xs text-slate-400">
            Corte histórico: 2025-02-24 • Horizonte: 2025-02-25 al 2025-03-31
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleTestPreds}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              showTestPreds
                ? "border-sky-500/40 bg-sky-500/10 text-sky-500"
                : "border-slate-200 text-slate-500 hover:text-slate-800 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {showTestPreds ? "Ocultar Test Set" : "Superponer Test Set"}
          </button>

          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-800">
            {[
              { label: "35d", val: 35 },
              { label: "86d", val: 86 },
              { label: "180d", val: 180 },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => onChangeHistoryDays(opt.val)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  historyDays === opt.val
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
            onClick={handleDownloadCSV}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
            title="Descargar CSV"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Minimalist Model Selector */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: MODEL_COLORS.real }}
          />
          Real
        </span>

        {ALL_MODELS.map((model) => {
          const active = visibleModels[model];
          const color = MODEL_COLORS[model] || "#94a3b8";
          return (
            <button
              key={model}
              type="button"
              onClick={() => toggleModel(model)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                active
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                  : "text-slate-400 opacity-50 hover:opacity-100 dark:text-slate-500"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? color : "#64748b" }}
              />
              {model === "SimpleML" ? "Simple-ML" : model}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="mt-4 h-[400px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Cargando...
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
                minTickGap={35}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain as [number, number]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `${v}m`}
                width={46}
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
                  typeof value === "number" ? `${value.toFixed(2)} m` : "--",
                  name === "real" ? "Real" : name,
                ]}
              />

              <ReferenceArea
                x1="2025-02-25"
                x2="2025-03-31"
                fill="#0ea5e9"
                fillOpacity={0.05}
              />

              <ReferenceLine
                x="2025-02-24"
                stroke="#38bdf8"
                strokeDasharray="3 3"
                strokeOpacity={0.7}
              />

              <Line
                type="monotone"
                dataKey="real"
                name="real"
                stroke={MODEL_COLORS.real}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
              />

              {ALL_MODELS.map((model) =>
                visibleModels[model] ? (
                  <Line
                    key={model}
                    type="monotone"
                    dataKey={model}
                    name={model}
                    stroke={MODEL_COLORS[model]}
                    strokeWidth={2}
                    strokeDasharray={model === "SimpleML" ? "5 4" : undefined}
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
  );
}
