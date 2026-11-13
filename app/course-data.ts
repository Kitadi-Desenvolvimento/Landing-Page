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
  coverImage?: string;
  alt: string;
  statusLabel: string;
  ctaLabel: string;
  imageMode: "object" | "photo";
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
  aboutEyebrow: string;
  aboutHeading: string;
  audienceEyebrow: string;
  audienceHeading: string;
  aboutHighlight: string;
  aboutBody: string[];
  audienceIntro: string;
  audienceGroups: CourseAudienceGroup[];
  resultsIntro: string;
  results: string[];
  methodIntro: string;
  methodEyebrow?: string;
  methodHeading?: string;
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

export type ProductListing = Pick<
  Course,
  | "slug"
  | "category"
  | "title"
  | "shortName"
  | "tagline"
  | "image"
  | "coverImage"
  | "alt"
  | "statusLabel"
  | "imageMode"
  | "modality"
> & {
  whatsappCta?: boolean;
  whatsappOnly?: boolean;
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
    ctaLabel: "Quero agendar a minha sessão",
    imageMode: "object",
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
    aboutEyebrow: "Sobre a consultoria",
    aboutHeading: "O que é a Bússola do Kitadi",
    audienceEyebrow: "Perfil do cliente",
    audienceHeading: "Para quem é esta consultoria",
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
      "Confirmação do interesse pelo WhatsApp",
      "Envio do formulário de anamnese",
      "Agendamento da sessão privada",
      "Realização da consultoria",
      "Início do acompanhamento",
    ],
    closingLead: "Algumas decisões mudam apenas o presente.",
    closingAccent: "Outras mudam o futuro inteiro.",
    closingNote: "Esta pode ser uma delas.",
  },
  {
    slug: "tea-and-money-talks",
    category: "Experiência Kitadi",
    title: "Tea & Money Talks",
    shortName: "TEA",
    programTitle: "Tea & Money Talks",
    description:
      "Uma conversa à mesa com o dinheiro: as três fases da vida financeira e a preparação de 2027.",
    longDescription:
      "O Tea & Money Talks é uma experiência presencial em que o dinheiro se senta à mesa — sem julgamento, com honestidade e com decisões. Um espaço para compreender a sua fase financeira e preparar 2027 com clareza.",
    audience:
      "Quem quer olhar para o dinheiro com honestidade, identificar a fase prioritária e sair com um plano concreto para os próximos meses.",
    highlight:
      "Diagnóstico da fase financeira, calendário de 2027, orçamento e o plano ROTA para os próximos 7 dias.",
    tagline: "À mesa com o dinheiro.",
    price: "88.000 Kz",
    priceAmount: 88000,
    variants: [
      {
        id: "participacao",
        label: "Participação",
        detail: "1 lugar · 21 Novembro 2026",
        price: "88.000 Kz",
        priceAmount: 88000,
      },
    ],
    image: "/produtos/tea-money-talks.jpg",
    coverImage: "/produtos/tea-capa.jpg",
    alt: "Grupo à mesa no Tea & Money Talks da Kitadi",
    statusLabel: "21 Nov 2026",
    ctaLabel: "Quero participar",
    imageMode: "photo",
    conductedBy: "Neuza Pinto",
    format: "Experiência presencial · 21 Novembro 2026",
    modality: "Kitadi · Morro Bento",
    heroEyebrow: "À mesa com o dinheiro",
    heroSubtitle: "As 3 fases da vida financeira e a preparação de 2027",
    momentEyebrow: "A experiência",
    momentTitle: "Hoje, o dinheiro senta-se",
    momentAccent: "à mesa",
    momentLead:
      "Sem julgamento. Com honestidade. E com decisões. Aqui, todas as perguntas são válidas — e o que é partilhado à mesa fica à mesa.",
    momentQuestions: [
      "Dinheiro e família",
      "Dinheiro e casal",
      "Dinheiro e filhos",
      "Ajudas familiares e limites",
      "Medo, culpa e vergonha financeira",
      "Dívidas, poupança, investimentos e o futuro",
    ],
    aboutEyebrow: "Sobre a experiência",
    aboutHeading: "O que é o Tea & Money Talks",
    audienceEyebrow: "As três fases",
    audienceHeading: "Por onde começa o seu percurso",
    aboutHighlight:
      "Aqui, ninguém precisa parecer bem resolvido. O pacto da mesa é confidencialidade, ausência de julgamento, honestidade com os números reais e responsabilidade pela parte que nos cabe.",
    aboutBody: [
      "As fases da vida financeira não dependem da idade: dependem da solidez da base que já construiu. Uma pessoa pode ganhar muito e ainda estar a construir a protecção; outra pode investir e, ao mesmo tempo, precisar de reforçar o rendimento.",
      "A prioridade está na primeira fase que ainda não se sustenta. O Tea & Money Talks ajuda a reconhecê-la e a transformar essa leitura num plano para 2027.",
    ],
    audienceIntro:
      "A fase prioritária depende da base que já construiu. O percurso começa na primeira fase que ainda não tem uma estrutura sólida.",
    audienceGroups: [
      {
        title: "Ganhar mais",
        description:
          "Aumentar a capacidade de gerar rendimento quando o valor ainda limita as escolhas, a fonte é única ou o plano de crescimento não existe.",
      },
      {
        title: "Proteger e manter",
        description:
          "Organizar o dinheiro e reduzir a vulnerabilidade: visibilidade, margem, reserva, protecção e controlo da dívida.",
      },
      {
        title: "Multiplicar",
        description:
          "Investir o excedente com objectivos claros — só depois de haver margem, reserva e dívidas sob controlo.",
      },
    ],
    resultsIntro:
      "Sai da mesa com um diagnóstico honesto, um calendário realista e uma primeira acção marcada.",
    results: [
      "Clareza sobre a fase financeira em que está e a que precisa de atenção primeiro",
      "Um diagnóstico individual da sua base: ganhar, proteger ou multiplicar",
      "Um calendário financeiro para 2026 e 2027, com datas e decisões",
      "Um orçamento pensado como decisão antecipada, não como lista de despesas",
      "O plano ROTA — realidade, objectivos, trajecto e acompanhamento",
      "Uma acção concreta para os próximos 7 dias",
    ],
    methodIntro:
      "Um percurso à mesa, com exercícios e conversa, para ligar dinheiro, datas e decisões.",
    methodSteps: [
      {
        number: "01",
        phase: "40 min",
        title: "As três fases",
        description:
          "Compreender onde o dinheiro ganha força ou se perde — ganhar, proteger e multiplicar.",
      },
      {
        number: "02",
        phase: "30 min",
        title: "O meu diagnóstico",
        description:
          "Identificar a fase prioritária, as evidências e a decisão seguinte, sem expor valores que não queira revelar.",
      },
      {
        number: "03",
        phase: "50 min",
        title: "Plano 2027",
        description:
          "Ligar objectivos, datas e dinheiro num calendário realista, para que o fim do ano deixe de ser improvisação.",
      },
      {
        number: "04",
        phase: "45 min",
        title: "Conversa à mesa",
        description:
          "Partilhar dúvidas, experiências e compromissos — o que os números não dizem, com confidencialidade.",
      },
    ],
    bonusTitle: "Método ROTA Financeira",
    bonusDescription:
      "Quatro perguntas para sair da mesa com um plano: onde estou, aonde quero chegar, como vou chegar lá e como saberei se estou no caminho certo.",
    investmentIntro:
      "Uma experiência presencial na Kitadi, em Morro Bento. Para garantir o seu lugar, fale connosco.",
    includes: [
      "Diagnóstico da fase financeira",
      "Calendário financeiro de 2027",
      "Exercício de orçamento",
      "Plano ROTA Financeira",
      "Conversa à mesa, com confidencialidade",
      "Primeira acção para os próximos 7 dias",
    ],
    nextSteps: [
      "Confirmar o interesse connosco",
      "Reservar o lugar na sessão de 21 de Novembro",
      "Participar na experiência em Morro Bento",
      "Sair com o plano dos próximos 7 dias",
    ],
    closingLead: "Faz a tua parte.",
    closingAccent: "Porque a tua parte ninguém vai fazer.",
    closingNote: "Nem mesmo Deus.",
  },
  {
    slug: "desafio-aprendiz",
    category: "Desafio Kitadi",
    title: "Desafio Aprendiz",
    shortName: "APRENDIZ",
    programTitle: "Desafio Aprendiz",
    description:
      "Aprendiz é um programa prático de educação financeira, com duração de 15 dias, criado para ajudar a desenvolver uma relação mais consciente e organizada com o dinheiro.",
    longDescription:
      "Aprendiz é um programa prático de educação financeira, com duração de 15 dias, criado para ajudar a desenvolver uma relação mais consciente e organizada com o dinheiro. O objectivo é ajudá-la a sair da intenção de organizar as suas finanças para a prática, criando hábitos financeiros mais saudáveis e sustentáveis.",
    audience:
      "Quem quer passar da intenção de organizar as finanças para a prática, com hábitos mais conscientes e sustentáveis.",
    highlight:
      "100% via WhatsApp, com desafios diários, exercícios práticos e acompanhamento em grupo com a formadora Neuza Pinto.",
    tagline: "15 dias de organização financeira.",
    price: "16.989 Kz",
    priceAmount: 16899,
    variants: [
      {
        id: "participacao",
        label: "Participação",
        detail: "15 dias · 30 Novembro 2026",
        price: "16.989 Kz",
        priceAmount: 16899,
      },
    ],
    image: "/produtos/desafio-aprendiz.jpg",
    coverImage: "/produtos/desafio-aprendiz.jpg",
    alt: "Neuza Pinto no cartaz do Desafio Aprendiz, 15 dias de organização financeira",
    statusLabel: "30 Nov 2026",
    ctaLabel: "Quero participar",
    imageMode: "object",
    conductedBy: "Neuza Pinto",
    format: "15 dias · 30 Novembro 2026",
    modality: "100% via WhatsApp",
    heroEyebrow: "Programa prático de educação financeira",
    heroSubtitle: "100% via WhatsApp",
    momentEyebrow: "O programa",
    momentTitle: "Uma relação mais consciente",
    momentAccent: "com o dinheiro",
    momentLead:
      "Aprendiz é um programa prático de educação financeira, com duração de 15 dias, criado para ajudar a desenvolver uma relação mais consciente e organizada com o dinheiro.",
    momentQuestions: [],
    aboutEyebrow: "O objectivo",
    aboutHeading: "Da intenção para a prática",
    audienceEyebrow: "O que vai aprender",
    audienceHeading: "O que vai aprender e desenvolver?",
    aboutHighlight:
      "O objectivo é ajudá-la a sair da intenção de organizar as suas finanças para a prática, criando hábitos financeiros mais saudáveis e sustentáveis.",
    aboutBody: [],
    audienceIntro: "",
    audienceGroups: [
      {
        title: "Organização financeira",
        description: "Aprender a gerir melhor as suas receitas e despesas.",
      },
      {
        title: "Controlo de gastos",
        description:
          "Identificar despesas desnecessárias e fugas financeiras.",
      },
      {
        title: "Poupança",
        description: "Desenvolver hábitos para poupar de forma consistente.",
      },
      {
        title: "Definição de objectivos",
        description:
          "Estabelecer metas financeiras claras e realistas.",
      },
      {
        title: "Planeamento financeiro",
        description:
          "Tomar decisões mais conscientes e preparar-se melhor para os seus compromissos.",
      },
      {
        title: "Acção prática",
        description:
          "Aplicar os conhecimentos no seu dia-a-dia através de desafios, exercícios e reflexões.",
      },
    ],
    resultsIntro: "",
    results: [],
    methodEyebrow: "Como funciona",
    methodHeading: "100% via WhatsApp",
    methodIntro:
      "100% via WhatsApp, com desafios diários, exercícios práticos e acompanhamento em grupo com a formadora Neuza Pinto.",
    methodSteps: [
      {
        number: "01",
        phase: "No WhatsApp",
        title: "Desafios diários",
        description: "Desafios diários durante os 15 dias do programa.",
      },
      {
        number: "02",
        phase: "No WhatsApp",
        title: "Exercícios práticos",
        description:
          "Exercícios práticos para aplicar os conhecimentos no dia-a-dia.",
      },
      {
        number: "03",
        phase: "Em grupo",
        title: "Acompanhamento em grupo",
        description:
          "Acompanhamento em grupo com a formadora Neuza Pinto.",
      },
    ],
    bonusTitle: "",
    bonusDescription: "",
    investmentIntro:
      "O Aprendiz decorre 100% via WhatsApp, com desafios diários, exercícios práticos e acompanhamento em grupo com a formadora Neuza Pinto. O início é a 30 de Novembro de 2026. Para reservar o lugar, fale connosco.",
    includes: [
      "Organização financeira",
      "Controlo de gastos",
      "Poupança",
      "Definição de objectivos",
      "Planeamento financeiro",
      "Acção prática com desafios, exercícios e reflexões",
      "Acompanhamento em grupo com Neuza Pinto",
      "Percurso 100% via WhatsApp",
    ],
    nextSteps: [
      "Confirmar o interesse connosco",
      "Entrar no grupo de WhatsApp",
      "Seguir os desafios diários durante 15 dias",
      "Aplicar os exercícios no dia-a-dia",
    ],
    closingLead: "Da intenção",
    closingAccent: "para a prática.",
    closingNote:
      "O objectivo é ajudá-la a sair da intenção de organizar as suas finanças para a prática, criando hábitos financeiros mais saudáveis e sustentáveis.",
  },
  {
    slug: "finance-date",
    category: "Experiência Kitadi",
    title: "Finance Date",
    shortName: "DATE",
    programTitle: "Finance Date",
    description:
      "Finance Date é um encontro presencial imersivo de finanças para casais.",
    longDescription:
      "Finance Date é um encontro presencial imersivo de finanças para casais. Um tempo a dois para olhar para o dinheiro no mesmo espaço.",
    audience:
      "Casais que querem tratar as finanças em conjunto, num encontro presencial e imersivo.",
    highlight: "Encontro presencial imersivo de finanças para casais.",
    tagline: "Finanças para casais.",
    price: "",
    priceAmount: 0,
    variants: [],
    image: "/produtos/finance-date.jpg",
    coverImage: "/produtos/finance-date.jpg",
    alt: "Casal no cartaz do Finance Date, finanças para casais",
    statusLabel: "Presencial",
    ctaLabel: "Quero participar",
    imageMode: "object",
    conductedBy: "Neuza Pinto",
    format: "Encontro presencial imersivo",
    modality: "Presencial",
    heroEyebrow: "Encontro presencial imersivo",
    heroSubtitle: "Finanças para casais",
    momentEyebrow: "O encontro",
    momentTitle: "Finanças para casais",
    momentAccent: "no mesmo espaço",
    momentLead:
      "Finance Date é um encontro presencial imersivo de finanças para casais.",
    momentQuestions: [],
    aboutEyebrow: "O encontro",
    aboutHeading: "Finanças para casais",
    audienceEyebrow: "Para quem é",
    audienceHeading: "Um encontro para os dois",
    aboutHighlight:
      "Um encontro presencial imersivo para o casal olhar para o dinheiro em conjunto.",
    aboutBody: [
      "Finance Date junta o casal no mesmo espaço, com tempo dedicado às finanças dos dois.",
    ],
    audienceIntro:
      "É para casais. O encontro é presencial e imersivo.",
    audienceGroups: [
      {
        title: "Casais",
        description: "Finanças tratadas a dois, no mesmo encontro.",
      },
      {
        title: "Presencial",
        description: "Um encontro com presença, no mesmo espaço.",
      },
      {
        title: "Imersivo",
        description: "Tempo reservado para esta conversa.",
      },
    ],
    resultsIntro: "",
    results: [],
    methodEyebrow: "Como funciona",
    methodHeading: "Encontro presencial imersivo",
    methodIntro:
      "Finance Date é um encontro presencial imersivo de finanças para casais. Para reservar o lugar, fale connosco.",
    methodSteps: [
      {
        number: "01",
        phase: "A dois",
        title: "Casais",
        description: "O encontro é para os dois falarem de dinheiro em conjunto.",
      },
      {
        number: "02",
        phase: "No mesmo espaço",
        title: "Presencial",
        description: "Acontece com presença, fora do ecrã.",
      },
      {
        number: "03",
        phase: "Com tempo",
        title: "Imersivo",
        description: "O tempo do encontro fica dedicado às finanças do casal.",
      },
    ],
    bonusTitle: "",
    bonusDescription: "",
    investmentIntro:
      "O Finance Date é um encontro presencial imersivo de finanças para casais. Para reservar o lugar, fale connosco.",
    includes: [
      "Encontro presencial",
      "Finanças para casais",
      "Experiência imersiva",
    ],
    nextSteps: [
      "Confirmar o interesse connosco",
      "Reservar o lugar do casal",
      "Participar no encontro presencial",
    ],
    closingLead: "Finance Date.",
    closingAccent: "Finanças para casais.",
    closingNote: "Um encontro presencial imersivo.",
  },
];

