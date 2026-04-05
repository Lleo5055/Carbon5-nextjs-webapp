const fs = require('fs');
const path = require('path');

const blogDir = path.join(process.cwd(), 'content/blog');

const RESOURCES = {
  ghg: {
    label: 'GHG Protocol Corporate Standard',
    url: 'https://ghgprotocol.org/corporate-standard',
  },
  ghgScope3: {
    label: 'GHG Protocol Scope 3 Standard',
    url: 'https://ghgprotocol.org/scope-3-standard',
  },
  brsr: {
    label: 'SEBI BRSR Circular',
    url: 'https://www.sebi.gov.in/legal/circulars/may-2021/business-responsibility-and-sustainability-reporting-by-listed-entities_50096.html',
  },
  ccts: {
    label: 'India Carbon Credit Trading Scheme (MoEFCC)',
    url: 'https://moef.gov.in/en/division/environment-divisions/climate-change-2/carbon-credit-trading-scheme/',
  },
  csrd: {
    label: 'CSRD Directive Text (EUR-Lex)',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022L2464',
  },
  esrs: {
    label: 'European Sustainability Reporting Standards (EFRAG)',
    url: 'https://www.efrag.org/en/projects/esrs-set-1-final-standards',
  },
  secr: {
    label: 'SECR Guidance (UK Government)',
    url: 'https://www.gov.uk/government/collections/streamlined-energy-and-carbon-reporting',
  },
  esos: {
    label: 'ESOS Guidance (UK Government)',
    url: 'https://www.gov.uk/guidance/energy-savings-opportunity-scheme-esos',
  },
  ukEts: {
    label: 'UK Emissions Trading Scheme (UK Government)',
    url: 'https://www.gov.uk/guidance/uk-emissions-trading-scheme',
  },
  euEts: {
    label: 'EU Emissions Trading System (European Commission)',
    url: 'https://climate.ec.europa.eu/eu-action/eu-emissions-trading-system-eu-ets_en',
  },
  cbam: {
    label: 'Carbon Border Adjustment Mechanism (European Commission)',
    url: 'https://taxation.ec.europa.eu/carbon-border-adjustment-mechanism_en',
  },
  sbti: {
    label: 'Science Based Targets initiative (SBTi)',
    url: 'https://sciencebasedtargets.org',
  },
  cdp: {
    label: 'CDP Disclosure Platform',
    url: 'https://www.cdp.net/en',
  },
  tcfd: {
    label: 'TCFD Recommendations (IFRS Foundation)',
    url: 'https://www.ifrs.org/groups/task-force-on-climate-related-financial-disclosures/',
  },
  gri: {
    label: 'Global Reporting Initiative (GRI) Standards',
    url: 'https://www.globalreporting.org/standards/',
  },
  iea: {
    label: 'IEA Emission Factors 2023',
    url: 'https://www.iea.org/data-and-statistics/data-product/emissions-factors-2023',
  },
  ipcc: {
    label: 'IPCC Sixth Assessment Report',
    url: 'https://www.ipcc.ch/assessment-report/ar6/',
  },
  unfccc: {
    label: 'UNFCCC Paris Agreement',
    url: 'https://unfccc.int/process-and-meetings/the-paris-agreement',
  },
  ukGovConversionFactors: {
    label: 'UK Government GHG Conversion Factors',
    url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  },
};

