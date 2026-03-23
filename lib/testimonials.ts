export type Testimonial = {
  name: string;
  role: string;
  company: string;
  quote: string;
  avatarUrl: string;
};

const avatar = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=200&bold=true`;

// ── India ──────────────────────────────────────────────────────────────────
export const indiaTestimonials: Testimonial[] = [
  { name: 'Arjun Mehta',  role: 'Operations Head',     company: 'TechFlow India',       quote: 'We had our first BRSR-ready carbon account ready in under an hour. No sustainability consultant needed. Our finance team handled it end to end.',                                                           avatarUrl: avatar('Arjun Mehta',  '059669') },
  { name: 'Priya Sharma', role: 'Finance Manager',      company: 'Horizon Manufacturing', quote: 'Our board wanted a clear emissions number for the annual report. Greenio gave us that in one afternoon, without pulling in an external agency.',                                                           avatarUrl: avatar('Priya Sharma', '0f766e') },
  { name: 'Rajesh Patel', role: 'Managing Director',    company: 'PatelCorp Logistics',  quote: 'We included our emission report in a large tender response. It gave us a credibility edge over competitors who had no carbon data at all.',                                                                avatarUrl: avatar('Rajesh Patel', '1d4ed8') },
  { name: 'Neha Gupta',   role: 'Compliance Officer',   company: 'GreenTrade Solutions', quote: 'BRSR preparation used to feel overwhelming. Greenio breaks it into simple data entry steps. The hotspot dashboard alone is worth it.',                                                                     avatarUrl: avatar('Neha Gupta',   '7c3aed') },
  { name: 'Vikram Singh', role: 'CFO',                  company: 'Sunrise Industries',   quote: 'We are a 120-person manufacturing unit. Greenio is exactly what we needed: credible enough for investors, simple enough for our accounts team to run themselves.',                                          avatarUrl: avatar('Vikram Singh', 'b45309') },
];

// ── Shared photo URLs ──────────────────────────────────────────────────────
const photos = [
  'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/2380794/pexels-photo-2380794.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/3760853/pexels-photo-3760853.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200',
];

const names    = ['Mark Wilson', 'Emma Clarke', 'Tom Harris', 'Lucy Bennett', 'James Porter'];
const companies = ['Northvale Logistics', 'BrightPath Services', 'HarrisTech', 'Greenline Transport', 'Oakwood Retail Group'];

// ── Per-locale data: [quote, role] pairs ──────────────────────────────────
type LocaleRow = { role: string; quote: string };

const localeRows: Record<string, LocaleRow[]> = {
  en: [
    { role: 'Operations Director', quote: "We pulled together a credible footprint in a single afternoon. No one on my team is a sustainability expert, and that's the point — the product isn't built for experts." },
    { role: 'Finance Manager',     quote: 'The board just wants a clear number, a simple trend and what we should do next. Greenio gives me all three without adding a new project to my week.' },
    { role: 'Managing Director',   quote: "We used our first report in a tender the same week. It's now part of the pack we share with larger customers asking about emissions and net-zero plans." },
    { role: 'Office Manager',      quote: 'I can log utility and fuel data in minutes. The dashboard makes it obvious where our biggest hotspots are, without drowning us in jargon.' },
    { role: 'CFO',                 quote: "For a mid-sized business, Greenio hits the sweet spot — serious enough for investors, simple enough that we don't need consultants to run it." },
  ],
  de: [
    { role: 'Betriebsleiter',      quote: 'Wir haben unsere Klimabilanz an einem einzigen Nachmittag zusammengestellt. Niemand in meinem Team ist Nachhaltigkeitsexperte — und genau das ist der Punkt.' },
    { role: 'Finanzmanagerin',     quote: 'Der Vorstand will nur eine klare Zahl, einen einfachen Trend und die nächsten Schritte. Greenio liefert mir alle drei, ohne meiner Woche ein neues Projekt hinzuzufügen.' },
    { role: 'Geschäftsführer',     quote: 'Wir haben unseren ersten Bericht noch in der gleichen Woche in einer Ausschreibung eingesetzt. Er gehört jetzt zur Standardmappe für größere Kunden.' },
    { role: 'Büromanagerin',       quote: 'Ich kann Strom- und Kraftstoffverbrauch in Minuten erfassen. Das Dashboard zeigt sofort, wo unsere größten Emissionsquellen sind.' },
    { role: 'CFO',                 quote: 'Für ein mittelständisches Unternehmen trifft Greenio genau den richtigen Punkt — seriös genug für Investoren, einfach genug ohne externe Berater.' },
  ],
  fr: [
    { role: 'Directeur des opérations', quote: "Nous avons constitué notre bilan carbone crédible en une seule après-midi. Personne dans mon équipe n'est expert en durabilité — et c'est précisément l'objectif." },
    { role: 'Responsable financière',   quote: "Le conseil ne veut qu'un chiffre clair, une tendance simple et les prochaines actions. Greenio me donne les trois sans ajouter un nouveau projet à ma semaine." },
    { role: 'Directeur général',        quote: "Nous avons utilisé notre premier rapport dans un appel d'offres la même semaine. Il fait maintenant partie du dossier partagé avec les grands clients." },
    { role: 'Office Manager',           quote: "Je peux saisir les données de consommation en quelques minutes. Le tableau de bord montre immédiatement où se trouvent nos principaux postes d'émissions." },
    { role: 'Directeur financier',      quote: "Pour une PME, Greenio trouve le bon équilibre — assez sérieux pour les investisseurs, assez simple pour ne pas avoir besoin de consultants." },
  ],
  it: [
    { role: 'Direttore operativo',    quote: "Abbiamo messo insieme un bilancio di carbonio credibile in un solo pomeriggio. Nessuno nel mio team è esperto di sostenibilità — ed è proprio questo il punto." },
    { role: 'Responsabile finanziaria', quote: "Il CDA vuole solo un numero chiaro, un trend semplice e le prossime azioni. Greenio me li dà tutti e tre senza aggiungere un nuovo progetto alla mia settimana." },
    { role: 'Amministratore delegato', quote: "Abbiamo usato il primo report in una gara d'appalto la stessa settimana. Ora fa parte del pacchetto che condividiamo con i clienti più grandi." },
    { role: 'Office Manager',          quote: "Posso registrare i dati di consumo in pochi minuti. Il dashboard mostra subito dove sono i nostri hotspot principali, senza gergo tecnico." },
    { role: 'Direttore finanziario',   quote: "Per una PMI, Greenio centra l'obiettivo — abbastanza serio per gli investitori, abbastanza semplice da non aver bisogno di consulenti." },
  ],
  es: [
    { role: 'Director de operaciones', quote: "Reunimos una huella de carbono creíble en una sola tarde. Nadie en mi equipo es experto en sostenibilidad — y ese es precisamente el punto." },
    { role: 'Gerente financiera',       quote: "El consejo solo quiere un número claro, una tendencia simple y qué hacer a continuación. Greenio me da los tres sin añadir un nuevo proyecto a mi semana." },
    { role: 'Director general',         quote: "Usamos nuestro primer informe en una licitación la misma semana. Ahora forma parte del paquete que compartimos con clientes más grandes." },
    { role: 'Office Manager',           quote: "Puedo registrar los datos de consumo en minutos. El panel muestra de inmediato dónde están nuestras principales fuentes de emisiones." },
    { role: 'Director financiero',      quote: "Para una pyme, Greenio da en el clavo — lo suficientemente serio para los inversores, lo suficientemente simple para no necesitar consultores." },
  ],
  nl: [
    { role: 'Operationeel directeur', quote: "We hebben onze geloofwaardige CO₂-voetafdruk op één middag samengesteld. Niemand in mijn team is een duurzaamheidsexpert — en dat is precies het punt." },
    { role: 'Financieel manager',      quote: "Het bestuur wil alleen een duidelijk getal, een eenvoudige trend en wat we vervolgens moeten doen. Greenio geeft me alle drie zonder een nieuw project aan mijn week toe te voegen." },
    { role: 'Directeur',               quote: "We hebben ons eerste rapport diezelfde week gebruikt in een aanbesteding. Het maakt nu deel uit van het pakket dat we met grotere klanten delen." },
    { role: 'Office Manager',          quote: "Ik kan verbruiksgegevens in minuten vastleggen. Het dashboard laat direct zien waar onze grootste emissiebronnen zijn." },
    { role: 'CFO',                     quote: "Voor een mkb-bedrijf raakt Greenio precies de juiste snaar — serieus genoeg voor investeerders, eenvoudig genoeg om zonder consultants te draaien." },
  ],
  pl: [
    { role: 'Dyrektor operacyjny',    quote: "Zebraliśmy wiarygodny ślad węglowy w jedno popołudnie. Nikt w moim zespole nie jest ekspertem ds. zrównoważonego rozwoju — i właśnie o to chodzi." },
    { role: 'Kierownik finansowy',    quote: "Zarząd chce tylko jasnej liczby, prostego trendu i informacji, co robić dalej. Greenio daje mi wszystkie trzy bez dodawania nowego projektu do mojego tygodnia." },
    { role: 'Dyrektor zarządzający', quote: "Użyliśmy pierwszego raportu w przetargu w tym samym tygodniu. Teraz jest częścią pakietu wysyłanego do większych klientów." },
    { role: 'Office Manager',         quote: "Mogę logować dane o zużyciu w kilka minut. Dashboard od razu pokazuje, gdzie są nasze największe źródła emisji." },
    { role: 'CFO',                    quote: "Dla MŚP Greenio trafia w dziesiątkę — wystarczająco poważny dla inwestorów, wystarczająco prosty, żeby nie potrzebować konsultantów." },
  ],
  sv: [
    { role: 'Operationschef',          quote: "Vi satte ihop ett trovärdigt koldioxidavtryck på en enda eftermiddag. Ingen i mitt team är hållbarhetsexpert — och det är precis poängen." },
    { role: 'Ekonomichef',             quote: "Styrelsen vill bara ha ett tydligt tal, en enkel trend och vad vi ska göra härnäst. Greenio ger mig alla tre utan att lägga till ett nytt projekt på min vecka." },
    { role: 'Verkställande direktör', quote: "Vi använde vår första rapport i en upphandling samma vecka. Den är nu en del av paketet vi delar med större kunder." },
    { role: 'Office Manager',          quote: "Jag kan logga förbrukningsdata på minuter. Instrumentpanelen visar direkt var våra största utsläppskällor är." },
    { role: 'CFO',                     quote: "För ett SMF träffar Greenio rätt — seriöst nog för investerare, enkelt nog för att inte behöva konsulter." },
  ],
  da: [
    { role: 'Driftsdirektør',           quote: "Vi satte vores troværdige CO₂-fodaftryk sammen på en enkelt eftermiddag. Ingen på mit team er bæredygtighedsekspert — og det er præcis pointen." },
    { role: 'Finanschef',               quote: "Bestyrelsen vil bare have et klart tal, en enkel tendens og hvad vi skal gøre næste. Greenio giver mig alle tre uden at tilføje et nyt projekt til min uge." },
    { role: 'Administrerende direktør', quote: "Vi brugte vores første rapport i et udbud samme uge. Det er nu en del af pakken, vi deler med større kunder." },
    { role: 'Office Manager',           quote: "Jeg kan logge forbrugsdata på minutter. Dashboardet viser med det samme, hvor vores største emissionskilder er." },
    { role: 'CFO',                      quote: "For en SMV rammer Greenio plet — seriøst nok til investorer, enkelt nok til at vi ikke behøver konsulenter." },
  ],
  pt: [
    { role: 'Diretor de operações',  quote: "Reunimos uma pegada de carbono credível numa única tarde. Ninguém na minha equipa é especialista em sustentabilidade — e é precisamente esse o ponto." },
    { role: 'Gestora financeira',    quote: "O conselho quer apenas um número claro, uma tendência simples e o que devemos fazer a seguir. O Greenio dá-me os três sem adicionar um novo projeto à minha semana." },
    { role: 'Diretor geral',         quote: "Usámos o nosso primeiro relatório numa proposta na mesma semana. Agora faz parte do pacote que partilhamos com clientes maiores." },
    { role: 'Office Manager',        quote: "Consigo registar dados de consumo em minutos. O painel mostra imediatamente onde estão as nossas maiores fontes de emissões." },
    { role: 'CFO',                   quote: "Para uma PME, o Greenio acerta em cheio — sério o suficiente para investidores, simples o suficiente para não precisarmos de consultores." },
  ],
};

// ie uses English rows
localeRows['ie'] = localeRows['en'];

function buildSet(locale: string): Testimonial[] {
  const rows = localeRows[locale] ?? localeRows['en'];
  return rows.map((r, i) => ({
    name: names[i],
    role: r.role,
    company: companies[i],
    quote: r.quote,
    avatarUrl: photos[i],
  }));
}

export function getTestimonialsForLocale(locale: string): Testimonial[] {
  if (locale === 'in') return indiaTestimonials;
  return buildSet(locale);
}
