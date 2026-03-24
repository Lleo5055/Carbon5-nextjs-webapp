import type { Translations } from './types';

export const pt: Translations = {
  lang: 'pt',

  nav: {
    product: 'Produto',
    howItWorks: 'Como funciona',
    pricing: 'Preços',
    contact: 'Contacto',
    login: 'Entrar',
    getStarted: 'Começar gratuitamente',
  },

  hero: {
    badge: 'Desenvolvido para PMEs europeias',
    headline: 'Contabilidade de carbono pronta para auditoria para PMEs,',
    headlineHighlight: 'concluída em minutos.',
    subtext: 'Contas de carbono conformes com a CSRD com relatórios de auditoria e Leadership Snapshots. Sem consultores, sem complexidade.',
    cta: 'Começar grátis – sem cartão',
    stat1: 'Projetado para PMEs com 1–250 funcionários',
    stat2: 'Primeira conta de carbono em menos de 30 minutos',
    efBadge: 'Rede PT: 0,235 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Emissões do ano corrente',
    subtitle: 'Visão geral de CO₂ · Entidade europeia',
    badgeLabel: 'Beta ao vivo',
    totalCo2eLabel: 'Total CO₂e',
    totalCo2eChange: '–8,2% vs. ano anterior',
    electricityLabel: 'Eletricidade',
    electricityNote: 'Principal fonte',
    reportsLabel: 'Relatórios',
    reportsNote: 'Este ano',
    trendLabel: 'Tendência mensal',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Relatório para o conselho num clique',
    downloadSub: 'Exporte um PDF limpo com os seus dados mais recentes.',
    downloadBtn: 'Transferir PDF',
  },

  product: {
    heading: 'Criado para empresas reais, não para especialistas em clima.',
    sub: 'Sem equipa de sustentabilidade necessária. Contabilidade de carbono clara para equipas de operações, finanças e conformidade.',
    features: [
      {
        title: 'Simples por design',
        desc: 'Sem folhas de cálculo complicadas. Introduza consumos, escolha uma categoria e deixe a plataforma calcular o CO₂e com métodos europeus padrão.',
      },
      {
        title: 'Resultados conformes com a CSRD',
        desc: 'Contas de carbono limpas para conselhos de administração, investidores e clientes. Perfeito para concursos, conformidade e objetivos de emissões nulas.',
      },
      {
        title: 'Preços justos e transparentes',
        desc: 'Comece grátis, mude para um plano superior quando a contabilidade se tornar regular. Sem contratos longos nem upselling de consultoria.',
      },
    ],
  },

  howItWorks: {
    heading: 'Como funciona o Greenio',
    sub: 'De faturas desordenadas a uma conta de carbono pronta para auditoria em três passos.',
    steps: [
      {
        title: 'Adicione os seus dados',
        desc: 'Eletricidade, gás, combustível e refrigerantes. Dados perfeitos não necessários, estimativas suportadas.',
      },
      {
        title: 'Calculamos a sua pegada',
        desc: 'Fatores de emissão europeus. A sua conta de carbono por mês, fonte e ponto crítico, instantaneamente.',
      },
      {
        title: 'Transfira e aja',
        desc: 'Exporte um PDF para o seu conselho e comece a abordar as suas principais fontes de emissões.',
      },
    ],
    benefits: [
      '30 minutos para a primeira conta de carbono',
      'Resultados conformes com a CSRD',
      'Projetado para não especialistas',
    ],
  },

  pricing: {
    heading: 'Preços simples e transparentes',
    sub: 'Comece grátis. Mude de plano quando estiver pronto. Sem taxas nem contratos.',
    note: 'Todos os planos incluem acesso ao mesmo painel limpo e minimalista.',
    cancelNote: 'Cancele ou mude de plano a qualquer momento. Sem contratos de longo prazo.',
    plans: {
      free: {
        name: 'Gratuito',
        price: '€0',
        period: 'por mês',
        features: [
          'Introdução de dados ilimitada',
          '1 conta/relatório de carbono por ano',
          'Painel de emissões principal',
        ],
        cta: 'Começar com o Gratuito',
      },
      growth: {
        name: 'Crescimento',
        price: '€14,99',
        period: 'por mês',
        features: [
          'Contas/relatórios ilimitados',
          'Exportações CSV / XLS',
          'Relatórios CSRD',
          'Suporte por email',
        ],
        cta: 'Escolher Crescimento',
      },
      pro: {
        name: 'Pro',
        price: '€34,99',
        period: 'por mês',
        features: [
          'Tudo do Crescimento',
          'Acesso em equipa multi-utilizador',
          'Leadership Snapshot',
          'Recomendações de IA para redução',
          'Suporte prioritário',
        ],
        cta: 'Escolher Pro',
        badge: 'Mais popular',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Fale connosco',
        period: 'personalizado',
        features: [
          'Tudo do Pro',
          'Múltiplas entidades e localizações',
          'Integração e suporte personalizados',
          'Gestor de conta dedicado',
        ],
        cta: 'Contactar-nos',
      },
    },
  },

  contact: {
    heading: 'Transforme a contabilidade de carbono numa vantagem, não num fardo.',
    sub: 'Uma base clara e próximos passos simples para empresas europeias reais.',
    ctaPrimary: 'Começar grátis hoje',
    ctaEmail: 'Enviar-nos um email',
    cardHeading: 'Prefere email?',
    cardDesc:
      'Partilhe o tamanho da sua empresa e o motivo pelo qual está a explorar a contabilidade de carbono. Responderemos com os próximos passos.',
    cardEmailLabel: 'Email:',
  },

  footer: {
    rights: 'Greenio. Todos os direitos reservados.',
    madeIn: 'Fabricado no Reino Unido',
    flag: '🇬🇧',
    privacy: 'Privacidade',
    terms: 'Termos',
  },

  testimonials: {
    heading: 'A confiança das equipas de operações e finanças na Europa.',
    subtext: 'Como os nossos clientes utilizam o Greenio hoje.',
    tag: 'Primeiros clientes em logística, serviços profissionais e tecnologia.',
  },

  switcher: {
    title: 'Selecione o seu país',
  },
};
