"use client";

import { useMemo, useState } from "react";
import { okrTemplates, type OkrTemplate } from "../lib/okr-templates";

const filters = [
  { id: "all", label: "Todos" },
  { id: "daily", label: "Diários" },
  { id: "weekly", label: "Semanais" },
  { id: "monthly", label: "Mensais" },
] as const;

type FilterId = (typeof filters)[number]["id"];

const periodLabel: Record<OkrTemplate["period"], string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export default function OkrTemplatePicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (template: OkrTemplate) => void;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt");
    return okrTemplates.filter((template) => {
      if (filter !== "all" && template.period !== filter) return false;
      if (!needle) return true;
      return [template.title, ...template.keyResults.map((item) => item.title)]
        .join(" ")
        .toLocaleLowerCase("pt")
        .includes(needle);
    });
  }, [filter, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="okr-template-title" aria-modal="true" className="my-auto flex max-h-[92vh] w-full max-w-[760px] flex-col rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a8792f]">Modelos prontos</p>
            <h2 className="mt-1 text-xl font-bold text-[#302829]" id="okr-template-title">Templates de OKR</h2>
            <p className="mt-2 text-[12px] text-[#817773]">Escolha um modelo. Antes de guardar, ajuste as metas, a área e a data.</p>
          </div>
          <button aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]" onClick={onClose} type="button">×</button>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por período">
            {filters.map((item) => (
              <button
                aria-pressed={filter === item.id}
                className={`min-h-9 rounded-full px-3 text-[11px] font-semibold ${filter === item.id ? "bg-[#510f1d] text-white" : "border border-[#e9e3e0] text-[#625858]"}`}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            className="min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829] sm:max-w-[240px]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar"
            value={query}
          />
        </div>
        <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
          {visible.map((template) => (
            <li key={template.id}>
              <button
                className="w-full rounded-2xl border border-[#eee9e6] px-4 py-3 text-left hover:border-[#e2d6c4] hover:bg-[#fbf6ee]"
                onClick={() => onSelect(template)}
                type="button"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a8792f]">{periodLabel[template.period]}</span>
                <span className="mt-1 block text-[13px] font-semibold text-[#302829]">{template.title}</span>
                <span className="mt-1 block text-[11px] leading-5 text-[#817773]">
                  {template.keyResults.map((item) => item.title).join(" · ")}
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="rounded-2xl bg-[#faf8f6] px-4 py-6 text-center text-[12px] text-[#817773]">Nenhum template com esse filtro.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
