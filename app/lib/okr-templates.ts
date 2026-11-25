import type { ObjectivePeriodType } from "./objective-periods";

export type OkrTemplateMetric = "number" | "percentage" | "currency";

export type OkrTemplateKeyResult = {
  title: string;
  valueType: OkrTemplateMetric;
  target: number;
  unit: string;
};

export type OkrTemplate = {
  id: string;
  period: Extract<ObjectivePeriodType, "daily" | "weekly" | "monthly">;
  title: string;
  description: string;
  keyResults: [OkrTemplateKeyResult, OkrTemplateKeyResult, OkrTemplateKeyResult];
};

const note = "Exemplo pronto a usar. Ajuste o texto, as metas, a área e a data à sua realidade.";

function okr(
  id: string,
  period: OkrTemplate["period"],
  title: string,
  keyResults: [OkrTemplateKeyResult, OkrTemplateKeyResult, OkrTemplateKeyResult],
): OkrTemplate {
  return { id, period, title, description: note, keyResults };
}

function metric(
  title: string,
  valueType: OkrTemplateMetric,
  target: number,
  unit: string,
): OkrTemplateKeyResult {
  return { title, valueType, target, unit };
}

export const okrTemplates: OkrTemplate[] = [
  okr("m01", "monthly", "Vender a campanha do mês até à meta", [
    metric("Vendas com pagamento aceite", "number", 40, "vendas"),
    metric("Propostas com preço enviadas", "number", 80, "propostas"),
    metric("Propostas que se convertem em venda", "percentage", 50, "%"),
  ]),
  okr("m02", "monthly", "Fazer a receita comercial do mês bater a meta", [
    metric("Receita com pagamento aceite", "currency", 6000000, "Kz"),
    metric("Vendas fechadas no mês", "number", 25, "vendas"),
    metric("Oportunidades criadas que fecham no mês", "percentage", 25, "%"),
  ]),
  okr("m03", "monthly", "Trazer vendas de empresas para a receita", [
    metric("Empresas que chegam a proposta enviada", "number", 8, "empresas"),
    metric("Programas empresariais com pagamento aceite", "number", 2, "programas"),
    metric("Receita aceite em vendas a empresas", "currency", 3000000, "Kz"),
  ]),
  okr("m04", "monthly", "Aumentar o valor de cada venda", [
    metric("Ticket médio das vendas aceites", "currency", 180000, "Kz"),
    metric("Vendas com segundo produto ou mais participantes", "number", 5, "vendas"),
    metric("Propostas enviadas ao preço de tabela", "percentage", 90, "%"),
  ]),
  okr("m05", "monthly", "Fechar o que já foi proposto", [
    metric("Propostas do mês que passam a pagamento aceite", "percentage", 30, "%"),
    metric("Dias médios entre a proposta e o pagamento", "number", 10, "dias"),
    metric("Sins verbais pagos ou com data de cobrança", "percentage", 100, "%"),
  ]),
  okr("m06", "monthly", "Encher a edição em destaque", [
    metric("Inscrições pagas na edição", "number", 30, "inscrições"),
    metric("Interessados qualificados que recebem proposta", "percentage", 80, "%"),
    metric("Receita aceite ligada a essa edição", "currency", 4000000, "Kz"),
  ]),
  okr("m07", "monthly", "Vender os bilhetes do evento do mês", [
    metric("Bilhetes com pagamento aceite", "number", 50, "bilhetes"),
    metric("Propostas ou reservas enviadas", "number", 90, "propostas"),
    metric("Reservas que se convertem em bilhete pago", "percentage", 55, "%"),
  ]),
  okr("m08", "monthly", "Abrir carteira de clientes novos", [
    metric("Clientes que compram pela primeira vez", "number", 20, "clientes"),
    metric("Primeiras reuniões com clientes novos", "number", 15, "reuniões"),
    metric("Novos contactos que chegam a proposta", "percentage", 40, "%"),
  ]),
  okr("m09", "monthly", "Voltar a vender a quem já comprou", [
    metric("Clientes antigos que compram de novo", "number", 8, "clientes"),
    metric("Ofertas de continuidade enviadas", "number", 20, "ofertas"),
    metric("Ofertas de continuidade que fecham", "percentage", 30, "%"),
  ]),
  okr("m10", "monthly", "Subir as propostas de valor mais alto", [
    metric("Propostas acima do valor definido", "number", 6, "propostas"),
    metric("Essas propostas que fecham", "number", 2, "vendas"),
    metric("Receita aceite nessas vendas", "currency", 2500000, "Kz"),
  ]),
  okr("m11", "monthly", "Cobrar todos os sins do mês", [
    metric("Aceitações que recebem dados de pagamento no próprio dia", "percentage", 100, "%"),
    metric("Pagamentos prometidos que são cobrados", "percentage", 100, "%"),
    metric("Valor ainda por cobrar no fecho do mês", "currency", 0, "Kz"),
  ]),
  okr("m12", "monthly", "Gerar vendas através de parceiros", [
    metric("Parceiros abordados", "number", 4, "parceiros"),
    metric("Indicações recebidas", "number", 10, "indicações"),
    metric("Vendas fechadas a partir de indicações", "number", 3, "vendas"),
  ]),
  okr("m13", "monthly", "Qualificar o pipeline antes de propor", [
    metric("Oportunidades qualificadas no mês", "number", 30, "oportunidades"),
    metric("Qualificadas que recebem proposta", "percentage", 70, "%"),
    metric("Propostas feitas sem qualificação", "number", 0, "propostas"),
  ]),
  okr("m14", "monthly", "Reduzir o tempo até à primeira proposta", [
    metric("Dias médios entre o primeiro contacto e a proposta", "number", 5, "dias"),
    metric("Contactos novos que recebem proposta em 7 dias", "percentage", 60, "%"),
    metric("Contactos novos sem proposta nem perda ao fim do mês", "number", 0, "contactos"),
  ]),
  okr("m15", "monthly", "Manter o preço de tabela na maior parte das vendas", [
    metric("Vendas fechadas ao preço de tabela", "percentage", 85, "%"),
    metric("Descontos concedidos com motivo escrito", "percentage", 100, "%"),
    metric("Desconto médio sobre o preço de tabela", "percentage", 10, "%"),
  ]),
  okr("m16", "monthly", "Converter interessados de formações abertas", [
    metric("Interessados contactados", "number", 40, "pessoas"),
    metric("Interessados que recebem condição de inscrição", "percentage", 100, "%"),
    metric("Inscrições pagas a partir desses interessados", "number", 12, "inscrições"),
  ]),
  okr("m17", "monthly", "Fechar programas à medida para organizações", [
    metric("Diagnósticos comerciais feitos", "number", 4, "diagnósticos"),
    metric("Propostas à medida enviadas", "number", 3, "propostas"),
    metric("Programas à medida com pagamento aceite", "number", 1, "programas"),
  ]),
  okr("m18", "monthly", "Deixar a receita do mês explicada", [
    metric("Pagamentos aceites ligados à oportunidade certa", "percentage", 100, "%"),
    metric("Vendas sem produto identificado", "number", 0, "vendas"),
    metric("Receita aceite reconciliada com o funil", "percentage", 100, "%"),
  ]),
  okr("w01", "weekly", "Fazer o funil avançar nesta semana", [
    metric("Contactos que passam a em conversa", "number", 10, "contactos"),
    metric("Propostas com preço, produto e pagamento", "number", 4, "propostas"),
    metric("Reuniões ou chamadas comerciais feitas", "number", 6, "reuniões"),
  ]),
  okr("w02", "weekly", "Pedir decisão às propostas maduras", [
    metric("Propostas com 7 dias ou mais que recebem pedido de decisão", "percentage", 100, "%"),
    metric("Propostas que fecham com pagamento aceite", "number", 2, "propostas"),
    metric("Propostas sem fecho que ficam perdidas ou com nova data", "percentage", 100, "%"),
  ]),
  okr("w03", "weekly", "Não deixar a carteira esfriar", [
    metric("Contactos parados há mais de 14 dias reactivados", "number", 5, "contactos"),
    metric("Perdidos da semana com motivo escrito", "percentage", 100, "%"),
    metric("Canais ou parceiros novos abordados", "number", 1, "parceiros"),
  ]),
  okr("w04", "weekly", "Encher a semana de conversas com preço", [
    metric("Conversas em que o preço é dito", "number", 8, "conversas"),
    metric("Dessas conversas que recebem proposta escrita", "percentage", 50, "%"),
    metric("Vendas fechadas na semana", "number", 3, "vendas"),
  ]),
  okr("w05", "weekly", "Gerar contactos novos suficientes", [
    metric("Contactos novos registados no funil", "number", 25, "contactos"),
    metric("Contactos novos com origem preenchida", "percentage", 100, "%"),
    metric("Contactos novos contactados na mesma semana", "percentage", 100, "%"),
  ]),
  okr("w06", "weekly", "Avançar as empresas em conversa", [
    metric("Empresas novas contactadas", "number", 5, "empresas"),
    metric("Reuniões com decisores", "number", 2, "reuniões"),
    metric("Propostas empresariais enviadas", "number", 1, "propostas"),
  ]),
  okr("w07", "weekly", "Cobrar os pagamentos prometidos da semana", [
    metric("Promessas de pagamento da semana cobradas", "percentage", 100, "%"),
    metric("Pagamentos aceites na semana", "number", 4, "pagamentos"),
    metric("Valor aceite na semana", "currency", 800000, "Kz"),
  ]),
  okr("w08", "weekly", "Preparar propostas com tudo o que a venda precisa", [
    metric("Propostas com produto, preço e o que está incluído", "number", 4, "propostas"),
    metric("Propostas com forma de pagamento indicada", "percentage", 100, "%"),
    metric("Propostas enviadas até 48 horas após a reunião", "percentage", 80, "%"),
  ]),
  okr("w09", "weekly", "Limpar oportunidades sem próximo passo", [
    metric("Oportunidades activas sem data de follow-up no fecho", "number", 0, "oportunidades"),
    metric("Fichas actualizadas com nota", "number", 15, "fichas"),
    metric("Oportunidades paradas há 21 dias decididas", "percentage", 100, "%"),
  ]),
  okr("w10", "weekly", "Recuperar propostas sem resposta", [
    metric("Propostas sem resposta há mais de 7 dias com follow-up", "percentage", 100, "%"),
    metric("Essas propostas que respondem", "number", 3, "respostas"),
    metric("Essas propostas que fecham ou são perdidas com motivo", "percentage", 100, "%"),
  ]),
  okr("w11", "weekly", "Pedir referências a quem já está em conversa", [
    metric("Pedidos de referência feitos", "number", 5, "pedidos"),
    metric("Indicações recebidas", "number", 3, "indicações"),
    metric("Indicações que entram no funil", "percentage", 100, "%"),
  ]),
  okr("w12", "weekly", "Confirmar interessados numa edição aberta", [
    metric("Interessados contactados", "number", 12, "pessoas"),
    metric("Interessados com vaga e preço confirmados", "percentage", 100, "%"),
    metric("Inscrições pagas na semana", "number", 3, "inscrições"),
  ]),
  okr("w13", "weekly", "Medir o pipeline que ainda pode fechar", [
    metric("Valor em aberto fora de convertido e perdido", "currency", 5000000, "Kz"),
    metric("Oportunidades em proposta enviada", "number", 8, "oportunidades"),
    metric("Oportunidades em proposta com próximo passo datado", "percentage", 100, "%"),
  ]),
  okr("w14", "weekly", "Registar a origem de cada oportunidade", [
    metric("Oportunidades novas com origem", "percentage", 100, "%"),
    metric("Origens revistas nas fichas antigas tocadas", "percentage", 100, "%"),
    metric("Oportunidades sem origem no fecho da semana", "number", 0, "oportunidades"),
  ]),
  okr("w15", "weekly", "Fazer follow-up a todas as reuniões da semana", [
    metric("Reuniões feitas", "number", 6, "reuniões"),
    metric("Reuniões com resumo enviado ao cliente", "percentage", 100, "%"),
    metric("Reuniões que geram proposta ou próxima data", "percentage", 100, "%"),
  ]),
  okr("w16", "weekly", "Separar o que está frio do que ainda pode vender", [
    metric("Oportunidades revistas uma a uma", "number", 20, "oportunidades"),
    metric("Movidas de etapa ou marcadas como perdidas", "number", 8, "oportunidades"),
    metric("Perdidas com motivo escrito", "percentage", 100, "%"),
  ]),
  okr("d01", "daily", "Tratar hoje quem entrou hoje", [
    metric("Contactos novos que recebem o primeiro contacto", "percentage", 100, "%"),
    metric("Contactos novos com origem preenchida", "percentage", 100, "%"),
    metric("Contactos novos registados", "number", 8, "contactos"),
  ]),
  okr("d02", "daily", "Cumprir os follow-ups que vencem hoje", [
    metric("Follow-ups de hoje por tratar no fecho", "number", 0, "follow-ups"),
    metric("Oportunidades em conversa com interacção registada", "number", 5, "oportunidades"),
    metric("Fichas tocadas com nota e nova data", "percentage", 100, "%"),
  ]),
  okr("d03", "daily", "Dar um passo de venda em cada conversa", [
    metric("Conversas com preço, vaga ou condição de inscrição", "number", 3, "conversas"),
    metric("Propostas enviadas ou actualizadas com valor", "number", 1, "propostas"),
    metric("Conversas com próximo passo escrito", "percentage", 100, "%"),
  ]),
  okr("d04", "daily", "Cobrar no dia quem já disse que sim", [
    metric("Aceitações do dia que recebem link ou dados de pagamento", "percentage", 100, "%"),
    metric("Aceitações sem referência de pagamento ou data de cobrança", "number", 0, "aceitações"),
    metric("Follow-ups de pagamento prometido para hoje", "number", 2, "follow-ups"),
  ]),
  okr("d05", "daily", "Responder a todos os pedidos comerciais do dia", [
    metric("Pedidos de WhatsApp e email respondidos", "percentage", 100, "%"),
    metric("Respostas que incluem o próximo passo", "percentage", 100, "%"),
    metric("Pedidos ainda por responder no fecho", "number", 0, "pedidos"),
  ]),
  okr("d06", "daily", "Registar a conversa antes de terminar o dia", [
    metric("Conversas do dia registadas no funil", "percentage", 100, "%"),
    metric("Registos com nota útil", "number", 5, "notas"),
    metric("Conversas sem ficha no fecho", "number", 0, "conversas"),
  ]),
  okr("d07", "daily", "Dizer o preço nas conversas de hoje", [
    metric("Conversas em que o preço é dito", "number", 3, "conversas"),
    metric("Clientes que pedem proposta depois do preço", "number", 1, "pedidos"),
    metric("Conversas de venda sem preço dito", "number", 0, "conversas"),
  ]),
  okr("d08", "daily", "Actualizar as propostas que mudaram hoje", [
    metric("Propostas actualizadas com o valor certo", "number", 1, "propostas"),
    metric("Propostas actualizadas com a forma de pagamento", "percentage", 100, "%"),
    metric("Clientes avisados da actualização", "percentage", 100, "%"),
  ]),
  okr("d09", "daily", "Confirmar interessados numa vaga aberta", [
    metric("Interessados contactados", "number", 3, "pessoas"),
    metric("Interessados com vaga confirmada", "percentage", 100, "%"),
    metric("Inscrições pagas no dia", "number", 1, "inscrições"),
  ]),
  okr("d10", "daily", "Pedir uma referência por dia", [
    metric("Pedidos de referência feitos", "number", 1, "pedidos"),
    metric("Indicações recebidas e registadas", "number", 1, "indicações"),
    metric("Indicações com primeiro contacto no próprio dia", "percentage", 100, "%"),
  ]),
  okr("d11", "daily", "Não deixar nenhum follow-up de ontem pendente", [
    metric("Follow-ups atrasados tratados", "percentage", 100, "%"),
    metric("Atrasados ainda abertos no fecho", "number", 0, "follow-ups"),
    metric("Atrasados que avançam de etapa ou ganham nova data", "percentage", 100, "%"),
  ]),
  okr("d12", "daily", "Qualificar os contactos antes de prometer proposta", [
    metric("Contactos novos qualificados", "number", 4, "contactos"),
    metric("Qualificados com necessidade e decisor anotados", "percentage", 100, "%"),
    metric("Propostas enviadas sem qualificação", "number", 0, "propostas"),
  ]),
  okr("d13", "daily", "Preparar a lista de cobrança do dia", [
    metric("Clientes na lista de cobrança contactados", "percentage", 100, "%"),
    metric("Pagamentos confirmados no dia", "number", 1, "pagamentos"),
    metric("Cobranças sem resultado e sem nova data", "number", 0, "cobranças"),
  ]),
  okr("d14", "daily", "Ligar a decisores de empresas", [
    metric("Tentativas de contacto a empresas", "number", 8, "tentativas"),
    metric("Conversas com decisor ou influenciador", "number", 2, "conversas"),
    metric("Reuniões marcadas", "number", 1, "reuniões"),
  ]),
  okr("d15", "daily", "Fechar o dia com o funil em ordem", [
    metric("Fichas tocadas com próxima data", "percentage", 100, "%"),
    metric("Etapas actualizadas", "number", 3, "etapas"),
    metric("Fichas activas sem próximo passo", "number", 0, "fichas"),
  ]),
  okr("d16", "daily", "Enviar hoje a proposta prometida hoje", [
    metric("Propostas prometidas para hoje enviadas", "percentage", 100, "%"),
    metric("Propostas enviadas com preço", "number", 1, "propostas"),
    metric("Promessas de proposta ainda em aberto no fecho", "number", 0, "promessas"),
  ]),
];
