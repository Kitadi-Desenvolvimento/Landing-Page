type CommercialEvent = {
  eventType: string;
  fromStage: string | null;
  toStage: string | null;
  paymentStatus: string | null;
  details: string;
};

const commercialStageNames: Record<string, string> = {
  new_contact: "Novo contacto",
  in_conversation: "Em conversa",
  proposal_sent: "Proposta enviada",
  converted: "Convertido",
  lost: "Perdido",
};

function paymentStatusName(status: string | null) {
  switch (status) {
    case "pending": return "continua a aguardar confirmação";
    case "accepted": return "foi confirmado";
    case "rejected": return "foi recusado";
    case "expired": return "expirou";
    case "canceled": return "foi cancelado";
    case "refunded": return "foi reembolsado";
    default: return "";
  }
}

function stageChangeReason(details: string) {
  const reasonPrefix = "Motivo da mudança:";
  if (details.startsWith(reasonPrefix)) {
    return details.slice(reasonPrefix.length).split(" Motivo da perda:")[0].trim();
  }
  if (details.startsWith("Marcada como perdida:")) {
    return details.slice("Marcada como perdida:".length).trim();
  }
  return "";
}

export function describeCommercialEvent(event: CommercialEvent, subject: string) {
  if (event.fromStage && event.toStage) {
    const from = commercialStageNames[event.fromStage] ?? "uma etapa anterior";
    const to = commercialStageNames[event.toStage] ?? "uma nova etapa";
    const reason = stageChangeReason(event.details);
    if (reason === "Pagamento confirmado automaticamente.") {
      return `A oportunidade «${subject}» passou de «${from}» para «${to}» depois de o pagamento ser confirmado automaticamente.`;
    }
    if (reason === "Etapa actualizada automaticamente pelo sistema.") {
      return `A oportunidade «${subject}» passou de «${from}» para «${to}» através de uma actualização automática do sistema.`;
    }
    if (reason) {
      let description = `A oportunidade «${subject}» passou de «${from}» para «${to}». Motivo indicado: ${reason}`;
      const lossReason = event.details.match(/Motivo da perda:\s*(.+)$/)?.[1]?.trim();
      if (lossReason && lossReason !== reason) {
        description += ` Motivo da perda: ${lossReason}`;
      }
      return description;
    }
    return `A oportunidade «${subject}» passou de «${from}» para «${to}». Não foi guardada uma explicação para esta mudança.`;
  }

  if (event.eventType === "created") {
    return event.details.includes("checkout")
      ? `A oportunidade «${subject}» foi criada automaticamente após uma inscrição no site.`
      : `A equipa registou manualmente a oportunidade «${subject}».`;
  }
  if (event.eventType === "payment_updated") {
    const status = paymentStatusName(event.paymentStatus);
    let description = status
      ? `O pagamento relacionado com «${subject}» ${status}.`
      : `O estado do pagamento relacionado com «${subject}» foi actualizado.`;
    if (event.details && !event.details.startsWith("Estado de pagamento actualizado.")) {
      description += ` Informação adicional: ${event.details}`;
    }
    return description;
  }
  if (event.eventType === "details_updated") {
    let description = `A equipa actualizou as notas ou a data do próximo contacto de «${subject}».`;
    if (event.details && !event.details.startsWith("Detalhes ou seguimento actualizados.")) {
      description += ` Informação adicional: ${event.details}`;
    }
    return description;
  }
  return event.details || `Foi registada uma actividade em «${subject}».`;
}

export function describeObjectiveProgress({
  title,
  scope,
  value,
  note,
  previous = false,
  currentValue = "",
  currentNote = "",
}: {
  title: string;
  scope: string;
  value: string;
  note: string;
  previous?: boolean;
  currentValue?: string;
  currentNote?: string;
}) {
  if (previous) {
    return `O registo de progresso no objectivo «${title}» foi corrigido. O valor passou de «${value || "não indicado"}» para «${currentValue || "não indicado"}».${note ? ` Observação anterior: ${note}.` : ""}${currentNote ? ` Observação actual: ${currentNote}` : ""}`;
  }
  return `Foi registado progresso no objectivo «${title}», ${scope}. Valor registado: ${value || "não indicado"}.${note ? ` Observação: ${note}` : ""}`;
}

export function describeObjectiveChange(
  eventType: string,
  title: string,
  scope: string,
) {
  if (eventType === "created") return `Foi criado o objectivo «${title}» ${scope}.`;
  if (eventType === "archived") {
    return `O objectivo «${title}», ${scope}, foi arquivado e deixou de estar activo.`;
  }
  if (eventType === "restored") return `O objectivo «${title}», ${scope}, foi reactivado.`;
  return `Os dados do objectivo «${title}», ${scope}, foram actualizados.`;
}

export function objectiveEventLabel(eventType: string) {
  if (eventType === "created") return "Objectivo criado";
  if (eventType === "archived") return "Objectivo arquivado";
  if (eventType === "restored") return "Objectivo reactivado";
  return "Objectivo actualizado";
}

export function commercialEventLabel(eventType: string) {
  switch (eventType) {
    case "created": return "Nova oportunidade";
    case "stage_changed": return "Etapa alterada";
    case "payment_updated": return "Pagamento actualizado";
    case "details_updated": return "Acompanhamento actualizado";
    default: return "Actividade comercial";
  }
}
