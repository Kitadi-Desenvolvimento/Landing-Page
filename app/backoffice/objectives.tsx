"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  objectiveValueTypes,
  type ObjectiveValueType,
} from "../lib/objectives";

type Objective = {
  id: string;
  area_id: string;
  due_date: string | null;
  archived: boolean;
  title: string;
  description: string;
  value_type: ObjectiveValueType;
  target_value: unknown;
  unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ObjectiveCheckIn = {
  id: string;
  objective_id: string;
  checkin_date: string;
  value: unknown;
  note: string;
  checked_in_by_email: string;
  created_at: string;
  updated_at: string;
  updated_by_email: string;
};

type ObjectiveCheckInEdit = {
  id: string;
  checkin_id: string;
  previous_value: unknown;
  previous_note: string;
  edited_by_email: string;
  edited_at: string;
};

export type ObjectiveArea = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

type ObjectivesData = {
  objectives: Objective[];
  checkins: ObjectiveCheckIn[];
  edits: ObjectiveCheckInEdit[];
  areas: ObjectiveArea[];
  role: "admin" | "manager" | "collaborator";
  readOnly: boolean;
};

const valueTypeLabels: Record<ObjectiveValueType, string> = {
  number: "Numérico",
  percentage: "Percentagem",
  currency: "Moeda / valor",
  text: "Texto",
  boolean: "Sim / não",
  date: "Data",
  custom: "Personalizado (JSON)",
};

export default function Objectives() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [checkins, setCheckins] = useState<ObjectiveCheckIn[]>([]);
  const [edits, setEdits] = useState<ObjectiveCheckInEdit[]>([]);
  const [areas, setAreas] = useState<ObjectiveArea[]>([]);
  const [role, setRole] = useState<ObjectivesData["role"]>("collaborator");
  const [readOnly, setReadOnly] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formObjective, setFormObjective] = useState<Objective | null | "new">(null);
  const [formCheckIn, setFormCheckIn] = useState<{ objective: Objective; checkin: ObjectiveCheckIn } | null>(null);
  const [savingCheckIn, setSavingCheckIn] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/backoffice/objectives", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok || !isObjectiveResponse(result)) {
        const code = typeof result === "object" && result !== null && "error" in result
          ? result.error
          : null;
        throw new Error(objectiveLoadError(code, response.status));
      }
      setObjectives(result.objectives);
      setCheckins(result.checkins);
      setEdits(result.edits);
      setAreas(result.areas);
      setRole(result.role);
      setReadOnly(result.readOnly);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os objectivos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveObjective(payload: ObjectivePayload, objective: Objective | null) {
    const response = await fetch(
      objective
        ? `/api/backoffice/objectives/${encodeURIComponent(objective.id)}`
        : "/api/backoffice/objectives",
      {
        method: objective ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) throw new Error("Não foi possível guardar o objectivo.");
    setFormObjective(null);
    await loadData();
  }

  async function saveCheckIn(
    objective: Objective,
    value: unknown,
    note: string,
  ) {
    setSavingCheckIn(objective.id);
    setError("");
    try {
      const response = await fetch(
        `/api/backoffice/objectives/${encodeURIComponent(objective.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value, note }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        const duplicate =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          result.error === "already_checked_in_today";
        if (duplicate) await loadData();
        throw new Error(
          duplicate
            ? "O check-in diário deste objectivo já foi registado."
            : "Não foi possível guardar o check-in.",
        );
      }
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o check-in.");
    } finally {
      setSavingCheckIn("");
    }
  }

  async function setObjectiveArchived(objective: Objective, archived: boolean): Promise<boolean> {
    setError("");
    try {
      const response = await fetch(
        `/api/backoffice/objectives/${encodeURIComponent(objective.id)}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        },
      );
      if (!response.ok) throw new Error("Não foi possível actualizar o estado do objectivo.");
      await loadData();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível actualizar o estado do objectivo.");
      return false;
    }
  }

  const today = luandaToday();
  const activeCount = objectives.filter((objective) => objective.active && !objective.archived).length;
  const canCreateObjective = !readOnly && areas.some((area) => area.active);
  const visibleObjectives = objectives.filter((objective) => objective.archived === showArchived);
  const selectedObjective = selectedObjectiveId
    ? objectives.find((objective) => objective.id === selectedObjectiveId) ?? null
    : null;
  const todayCount = objectives.filter((objective) =>
    !objective.archived &&
      checkins.some((checkin) => checkin.objective_id === objective.id && checkin.checkin_date === today),
  ).length;

  function renderObjectiveCard(objective: Objective, inModal = false) {
    const history = checkins.filter((item) => item.objective_id === objective.id);
    const todayCheckIn = history.find((item) => item.checkin_date === today);
    return (
      <ObjectiveCard
        checkInDone={Boolean(todayCheckIn)}
        history={history}
        onArchive={(archived) => {
          void (async () => {
            const updated = await setObjectiveArchived(objective, archived);
            if (updated && inModal) setSelectedObjectiveId(null);
          })();
        }}
        edits={edits.filter((edit) => history.some((item) => item.id === edit.checkin_id))}
        areaName={areas.find((area) => area.id === objective.area_id)?.name ?? "Área"}
        key={`${inModal ? "modal" : "card"}-${objective.id}`}
        objective={objective}
        readOnly={readOnly}
        saving={savingCheckIn === objective.id}
        onCheckIn={(value, note) => saveCheckIn(objective, value, note)}
        onEdit={() => setFormObjective(objective)}
        onEditCheckIn={(checkin) => setFormCheckIn({ objective, checkin })}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">
            Planeamento e acompanhamento
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#302829]">Objectivos</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#817773]">
            {readOnly
              ? "Consulte as metas e o progresso de todas as áreas. O seu perfil não pode alterar objectivos ou check-ins."
              : "Cadastre metas de qualquer tipo, registe o progresso uma vez por dia e consulte quem fez cada actualização."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <button
              aria-pressed={showArchived}
              className="min-h-11 rounded-full border border-[#e9e3e0] px-4 text-[11px] font-semibold text-[#6d605b]"
              onClick={() => setShowArchived((current) => !current)}
              type="button"
            >
              {showArchived ? "Ver objectivos activos" : `Arquivados (${objectives.filter((item) => item.archived).length})`}
            </button>
          ) : null}
          {canCreateObjective && !showArchived ? <button
            className="min-h-11 rounded-full bg-[#510f1d] px-5 text-[12px] font-semibold text-white hover:bg-[#762838]"
            onClick={() => setFormObjective("new")}
            type="button"
          >
            Novo objectivo
          </button> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <ObjectiveStat label="Objectivos activos" value={String(activeCount)} />
        <ObjectiveStat label="Check-ins de hoje" value={`${todayCount} / ${activeCount}`} />
        <ObjectiveStat label="Registos no histórico" value={String(checkins.length)} />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {role === "manager" ? (
        <p className="mt-4 rounded-xl bg-[#f7f3ed] px-4 py-3 text-xs text-[#706560]">
          A gerir as áreas atribuídas: {areas.map((area) => area.name).join(", ") || "nenhuma área atribuída"}.
        </p>
      ) : null}
      {loading ? (
        <p className="mt-6 rounded-2xl border border-[#eee9e6] bg-white p-6 text-sm text-[#817773]">
          A carregar objectivos e histórico…
        </p>
      ) : null}
      {!loading && visibleObjectives.length === 0 && !error ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d8cdc7] bg-white p-8 text-center">
          <h3 className="font-bold text-[#302829]">{showArchived ? "Não há objectivos arquivados" : "Ainda não há objectivos"}</h3>
          <p className="mt-2 text-sm text-[#817773]">{showArchived ? "Os objectivos arquivados aparecerão aqui." : "Crie o primeiro para começar a acompanhar o progresso diário."}</p>
        </div>
      ) : null}
      {!loading && !readOnly && areas.every((area) => !area.active) ? (
        <p className="mt-4 rounded-xl bg-[#fff7f4] px-4 py-3 text-xs text-[#8f4c40]">
          Não há áreas activas para criar objectivos. Peça a um administrador que active uma área.
        </p>
      ) : null}

      {visibleObjectives.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-[20px] border border-[#eee9e6] bg-white">
          <div className="hidden grid-cols-[minmax(150px,1.2fr)_minmax(110px,0.7fr)_minmax(160px,1fr)_minmax(100px,0.7fr)] gap-4 border-b border-[#f1edeb] bg-[#faf8f6] px-5 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#918783] sm:grid">
            <span>Objectivo</span><span>Área</span><span>Progresso</span><span>Prazo</span>
          </div>
          <div className="divide-y divide-[#f1edeb]">
            {visibleObjectives.map((objective) => {
              const latest = checkins.find((item) => item.objective_id === objective.id);
              const complete = isObjectiveComplete(objective, latest?.value);
              const dueWarning = objective.archived || complete
                ? null
                : objectiveDueWarning(objective.due_date, today);
              return (
                <button
                  className={`grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#fcfbfa] sm:grid-cols-[minmax(150px,1.2fr)_minmax(110px,0.7fr)_minmax(160px,1fr)_minmax(100px,0.7fr)] sm:items-center sm:gap-4 sm:px-5 ${
                    dueWarning?.level === "overdue"
                      ? "border-l-2 border-l-[#c4544f]"
                      : dueWarning?.level === "soon"
                        ? "border-l-2 border-l-[#c89a42]"
                        : "border-l-2 border-l-transparent"
                  }`}
                  key={objective.id}
                  onClick={() => setSelectedObjectiveId(objective.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-[#352d2e]">{objective.title}</span>
                    <span className="mt-1 block text-[9px] text-[#8d837f]">
                      {objective.archived ? "Arquivado" : objective.active ? "Activo" : "Inactivo"}
                    </span>
                  </span>
                  <span className="text-[10px] text-[#766d69]">
                    <span className="mr-1 text-[9px] font-semibold text-[#a19894] sm:hidden">Área:</span>
                    {areas.find((area) => area.id === objective.area_id)?.name ?? "Área"}
                  </span>
                  <span className="min-w-0">
                    <span className="mb-1 block text-[9px] text-[#766d69]">
                      {latest
                        ? `${displayValue(latest.value, objective.value_type, objective.unit)}${objective.target_value !== null ? ` / ${displayValue(objective.target_value, objective.value_type, objective.unit)}` : ""}`
                        : "Sem check-in"}
                    </span>
                    <ObjectiveProgress
                      alwaysShow
                      currentValue={latest?.value}
                      targetValue={objective.target_value}
                      unit={objective.unit}
                      valueType={objective.value_type}
                    />
                  </span>
                  <span className={`text-[10px] ${
                    dueWarning?.level === "overdue" ? "font-semibold text-[#b64c47]" :
                      dueWarning?.level === "soon" ? "font-semibold text-[#a2772d]" : "text-[#766d69]"
                  }`}>
                    <span className="mr-1 text-[9px] font-semibold text-[#a19894] sm:hidden">Prazo:</span>
                    {objective.due_date ? formatDate(objective.due_date) : "Sem prazo"}
                    {dueWarning ? <span className="mt-1 block text-[9px]">{dueWarning.label}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedObjective ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#211d1e]/50 p-3 sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedObjectiveId(null);
          }}
        >
          <section
            aria-labelledby="objective-details-title"
            aria-modal="true"
            className="my-auto max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-[24px] bg-[#f7f5f3] p-4 shadow-2xl sm:p-6"
            role="dialog"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#302829]" id="objective-details-title">Detalhes do objectivo</h2>
              <button
                aria-label="Fechar detalhes"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#625858]"
                onClick={() => setSelectedObjectiveId(null)}
                type="button"
              >
                ×
              </button>
            </div>
            {renderObjectiveCard(selectedObjective, true)}
          </section>
        </div>
      ) : null}

      {formObjective !== null ? (
        <ObjectiveEditor
          key={formObjective === "new" ? "new-objective" : formObjective.id}
          objective={formObjective === "new" ? null : formObjective}
          areas={areas.filter((area) =>
            area.active || (typeof formObjective === "object" &&
              formObjective !== null && area.id === formObjective.area_id),
          )}
          onClose={() => setFormObjective(null)}
          onSave={saveObjective}
        />
      ) : null}
      {formCheckIn ? (
        <CheckInEditor
          checkin={formCheckIn.checkin}
          objective={formCheckIn.objective}
          onClose={() => setFormCheckIn(null)}
          onSave={async (value, note) => {
            const response = await fetch(
              `/api/backoffice/objectives/${encodeURIComponent(formCheckIn.objective.id)}/checkins/${encodeURIComponent(formCheckIn.checkin.id)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value, note }),
              },
            );
            if (!response.ok) throw new Error("Não foi possível editar o check-in.");
            setFormCheckIn(null);
            await loadData();
          }}
        />
      ) : null}
    </>
  );
}

export function OverviewObjectives({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const [data, setData] = useState<ObjectivesData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/backoffice/objectives", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isObjectiveResponse(result)) {
          const code = typeof result === "object" && result !== null && "error" in result
            ? result.error
            : null;
          throw new Error(objectiveLoadError(code, response.status));
        }
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados dos projectos.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const activeObjectives = data?.objectives.filter((objective) => objective.active && !objective.archived) ?? [];
  const checkinsToday = data?.checkins.filter(
    (checkin) => checkin.checkin_date === luandaToday() &&
      activeObjectives.some((objective) => objective.id === checkin.objective_id),
  ).length ?? 0;

  return (
    <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-bold text-[#302829]">Projectos e objectivos</p>
          <p className="mt-1 text-[11px] text-[#a19894]">
            Progresso da meta pelo check-in mais recente
          </p>
        </div>
        <button
          className="shrink-0 text-[10px] font-bold text-[#8a5b38] hover:text-[#510f1d]"
          onClick={onNavigate}
          type="button"
        >
          Ver todos →
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[#fff7f4] px-3 py-2.5 text-[10px] text-[#9b443c]" role="alert">{error}</p>
      ) : !data ? (
        <p className="mt-4 text-[11px] text-[#968c88]">A carregar dados dos projectos…</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <span className="rounded-lg bg-[#f7f3f0] px-3 py-2 text-[10px] text-[#756d69]">
              <strong className="text-[#443a3b]">{activeObjectives.length}</strong> activos
            </span>
            <span className="rounded-lg bg-[#edf4ee] px-3 py-2 text-[10px] text-[#52765e]">
              <strong>{checkinsToday}</strong> check-ins hoje
            </span>
          </div>
          <div className="mt-2 divide-y divide-[#f1edeb]">
            {activeObjectives.slice(0, 4).map((objective) => {
              const latest = data.checkins.find((checkin) => checkin.objective_id === objective.id);
              const isComplete = isObjectiveComplete(objective, latest?.value);
              const dueWarning = isComplete ? null : objectiveDueWarning(objective.due_date, luandaToday());
              return (
                <div className={`py-3 ${
                  dueWarning?.level === "overdue"
                    ? "rounded-xl px-2 ring-1 ring-inset ring-[#c4544f]"
                    : dueWarning?.level === "soon"
                      ? "rounded-xl px-2 ring-1 ring-inset ring-[#c89a42]"
                      : ""
                }`} key={objective.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold text-[#393132]">{objective.title}</p>
                    <p className="shrink-0 text-right text-[10px] text-[#766d69]">
                      {latest
                        ? displayValue(latest.value, objective.value_type, objective.unit)
                        : "Sem check-in"}
                      {objective.target_value !== null
                        ? ` / ${displayValue(objective.target_value, objective.value_type, objective.unit)}`
                        : ""}
                    </p>
                  </div>
                  {objective.due_date ? (
                    <p className={`mt-1 text-[9px] ${
                      dueWarning?.level === "overdue" ? "text-[#b64c47]" :
                        dueWarning?.level === "soon" ? "text-[#a2772d]" : "text-[#817773]"
                    }`}>
                      Prazo: {formatDate(objective.due_date)}
                      {dueWarning ? ` · ${dueWarning.label}` : isComplete ? " · Meta concluída" : ""}
                    </p>
                  ) : null}
                  <ObjectiveProgress
                    currentValue={latest?.value}
                    targetValue={objective.target_value}
                    unit={objective.unit}
                    valueType={objective.value_type}
                  />
                </div>
              );
            })}
            {activeObjectives.length === 0 ? (
              <p className="py-5 text-[11px] text-[#968c88]">Ainda não há projectos activos.</p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function ObjectiveCard({
  objective,
  history,
  edits,
  areaName,
  checkInDone,
  saving,
  readOnly,
  onEdit,
  onArchive,
  onEditCheckIn,
  onCheckIn,
}: {
  objective: Objective;
  history: ObjectiveCheckIn[];
  edits: ObjectiveCheckInEdit[];
  areaName: string;
  checkInDone: boolean;
  saving: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onEditCheckIn: (checkin: ObjectiveCheckIn) => void;
  onCheckIn: (value: unknown, note: string) => Promise<void>;
}) {
  const [valueInput, setValueInput] = useState(
    objective.value_type === "custom" ? "" : "",
  );
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");
  const latestCheckIn = history[0];
  const complete = isObjectiveComplete(objective, latestCheckIn?.value);
  const dueWarning = objective.archived || complete
    ? null
    : objectiveDueWarning(objective.due_date, luandaToday());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    const value = parseInputValue(valueInput, objective.value_type);
    if (!value.valid) {
      setValidationError(value.error);
      return;
    }
    await onCheckIn(value.value, note);
    setValueInput("");
    setNote("");
  }

  return (
    <article className={`rounded-[22px] border bg-white p-5 sm:p-6 ${
      dueWarning?.level === "overdue"
        ? "border-[#eee9e6] ring-1 ring-inset ring-[#c4544f]"
        : dueWarning?.level === "soon"
          ? "border-[#eee9e6] ring-1 ring-inset ring-[#c89a42]"
          : objective.active && !objective.archived
            ? "border-[#eee9e6]"
            : "border-dashed border-[#d8cfca] opacity-75"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold text-[#352d2e]">{objective.title}</h3>
            <span className="rounded-full bg-[#f7f3ed] px-2.5 py-1 text-[9px] font-semibold text-[#796b59]">{areaName}</span>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${
              objective.archived
                ? "bg-[#f3efed] text-[#847a76]"
                : objective.active ? "bg-[#edf4ee] text-[#52765e]" : "bg-[#f3efed] text-[#847a76]"
            }`}>
              {objective.archived ? "Arquivado" : objective.active ? "Activo" : "Inactivo"}
            </span>
          </div>
          {objective.description ? <p className="mt-2 text-[11px] leading-5 text-[#817773]">{objective.description}</p> : null}
          {objective.due_date ? (
            <p className={`mt-2 text-[10px] font-semibold ${
              dueWarning?.level === "overdue" ? "text-[#b64c47]" :
                dueWarning?.level === "soon" ? "text-[#a2772d]" : "text-[#817773]"
            }`}>
              Prazo: {formatDate(objective.due_date)}
              {dueWarning ? ` · ${dueWarning.label}` : ""}
              {complete ? " · Meta concluída" : ""}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {!objective.archived ? (
              <button
                className="rounded-full border border-[#e9e3e0] px-3 py-1.5 text-[10px] font-semibold text-[#6d605b] hover:bg-[#faf8f7]"
                onClick={onEdit}
                type="button"
              >
                Editar
              </button>
            ) : null}
            <button
              className="rounded-full border border-[#e9e3e0] px-3 py-1.5 text-[10px] font-semibold text-[#6d605b] hover:bg-[#faf8f7]"
              onClick={() => onArchive(!objective.archived)}
              type="button"
            >
              {objective.archived ? "Restaurar" : "Arquivar"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-[#faf8f6] p-4 sm:grid-cols-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#a19894]">Tipo</p>
          <p className="mt-1 text-[11px] font-semibold text-[#4c4242]">{valueTypeLabels[objective.value_type]}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#a19894]">Meta</p>
          <p className="mt-1 text-[11px] font-semibold text-[#4c4242]">
            {objective.target_value === null ? "Sem meta definida" : displayValue(objective.target_value, objective.value_type, objective.unit)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#a19894]">Último check-in</p>
          <p className="mt-1 text-[11px] font-semibold text-[#4c4242]">
            {history[0]
              ? `${displayValue(history[0].value, objective.value_type, objective.unit)} · ${formatDate(history[0].checkin_date)}`
              : "Sem registos"}
          </p>
        </div>
      </div>
      <ObjectiveProgress
        currentValue={history[0]?.value}
        targetValue={objective.target_value}
        unit={objective.unit}
        valueType={objective.value_type}
      />

      {objective.active && !objective.archived && !readOnly ? (
        <form className="mt-4 rounded-2xl border border-[#eee7e2] p-4" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-bold text-[#443a3b]">Check-in diário</h4>
            <span className="text-[9px] text-[#958b87]">{formatDate(luandaToday())}</span>
          </div>
          {checkInDone ? (
            <p className="mt-3 rounded-xl bg-[#edf4ee] px-3 py-2.5 text-[10px] font-medium text-[#52765e]">
              Check-in de hoje registado. As alterações ficam guardadas no histórico.
            </p>
          ) : (
            <>
              <ObjectiveValueInput
                label="Valor actual"
                onChange={setValueInput}
                type={objective.value_type}
                unit={objective.unit}
                value={valueInput}
              />
              <label className="mt-3 block text-[10px] font-semibold text-[#817773]">
                Nota (opcional)
                <textarea
                  className="mt-1 min-h-16 w-full rounded-xl border border-[#e9e3e0] px-3 py-2 text-[11px] text-[#302829]"
                  maxLength={1000}
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </label>
              {validationError ? <p className="mt-2 text-[10px] text-red-700">{validationError}</p> : null}
              <button
                className="mt-3 min-h-9 rounded-full bg-[#510f1d] px-4 text-[10px] font-semibold text-white disabled:opacity-50"
                disabled={saving}
                type="submit"
              >
                {saving ? "A registar…" : "Registar check-in"}
              </button>
            </>
          )}
        </form>
      ) : null}

      <details className="mt-4 rounded-2xl border border-[#f0ecea]">
        <summary className="cursor-pointer px-4 py-3 text-[10px] font-bold text-[#6e625e]">
          Histórico de check-ins ({history.length})
        </summary>
        <div className="border-t border-[#f0ecea]">
          {history.length ? (
            <div className="divide-y divide-[#f3efed]">
              {history.map((item) => (
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[100px_1fr_1fr]" key={item.id}>
                  <p className="text-[10px] font-semibold text-[#493f40]">{formatDate(item.checkin_date)}</p>
                  <p className="text-[10px] font-semibold text-[#493f40]">
                    {displayValue(item.value, objective.value_type, objective.unit)}
                    {item.note ? <span className="mt-1 block font-normal text-[#827874]">{item.note}</span> : null}
                  </p>
                  <p className="text-[9px] text-[#8d837f]">
                    Por {item.checked_in_by_email || "administrador"} · {formatDateTime(item.created_at)}
                    {item.updated_by_email ? (
                      <span className="mt-1 block">Editado por {item.updated_by_email} · {formatDateTime(item.updated_at)}</span>
                    ) : null}
                  </p>
                  {!readOnly ? (
                    <button
                      className="justify-self-start text-[9px] font-semibold text-[#8a5b38] hover:text-[#510f1d] sm:col-start-2"
                      onClick={() => onEditCheckIn(item)}
                      type="button"
                    >
                      Editar check-in
                    </button>
                  ) : null}
                  {edits.filter((edit) => edit.checkin_id === item.id).length > 0 ? (
                    <details className="text-[9px] text-[#8d837f] sm:col-span-3">
                      <summary className="cursor-pointer">Ver alterações anteriores</summary>
                      <ul className="mt-2 space-y-1">
                        {edits.filter((edit) => edit.checkin_id === item.id).map((edit) => (
                          <li key={edit.id}>
                            {formatDateTime(edit.edited_at)} · {displayValue(edit.previous_value, objective.value_type, objective.unit)}
                            {edit.previous_note ? ` — ${edit.previous_note}` : ""} · por {edit.edited_by_email || "utilizador"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-4 text-[10px] text-[#928884]">Ainda não há check-ins.</p>
          )}
        </div>
      </details>
    </article>
  );
}

function CheckInEditor({
  objective,
  checkin,
  onClose,
  onSave,
}: {
  objective: Objective;
  checkin: ObjectiveCheckIn;
  onClose: () => void;
  onSave: (value: unknown, note: string) => Promise<void>;
}) {
  const [valueInput, setValueInput] = useState(
    objective.value_type === "custom"
      ? JSON.stringify(checkin.value, null, 2)
      : String(checkin.value ?? ""),
  );
  const [note, setNote] = useState(checkin.note);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseInputValue(valueInput, objective.value_type);
    if (!parsed.valid) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(parsed.value, note);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível editar o check-in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="checkin-editor-title" aria-modal="true" className="my-auto w-full max-w-[520px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a8792f]">Histórico · {formatDate(checkin.checkin_date)}</p>
            <h2 className="mt-1 text-xl font-bold text-[#302829]" id="checkin-editor-title">Editar check-in</h2>
          </div>
          <button aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]" onClick={onClose} type="button">×</button>
        </div>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <ObjectiveValueInput
            label="Valor registado"
            onChange={setValueInput}
            type={objective.value_type}
            unit={objective.unit}
            value={valueInput}
          />
          <label className="block text-[10px] font-semibold text-[#817773]">
            Nota
            <textarea className="mt-1 min-h-20 w-full rounded-xl border border-[#e9e3e0] px-3 py-2 text-[11px] text-[#302829]" maxLength={1000} onChange={(event) => setNote(event.target.value)} value={note} />
          </label>
          <p className="text-[10px] text-[#8d837f]">O valor anterior será guardado no histórico de alterações.</p>
          {error ? <p className="text-[11px] text-red-700" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[#f0ecea] pt-4">
            <button className="min-h-10 rounded-full border border-[#e9e3e0] px-4 text-[11px] font-semibold text-[#625858]" onClick={onClose} type="button">Cancelar</button>
            <button className="min-h-10 rounded-full bg-[#510f1d] px-5 text-[11px] font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "A guardar…" : "Guardar alteração"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ObjectiveEditor({
  objective,
  areas,
  onClose,
  onSave,
}: {
  objective: Objective | null;
  areas: ObjectiveArea[];
  onClose: () => void;
  onSave: (payload: ObjectivePayload, objective: Objective | null) => Promise<void>;
}) {
  const [valueType, setValueType] = useState<ObjectiveValueType>(objective?.value_type ?? "number");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const targetInput = String(form.get("targetValue") ?? "").trim();
    const target = targetInput ? parseInputValue(targetInput, valueType) : { valid: true as const, value: null };
    if (!target.valid) {
      setError(`Meta inválida: ${target.error}`);
      setSaving(false);
      return;
    }
    const payload: ObjectivePayload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      areaId: String(form.get("areaId") ?? ""),
      dueDate: String(form.get("dueDate") ?? "") || null,
      valueType,
      targetValue: target.value,
      unit: String(form.get("unit") ?? ""),
      active: form.get("active") === "on",
    };
    try {
      await onSave(payload, objective);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o objectivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="objective-editor-title" aria-modal="true" className="my-auto w-full max-w-[620px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a8792f]">{objective ? "Actualizar meta" : "Nova meta"}</p>
            <h2 className="mt-1 text-xl font-bold text-[#302829]" id="objective-editor-title">{objective ? "Editar objectivo" : "Criar objectivo"}</h2>
          </div>
          <button aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]" onClick={onClose} type="button">×</button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-[10px] font-semibold text-[#817773]">
            Nome do objectivo
            <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]" defaultValue={objective?.title} maxLength={160} name="title" required />
          </label>
          <label className="block text-[10px] font-semibold text-[#817773]">
            Descrição (opcional)
            <textarea className="mt-1 min-h-20 w-full rounded-xl border border-[#e9e3e0] px-3 py-2 text-[12px] text-[#302829]" defaultValue={objective?.description} maxLength={2000} name="description" />
          </label>
          <label className="block text-[10px] font-semibold text-[#817773]">
            Área
            <select className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" defaultValue={objective?.area_id ?? areas[0]?.id ?? ""} name="areaId" required>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.active ? "" : " · inactiva"}</option>)}
            </select>
          </label>
          <label className="block text-[10px] font-semibold text-[#817773]">
            Data de fim (opcional)
            <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[11px] text-[#302829]" defaultValue={objective?.due_date ?? ""} name="dueDate" type="date" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[10px] font-semibold text-[#817773]">
              Tipo de valor
              <select className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" onChange={(event) => setValueType(event.target.value as ObjectiveValueType)} value={valueType}>
                {objectiveValueTypes.map((type) => <option key={type} value={type}>{valueTypeLabels[type]}</option>)}
              </select>
            </label>
            <label className="block text-[10px] font-semibold text-[#817773]">
              Unidade (opcional)
              <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]" defaultValue={objective?.unit} maxLength={40} name="unit" placeholder="ex.: vendas, Kz, pessoas" />
            </label>
          </div>
          <ObjectiveValueInput
            defaultValue={objective?.target_value ?? null}
            key={valueType}
            label="Meta / valor-alvo (opcional)"
            name="targetValue"
            type={valueType}
            unit={String(objective?.unit ?? "")}
          />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#554b4b]">
            <input defaultChecked={objective?.active ?? true} name="active" type="checkbox" />
            Objectivo activo
          </label>
          {error ? <p className="text-[11px] text-red-700" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[#f0ecea] pt-4">
            <button className="min-h-10 rounded-full border border-[#e9e3e0] px-4 text-[11px] font-semibold text-[#625858]" onClick={onClose} type="button">Cancelar</button>
            <button className="min-h-10 rounded-full bg-[#510f1d] px-5 text-[11px] font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "A guardar…" : "Guardar objectivo"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ObjectiveValueInput({
  label,
  type,
  unit,
  value,
  onChange,
  defaultValue,
  name,
}: {
  label: string;
  type: ObjectiveValueType;
  unit: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: unknown;
  name?: string;
}) {
  const common = "mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[11px] text-[#302829]";
  const initialValue = defaultValue === null || defaultValue === undefined
    ? ""
    : type === "custom"
      ? JSON.stringify(defaultValue, null, 2)
      : String(defaultValue);

  if (type === "boolean") {
    return (
      <label className="mt-3 block text-[10px] font-semibold text-[#817773]">
        {label}
        <select className={`${common} bg-white`} name={name} onChange={(event) => onChange?.(event.target.value)} value={value ?? initialValue}>
          <option value="">Seleccionar</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </label>
    );
  }
  if (type === "custom") {
    return (
      <label className="mt-3 block text-[10px] font-semibold text-[#817773]">
        {label} · JSON
        <textarea className={`${common} min-h-20 py-2 font-mono`} defaultValue={value === undefined ? initialValue : undefined} name={name} onChange={(event) => onChange?.(event.target.value)} placeholder={'ex.: {"feito": true}'} value={value} />
      </label>
    );
  }
  const inputType = type === "date" ? "date" : type === "text" ? "text" : "number";
  return (
    <label className="mt-3 block text-[10px] font-semibold text-[#817773]">
      {label}{unit ? ` (${unit})` : type === "percentage" ? " (%)" : ""}
      <input
        className={common}
        defaultValue={value === undefined ? initialValue : undefined}
        max={type === "percentage" ? 100 : undefined}
        min={type === "percentage" ? 0 : undefined}
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
        step={type === "text" || type === "date" ? undefined : "any"}
        type={inputType}
        value={value}
      />
    </label>
  );
}

type ObjectivePayload = {
  title: string;
  description: string;
  areaId: string;
  dueDate: string | null;
  valueType: ObjectiveValueType;
  targetValue: unknown;
  unit: string;
  active: boolean;
};

function parseInputValue(
  input: string,
  type: ObjectiveValueType,
): { valid: true; value: unknown } | { valid: false; error: string } {
  if (type === "number" || type === "percentage" || type === "currency") {
    if (!input.trim()) return { valid: false, error: "Indique um valor numérico." };
    const number = Number(input);
    if (!Number.isFinite(number)) return { valid: false, error: "Indique um número válido." };
    if (type === "percentage" && (number < 0 || number > 100)) {
      return { valid: false, error: "A percentagem deve estar entre 0 e 100." };
    }
    return { valid: true, value: number };
  }
  if (type === "boolean") {
    if (input !== "true" && input !== "false") return { valid: false, error: "Escolha Sim ou Não." };
    return { valid: true, value: input === "true" };
  }
  if (type === "date") {
    if (!input) return { valid: false, error: "Seleccione uma data." };
    return { valid: true, value: input };
  }
  if (type === "custom") {
    try {
      return { valid: true, value: JSON.parse(input) };
    } catch {
      return { valid: false, error: "Insira um JSON válido (texto entre aspas, número, true/false, lista ou objecto)." };
    }
  }
  if (!input.trim()) return { valid: false, error: "Indique um valor." };
  return { valid: true, value: input.trim() };
}

function isObjectiveResponse(value: unknown): value is {
  objectives: Objective[];
  checkins: ObjectiveCheckIn[];
  edits: ObjectiveCheckInEdit[];
  areas: ObjectiveArea[];
  role: ObjectivesData["role"];
  readOnly: boolean;
} {
  if (typeof value !== "object" || value === null ||
      !("objectives" in value) || !Array.isArray(value.objectives) ||
      !("checkins" in value) || !Array.isArray(value.checkins) ||
      !("edits" in value) || !Array.isArray(value.edits) ||
      !("areas" in value) || !Array.isArray(value.areas) ||
      !("role" in value) || !["admin", "manager", "collaborator"].includes(String(value.role)) ||
      !("readOnly" in value) || typeof value.readOnly !== "boolean") return false;
  return value.objectives.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "area_id" in item && typeof item.area_id === "string" &&
    "due_date" in item && (typeof item.due_date === "string" || item.due_date === null) &&
    "archived" in item && typeof item.archived === "boolean" &&
    "title" in item && typeof item.title === "string" &&
    "description" in item && typeof item.description === "string" &&
    "value_type" in item && typeof item.value_type === "string" &&
    objectiveValueTypes.includes(item.value_type as ObjectiveValueType) &&
    "target_value" in item && "unit" in item && typeof item.unit === "string" &&
    "active" in item && typeof item.active === "boolean" &&
    "created_at" in item && typeof item.created_at === "string" &&
    "updated_at" in item && typeof item.updated_at === "string",
  ) && value.checkins.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "objective_id" in item && typeof item.objective_id === "string" &&
    "checkin_date" in item && typeof item.checkin_date === "string" &&
    "value" in item && "note" in item && typeof item.note === "string" &&
    "checked_in_by_email" in item && typeof item.checked_in_by_email === "string" &&
    "created_at" in item && typeof item.created_at === "string" &&
    "updated_at" in item && typeof item.updated_at === "string" &&
    "updated_by_email" in item && typeof item.updated_by_email === "string",
  ) && value.edits.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "checkin_id" in item && typeof item.checkin_id === "string" &&
    "previous_value" in item &&
    "previous_note" in item && typeof item.previous_note === "string" &&
    "edited_by_email" in item && typeof item.edited_by_email === "string" &&
    "edited_at" in item && typeof item.edited_at === "string",
  ) && value.areas.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "name" in item && typeof item.name === "string" &&
    "slug" in item && typeof item.slug === "string" &&
    "active" in item && typeof item.active === "boolean",
  );
}

function objectiveLoadError(code: unknown, status: number) {
  switch (code) {
    case "objectives_schema_missing":
      return "A tabela de objectivos ou as colunas de prazo/arquivo ainda não existem. Aplique as migrações 20261113020000, 20261113030000 e 20261113040000 no Supabase.";
    case "areas_schema_missing":
      return "As tabelas das áreas ainda não existem. Aplique a migração 20261113030000 no Supabase.";
    case "checkins_schema_missing":
      return "A estrutura dos check-ins ainda não está actualizada. Aplique as migrações 20261113020000 e 20261113030000 no Supabase.";
    case "checkin_edits_schema_missing":
      return "O histórico de edições ainda não existe. Aplique a migração 20261113030000 no Supabase.";
    case "area_access_unavailable":
      return "Não foi possível verificar as áreas atribuídas. Confirme se a migração 20261113030000 foi aplicada.";
    case "unauthorized":
      return "A sessão expirou. Inicie sessão novamente.";
    case "forbidden":
      return "A sua conta não tem uma função autorizada para consultar os objectivos.";
    case "objectives_unavailable":
    case "areas_unavailable":
    case "checkins_unavailable":
    case "checkin_edits_unavailable":
      return "O Supabase não conseguiu carregar os dados. Tente novamente e consulte os registos do servidor se o erro persistir.";
    default:
      if (status === 503) return "A estrutura do Supabase está incompleta. Aplique as migrações dos objectivos, áreas e prazos.";
      if (status === 401) return "A sessão expirou. Inicie sessão novamente.";
      if (status === 403) return "A sua conta não tem permissão para consultar os objectivos.";
      return "Não foi possível carregar os objectivos. Verifique a ligação ao Supabase e tente novamente.";
  }
}

function ObjectiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#eee9e6] bg-white p-4">
      <p className="text-[10px] font-semibold text-[#918783]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#342c2d]">{value}</p>
    </div>
  );
}

function displayValue(value: unknown, type: ObjectiveValueType, unit: string) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") {
    const number = new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 2 }).format(value);
    if (type === "percentage") return `${number}%`;
    return unit ? `${number} ${unit}` : type === "currency" ? `${number} Kz` : number;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function isObjectiveComplete(objective: Objective, currentValue: unknown) {
  if (objective.target_value === null || currentValue === undefined || currentValue === null) return false;
  if (typeof objective.target_value === "number" && typeof currentValue === "number") {
    return currentValue >= objective.target_value;
  }
  return currentValue === objective.target_value;
}

function objectiveDueWarning(
  dueDate: string | null,
  today: string,
): { level: "soon" | "overdue"; label: string } | null {
  if (!dueDate) return null;
  const daysUntil = Math.round(
    (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (daysUntil < 0) return { level: "overdue", label: `Prazo ultrapassado há ${Math.abs(daysUntil)} dia(s)` };
  if (daysUntil === 0) return { level: "overdue", label: "Prazo termina hoje" };
  if (daysUntil <= 7) return { level: "soon", label: `Faltam ${daysUntil} dia(s)` };
  return null;
}

function ObjectiveProgress({
  currentValue,
  targetValue,
  unit,
  valueType,
  alwaysShow = false,
}: {
  currentValue: unknown;
  targetValue: unknown;
  unit: string;
  valueType: ObjectiveValueType;
  alwaysShow?: boolean;
}) {
  const numericTarget = typeof targetValue === "number" && targetValue > 0 &&
    ["number", "percentage", "currency"].includes(valueType);
  if (!numericTarget) {
    if (!alwaysShow) return null;
    const hasTarget = targetValue !== null;
    const complete = hasTarget && (
      currentValue === targetValue ||
      (typeof targetValue === "object" && targetValue !== null &&
        JSON.stringify(currentValue) === JSON.stringify(targetValue))
    );
    const progress = complete ? 100 : 0;
    const stateLabel = !hasTarget
      ? "Sem meta definida"
      : currentValue === undefined
        ? "A aguardar check-in"
        : "Estado da meta";
    return (
      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[9px] text-[#8d837f]">
          <span>{stateLabel}</span>
          <span className="font-bold text-[#66574c]">{complete ? "Concluído" : hasTarget ? "Em aberto" : "—"}</span>
        </div>
        <div
          aria-label={complete ? "Objectivo concluído" : hasTarget ? "Objectivo ainda não concluído" : "Objectivo sem meta definida"}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="h-2 overflow-hidden rounded-full bg-[#f0ece9]"
          role="progressbar"
        >
          <div
            className={`h-full rounded-full transition-[width] ${complete ? "bg-[#52765e]" : "bg-[#cda45c]"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  const current = typeof currentValue === "number" ? currentValue : 0;
  const exactProgress = (current / targetValue) * 100;
  const barProgress = Math.min(100, Math.max(0, exactProgress));

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex justify-between text-[9px] text-[#8d837f]">
        <span>{currentValue === undefined ? "A aguardar primeiro check-in" : "Progresso da meta"}</span>
        <span className="font-bold text-[#66574c]">
          {currentValue === undefined ? "0%" : `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 1 }).format(exactProgress)}%`}
        </span>
      </div>
      <div
        aria-label={`Progresso ${currentValue === undefined ? 0 : exactProgress.toFixed(1)}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={barProgress}
        className="h-2 overflow-hidden rounded-full bg-[#f0ece9]"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-[width] ${barProgress >= 100 ? "bg-[#52765e]" : "bg-[#cda45c]"}`}
          style={{ width: `${barProgress}%` }}
        />
      </div>
      {exactProgress > 100 ? (
        <p className="mt-1 text-right text-[9px] font-semibold text-[#52765e]">
          Meta superada · {displayValue(current, valueType, unit)}
        </p>
      ) : null}
    </div>
  );
}

function luandaToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return date.toLocaleDateString("pt-AO", { dateStyle: "medium" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}
