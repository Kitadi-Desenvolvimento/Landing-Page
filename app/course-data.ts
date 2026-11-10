export type CourseVariant = {
  id: string;
  label: string;
  detail: string;
  price: string;
  priceAmount: number;
};

export type CourseAudienceGroup = {
  title: string;
  description: string;
};

export type CourseMethodStep = {
  number: string;
  phase: string;
  title: string;
  description: string;
};

export type Course = {
  slug: string;
  category: string;
  title: string;
  shortName: string;
  programTitle: string;
  description: string;
  longDescription: string;
  audience: string;
  highlight: string;
  tagline: string;
  price: string;
  priceAmount: number;
  variants: CourseVariant[];
  image: string;
  alt: string;
  statusLabel: string;
  conductedBy: string;
  format: string;
  modality: string;
  heroEyebrow: string;
  heroSubtitle: string;
  momentEyebrow: string;
  momentTitle: string;
  momentAccent: string;
  momentLead: string;
  momentQuestions: string[];
  aboutHighlight: string;
  aboutBody: string[];
  audienceIntro: string;
  audienceGroups: CourseAudienceGroup[];
  resultsIntro: string;
  results: string[];
  methodIntro: string;
  methodSteps: CourseMethodStep[];
  bonusTitle: string;
  bonusDescription: string;
  investmentIntro: string;
  includes: string[];
  nextSteps: string[];
  closingLead: string;
  closingAccent: string;
  closingNote: string;
};

