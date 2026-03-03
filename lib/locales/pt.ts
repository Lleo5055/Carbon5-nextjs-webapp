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
    subtext:
      'Transforme os seus dados de emissões em contas de carbono conformes com a CSRD e o GHG Protocol — com relatórios de nível de auditoria e Leadership Snapshots profissionais.',
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
    sub: 'A maioria das PMEs não tem uma equipa de sustentabilidade. O Greenio oferece-lhe uma conta de carbono clara e credível sem complexidade — para equipas de operações, finanças e conformidade.',
    features: [
      {
        title: 'Simples por design',
        desc: 'Sem folhas de cálculo complicadas. Introduza consumos, escolha uma categoria e deixe a plataforma calcular o CO₂e com métodos europeus padrão.',
      },
      {
        title: 'Resultados conformes com a CSRD',
        desc: 'Gere contas de carbono limpas para conselhos de administração, investidores e clientes. Perfeito para concursos, conformidade e objetivos de emissões nulas.',
      },
      {
        title: 'Preços justos e transparentes',
        desc: 'Comece grátis, mude para um plano superior quando a contabilidade se tornar regular. Sem contratos longos nem upselling de consultoria.',
      },
    ],
  },

  howItWorks: {
    heading: 'Como funciona o Greenio',
    sub: 'De faturas desordenadas a uma conta de carbono pronta para auditoria — em três passos simples.',
    steps: [
      {
        title: 'Adicione os seus dados',
        desc: 'Comece com o que tem — eletricidade, gás, combustível e refrigerantes. Não são necessários dados perfeitos; as estimativas são suportadas.',
      },
      {
        title: 'Calculamos a sua pegada',
        desc: 'Aplicamos os fatores de emissão europeus e construímos a sua conta de carbono por mês, fonte e ponto crítico — instantaneamente e com transparência.',
      },
      {
        title: 'Transfira e aja',
        desc: 'Exporte um PDF claro para o seu conselho de administração e comece a abordar as suas principais fontes de emissões com recomendações concretas.',
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
    sub: 'Comece grátis, mude para um plano superior apenas quando a contabilidade de carbono se tornar rotineira. Sem taxas de configuração, sem surpresas.',
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
        price: '€11,99',
        period: 'por mês',
        features: [
          'Contas/relatórios ilimitados',
          'Suporte prioritário',
          'Exportações CSV / XLS',
        ],
        cta: 'Escolher Crescimento',
        badge: 'Mais popular',
      },
      pro: {
        name: 'Pro',
        price: '€29,99',
        period: 'por mês',
        features: [
          'Tudo do Crescimento',
          'Acesso em equipa (multiutilizador)',
          'Leadership Snapshot',
          'Recomendações de IA para redução',
        ],
        cta: 'Escolher Pro',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Vamos conversar',
        period: 'personalizado',
        features: [
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
    sub: 'Quer esteja a começar ou a consolidar um compromisso de emissões nulas, o Greenio oferece-lhe uma base clara e próximos passos simples.',
    ctaPrimary: 'Começar grátis hoje',
    ctaEmail: 'Enviar-nos um email',
    cardHeading: 'Prefere email?',
    cardDesc:
      'Partilhe algumas linhas sobre o tamanho da sua empresa e o motivo pelo qual está a explorar a contabilidade de carbono. Responderemos com os próximos passos e, se útil, um link para uma breve chamada introdutória.',
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
    subtext: 'O Greenio integra-se no dia a dia das equipas ocupadas — sem necessidade de consultores climáticos. É assim que os nossos clientes utilizam a plataforma hoje.',
    tag: 'Primeiros clientes em logística, serviços profissionais e tecnologia.',
  },

  switcher: {
    title: 'Selecione o seu país',
  },
};
