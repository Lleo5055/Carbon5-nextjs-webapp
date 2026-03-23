import type { Translations } from './types';

export const es: Translations = {
  lang: 'es',

  nav: {
    product: 'Producto',
    howItWorks: 'Cómo funciona',
    pricing: 'Precios',
    contact: 'Contacto',
    login: 'Iniciar sesión',
    getStarted: 'Empezar gratis',
  },

  hero: {
    badge: 'Diseñado para pymes europeas',
    headline: 'Contabilidad de carbono lista para auditoría para pymes,',
    headlineHighlight: 'en minutos.',
    subtext: 'Cuentas de carbono conformes con la CSRD con informes de auditoría y Leadership Snapshots. Sin consultores, sin complejidad.',
    cta: 'Empezar gratis – sin tarjeta',
    stat1: 'Diseñado para pymes de 1 a 250 empleados',
    stat2: 'Primera cuenta de carbono en menos de 30 minutos',
    efBadge: 'Red eléctrica ES: 0,231 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Emisiones del año en curso',
    subtitle: 'Resumen de CO₂ · Entidad europea',
    badgeLabel: 'Beta en vivo',
    totalCo2eLabel: 'Total CO₂e',
    totalCo2eChange: '–8,2% vs año anterior',
    electricityLabel: 'Electricidad',
    electricityNote: 'Principal fuente',
    reportsLabel: 'Informes',
    reportsNote: 'Este año',
    trendLabel: 'Tendencia mensual',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Informe para el consejo en un clic',
    downloadSub: 'Exporta un PDF limpio con tus últimos datos.',
    downloadBtn: 'Descargar PDF',
  },

  product: {
    heading: 'Creado para empresas reales, no para expertos en clima.',
    sub: 'Sin equipo de sostenibilidad necesario. Contabilidad de carbono clara para operaciones, finanzas y cumplimiento.',
    features: [
      {
        title: 'Simple por diseño',
        desc: 'Sin hojas de cálculo complicadas. Introduce consumos, elige una categoría y deja que la plataforma calcule el CO₂e con métodos europeos estándar.',
      },
      {
        title: 'Resultados conformes con la CSRD',
        desc: 'Cuentas de carbono limpias para consejos de administración, inversores y clientes. Ideal para licitaciones, cumplimiento y objetivos de cero emisiones netas.',
      },
      {
        title: 'Precios justos y transparentes',
        desc: 'Empieza gratis, mejora cuando la contabilidad se vuelva regular. Sin contratos largos ni upselling de consultoría.',
      },
    ],
  },

  howItWorks: {
    heading: 'Cómo funciona Greenio',
    sub: 'De facturas desordenadas a una cuenta de carbono lista para auditoría en tres pasos.',
    steps: [
      {
        title: 'Añade tus datos',
        desc: 'Electricidad, gas, combustible y refrigerantes. No se necesitan datos perfectos, se aceptan estimaciones.',
      },
      {
        title: 'Calculamos tu huella',
        desc: 'Factores de emisión europeos. Tu cuenta de carbono por mes, fuente y punto caliente, al instante.',
      },
      {
        title: 'Descarga y actúa',
        desc: 'Exporta un PDF para tu consejo y empieza a abordar tus principales fuentes de emisiones.',
      },
    ],
    benefits: [
      '30 minutos para la primera cuenta de carbono',
      'Resultados conformes con la CSRD',
      'Diseñado para no especialistas',
    ],
  },

  pricing: {
    heading: 'Precios simples y transparentes',
    sub: 'Empieza gratis. Mejora cuando estés listo. Sin tarifas ni contratos.',
    note: 'Todos los planes incluyen acceso al mismo panel limpio y minimalista.',
    cancelNote: 'Cancela o cambia de plan en cualquier momento. Sin contratos a largo plazo.',
    plans: {
      free: {
        name: 'Gratuito',
        price: '€0',
        period: 'al mes',
        features: [
          'Entrada de datos ilimitada',
          '1 cuenta/informe de carbono al año',
          'Panel de emisiones principal',
        ],
        cta: 'Empezar gratis',
      },
      growth: {
        name: 'Crecimiento',
        price: '€14,99',
        period: 'al mes',
        features: [
          'Cuentas/informes ilimitados',
          'Soporte prioritario',
          'Exportaciones CSV / XLS',
        ],
        cta: 'Elegir Crecimiento',
        badge: 'Más popular',
      },
      pro: {
        name: 'Pro',
        price: '€34,99',
        period: 'al mes',
        features: [
          'Todo de Crecimiento',
          'Acceso en equipo (multiusuario)',
          'Leadership Snapshot',
          'Recomendaciones de IA para reducción',
        ],
        cta: 'Elegir Pro',
      },
      enterprise: {
        name: 'Empresa',
        price: 'Hablemos',
        period: 'personalizado',
        features: [
          'Múltiples entidades y ubicaciones',
          'Incorporación y soporte personalizados',
          'Gestor de cuenta dedicado',
        ],
        cta: 'Contactar',
      },
    },
  },

  contact: {
    heading: 'Convierte la contabilidad de carbono en una fortaleza, no en una carga.',
    sub: 'Una base clara y pasos sencillos para empresas europeas reales.',
    ctaPrimary: 'Empieza gratis hoy',
    ctaEmail: 'Escríbenos',
    cardHeading: '¿Prefieres el correo electrónico?',
    cardDesc:
      'Comparte tu empresa y por qué estás explorando la contabilidad de carbono. Te responderemos con los próximos pasos.',
    cardEmailLabel: 'Email:',
  },

  footer: {
    rights: 'Greenio. Todos los derechos reservados.',
    madeIn: 'Fabricado en el Reino Unido',
    flag: '🇬🇧',
    privacy: 'Privacidad',
    terms: 'Términos',
  },

  testimonials: {
    heading: 'La confianza de los equipos de operaciones y finanzas en Europa.',
    subtext: 'Así utilizan nuestros clientes Greenio hoy.',
    tag: 'Primeros clientes en logística, servicios profesionales y tecnología.',
  },

  switcher: {
    title: 'Selecciona tu país',
  },
};