function getResourceKeys(slug, regulation, keywords) {
  const res = new Set();
  const kw = (keywords || '').toLowerCase();
  const reg = (regulation || '').toLowerCase();
  const s = slug.toLowerCase();

  // GHG Protocol - any emissions/scope article
  if (reg.includes('ghg') || kw.includes('scope') || kw.includes('ghg') || kw.includes('greenhouse') || kw.includes('emission')) {
    res.add('ghg');
  }
  if (s.includes('scope-3') || kw.includes('scope 3')) res.add('ghgScope3');

  // Regulations
  if (reg.includes('brsr') || s.includes('brsr') || kw.includes('brsr')) res.add('brsr');
  if (reg.includes('ccts') || s.includes('ccts') || kw.includes('ccts')) res.add('ccts');
  if (reg.includes('csrd') || s.includes('csrd') || kw.includes('csrd')) { res.add('csrd'); res.add('esrs'); }
  if (reg.includes('secr') || s.includes('secr') || kw.includes('secr')) { res.add('secr'); res.add('ukGovConversionFactors'); }
  if (s.includes('esos') || kw.includes('esos')) res.add('esos');
  if (s.includes('uk-ets') || kw.includes('uk ets')) res.add('ukEts');
  if (s.includes('eu-ets') || kw.includes('eu ets')) res.add('euEts');
  if (s.includes('cbam') || kw.includes('cbam')) { res.add('cbam'); res.add('euEts'); }
  if (s.includes('sbti') || kw.includes('sbti') || kw.includes('science based target')) { res.add('sbti'); res.add('unfccc'); }
  if (s.includes('cdp-') || kw.includes(' cdp')) { res.add('cdp'); res.add('tcfd'); }
  if (s.includes('tcfd') || kw.includes('tcfd')) res.add('tcfd');
  if (s.includes('gri') || kw.includes(' gri')) { res.add('gri'); res.add('csrd'); }
  if (s.includes('esg') || kw.includes('esg reporting')) { res.add('gri'); res.add('tcfd'); }
  if (s.includes('emission-factor') || kw.includes('emission factor')) { res.add('iea'); res.add('ukGovConversionFactors'); }
  if (s.includes('net-zero') || s.includes('carbon-neutral') || s.includes('carbon-credits') || kw.includes('net zero')) { res.add('unfccc'); res.add('sbti'); }

  // Geography
  if (s.includes('-uk') || s.includes('uk-') || kw.includes(' uk ') || kw.includes('united kingdom')) { res.add('secr'); res.add('ukGovConversionFactors'); }
  if (s.includes('-europe') || s.includes('europe-') || kw.includes('europe') || kw.includes('european')) { res.add('csrd'); res.add('esrs'); }
  if (s.includes('-india') || s.includes('india-') || kw.includes('india')) { res.add('brsr'); res.add('ccts'); }

  // Always add IPCC for any carbon/climate article
  res.add('ipcc');

  return [...res];
}

function buildSection(keys) {
  const lines = keys.map(k => `- [${RESOURCES[k].label}](${RESOURCES[k].url})`);
  return `\n## Official Resources\n\n${lines.join('\n')}\n`;
}

const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.mdx'));
let updated = 0;

for (const file of files) {
  const fp = path.join(blogDir, file);
  let content = fs.readFileSync(fp, 'utf8');

  if (content.includes('## Official Resources')) continue;

  const slugMatch = content.match(/^slug:\s*"([^"]+)"/m);
  const regulationMatch = content.match(/^regulation:\s*"([^"]+)"/m);
  const keywordsMatch = content.match(/^keywords:\s*"([^"]+)"/m);

  const slug = slugMatch ? slugMatch[1] : file.replace('.mdx', '');
  const regulation = regulationMatch ? regulationMatch[1] : '';
  const keywords = keywordsMatch ? keywordsMatch[1] : '';

  const keys = getResourceKeys(slug, regulation, keywords);
  if (keys.length === 0) continue;

  const section = buildSection(keys);

  if (content.includes('<BlogCTA')) {
    content = content.replace(/(\n<BlogCTA[^\n]*\/>)/, '\n' + section.trim() + '$1');
  } else {
    content = content.trimEnd() + '\n' + section;
  }

  fs.writeFileSync(fp, content);
  updated++;
  console.log('Updated: ' + file + ' (' + keys.length + ' links)');
}

console.log('\nTotal updated: ' + updated + '/' + files.length);
