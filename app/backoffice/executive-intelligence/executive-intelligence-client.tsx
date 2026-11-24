"use client";

import { useEffect, useState } from "react";
import FilterPanel from "./filters-panel";
import MetricsCards from "./metrics-cards";
import ActivityFeed from "./activity-feed";

type Metrics = {
  crmConverted: number;
  crmConvertedPercent: number;
  objectivesAchieved: number;
  objectivesTotal: number;
  revenueAmount: number;
  expensesAmount: number;
  byArea: Array<{
    area_id: string;
    area_name: string;
    crm_activities: number;
    crm_converted: number;
    objectives_total: number;
    objectives_achieved: number;
    revenue: number;
  }>;
};

type Activity = {
  id: string;
  timestamp: string;
  type: "crm" | "objective" | "finance";
  actor_email: string;
  department: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  status?: "ok" | "pending" | "failed";
};

type ExecutiveIntelligenceProps = {
  areas: Array<{ id: string; name: string }>;
  userRole: string;
  userId: string;
};

export default function ExecutiveIntelligence({
  areas,
  userRole,
  userId,
}: ExecutiveIntelligenceProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const [filters, setFilters] = useState({
    period: 7,
    area_id: null as string | null,
    type: "all" as "all" | "crm" | "objective" | "finance",
  });

  // Load metrics
  useEffect(() => {
    setMetricsLoading(true);
    const params = new URLSearchParams();
    params.append("period", String(filters.period));
    if (filters.area_id) params.append("area_id", filters.area_id);

    fetch(`/api/backoffice/executive-intelligence/metrics?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setMetrics(data);
        setMetricsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load metrics:", error);
        setMetricsLoading(false);
      });
  }, [filters.period, filters.area_id]);

  // Load activities
  useEffect(() => {
    setActivitiesLoading(true);
    const params = new URLSearchParams();
    params.append("period", String(filters.period));
    if (filters.area_id) params.append("area_id", filters.area_id);
    if (filters.type !== "all") params.append("type", filters.type);
    params.append("limit", "50");

    fetch(`/api/backoffice/executive-intelligence/activities?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setActivities(data.activities || []);
        setActivitiesLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load activities:", error);
        setActivitiesLoading(false);
      });
  }, [filters.period, filters.area_id, filters.type]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FilterPanel onFilterChange={handleFilterChange} areas={areas} />

      {/* Metrics */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-[#510f1d]">📊 Resumo Executivo</h2>
        <MetricsCards metrics={metrics} loading={metricsLoading} />
      </div>

      {/* Areas Summary */}
      {metrics && metrics.byArea.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-[#510f1d]">🏢 Resumo por Departamento</h2>
          <div className="overflow-x-auto rounded-lg border border-[#e7e1df] bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-[#e7e1df] bg-[#faf9f8]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#510f1d]">Departamento</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#510f1d]">🎯 CRM Atividades</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#510f1d]">✅ Convertidas</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#510f1d]">📊 Objetivos</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#510f1d]">✔️ Alcançados</th>
                  <th className="px-4 py-3 text-right font-semibold text-[#510f1d]">💰 Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e1df]">
                {metrics.byArea.map((area) => (
                  <tr key={area.area_id} className="hover:bg-[#faf9f8] transition">
                    <td className="px-4 py-3 font-medium text-[#510f1d]">{area.area_name}</td>
                    <td className="px-4 py-3 text-center text-[#716a69]">{area.crm_activities}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#8fc97f]">
                      {area.crm_converted}
                    </td>
                    <td className="px-4 py-3 text-center text-[#716a69]">{area.objectives_total}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#8fc97f]">
                      {area.objectives_achieved}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#510f1d]">
                      AOA {(area.revenue / 1_000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-[#510f1d]">⏰ Timeline de Atividades</h2>
        <ActivityFeed activities={activities} loading={activitiesLoading} />
      </div>
    </div>
  );
}
