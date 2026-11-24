"use client";

import { useState } from "react";

type FilterPanelProps = {
  onFilterChange: (filters: {
    period: number;
    area_id: string | null;
    type: "all" | "crm" | "objective" | "finance";
  }) => void;
  areas: Array<{ id: string; name: string }>;
};

export default function FilterPanel({ onFilterChange, areas }: FilterPanelProps) {
  const [period, setPeriod] = useState("7");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [type, setType] = useState<"all" | "crm" | "objective" | "finance">("all");

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    onFilterChange({
      period: parseInt(value, 10),
      area_id: areaId,
      type,
    });
  };

  const handleAreaChange = (value: string) => {
    const newAreaId = value === "" ? null : value;
    setAreaId(newAreaId);
    onFilterChange({
      period: parseInt(period, 10),
      area_id: newAreaId,
      type,
    });
  };

  const handleTypeChange = (value: "all" | "crm" | "objective" | "finance") => {
    setType(value);
    onFilterChange({
      period: parseInt(period, 10),
      area_id: areaId,
      type: value,
    });
  };

  return (
    <div className="flex flex-wrap gap-4 rounded-lg border border-[#e7e1df] bg-[#faf9f8] p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#716a69]">📅 Período</label>
        <select
          value={period}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="rounded-lg border border-[#d9d1cf] px-3 py-2 text-sm outline-none transition focus:border-[#862f3b]"
        >
          <option value="1">Hoje</option>
          <option value="7">Esta Semana</option>
          <option value="30">Este Mês</option>
          <option value="365">Este Ano</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#716a69]">🏢 Departamento</label>
        <select
          value={areaId || ""}
          onChange={(e) => handleAreaChange(e.target.value)}
          className="rounded-lg border border-[#d9d1cf] px-3 py-2 text-sm outline-none transition focus:border-[#862f3b]"
        >
          <option value="">Todos</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#716a69]">📊 Tipo</label>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as "all" | "crm" | "objective" | "finance")}
          className="rounded-lg border border-[#d9d1cf] px-3 py-2 text-sm outline-none transition focus:border-[#862f3b]"
        >
          <option value="all">Todos</option>
          <option value="crm">Comercial (CRM)</option>
          <option value="objective">Objetivos</option>
          <option value="finance">Financeiro</option>
        </select>
      </div>
    </div>
  );
}
