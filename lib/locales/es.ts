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
    subtext:
      'Convierte tus datos de emisiones en cuentas de carbono conformes con la CSRD y el GHG Protocol — con informes de nivel de auditoría y Leadership Snapshots profesionales.',
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
    sub: 'La mayoría de las pymes no tienen un equipo de sostenibilidad. Greenio te ofrece una cuenta de carbono clara y creíble sin complejidad — para equipos de operaciones, finanzas y cumplimiento.',
    features: [
      {
        title: 'Simple por diseño',
        desc: 'Sin hojas de cálculo complicadas. Introduce consumos, elige una categoría y deja que la plataforma calcule el CO₂e con métodos europeos estándar.',
      },
      {
        title: 'Resultados conformes con la CSRD',
        desc: 'Genera cuentas de carbono limpias para consejos de administración, inversores y clientes. Ideal para licitaciones, cumplimiento y objetivos de cero emisiones netas.',
      },
      {
        title: 'Precios justos y transparentes',
        desc: 'Empieza gratis, mejora cuando la contabilidad se vuelva regular. Sin contratos largos ni upselling de consultoría.',
      },
    ],
  },

  howItWorks: {
    heading: 'Cómo funciona Greenio',
    sub: 'De facturas desordenadas a una cuenta de carbono lista para auditoría — en tres sencillos pasos.',
    steps: [
      {
        title: 'Añade tus datos',
        desc: 'Comienza con lo que tienes — electricidad, gas, combustible y refrigerantes. No se necesitan datos perfectos; se aceptan estimaciones.',
      },
      {
        title: 'Calculamos tu huella',
        desc: 'Aplicamos los factores de emisión europeos y construimos tu cuenta de carbono por mes, fuente y punto caliente — al instante y con total transparencia.',
      },
      {
        title: 'Descarga y actúa',
        desc: 'Exporta un PDF claro para tu consejo de administración y empieza a abordar tus principales fuentes de emisiones con recomendaciones concretas.',
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
    sub: 'Empieza gratis, mejora solo cuando la contabilidad de carbono se vuelva rutinaria. Sin tarifas de configuración, sin sorpresas.',
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
        price: '€11,99',
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
        price: '€29,99',
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
    sub: 'Ya sea que estés empezando o consolidando un compromiso de cero emisiones netas, Greenio te ofrece una base clara y pasos sencillos a seguir.',
    ctaPrimary: 'Empieza gratis hoy',
    ctaEmail: 'Escríbenos',
    cardHeading: '¿Prefieres el correo electrónico?',
    cardDesc:
      'Comparte unas líneas sobre el tamaño de tu empresa y por qué estás explorando la contabilidad de carbono. Te responderemos con los próximos pasos y, si es útil, un enlace para una breve llamada.',
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
    subtext: 'Greenio encaja en el día a día de los equipos ocupados — sin consultores climáticos. Así es como nuestros clientes lo usan hoy.',
    tag: 'Primeros clientes en logística, servicios profesionales y tecnología.',
  },

  switcher: {
    title: 'Selecciona tu país',
  },
};
