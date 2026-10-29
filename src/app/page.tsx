"use client";

import React, { useEffect, useState } from "react";
import { Waves, Sun, Moon } from "lucide-react";
import {
  api,
  StationMetadata,
  DashboardSummaryResponse,
  MetricItem,
  CompareSeriesPoint,
} from "@/lib/api";
import StationCards from "@/components/StationCards";
import ForecastComparisonChart from "@/components/ForecastComparisonChart";
import MetricsBenchmarkSection from "@/components/MetricsBenchmarkSection";
import HistoricalAndWaveSection from "@/components/HistoricalAndWaveSection";
import DidacticGuideSection from "@/components/DidacticGuideSection";

export default function OrinocoDashboardPage() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "forecast" | "metrics" | "wave" | "didactic"
  >("forecast");

  const [stations, setStations] = useState<StationMetadata[]>([]);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);

  const [selectedStation, setSelectedStation] =
    useState<string>("ciudad_bolivar");
  const [historyDays, setHistoryDays] = useState<number>(35);
  const [timeline, setTimeline] = useState<CompareSeriesPoint[]>([]);
  const [loadingSeries, setLoadingSeries] = useState<boolean>(true);

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    Promise.all([api.getStations(), api.getSummary(), api.getMetrics()])
      .then(([stRes, sumRes, metRes]) => {
        setStations(stRes);
        setSummary(sumRes);
        setMetrics(metRes.metrics);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingSeries(true);
    api
      .getCompareSeries(selectedStation, historyDays)
      .then((res) => {
        if (mounted) {
          setTimeline(res.timeline);
          setLoadingSeries(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingSeries(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedStation, historyDays]);

  const currentStationObj = stations.find((s) => s.id === selectedStation);

  return (
    <div className="min-h-screen">
      {/* Minimalist Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800/60 dark:bg-[#060c18]/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Waves className="h-5 w-5 text-sky-500" />
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              Río Orinoco
            </span>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs dark:bg-slate-900">
              {[
                { id: "forecast", label: "Pronóstico" },
                { id: "metrics", label: "Test Set y Métricas" },
                { id: "wave", label: "Propagación" },
                { id: "didactic", label: "Guía" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              title="Cambiar tema"
            >
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Focused Single-View Content */}
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {activeTab !== "didactic" && (
          <StationCards
            stations={stations}
            summaries={summary?.estaciones ?? []}
            selectedStation={selectedStation}
            onSelectStation={setSelectedStation}
          />
        )}

        {activeTab === "forecast" && (
          <ForecastComparisonChart
            station={currentStationObj}
            timeline={timeline}
            historyDays={historyDays}
            onChangeHistoryDays={setHistoryDays}
            loading={loadingSeries}
          />
        )}

        {activeTab === "metrics" && (
          <MetricsBenchmarkSection
            metrics={metrics}
            stations={stations}
            selectedStation={selectedStation}
          />
        )}

        {activeTab === "wave" && <HistoricalAndWaveSection />}

        {activeTab === "didactic" && (
          <DidacticGuideSection
            stations={stations}
            metrics={metrics}
            selectedStation={selectedStation}
            onSelectStation={setSelectedStation}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>
    </div>
  );
}