export const courses: Course[] = [
  {
    slug: "bussola-do-kitadi",
    category: "Consultoria estratégica",
    title: "Bússola do Kitadi",
    shortName: "BÚSSOLA",
    programTitle: "A Bússola do Kitadi",
    description:
      "Consultoria estratégica premium de finanças pessoais para quem precisa de tomar a decisão certa no momento exacto.",
    longDescription:
      "A Bússola do Kitadi não é uma consultoria financeira comum. É um espaço estratégico de clareza, direcção e estruturação, criado para quem precisa de tomar as decisões certas no momento exacto.",
    audience:
      "Executivos, empresários, profissionais com rendimentos consideráveis e casais que procuram orientação especializada para resolver desafios financeiros específicos.",
    highlight:
      "Sessão privada de 2 horas, anamnese financeira, plano de acção personalizado e 15 dias de acompanhamento.",
    tagline:
      "Para quem já chegou longe o suficiente para saber que o próximo passo precisa de ser certo.",
    price: "385.000 Kz",
    priceAmount: 385000,
    variants: [
      {
        id: "individual",
        label: "Individual",
        detail: "1 pessoa",
        price: "385.000 Kz",
        priceAmount: 385000,
      },
      {
        id: "casal",
        label: "Casal",
        detail: "2 pessoas",
        price: "485.000 Kz",
        priceAmount: 485000,
      },
    ],
    image: "/produtos/bussola.jpg",
    alt: "Bússola dourada da consultoria estratégica Kitadi",
    statusLabel: "Consultoria privada",
    conductedBy: "Neuza Pinto",
    format: "Sessão privada · 2 horas",
    modality: "Presencial ou online",
    heroEyebrow: "Consultoria estratégica premium de finanças pessoais",
    heroSubtitle: "Feito à medida da sua necessidade",
    momentEyebrow: "O momento certo",
    momentTitle: "Há momentos em que a questão já não é",
    momentAccent: "ganhar mais",
    momentLead:
      "Existe um ponto de inflexão na vida financeira de muitas pessoas: o rendimento já existe e o esforço já foi feito. A questão passou a ser outra, muito mais profunda e mais estratégica.",
    momentQuestions: [
      "Como estruturar o meu património de forma inteligente?",
      "Como organizar a vida financeira da minha família?",
      "Como tomar decisões financeiras importantes?",
      "Como investir com segurança sem errar nos momentos críticos?",
      "Como garantir o futuro dos meus filhos? Que legado vou deixar?",
      "Como transformar rendimento em estabilidade, liberdade e paz?",
    ],
    aboutHighlight:
      "A Bússola do Kitadi não é uma consultoria financeira comum. É um espaço estratégico de clareza, direcção e estruturação, criado para quem precisa de tomar as decisões certas no momento exacto.",
    aboutBody: [
      "Trata-se de uma sessão privada, altamente personalizada e confidencial, desenhada especificamente para executivos, empresários, profissionais com rendimentos consideráveis e casais que procuram orientação especializada para resolver desafios financeiros específicos.",
      "Mais do que números e planilhas, a Bússola oferece orientação estratégica, alinhada à sua realidade, aos seus objectivos e ao futuro que deseja construir.",
    ],
    audienceIntro:
      "A Bússola do Kitadi foi desenhada para pessoas que já alcançaram um certo nível financeiro e compreenderam que, a partir daqui, crescer exige muito mais do que trabalho e disciplina: exige visão, estratégia e decisões inteligentes e certeiras.",
    audienceGroups: [
      {
        title: "Executivos e profissionais C-level",
        description:
          "Líderes que gerem grandes responsabilidades mas precisam de cuidar também do seu próprio património.",
      },
      {
        title: "Empresários e profissionais liberais",
        description:
          "Quem cresceu e precisa agora de estruturar e separar o pessoal do empresarial.",
      },
      {
        title: "Casais em construção patrimonial",
        description:
          "Famílias que constroem o futuro juntos e precisam de um plano financeiro comum, sólido e partilhado.",
      },
      {
        title: "Investidores iniciantes",
        description:
          "Pessoas que querem investir com inteligência, reduzindo o risco de decisões baseadas em impulso ou desinformação.",
      },
      {
        title: "Planeamento de longo prazo",
        description:
          "Quem pensa no legado e quer garantir protecção, estabilidade e futuro para si e para a família.",
      },
      {
        title: "Decisões financeiras críticas",
        description:
          "Pessoas que estão perante decisões capazes de transformar a sua vida financeira e procuram orientação estratégica antes de agir.",
      },
    ],
    resultsIntro:
      "Ao final da consultoria, terá mais do que respostas: terá ferramentas, estratégias e clareza para agir.",
    results: [
      "Clareza total sobre a sua realidade financeira actual e os caminhos disponíveis",
      "Estratégias práticas, personalizadas e aplicáveis à sua situação específica",
      "Capacidade de tomar decisões financeiras com confiança e menor margem de erro",
      "Organização financeira familiar e patrimonial alinhada aos seus objectivos",
      "Maior segurança para começar a investir, proteger e estruturar o seu futuro",
      "Um plano de acção estratégico e personalizado para resolver a sua necessidade",
    ],
    methodIntro:
      "Um processo de três etapas desenhado para máximo impacto e transformação duradoura.",
    methodSteps: [
      {
        number: "01",
        phase: "Antes da sessão",
        title: "Diagnóstico financeiro estratégico",
        description:
          "Preenchimento de um formulário confidencial de anamnese financeira, desenvolvido para revelar com precisão a sua realidade, os seus desafios e os objectivos que pretende alcançar.",
      },
      {
        number: "02",
        phase: "A sessão",
        title: "Consultoria privada de 2 horas",
        description:
          "Sessão individual ou em casal conduzida pela Neuza Pinto, presencial ou online, totalmente dedicada à sua situação. Sem modelos genéricos, sem soluções de prateleira: uma estratégia construída para si.",
      },
      {
        number: "03",
        phase: "Após a sessão",
        title: "Acompanhamento pós-consultoria",
        description:
          "15 dias de suporte directo via WhatsApp para esclarecimento de dúvidas, ajuste de estratégias e acompanhamento na implementação do seu plano de acção.",
      },
    ],
    bonusTitle: "E-book A Trilha da Riqueza",
    bonusDescription:
      "Acesso ao e-book «A Trilha da Riqueza: Construção do Plano Financeiro Antifrágil», um guia prático para estruturar um plano financeiro resistente a crises e incertezas.",
    investmentIntro:
      "Uma consultoria de alto valor com retorno que se mede em decisões melhores, perdas evitadas e um futuro mais estruturado.",
    includes: [
      "Anamnese financeira completa",
      "Sessão privada de 2 horas",
      "Plano de acção personalizado",
      "15 dias de suporte WhatsApp",
      "E-book exclusivo (bónus)",
      "Confidencialidade total",
    ],
    nextSteps: [
      "Confirmação do interesse e pagamento",
      "Envio do formulário de anamnese",
      "Agendamento da sessão privada",
      "Realização da consultoria",
      "Início do acompanhamento",
    ],
    closingLead: "Algumas decisões mudam apenas o presente.",
    closingAccent: "Outras mudam o futuro inteiro.",
    closingNote: "Esta pode ser uma delas.",
  },
];

export function getCourseBySlug(slug: string) {
  return courses.find((item) => item.slug === slug);
}

export function getCourseVariant(course: Course, variantId?: string | null) {
  return (
    course.variants.find((item) => item.id === variantId) ?? course.variants[0]
  );
}

export function getProductPath(course: Course) {
  return `/produtos/${course.slug}`;
}

export function getCheckoutPath(course: Course, variantId?: string) {
  const path = `/formacoes/${course.slug}/inscricao`;
  return variantId ? `${path}?variante=${encodeURIComponent(variantId)}` : path;
}

export function parseKitadiOrderId(orderId: string) {
  for (const course of courses) {
    const prefix = `KITADI-${course.slug}-`;
    if (!orderId.startsWith(prefix)) continue;

    const rest = orderId.slice(prefix.length);
    for (const variant of course.variants) {
      const marker = `${variant.id}-`;
      if (rest.startsWith(marker)) {
        return {
          course,
          variant,
          suffix: rest.slice(marker.length),
        };
      }
    }

    return {
      course,
      variant: course.variants[0],
      suffix: rest,
    };
  }

  return null;
}
