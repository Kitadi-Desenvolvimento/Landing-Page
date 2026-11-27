const apiErrorMessages: Record<string, string> = {
  unauthorized: "A sessão expirou. Inicie sessão novamente.",
  forbidden: "Não tem permissão para esta acção.",
  invalid_origin: "O pedido não veio deste site. Actualize a página e tente novamente.",
  invalid_request: "O pedido não foi aceite. Actualize a página e tente novamente.",
  invalid_json: "O pedido não foi aceite. Actualize a página e tente novamente.",
  invalid_content_type: "O formato do pedido não foi aceite.",
  request_too_large: "O pedido é demasiado grande.",
  payload_too_large: "O pedido é demasiado grande.",
  invalid_id: "O identificador enviado não é válido.",
  supabase_not_configured: "O serviço de convites não está configurado no servidor.",

  invalid_objective_assignee:
    "Esta pessoa não pertence ao departamento seleccionado. Atribua-a à área em Equipa, ou grave o objectivo sem departamento.",
  invalid_objective_area: "O departamento escolhido não existe ou está inactivo.",
  invalid_objective: "Verifique o nome, o âmbito, o período e a meta do objectivo.",
  objective_scope_forbidden: "Não tem permissão para gerir objectivos neste âmbito.",
  invalid_parent_objective: "O objectivo principal escolhido não pode receber este key result.",
  invalid_objective_alignment: "O alinhamento escolhido não corresponde ao âmbito, à área ou ao período.",
  parent_objective_immutable: "Um key result não pode mudar de objectivo principal.",
  objective_archived: "Este objectivo está arquivado.",
  objective_inactive: "Este objectivo está inactivo.",
  objective_not_found: "Este objectivo já não existe.",
  objective_parent_inactive: "O objectivo principal está inactivo ou arquivado.",
  objective_access_unavailable: "Não foi possível verificar o acesso aos objectivos. Tente novamente.",
  objective_validation_unavailable: "Não foi possível validar o objectivo. Tente novamente.",
  objective_unavailable: "Não foi possível actualizar o objectivo. Tente novamente.",
  objective_create_failed: "Não foi possível criar o objectivo. Tente novamente.",
  objective_update_failed: "Não foi possível guardar o objectivo. Tente novamente.",
  objective_archive_failed: "Não foi possível alterar o estado do objectivo. Tente novamente.",
  invalid_archive_state: "O estado de arquivo enviado não é válido.",
  invalid_checkin: "O check-in enviado não é válido.",
  invalid_checkin_value: "O valor do check-in não corresponde ao tipo do objectivo.",
  already_checked_in_today: "O check-in diário deste objectivo já foi registado.",
  checkin_unavailable: "Não foi possível consultar o check-in. Tente novamente.",
  checkin_save_failed: "Não foi possível guardar o check-in. Tente novamente.",
  checkin_update_failed: "Não foi possível guardar a alteração. Tente novamente.",
  checkin_not_found: "Este check-in já não existe.",
  objectives_schema_missing:
    "A estrutura de objectivos, âmbitos e períodos ainda não existe. Aplique as migrações de objectivos 20261113020000, 20261113030000, 20261113040000, 20261113080000 e 20261124010000 no Supabase.",
  areas_schema_missing: "As tabelas das áreas ainda não existem. Aplique a migração 20261113030000 no Supabase.",
  checkins_schema_missing:
    "A estrutura dos check-ins ainda não está actualizada. Aplique as migrações 20261113020000 e 20261113030000 no Supabase.",
  checkin_edits_schema_missing: "O histórico de edições ainda não existe. Aplique a migração 20261113030000 no Supabase.",
  area_access_unavailable:
    "Não foi possível verificar as áreas atribuídas. Confirme se a migração 20261113030000 foi aplicada.",
  objectives_unavailable:
    "O Supabase não conseguiu carregar os dados. Tente novamente e consulte os registos do servidor se o erro persistir.",
  areas_unavailable:
    "O Supabase não conseguiu carregar os dados. Tente novamente e consulte os registos do servidor se o erro persistir.",
  checkins_unavailable:
    "O Supabase não conseguiu carregar os dados. Tente novamente e consulte os registos do servidor se o erro persistir.",
  checkin_edits_unavailable:
    "O Supabase não conseguiu carregar os dados. Tente novamente e consulte os registos do servidor se o erro persistir.",
  invalid_report: "O período do relatório não é válido.",
  invalid_report_date: "A data de referência do relatório não é válida.",
  report_schema_missing:
    "A estrutura do relatório não está instalada. Aplique a migração de histórico de actividades no Supabase.",
  report_unavailable: "Não foi possível gerar o relatório. Tente novamente.",

  invalid_area: "O nome da área não é válido.",
  invalid_area_name: "O nome da área não é válido.",
  area_already_exists: "Já existe uma área com esse nome.",
  area_not_found: "Esta área já não existe.",
  area_create_failed: "Não foi possível criar a área. Tente novamente.",
  area_update_failed: "Não foi possível actualizar a área. Tente novamente.",
  area_membership_forbidden: "Só pode atribuir pessoas às áreas que gere.",
  invalid_area_membership: "Uma das áreas escolhidas não existe.",

  invalid_team_update: "Os dados de acesso enviados não são válidos.",
  invalid_team_delete: "Não foi possível identificar a conta a apagar.",
  role_change_forbidden: "Não tem permissão para alterar funções.",
  user_not_found: "Esta conta já não existe.",
  cannot_revoke_self: "Não pode retirar o seu próprio acesso.",
  cannot_revoke_last_admin: "Não é possível retirar o acesso ao último administrador.",
  cannot_delete_self: "Não pode apagar a sua própria conta.",
  cannot_delete_last_admin: "Não é possível apagar o último administrador.",
  membership_update_failed: "Não foi possível actualizar as áreas desta pessoa.",
  role_update_failed: "Não foi possível actualizar a função desta pessoa.",
  account_delete_failed: "Não foi possível apagar a conta desta pessoa.",
  team_unavailable: "Não foi possível consultar a equipa. Tente novamente.",
  invalid_display_name: "O nome deve ter no máximo 80 caracteres.",
  profile_schema_missing: "Aplique a migração dos nomes da equipa no Supabase.",
  profile_unavailable: "Não foi possível guardar o nome. Tente novamente.",
  invalid_block: "Indique um motivo e até 12 pessoas da equipa.",
  invalid_block_person: "Uma das pessoas escolhidas não pode ser marcada neste bloqueio.",
  block_subject_not_found: "Este registo já não está disponível para bloqueio.",
  blocks_schema_missing: "Aplique a migração dos bloqueios no Supabase.",
  blocks_unavailable: "Não foi possível guardar o bloqueio. Tente novamente.",
  command_unavailable: "Não foi possível carregar o dashboard. Tente novamente.",
  notifications_unavailable: "Não foi possível carregar as notificações. Tente novamente.",
  notifications_dismiss_unavailable: "Aplique a migração 20261127080000 no Supabase para poder eliminar notificações.",
  invalid_notification: "Não foi possível eliminar esta notificação.",
  invalid_period: "O período escolhido não é válido.",

  invalid_invite: "O convite enviado não é válido.",
  invalid_email: "Indique um email válido.",
  invalid_role: "A função escolhida não é válida.",
  invite_exists: "Não foi possível convidar esse endereço. Verifique se já tem conta.",
  invite_unavailable: "Não foi possível gerar o link. Verifique a configuração do Supabase e tente novamente.",
  invite_link_missing: "O Supabase não devolveu o link. Tente novamente.",
  invite_role_update_failed:
    "Não foi possível atribuir a função à pessoa convidada. Contacte o suporte antes de gerar outro link.",
  invite_areas_update_failed:
    "O link foi gerado, mas não foi possível atribuir as áreas. Reveja os acessos da equipa.",

  commercial_not_configured:
    "Aplique as migrações do CRM no Supabase, incluindo a que exige o motivo da mudança de etapa.",
  commercial_unavailable: "Não foi possível consultar o funil comercial. Tente novamente.",
  commercial_create_failed: "Não foi possível registar o contacto. Tente novamente.",
  commercial_update_failed: "Não foi possível guardar as alterações desta oportunidade.",
  contact_owner_not_ready: "Aplique a migração do comercial responsável para guardar esta pessoa.",
  commercial_stage_locked: "Os pagamentos confirmados permanecem na etapa Convertido.",
  stage_change_reason_required: "Explique o motivo da mudança de etapa.",
  lost_reason_required: "Indique o motivo da perda.",
  invalid_contact: "Verifique o nome, o email, o telefone e os dados da oportunidade.",
  invalid_update: "As alterações enviadas não são válidas.",
  opportunity_not_found: "Esta oportunidade já não existe.",
  commercial_report_schema_missing:
    "O histórico comercial não está disponível. Confirme se as migrações do CRM, incluindo a 20261124020000, foram aplicadas no Supabase.",
  commercial_report_unavailable: "Não foi possível gerar o relatório comercial. Tente novamente.",

  product_already_exists: "Já existe um produto com este nome.",
  invalid_product: "Verifique os campos, preços e use o caminho de uma imagem existente.",
  invalid_product_slug: "O nome do produto não gera um endereço válido.",
  checkout_not_available:
    "Para activar o pagamento, configure um preço válido e, para formações, preços válidos em todas as variantes.",
  product_not_found: "O produto escolhido já não existe.",
  product_load_failed: "Não foi possível consultar o produto. Tente novamente.",
  product_check_failed: "Não foi possível verificar se o produto já existe. Tente novamente.",
  product_order_failed: "Não foi possível definir a ordem do produto. Tente novamente.",
  product_create_failed: "Não foi possível criar o produto. Tente novamente.",
  product_update_failed: "Não foi possível guardar o produto. Tente novamente.",
  invalid_ebook: "O ficheiro do e-book não foi aceite.",
  ebook_invalid_pdf:
    "O ficheiro não é um PDF válido ou já está protegido por palavra-passe. Carregue o PDF original, sem protecção.",
  ebook_too_large: "O PDF não pode ter mais de 50 MB.",
  ebook_requires_simple_product: "Os e-books só podem ser associados a produtos simples, sem variantes de formação.",
  ebook_storage_unavailable: "Não foi possível guardar o e-book. Tente novamente.",
  ebook_original_missing: "Este produto ainda não tem o PDF original.",
  ebook_generation_failed: "Não foi possível gerar o PDF.",
  ebook_upload_failed: "Não foi possível enviar o PDF. Tente novamente.",
  not_an_ebook: "Esta compra não inclui um e-book.",

  invalid_filters: "Os filtros de participantes não são válidos.",
  invalid_reference: "A referência enviada não é válida.",
  attendee_not_found: "Este participante já não existe.",
  attendees_unavailable: "Não foi possível carregar a lista de participantes. Tente novamente.",
  payment_not_confirmed: "Só é possível registar presença de pagamentos concluídos.",
  payment_ledger_not_configured: "Aplique as migrações de pagamentos e participantes no Supabase.",
  payment_not_found: "Este pagamento já não existe.",

  ledger_not_migrated: "Aplique a migração 20261122000000_add_payment_reconciliation.sql no Supabase.",
  duplicate_reference: "Já existe um levantamento activo com esta referência WiPay.",
  invalid_payment: "Verifique os dados do pagamento: valor, email, telefone e uma data que não seja futura.",
  invalid_withdrawal: "Verifique o valor, a referência WiPay e a data. A data não pode ser futura.",
  invalid_variant: "Escolha uma variante válida do produto.",
  payment_not_found_or_not_accepted: "Só pagamentos concluídos podem ser alterados.",
  withdrawal_not_found_or_voided: "Este levantamento já foi anulado ou não existe.",
  period_closed: "Este mês está fechado. Reabra-o em Fecho e relatórios para alterar.",
  invalid_expense: "Verifique a data, a categoria, o fornecedor, a descrição e o valor. A data não pode ser futura.",
  expense_not_found_or_voided: "Esta despesa já foi anulada ou não existe.",
  period_not_ended: "Só é possível fechar meses que já terminaram.",
  period_already_closed: "Este mês já está fechado.",
  period_has_unreconciled: "Ainda há movimentos por conciliar neste mês.",
  period_not_closed: "Este mês não está fechado.",
  period_has_pending_fixed: "Ainda há despesas fixas por lançar neste mês.",
  period_not_started: "Só é possível lançar fixas de meses já iniciados.",
  invalid_end_month: "O último mês não pode ser anterior ao mês de início.",
  invalid_recurring: "Verifique a categoria, o fornecedor, a descrição, o valor, o dia (1 a 31) e o mês de início.",
  invalid_launch: "Verifique os valores a lançar.",
  recurring_not_found: "Esta despesa fixa já não existe.",
  invalid_action: "Esta acção não é válida.",
  expense_update_failed: "Não foi possível actualizar a despesa. Tente novamente.",
  expense_failed: "Não foi possível registar a despesa. Tente novamente.",
  payment_update_failed: "Não foi possível actualizar o pagamento. Tente novamente.",
  manual_payment_failed: "Não foi possível registar o pagamento. Tente novamente.",
  withdrawal_update_failed: "Não foi possível actualizar o levantamento. Tente novamente.",
  withdrawal_failed: "Não foi possível registar o levantamento. Tente novamente.",
  recurring_failed: "Não foi possível guardar a despesa fixa. Tente novamente.",
  closure_failed: "Não foi possível actualizar o fecho do mês. Tente novamente.",
  invalid_export: "O mês ou o tipo de exportação não é válido.",
  export_failed: "Não foi possível exportar. Tente novamente.",
};

export function apiErrorCode(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return null;
}

export function messageForApiError(code: unknown, fallback: string) {
  if (typeof code === "string" && code in apiErrorMessages) {
    return apiErrorMessages[code];
  }
  return fallback;
}

export function messageFromApiBody(body: unknown, fallback: string) {
  return messageForApiError(apiErrorCode(body), fallback);
}
