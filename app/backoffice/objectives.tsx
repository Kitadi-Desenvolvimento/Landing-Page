"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  objectiveValueTypes,
  type ObjectiveValueType,
} from "../lib/objectives";
import {
  canAlignObjective,
  objectivePeriodEnd,
  objectivePeriodStart,
  objectivePeriodTypes,
  type ObjectivePeriodType,
  type ReportPeriod,
} from "../lib/objective-periods";
import type { ObjectiveProduct, ObjectiveCollaborator as SimpleCollaborator } from "../lib/objective-products";
import { messageForApiError, messageFromApiBody } from "../lib/api-error-messages";
import { personLabel } from "../lib/person-label";
import type { OkrTemplate } from "../lib/okr-templates";
import { useErrorToast } from "./error-toast";
import BlockDialog from "./block-dialog";
import OkrTemplatePicker from "./okr-template-picker";

type Objective = {
  id: string;
  area_id: string | null;
  scope_type: "company" | "department" | "collaborator";
  assigned_to: string | null;
  period_type: ObjectivePeriodType | null;
  period_start: string | null;
  aligned_objective_id: string | null;
  parent_objective_id: string | null;
  due_date: string | null;
  archived: boolean;
  product_id: string | null;
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

type ObjectiveCollaborator = {
  id: string;
  email: string;
  displayName?: string;
  areaIds: string[];
};

type ObjectivesData = {
  objectives: Objective[];
  checkins: ObjectiveCheckIn[];
  edits: ObjectiveCheckInEdit[];
  areas: ObjectiveArea[];
  collaborators: ObjectiveCollaborator[];
  products: ObjectiveProduct[];
  availableCollaborators: SimpleCollaborator[];
  userId: string;
  manageableAreaIds: string[];
  role: "admin" | "manager" | "collaborator";
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
  const showError = useErrorToast();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [checkins, setCheckins] = useState<ObjectiveCheckIn[]>([]);
  const [edits, setEdits] = useState<ObjectiveCheckInEdit[]>([]);
  const [areas, setAreas] = useState<ObjectiveArea[]>([]);
  const [collaborators, setCollaborators] = useState<ObjectiveCollaborator[]>([]);
  const [userId, setUserId] = useState("");
  const [manageableAreaIds, setManageableAreaIds] = useState<string[]>([]);
  const [role, setRole] = useState<ObjectivesData["role"]>("collaborator");
  const [products, setProducts] = useState<ObjectiveProduct[]>([]);
  const [availableCollaborators, setAvailableCollaborators] = useState<SimpleCollaborator[]>([]);
  const [query, setQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | ObjectivePeriodType>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | Objective["scope_type"]>("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("mine");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "active" | "inactive" | "archived" | "all">("open");
  const [situationFilter, setSituationFilter] = useState<"all" | "no_checkin" | "in_progress" | "complete" | "soon" | "overdue">("all");
  const [shapeFilter, setShapeFilter] = useState<"all" | "with_krs" | "without_krs">("all");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formObjective, setFormObjective] = useState<Objective | null | "new">(null);
  const [formParentObjectiveId, setFormParentObjectiveId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState<OkrTemplate | null>(null);
  const [formCheckIn, setFormCheckIn] = useState<{ objective: Objective; checkin: ObjectiveCheckIn } | null>(null);
  const [savingCheckIn, setSavingCheckIn] = useState("");
  const [blockObjective, setBlockObjective] = useState<Objective | null>(null);

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
        throw new Error(messageForApiError(code, objectiveLoadFallback(response.status)));
      }
      setObjectives(result.objectives);
      setCheckins(result.checkins);
      setEdits(result.edits);
      setAreas(result.areas);
      setCollaborators(result.collaborators);
      setProducts(result.products);
      setAvailableCollaborators(result.availableCollaborators);
      setUserId(result.userId);
      setManageableAreaIds(result.manageableAreaIds);
      setRole(result.role);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os objectivos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function closeObjectiveEditor() {
    setFormObjective(null);
    setFormParentObjectiveId(null);
    setDraftTemplate(null);
  }

  async function saveObjective(
    payload: ObjectivePayload,
    objective: Objective | null,
    options?: { keepOpen?: boolean },
  ) {
    const response = await fetch(
      objective
        ? `/api/backoffice/objectives/${encodeURIComponent(objective.id)}`
        : "/api/backoffice/objectives",
      {
        method: objective ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          parentObjectiveId: objective?.parent_objective_id ?? payload.parentObjectiveId,
        }),
      },
    );
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(messageFromApiBody(result, "Não foi possível guardar o objectivo."));
    }
    const id = typeof result === "object" && result !== null && "id" in result && typeof result.id === "string"
      ? result.id
      : "";
    if (!id) throw new Error("Não foi possível guardar o objectivo.");
    if (!options?.keepOpen) {
      closeObjectiveEditor();
      await loadData();
    }
    return id;
  }

  async function saveCheckIn(
    objective: Objective,
    value: unknown,
    note: string,
  ) {
    setSavingCheckIn(objective.id);
    try {
      const response = await fetch(
        `/api/backoffice/objectives/${encodeURIComponent(objective.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value, note }),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          result.error === "already_checked_in_today"
        ) {
          await loadData();
        }
        showError(messageFromApiBody(result, "Não foi possível guardar o check-in."));
        return;
      }
      await loadData();
    } catch {
      showError("Não foi possível guardar o check-in.");
    } finally {
      setSavingCheckIn("");
    }
  }

  async function setObjectiveArchived(objective: Objective, archived: boolean): Promise<boolean> {
    try {
      const response = await fetch(
        `/api/backoffice/objectives/${encodeURIComponent(objective.id)}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        },
      );
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        showError(messageFromApiBody(result, "Não foi possível actualizar o estado do objectivo."));
        return false;
      }
      await loadData();
      return true;
    } catch {
      showError("Não foi possível actualizar o estado do objectivo.");
      return false;
    }
  }

  const today = luandaToday();
  const topLevelObjectives = objectives.filter((objective) => objective.parent_objective_id === null);
  const canCreateObjective = role === "admin" ||
    (role === "manager" && areas.some((area) => area.active)) ||
    role === "collaborator";
  const people = collaborators
    .filter((person) => person.id !== userId)
    .sort((left, right) => left.email.localeCompare(right.email, "pt"));
  const filtersNarrowed = query.trim() !== "" || periodFilter !== "all" || scopeFilter !== "all" ||
    areaFilter !== "all" || personFilter !== "mine" || productFilter !== "all" ||
    statusFilter !== "open" || situationFilter !== "all" || shapeFilter !== "all";
  const visibleObjectives = topLevelObjectives.filter((objective) =>
    objectiveMatchesFilters(objective, {
      objectives,
      checkins,
      collaborators,
      manageableAreaIds,
      userId,
      today,
      query,
      periodFilter,
      scopeFilter,
      areaFilter,
      personFilter,
      productFilter,
      statusFilter,
      situationFilter,
      shapeFilter,
    }),
  );
  const selectedObjective = selectedObjectiveId
    ? objectives.find((objective) => objective.id === selectedObjectiveId) ?? null
    : null;
  const editorParentObjectiveId = formObjective === "new"
    ? formParentObjectiveId
    : formObjective?.parent_objective_id ?? null;
  const editorParentAreaId = editorParentObjectiveId
    ? objectives.find((item) => item.id === editorParentObjectiveId)?.area_id ?? null
    : null;
  const editorParentObjective = editorParentObjectiveId
    ? objectives.find((item) => item.id === editorParentObjectiveId) ?? null
    : null;
  const activeCount = visibleObjectives.filter((objective) => objective.active && !objective.archived).length;
  const visibleIds = new Set(visibleObjectives.flatMap((objective) => [
    objective.id,
    ...objectives.filter((item) => item.parent_objective_id === objective.id).map((item) => item.id),
  ]));
  const visibleCheckins = checkins.filter((checkin) => visibleIds.has(checkin.objective_id));
  const todayCount = visibleObjectives.filter((objective) =>
    !objective.archived &&
      checkins.some((checkin) => checkin.objective_id === objective.id && checkin.checkin_date === today),
  ).length;

  function renderObjectiveCard(
    objective: Objective,
    inModal = false,
    isKeyResult = false,
    parentAllowsChanges = true,
  ) {
    const history = checkins.filter((item) => item.objective_id === objective.id);
    const todayCheckIn = history.find((item) => item.checkin_date === today);
    const keyResults = isKeyResult
      ? []
      : objectives.filter((item) => item.parent_objective_id === objective.id);
    const canManage = role === "admin" ||
      (role === "manager" && objective.scope_type !== "company" &&
        objective.area_id !== null && manageableAreaIds.includes(objective.area_id)) ||
      (role === "collaborator" && objective.scope_type === "collaborator" &&
        objective.assigned_to === userId);
    const canCheckIn = canManage;
    const areaName = objective.scope_type === "company"
      ? "Empresa"
      : objective.scope_type === "collaborator"
        ? personLabel(collaborators.find((member) => member.id === objective.assigned_to)?.displayName, collaborators.find((member) => member.id === objective.assigned_to)?.email ?? "Colaborador")
        : areas.find((area) => area.id === objective.area_id)?.name ?? "Departamento";
    const alignedObjectiveTitle = objective.aligned_objective_id
      ? objectives.find((item) => item.id === objective.aligned_objective_id)?.title ?? null
      : null;
    return (
      <ObjectiveCard
        checkInDone={Boolean(todayCheckIn)}
        history={history}
        isKeyResult={isKeyResult}
        parentAllowsChanges={parentAllowsChanges}
        keyResultCards={keyResults.map((keyResult) =>
          renderObjectiveCard(
            keyResult,
            inModal,
            true,
            parentAllowsChanges && objective.active && !objective.archived,
          ),
        )}
        onAddKeyResult={() => {
          setFormParentObjectiveId(objective.id);
          setFormObjective("new");
        }}
        onArchive={(archived) => {
          void (async () => {
            const updated = await setObjectiveArchived(objective, archived);
            if (updated && inModal) setSelectedObjectiveId(null);
          })();
        }}
        edits={edits.filter((edit) => history.some((item) => item.id === edit.checkin_id))}
        areaName={areaName}
        alignedObjectiveTitle={alignedObjectiveTitle}
        canManage={canManage}
        canCheckIn={canCheckIn}
        key={`${inModal ? "modal" : "card"}-${objective.id}`}
        objective={objective}
        saving={savingCheckIn === objective.id}
        onCheckIn={(value, note) => saveCheckIn(objective, value, note)}
        onBlock={() => setBlockObjective(objective)}
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
            {role === "collaborator"
              ? "Crie objectivos pessoais e registe o seu progresso diário."
              : role === "manager"
                ? "Gira os objectivos dos departamentos atribuídos e acompanhe os check-ins da equipa."
                : "Crie objectivos para a empresa, departamentos ou colaboradores e acompanhe o progresso."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateObjective ? (
            <>
              <button
                className="min-h-11 rounded-full border border-[#e2d6c4] bg-white px-5 text-[12px] font-semibold text-[#762838] hover:bg-[#fbf6ee]"
                onClick={() => setTemplatePickerOpen(true)}
                type="button"
              >
                Templates OKR
              </button>
              <button
                className="min-h-11 rounded-full bg-[#510f1d] px-5 text-[12px] font-semibold text-white hover:bg-[#762838]"
                onClick={() => {
                  setDraftTemplate(null);
                  setFormObjective("new");
                }}
                type="button"
              >
                Novo objectivo
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <ObjectiveStat label="Objectivos activos" value={String(activeCount)} />
        <ObjectiveStat label="Check-ins de hoje" value={`${todayCount} / ${activeCount}`} />
        <ObjectiveStat label="Registos no histórico" value={String(visibleCheckins.length)} />
      </div>
      <ObjectiveReportExport />

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
      {!loading && !error ? (
        <ObjectiveFilters
          areaFilter={areaFilter}
          areas={areas}
          filtersNarrowed={filtersNarrowed}
          people={people}
          periodFilter={periodFilter}
          personFilter={personFilter}
          productFilter={productFilter}
          products={products}
          query={query}
          resultCount={visibleObjectives.length}
          scopeFilter={scopeFilter}
          shapeFilter={shapeFilter}
          situationFilter={situationFilter}
          statusFilter={statusFilter}
          onAreaFilter={setAreaFilter}
          onClear={() => {
            setQuery("");
            setPeriodFilter("all");
            setScopeFilter("all");
            setAreaFilter("all");
            setPersonFilter("mine");
            setProductFilter("all");
            setStatusFilter("open");
            setSituationFilter("all");
            setShapeFilter("all");
          }}
          onPeriodFilter={setPeriodFilter}
          onPersonFilter={setPersonFilter}
          onProductFilter={setProductFilter}
          onQuery={setQuery}
          onScopeFilter={setScopeFilter}
          onShapeFilter={setShapeFilter}
          onSituationFilter={setSituationFilter}
          onStatusFilter={setStatusFilter}
        />
      ) : null}
      {!loading && visibleObjectives.length === 0 && !error ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d8cdc7] bg-white p-8 text-center">
          <h3 className="font-bold text-[#302829]">
            {topLevelObjectives.length === 0 ? "Ainda não há objectivos" : "Nenhum objectivo com estes filtros"}
          </h3>
          <p className="mt-2 text-sm text-[#817773]">
            {topLevelObjectives.length === 0
              ? "Crie o primeiro para começar a acompanhar o progresso diário."
              : personFilter === "mine"
                ? "Os meus mostra o que está atribuído a si ou ao seu departamento. Escolha Todas as pessoas para ver o resto."
                : "Altere os filtros para ver outros objectivos."}
          </p>
        </div>
      ) : null}
      {!loading && role === "manager" && areas.every((area) => !area.active) ? (
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
              const keyResultCount = objectives.filter((item) => item.parent_objective_id === objective.id).length;
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
                        : `border-l-2 ${periodAccentClass(objective.period_type)}`
                  }`}
                  key={objective.id}
                  onClick={() => setSelectedObjectiveId(objective.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-[#352d2e]">{objective.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ObjectivePeriodBadge period={objective.period_type} />
                      <ObjectiveScopeBadge scope={objective.scope_type} />
                      <span className="text-[9px] text-[#8d837f]">
                        {objective.archived ? "Arquivado" : objective.active ? "Activo" : "Inactivo"}
                        {keyResultCount > 0 ? ` · ${keyResultCount} KR${keyResultCount === 1 ? "" : "s"}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="text-[10px] text-[#766d69]">
                    <span className="mr-1 text-[9px] font-semibold text-[#a19894] sm:hidden">Área:</span>
                    {objective.scope_type === "company"
                      ? "Empresa"
                      : objective.scope_type === "collaborator"
                        ? personLabel(collaborators.find((member) => member.id === objective.assigned_to)?.displayName, collaborators.find((member) => member.id === objective.assigned_to)?.email ?? "Colaborador")
                        : areas.find((area) => area.id === objective.area_id)?.name ?? "Departamento"}
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
          key={formObjective === "new"
            ? `new-objective-${draftTemplate?.id ?? "blank"}-${formParentObjectiveId ?? "root"}`
            : formObjective.id}
          objective={formObjective === "new" ? null : formObjective}
          template={formObjective === "new" && !formParentObjectiveId ? draftTemplate : null}
          parentObjectiveId={editorParentObjectiveId}
          parentAreaId={editorParentAreaId}
          parentObjective={editorParentObjective}
          role={role}
          currentUserId={userId}
          objectives={objectives}
          collaborators={collaborators}
          areas={areas.filter((area) =>
            area.active || (typeof formObjective === "object" &&
              formObjective !== null && area.id === formObjective.area_id),
          )}
          products={products}
          onClose={closeObjectiveEditor}
          onFinished={async () => {
            closeObjectiveEditor();
            await loadData();
          }}
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
            if (!response.ok) {
              const result: unknown = await response.json().catch(() => null);
              throw new Error(messageFromApiBody(result, "Não foi possível editar o check-in."));
            }
            setFormCheckIn(null);
            await loadData();
          }}
        />
      ) : null}
      {templatePickerOpen ? (
        <OkrTemplatePicker
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={(template) => {
            setDraftTemplate(template);
            setFormParentObjectiveId(null);
            setFormObjective("new");
            setTemplatePickerOpen(false);
          }}
        />
      ) : null}
      {blockObjective ? (
        <BlockDialog
          onClose={() => setBlockObjective(null)}
          subjectId={blockObjective.id}
          subjectType="objective"
          title={blockObjective.title}
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
          throw new Error(messageForApiError(code, objectiveLoadFallback(response.status)));
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

  const activeObjectives = data?.objectives.filter((objective) =>
    objective.parent_objective_id === null &&
    objective.active &&
    !objective.archived &&
    objectiveBelongsToPerson(
      objective,
      data.userId,
      data.collaborators,
      data.userId,
      data.manageableAreaIds,
    ),
  ) ?? [];
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
            Os seus objectivos e o progresso pelo check-in mais recente
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
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#393132]">{objective.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <ObjectivePeriodBadge period={objective.period_type} />
                        <ObjectiveScopeBadge scope={objective.scope_type} />
                      </div>
                    </div>
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
  keyResultCards,
  isKeyResult,
  parentAllowsChanges,
  areaName,
  alignedObjectiveTitle,
  canManage,
  canCheckIn,
  checkInDone,
  saving,
  onEdit,
  onBlock,
  onAddKeyResult,
  onArchive,
  onEditCheckIn,
  onCheckIn,
}: {
  objective: Objective;
  history: ObjectiveCheckIn[];
  edits: ObjectiveCheckInEdit[];
  keyResultCards: React.ReactNode[];
  isKeyResult: boolean;
  parentAllowsChanges: boolean;
  areaName: string;
  alignedObjectiveTitle: string | null;
  canManage: boolean;
  canCheckIn: boolean;
  checkInDone: boolean;
  saving: boolean;
  onEdit: () => void;
  onBlock: () => void;
  onAddKeyResult: () => void;
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
            {isKeyResult ? (
              <span className="rounded-full bg-[#f7f3ed] px-2.5 py-1 text-[9px] font-semibold text-[#796b59]">KR</span>
            ) : null}
            <span className="rounded-full bg-[#f7f3ed] px-2.5 py-1 text-[9px] font-semibold text-[#796b59]">{areaName}</span>
            <ObjectivePeriodBadge period={objective.period_type} />
            <ObjectiveScopeBadge scope={objective.scope_type} />
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${
              objective.archived
                ? "bg-[#f3efed] text-[#847a76]"
                : objective.active ? "bg-[#edf4ee] text-[#52765e]" : "bg-[#f3efed] text-[#847a76]"
            }`}>
              {objective.archived ? "Arquivado" : objective.active ? "Activo" : "Inactivo"}
            </span>
          </div>
          {objective.description ? <p className="mt-2 text-[11px] leading-5 text-[#817773]">{objective.description}</p> : null}
          {alignedObjectiveTitle ? (
            <p className="mt-2 text-[10px] text-[#6e4b71]">Alinhado a: {alignedObjectiveTitle}</p>
          ) : null}
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
        {canManage && (!isKeyResult || parentAllowsChanges) ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {!objective.archived && !isKeyResult ? (
              <button
                className="rounded-full border border-[#e2d6c4] px-3 py-1.5 text-[10px] font-semibold text-[#762838] hover:bg-[#fbf6ee]"
                onClick={onBlock}
                type="button"
              >
                Bloquear
              </button>
            ) : null}
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

      {!isKeyResult ? (
        <section className="mt-5 border-t border-[#f0ecea] pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-[11px] font-bold text-[#443a3b]">Key Results ({keyResultCards.length})</h4>
            {canManage && objective.active && !objective.archived ? (
              <button
                className="rounded-full border border-[#e9e3e0] px-3 py-1.5 text-[10px] font-semibold text-[#6d605b] hover:bg-[#faf8f7]"
                onClick={onAddKeyResult}
                type="button"
              >
                Adicionar KR
              </button>
            ) : null}
          </div>
          {keyResultCards.length > 0 ? (
            <div className="space-y-3">{keyResultCards}</div>
          ) : (
            <p className="rounded-xl bg-[#faf8f6] px-3 py-3 text-[10px] text-[#8d837f]">
              Ainda não há KRs associados a este objectivo.
            </p>
          )}
        </section>
      ) : null}

      {objective.active && !objective.archived && canCheckIn && (!isKeyResult || parentAllowsChanges) ? (
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
                  {canManage ? (
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
  template,
  parentObjectiveId,
  parentAreaId,
  parentObjective,
  role,
  currentUserId,
  objectives,
  collaborators,
  areas,
  products,
  onClose,
  onFinished,
  onSave,
}: {
  objective: Objective | null;
  template: OkrTemplate | null;
  parentObjectiveId: string | null;
  parentAreaId: string | null;
  parentObjective: Objective | null;
  role: ObjectivesData["role"];
  currentUserId: string;
  objectives: Objective[];
  collaborators: ObjectiveCollaborator[];
  areas: ObjectiveArea[];
  products: ObjectiveProduct[];
  onClose: () => void;
  onFinished: () => Promise<void>;
  onSave: (
    payload: ObjectivePayload,
    objective: Objective | null,
    options?: { keepOpen?: boolean },
  ) => Promise<string>;
}) {
  const [valueType, setValueType] = useState<ObjectiveValueType>(objective?.value_type ?? "number");
  const [draftKeyResults, setDraftKeyResults] = useState(() =>
    template?.keyResults.map((item) => ({
      title: item.title,
      valueType: item.valueType,
      target: String(item.target),
      unit: item.unit,
    })) ?? null,
  );
  const [createdParentId, setCreatedParentId] = useState<string | null>(null);
  const [savedKeyResultCount, setSavedKeyResultCount] = useState(0);
  const [scopeType, setScopeType] = useState<ObjectivePayload["scopeType"]>(
    objective?.scope_type ?? parentObjective?.scope_type ?? (role === "collaborator" ? "collaborator" : "department"),
  );
  const [areaId, setAreaId] = useState(() => {
    if (objective) return objective.area_id ?? "";
    if (parentObjective) return parentObjective.area_id ?? "";
    if (parentObjectiveId) return parentAreaId ?? "";
    return role === "collaborator" ? "" : areas[0]?.id ?? "";
  });
  const [assignedTo, setAssignedTo] = useState(
    objective?.assigned_to ?? parentObjective?.assigned_to ?? (role === "collaborator" ? currentUserId : ""),
  );
  const [productId, setProductId] = useState(objective?.product_id ?? "");
  const [periodType, setPeriodType] = useState<ObjectivePeriodType>(
    objective?.period_type ?? parentObjective?.period_type ?? template?.period ?? "daily",
  );
  const [periodAnchor, setPeriodAnchor] = useState(
    objective?.period_start ?? parentObjective?.period_start ?? luandaToday(),
  );
  const [alignedObjectiveId, setAlignedObjectiveId] = useState(objective?.aligned_objective_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const effectiveScopeType = parentObjective?.scope_type ?? scopeType;
  const effectiveAreaId = parentObjective ? parentObjective.area_id : scopeType === "company" ? null : areaId || null;
  const effectiveAssignedTo = effectiveScopeType === "collaborator"
    ? parentObjective?.assigned_to ?? (role === "collaborator" ? currentUserId : assignedTo || null)
    : null;
  const assignableCollaborators = collaborators;
  const periodStart = objectivePeriodStart(periodType, periodAnchor);
  const alignmentCandidates = objectives.filter((candidate) => {
    if (candidate.id === objective?.id || candidate.parent_objective_id ||
        candidate.archived || !candidate.active || !candidate.period_type ||
        candidate.scope_type !== effectiveScopeType ||
        candidate.area_id !== effectiveAreaId ||
        candidate.assigned_to !== effectiveAssignedTo ||
        !canAlignObjective(periodType, candidate.period_type)) return false;
    const candidateEnd = candidate.period_start
      ? objectivePeriodEnd(candidate.period_type, candidate.period_start)
      : null;
    return Boolean(
      periodStart && candidate.period_start && candidateEnd &&
      periodStart >= candidate.period_start && periodStart < candidateEnd,
    );
  });

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
    if (!periodStart) {
      setError("Indique uma data válida para o período.");
      setSaving(false);
      return;
    }
    const selectedAreaId = parentObjective
      ? parentObjective.area_id
      : scopeType === "company"
        ? null
        : String(form.get("areaId") ?? "") || null;
    const selectedAssignedTo = effectiveScopeType === "collaborator"
      ? parentObjective
        ? parentObjective.assigned_to
        : role === "collaborator"
          ? currentUserId
          : String(form.get("assignedTo") ?? "") || null
      : null;
    const payload: ObjectivePayload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      scopeType: effectiveScopeType,
      areaId: selectedAreaId,
      assignedTo: selectedAssignedTo,
      periodType,
      periodStart: parentObjective?.period_start ?? periodStart,
      alignedObjectiveId: parentObjective ? null : String(form.get("alignedObjectiveId") ?? "") || null,
      parentObjectiveId,
      dueDate: String(form.get("dueDate") ?? "") || null,
      valueType,
      targetValue: target.value,
      unit: String(form.get("unit") ?? ""),
      active: form.get("active") === "on",
      productId: String(form.get("productId") ?? "") || null,
    };
    try {
      if (draftKeyResults && !objective && !parentObjectiveId) {
        const parsedKeyResults = draftKeyResults.map((item) => {
          const parsed = parseInputValue(item.target, item.valueType);
          return { item, parsed };
        });
        const invalid = parsedKeyResults.find((entry) => !entry.parsed.valid);
        if (invalid && !invalid.parsed.valid) {
          setError(`${invalid.item.title}: ${invalid.parsed.error}`);
          setSaving(false);
          return;
        }
        const parentId = createdParentId ?? await onSave(
          { ...payload, valueType: "number", targetValue: null, unit: "" },
          null,
          { keepOpen: true },
        );
        setCreatedParentId(parentId);
        for (let index = savedKeyResultCount; index < parsedKeyResults.length; index += 1) {
          const entry = parsedKeyResults[index];
          if (!entry.parsed.valid) continue;
          await onSave({
            title: entry.item.title,
            description: "",
            scopeType: payload.scopeType,
            areaId: payload.areaId,
            assignedTo: payload.assignedTo,
            periodType: payload.periodType,
            periodStart: payload.periodStart,
            alignedObjectiveId: null,
            parentObjectiveId: parentId,
            dueDate: payload.dueDate,
            valueType: entry.item.valueType,
            targetValue: entry.parsed.value,
            unit: entry.item.unit,
            active: true,
            productId: null,
          }, null, { keepOpen: true });
          setSavedKeyResultCount(index + 1);
        }
        await onFinished();
        return;
      }
      await onSave(payload, objective);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o objectivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="objective-editor-title" aria-modal="true" className={`my-auto w-full rounded-[24px] bg-white p-5 shadow-2xl sm:p-7 ${draftKeyResults ? "max-w-[720px]" : "max-w-[620px]"}`} role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a8792f]">
              {draftKeyResults ? "Template OKR" : parentObjectiveId ? "Key Result" : objective ? "Actualizar meta" : "Nova meta"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#302829]" id="objective-editor-title">
              {draftKeyResults ? "Ajustar e guardar" : parentObjectiveId ? objective ? "Editar KR" : "Adicionar Key Result" : objective ? "Editar objectivo" : "Criar objectivo"}
            </h2>
          </div>
          <button aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]" onClick={onClose} type="button">×</button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-[10px] font-semibold text-[#817773]">
            {parentObjectiveId ? "Nome do Key Result" : "Nome do objectivo"}
            <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]" defaultValue={template?.title ?? objective?.title} maxLength={160} name="title" required />
          </label>
          <label className="block text-[10px] font-semibold text-[#817773]">
            Descrição (opcional)
            <textarea className="mt-1 min-h-20 w-full rounded-xl border border-[#e9e3e0] px-3 py-2 text-[12px] text-[#302829]" defaultValue={template?.description ?? objective?.description} maxLength={2000} name="description" />
          </label>
          {parentObjectiveId && parentObjective ? (
            <p className="rounded-xl bg-[#faf8f6] px-3 py-2.5 text-[10px] text-[#817773]">
              Este KR herda o âmbito, o período e a atribuição do objectivo principal.
            </p>
          ) : (
            <div className="space-y-3">
              <label className="block text-[10px] font-semibold text-[#817773]">
                Âmbito
                {role === "collaborator" ? (
                  <span className="mt-1 block rounded-xl bg-[#faf8f6] px-3 py-3 text-[11px] font-normal text-[#625858]">
                    Objectivo pessoal
                  </span>
                ) : (
                  <select
                    className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]"
                    onChange={(event) => {
                      const nextScope = event.target.value as ObjectivePayload["scopeType"];
                      setScopeType(nextScope);
                      setAlignedObjectiveId("");
                    }}
                    value={scopeType}
                  >
                    {role === "admin" ? <option value="company">Empresa</option> : null}
                    <option value="department">Departamento</option>
                    <option value="collaborator">Colaborador</option>
                  </select>
                )}
              </label>
              {scopeType !== "company" ? (
                <label className="block text-[10px] font-semibold text-[#817773]">
                  Departamento{scopeType === "collaborator" && role === "admin" ? " (opcional)" : ""}
                  <select
                    className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]"
                    name="areaId"
                    onChange={(event) => {
                      const nextAreaId = event.target.value;
                      setAreaId(nextAreaId);
                      setAlignedObjectiveId("");
                      if (scopeType === "collaborator" && assignedTo) {
                        const selected = collaborators.find((member) => member.id === assignedTo);
                        if (selected && nextAreaId && !selected.areaIds.includes(nextAreaId)) setAssignedTo("");
                      }
                    }}
                    required={scopeType === "department" || role === "manager"}
                    value={areaId}
                  >
                    <option value="">Sem departamento</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.active ? "" : " · inactiva"}</option>)}
                  </select>
                </label>
              ) : null}
              {scopeType === "collaborator" ? (
                role === "collaborator" ? (
                  <p className="rounded-xl bg-[#faf8f6] px-3 py-2.5 text-[10px] text-[#817773]">
                    Este objectivo ficará atribuído à sua conta.
                  </p>
                ) : (
                  <label className="block text-[10px] font-semibold text-[#817773]">
                    Colaborador
                    <select className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" name="assignedTo" onChange={(event) => {
                      setAssignedTo(event.target.value);
                      setAlignedObjectiveId("");
                    }} required value={assignedTo}>
                      <option value="">Seleccionar colaborador</option>
                      {assignableCollaborators.map((member) => <option key={member.id} value={member.id}>{personLabel(member.displayName, member.email)}</option>)}
                    </select>
                  </label>
                )
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-semibold text-[#817773]">
                  Periodicidade
                  <select className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" onChange={(event) => {
                    setPeriodType(event.target.value as ObjectivePeriodType);
                    setAlignedObjectiveId("");
                  }} value={periodType}>
                    {objectivePeriodTypes.map((type) => <option key={type} value={type}>{periodTypeLabel(type)}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] font-semibold text-[#817773]">
                  Data de referência
                  <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[11px] text-[#302829]" name="periodAnchor" onChange={(event) => setPeriodAnchor(event.target.value)} required type="date" value={periodAnchor} />
                </label>
              </div>
              <label className="block text-[10px] font-semibold text-[#817773]">
                Alinhado com (opcional)
                <select className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" name="alignedObjectiveId" onChange={(event) => setAlignedObjectiveId(event.target.value)} value={alignedObjectiveId}>
                  <option value="">Sem alinhamento</option>
                  {alignmentCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} · {periodTypeLabel(candidate.period_type!)}</option>)}
                </select>
              </label>
            </div>
          )}
          <label className="block text-[10px] font-semibold text-[#817773]">
            Data de fim (opcional)
            <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[11px] text-[#302829]" defaultValue={objective?.due_date ?? ""} name="dueDate" type="date" />
          </label>
          {draftKeyResults ? null : (
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
          )}
          {draftKeyResults ? (
            <div className="space-y-3 rounded-2xl bg-[#faf8f6] p-3">
              <p className="text-[11px] font-semibold text-[#554b4b]">Key results de exemplo. Ajuste as metas antes de guardar.</p>
              {draftKeyResults.map((item, index) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_90px]" key={`${item.valueType}-${index}`}>
                  <label className="block text-[10px] font-semibold text-[#817773]">
                    Key result {index + 1}
                    <input
                      className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[12px] text-[#302829]"
                      maxLength={160}
                      onChange={(event) => setDraftKeyResults((current) => current?.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) ?? null)}
                      value={item.title}
                    />
                  </label>
                  <label className="block text-[10px] font-semibold text-[#817773]">
                    Meta
                    <input
                      className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[12px] text-[#302829]"
                      onChange={(event) => setDraftKeyResults((current) => current?.map((entry, entryIndex) => entryIndex === index ? { ...entry, target: event.target.value } : entry) ?? null)}
                      type="number"
                      value={item.target}
                    />
                  </label>
                  <label className="block text-[10px] font-semibold text-[#817773]">
                    {valueTypeLabels[item.valueType]}
                    <input
                      className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[12px] text-[#302829]"
                      maxLength={40}
                      onChange={(event) => setDraftKeyResults((current) => current?.map((entry, entryIndex) => entryIndex === index ? { ...entry, unit: event.target.value } : entry) ?? null)}
                      value={item.unit}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <ObjectiveValueInput
              defaultValue={objective?.target_value ?? null}
              key={valueType}
              label="Meta / valor-alvo (opcional)"
              name="targetValue"
              type={valueType}
              unit={String(objective?.unit ?? "")}
            />
          )}
          {!parentObjectiveId ? (
            <div className="space-y-3">
              <label className="block text-[10px] font-semibold text-[#817773]">
                Produto associado (opcional)
                <select className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" name="productId" onChange={(event) => setProductId(event.target.value)} value={productId}>
                  <option value="">Sem produto</option>
                  {products.map((product) => <option key={product.slug} value={product.slug}>{product.title}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#554b4b]">
            <input defaultChecked={objective?.active ?? true} name="active" type="checkbox" />
            {parentObjectiveId ? "KR activo" : "Objectivo activo"}
          </label>
          {error ? <p className="text-[11px] text-red-700" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[#f0ecea] pt-4">
            <button className="min-h-10 rounded-full border border-[#e9e3e0] px-4 text-[11px] font-semibold text-[#625858]" onClick={onClose} type="button">Cancelar</button>
            <button className="min-h-10 rounded-full bg-[#510f1d] px-5 text-[11px] font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "A guardar…" : draftKeyResults ? "Guardar OKR" : parentObjectiveId ? "Guardar KR" : "Guardar objectivo"}</button>
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
  scopeType: "company" | "department" | "collaborator";
  areaId: string | null;
  assignedTo: string | null;
  periodType: ObjectivePeriodType;
  periodStart: string;
  alignedObjectiveId: string | null;
  parentObjectiveId: string | null;
  dueDate: string | null;
  valueType: ObjectiveValueType;
  targetValue: unknown;
  unit: string;
  active: boolean;
  productId: string | null;
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
  collaborators: ObjectiveCollaborator[];
  products: ObjectiveProduct[];
  availableCollaborators: SimpleCollaborator[];
  userId: string;
  manageableAreaIds: string[];
  role: ObjectivesData["role"];
} {
  if (typeof value !== "object" || value === null ||
      !("objectives" in value) || !Array.isArray(value.objectives) ||
      !("checkins" in value) || !Array.isArray(value.checkins) ||
      !("edits" in value) || !Array.isArray(value.edits) ||
      !("areas" in value) || !Array.isArray(value.areas) ||
      !("collaborators" in value) || !Array.isArray(value.collaborators) ||
      !("products" in value) || !Array.isArray(value.products) ||
      !("availableCollaborators" in value) || !Array.isArray(value.availableCollaborators) ||
      !("userId" in value) || typeof value.userId !== "string" ||
      !("manageableAreaIds" in value) || !Array.isArray(value.manageableAreaIds) ||
      !("role" in value) || !["admin", "manager", "collaborator"].includes(String(value.role))) return false;
  return value.objectives.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "area_id" in item && (typeof item.area_id === "string" || item.area_id === null) &&
    "scope_type" in item && ["company", "department", "collaborator"].includes(String(item.scope_type)) &&
    "assigned_to" in item && (typeof item.assigned_to === "string" || item.assigned_to === null) &&
    "period_type" in item && (
      (typeof item.period_type === "string" &&
        objectivePeriodTypes.includes(item.period_type as ObjectivePeriodType)) ||
      item.period_type === null
    ) &&
    "period_start" in item && (typeof item.period_start === "string" || item.period_start === null) &&
    "aligned_objective_id" in item && (typeof item.aligned_objective_id === "string" || item.aligned_objective_id === null) &&
    "parent_objective_id" in item &&
    (typeof item.parent_objective_id === "string" || item.parent_objective_id === null) &&
    "due_date" in item && (typeof item.due_date === "string" || item.due_date === null) &&
    "archived" in item && typeof item.archived === "boolean" &&
    "product_id" in item && (typeof item.product_id === "string" || item.product_id === null) &&
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
  ) && value.collaborators.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "email" in item && typeof item.email === "string" &&
    (!("displayName" in item) || typeof item.displayName === "string") &&
    "areaIds" in item && Array.isArray(item.areaIds) &&
    item.areaIds.every((areaId) => typeof areaId === "string"),
  ) && value.availableCollaborators.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "email" in item && typeof item.email === "string" &&
    (!("displayName" in item) || typeof item.displayName === "string"),
  ) && value.products.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "slug" in item && typeof item.slug === "string" &&
    "title" in item && typeof item.title === "string" &&
    "image" in item && (typeof item.image === "string" || item.image === null),
  ) && value.manageableAreaIds.every((areaId) => typeof areaId === "string");
}

function objectiveLoadFallback(status: number) {
  if (status === 503) return "A estrutura do Supabase está incompleta. Aplique as migrações dos objectivos, áreas e prazos.";
  if (status === 401) return "A sessão expirou. Inicie sessão novamente.";
  if (status === 403) return "A sua conta não tem permissão para consultar os objectivos.";
  return "Não foi possível carregar os objectivos. Verifique a ligação ao Supabase e tente novamente.";
}

function ObjectiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#eee9e6] bg-white p-4">
      <p className="text-[10px] font-semibold text-[#918783]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#342c2d]">{value}</p>
    </div>
  );
}

function ObjectiveReportExport() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [date, setDate] = useState(luandaToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download(format: "csv" | "pdf") {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ period, date, format });
      const response = await fetch(`/api/backoffice/objectives/reports?${query}`, { cache: "no-store" });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const code = typeof result === "object" && result !== null && "error" in result
          ? result.error
          : null;
        throw new Error(messageForApiError(code, reportExportFallback(response.status)));
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ??
        `kitadi-relatorio-objectivos-${period}-${date}.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível exportar o relatório.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Exportar relatório de objectivos" className="mt-4 rounded-[18px] border border-[#eee9e6] bg-white p-4 sm:flex sm:items-end sm:justify-between sm:gap-4">
      <div>
        <div className="flex items-center gap-3">
          <Image
            alt="Kitadi"
            className="h-auto w-[86px] shrink-0"
            height={36}
            src="/kitadi-logo.png"
            width={88}
          />
          <div>
            <h2 className="text-sm font-bold text-[#342c2d]">Relatório de objectivos</h2>
            <p className="mt-1 text-[10px] leading-4 text-[#918783]">
              Objectivos criados ou actualizados e progresso registado. Não inclui actividade comercial.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-[10px] font-semibold text-[#817773]">
            Período
            <select className="mt-1 block min-h-9 rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]" onChange={(event) => setPeriod(event.target.value as ReportPeriod)} value={period}>
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold text-[#817773]">
            Data de referência
            <input className="mt-1 block min-h-9 rounded-xl border border-[#e9e3e0] px-3 text-[11px] text-[#302829]" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
        </div>
        {error ? <p className="mt-2 text-[10px] text-red-700" role="alert">{error}</p> : null}
      </div>
      <div className="mt-3 flex gap-2 sm:mt-0">
        <button className="min-h-9 rounded-full border border-[#e9e3e0] px-4 text-[10px] font-semibold text-[#625858] disabled:opacity-50" disabled={busy || !date} onClick={() => void download("csv")} type="button">
          {busy ? "A preparar…" : "Descarregar CSV"}
        </button>
        <button className="min-h-9 rounded-full bg-[#510f1d] px-4 text-[10px] font-semibold text-white disabled:opacity-50" disabled={busy || !date} onClick={() => void download("pdf")} type="button">
          {busy ? "A preparar…" : "Descarregar PDF"}
        </button>
      </div>
    </section>
  );
}

function reportExportFallback(status: number) {
  if (status === 401) return "A sessão expirou. Inicie sessão novamente.";
  if (status === 403) return "Não tem permissão para exportar este relatório.";
  return "Não foi possível exportar o relatório. Tente novamente e consulte os registos do servidor se o erro persistir.";
}

type ObjectiveFilterState = {
  objectives: Objective[];
  checkins: ObjectiveCheckIn[];
  collaborators: ObjectiveCollaborator[];
  manageableAreaIds: string[];
  userId: string;
  today: string;
  query: string;
  periodFilter: "all" | ObjectivePeriodType;
  scopeFilter: "all" | Objective["scope_type"];
  areaFilter: string;
  personFilter: string;
  productFilter: string;
  statusFilter: "open" | "active" | "inactive" | "archived" | "all";
  situationFilter: "all" | "no_checkin" | "in_progress" | "complete" | "soon" | "overdue";
  shapeFilter: "all" | "with_krs" | "without_krs";
};

function areasForPerson(
  personId: string,
  collaborators: ObjectiveCollaborator[],
  currentUserId: string,
  manageableAreaIds: string[],
) {
  const listed = collaborators.find((person) => person.id === personId)?.areaIds ?? [];
  if (personId !== currentUserId) return listed;
  return [...new Set([...listed, ...manageableAreaIds])];
}

function objectiveBelongsToPerson(
  objective: Objective,
  personId: string,
  collaborators: ObjectiveCollaborator[],
  currentUserId: string,
  manageableAreaIds: string[],
) {
  if (objective.assigned_to === personId) return true;
  const areas = areasForPerson(personId, collaborators, currentUserId, manageableAreaIds);
  return objective.scope_type === "department" &&
    objective.area_id !== null &&
    areas.includes(objective.area_id);
}

function objectiveMatchesFilters(objective: Objective, filters: ObjectiveFilterState) {
  if (filters.statusFilter === "archived" && !objective.archived) return false;
  if (filters.statusFilter === "open" && objective.archived) return false;
  if (filters.statusFilter === "active" && (!objective.active || objective.archived)) return false;
  if (filters.statusFilter === "inactive" && (objective.active || objective.archived)) return false;
  if (filters.periodFilter !== "all" && objective.period_type !== filters.periodFilter) return false;
  if (filters.scopeFilter !== "all" && objective.scope_type !== filters.scopeFilter) return false;
  if (filters.areaFilter !== "all" && objective.area_id !== filters.areaFilter) return false;
  if (filters.productFilter === "none" && objective.product_id) return false;
  if (filters.productFilter !== "all" && filters.productFilter !== "none" && objective.product_id !== filters.productFilter) return false;
  if (filters.personFilter !== "all") {
    const personId = filters.personFilter === "mine" ? filters.userId : filters.personFilter;
    if (!objectiveBelongsToPerson(
      objective,
      personId,
      filters.collaborators,
      filters.userId,
      filters.manageableAreaIds,
    )) return false;
  }
  const keyResults = filters.objectives.filter((item) => item.parent_objective_id === objective.id);
  if (filters.shapeFilter === "with_krs" && keyResults.length === 0) return false;
  if (filters.shapeFilter === "without_krs" && keyResults.length > 0) return false;
  const needle = filters.query.trim().toLocaleLowerCase("pt");
  if (needle) {
    const haystack = [objective.title, objective.description, ...keyResults.map((item) => item.title)]
      .join(" ")
      .toLocaleLowerCase("pt");
    if (!haystack.includes(needle)) return false;
  }
  const latest = filters.checkins.find((item) => item.objective_id === objective.id);
  const complete = isObjectiveComplete(objective, latest?.value);
  const dueWarning = objective.archived || complete ? null : objectiveDueWarning(objective.due_date, filters.today);
  if (filters.situationFilter === "no_checkin" && latest) return false;
  if (filters.situationFilter === "in_progress" && (!latest || complete)) return false;
  if (filters.situationFilter === "complete" && !complete) return false;
  if (filters.situationFilter === "soon" && dueWarning?.level !== "soon") return false;
  if (filters.situationFilter === "overdue" && dueWarning?.level !== "overdue") return false;
  return true;
}

function ObjectiveFilters({
  query,
  periodFilter,
  scopeFilter,
  areaFilter,
  personFilter,
  productFilter,
  statusFilter,
  situationFilter,
  shapeFilter,
  areas,
  people,
  products,
  resultCount,
  filtersNarrowed,
  onQuery,
  onPeriodFilter,
  onScopeFilter,
  onAreaFilter,
  onPersonFilter,
  onProductFilter,
  onStatusFilter,
  onSituationFilter,
  onShapeFilter,
  onClear,
}: {
  query: string;
  periodFilter: ObjectiveFilterState["periodFilter"];
  scopeFilter: ObjectiveFilterState["scopeFilter"];
  areaFilter: string;
  personFilter: string;
  productFilter: string;
  statusFilter: ObjectiveFilterState["statusFilter"];
  situationFilter: ObjectiveFilterState["situationFilter"];
  shapeFilter: ObjectiveFilterState["shapeFilter"];
  areas: ObjectiveArea[];
  people: ObjectiveCollaborator[];
  products: ObjectiveProduct[];
  resultCount: number;
  filtersNarrowed: boolean;
  onQuery: (value: string) => void;
  onPeriodFilter: (value: ObjectiveFilterState["periodFilter"]) => void;
  onScopeFilter: (value: ObjectiveFilterState["scopeFilter"]) => void;
  onAreaFilter: (value: string) => void;
  onPersonFilter: (value: string) => void;
  onProductFilter: (value: string) => void;
  onStatusFilter: (value: ObjectiveFilterState["statusFilter"]) => void;
  onSituationFilter: (value: ObjectiveFilterState["situationFilter"]) => void;
  onShapeFilter: (value: ObjectiveFilterState["shapeFilter"]) => void;
  onClear: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const controlClass = "h-8 rounded-full border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]";
  const extraCount = [
    scopeFilter !== "all",
    areaFilter !== "all",
    productFilter !== "all",
    statusFilter !== "open",
    situationFilter !== "all",
    shapeFilter !== "all",
  ].filter(Boolean).length;
  const periods = [
    { id: "all", label: "Todos" },
    { id: "daily", label: "Diário" },
    { id: "weekly", label: "Semanal" },
    { id: "monthly", label: "Mensal" },
    { id: "annual", label: "Anual" },
  ] as const;
  return (
    <section aria-label="Filtros de objectivos" className="mt-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          aria-label="Procurar objectivo"
          className={`${controlClass} w-40 max-w-full`}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Procurar"
          value={query}
        />
        <select
          aria-label="Pessoa"
          className={`${controlClass} max-w-full`}
          onChange={(event) => onPersonFilter(event.target.value)}
          title="Os meus mostra objectivos atribuídos a si e os do departamento de que faz parte."
          value={personFilter}
        >
          <option value="mine">Os meus</option>
          <option value="all">Todas as pessoas</option>
          {people.map((person) => <option key={person.id} value={person.id}>{personLabel(person.displayName, person.email)}</option>)}
        </select>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por período">
          {periods.map((item) => (
            <button
              aria-pressed={periodFilter === item.id}
              className={`h-8 rounded-full px-2.5 text-[11px] font-semibold ${periodFilter === item.id ? "bg-[#510f1d] text-white" : "border border-[#e9e3e0] text-[#625858]"}`}
              key={item.id}
              onClick={() => onPeriodFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          aria-expanded={moreOpen}
          className={`h-8 rounded-full px-3 text-[11px] font-semibold ${moreOpen || extraCount > 0 ? "bg-[#f7f3ed] text-[#762838]" : "border border-[#e9e3e0] text-[#625858]"}`}
          onClick={() => setMoreOpen((current) => !current)}
          type="button"
        >
          {moreOpen ? "Menos filtros" : extraCount > 0 ? `Mais filtros · ${extraCount}` : "Mais filtros"}
        </button>
        {filtersNarrowed ? (
          <button className="h-8 rounded-full px-2.5 text-[11px] font-semibold text-[#8a5b38]" onClick={onClear} type="button">
            Limpar
          </button>
        ) : null}
        <span className="px-1 text-[11px] text-[#817773]">{resultCount}</span>
      </div>
      {moreOpen ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <select aria-label="Âmbito" className={controlClass} onChange={(event) => onScopeFilter(event.target.value as ObjectiveFilterState["scopeFilter"])} value={scopeFilter}>
            <option value="all">Âmbito</option>
            <option value="company">Empresa</option>
            <option value="department">Departamento</option>
            <option value="collaborator">Pessoa</option>
          </select>
          <select aria-label="Área" className={controlClass} onChange={(event) => onAreaFilter(event.target.value)} value={areaFilter}>
            <option value="all">Área</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
          <select aria-label="Produto" className={controlClass} onChange={(event) => onProductFilter(event.target.value)} value={productFilter}>
            <option value="all">Produto</option>
            <option value="none">Sem produto</option>
            {products.map((product) => <option key={product.slug} value={product.slug}>{product.title}</option>)}
          </select>
          <select aria-label="Estado" className={controlClass} onChange={(event) => onStatusFilter(event.target.value as ObjectiveFilterState["statusFilter"])} value={statusFilter}>
            <option value="open">Não arquivados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="archived">Arquivados</option>
            <option value="all">Todos os estados</option>
          </select>
          <select aria-label="Situação" className={controlClass} onChange={(event) => onSituationFilter(event.target.value as ObjectiveFilterState["situationFilter"])} value={situationFilter}>
            <option value="all">Situação</option>
            <option value="no_checkin">Sem check-in</option>
            <option value="in_progress">Em progresso</option>
            <option value="complete">Concluídos</option>
            <option value="soon">Prazo próximo</option>
            <option value="overdue">Atrasados</option>
          </select>
          <select aria-label="Forma" className={controlClass} onChange={(event) => onShapeFilter(event.target.value as ObjectiveFilterState["shapeFilter"])} value={shapeFilter}>
            <option value="all">Forma</option>
            <option value="with_krs">Com key results</option>
            <option value="without_krs">Só o objectivo</option>
          </select>
        </div>
      ) : null}
    </section>
  );
}

function ObjectivePeriodBadge({ period }: { period: ObjectivePeriodType | null }) {
  if (!period) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${periodBadgeClass(period)}`}>
      {periodTypeLabel(period)}
    </span>
  );
}

function ObjectiveScopeBadge({ scope }: { scope: Objective["scope_type"] }) {
  const label = scope === "company" ? "Empresa" : scope === "department" ? "Departamento" : "Pessoa";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${scopeBadgeClass(scope)}`}>
      {label}
    </span>
  );
}

function periodBadgeClass(period: ObjectivePeriodType) {
  switch (period) {
    case "daily": return "bg-[#e7f3f8] text-[#2d627c]";
    case "weekly": return "bg-[#f0e9f1] text-[#6e4b71]";
    case "monthly": return "bg-[#f8f1e4] text-[#8a6232]";
    case "annual": return "bg-[#f6ecee] text-[#8d3d4a]";
  }
}

function scopeBadgeClass(scope: Objective["scope_type"]) {
  switch (scope) {
    case "company": return "bg-[#f4f1ef] text-[#6a615e]";
    case "department": return "bg-[#f7f3ed] text-[#7a6858]";
    case "collaborator": return "bg-[#eef4ef] text-[#4d6b57]";
  }
}

function periodAccentClass(period: ObjectivePeriodType | null) {
  switch (period) {
    case "daily": return "border-l-[#3d7ea6]";
    case "weekly": return "border-l-[#7a4e86]";
    case "monthly": return "border-l-[#c4923a]";
    case "annual": return "border-l-[#8d3d4a]";
    default: return "border-l-transparent";
  }
}

function periodTypeLabel(type: ObjectivePeriodType) {
  switch (type) {
    case "annual": return "Anual";
    case "monthly": return "Mensal";
    case "weekly": return "Semanal";
    case "daily": return "Diário";
  }
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