export const productListings: ProductListing[] = [
  ...courses.map((course) => ({
    ...course,
    whatsappCta: course.slug === "finance-date",
    whatsappOnly: course.slug === "finance-date",
  })),
  {
    slug: "o-negocio-e-meu",
    category: "Imersão Kitadi",
    title: "O Negócio é Meu!",
    shortName: "O NEGÓCIO É MEU!",
    tagline: "O teu negócio. As tuas prioridades. O teu plano para 2027.",
    image: "/produtos/o-negocio-e-meu.png",
    coverImage: "/produtos/o-negocio-e-meu.png",
    alt: "Cartaz da imersão O Negócio é Meu, com oito horas de imersão presencial",
    statusLabel: "8 horas de imersão",
    imageMode: "object",
    modality: "Presencial",
    whatsappCta: true,
    whatsappOnly: true,
  },
];

export function getCourseBySlug(slug: string) {
  return courses.find((item) => item.slug === slug);
}

export function getCourseVariant(course: Course, variantId?: string | null) {
  if (!course.variants.length) return undefined;
  return (
    course.variants.find((item) => item.id === variantId) ?? course.variants[0]
  );
}

export const kitadiWhatsAppNumber = "244936250151";
export const checkoutPriceLimit = 100_000;

export function offersCheckout(course: Course) {
  return (
    course.priceAmount > 0 &&
    course.priceAmount < checkoutPriceLimit &&
    course.variants.length > 0 &&
    course.variants.every(
      (variant) =>
        variant.priceAmount > 0 && variant.priceAmount < checkoutPriceLimit,
    )
  );
}

export function getProductPath(course: Pick<Course, "slug">) {
  return `/produtos/${course.slug}`;
}

export function getWhatsAppHref(course?: Pick<Course, "title">) {
  const text = course
    ? `Olá, quero aderir a ${course.title}.`
    : "Olá, quero saber mais sobre os produtos da Kitadi.";

  return `https://wa.me/${kitadiWhatsAppNumber}?text=${encodeURIComponent(text)}`;
}

export function getHelpWhatsAppHref() {
  return `https://wa.me/${kitadiWhatsAppNumber}?text=${encodeURIComponent("Olá, preciso de ajuda.")}`;
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
