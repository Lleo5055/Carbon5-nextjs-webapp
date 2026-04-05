/**
 * Adds natural inline external links to blog articles.
 * Rules:
 * - Max 2 external links per article
 * - Only replaces first plain-text occurrence (not already linked text)
 * - Never modifies frontmatter
 * - Internal links must always outnumber external links
 */

const fs = require('fs');
const path = require('path');

const blogDir = path.join(process.cwd(), 'content/blog');

// Each entry: pattern to find (regex), replacement with link, which slugs to apply to
// Pattern must match plain text only (not already inside a markdown link)
const INLINE_RULES = [
  // GHG Protocol - apply to any article mentioning it in body
  {
    match: /\bGreenhouse Gas Protocol Corporate Standard\b(?!\])/,
    replace: '[Greenhouse Gas Protocol Corporate Standard](https://ghgprotocol.org/corporate-standard)',
    slugs: null, // null = all articles
  },
  {
    match: /\bGHG Protocol Corporate Accounting and Reporting Standard\b(?!\])/,
    replace: '[GHG Protocol Corporate Accounting and Reporting Standard](https://ghgprotocol.org/corporate-standard)',
    slugs: null,
  },
  // SEBI - BRSR articles
  {
    match: /\bSecurities and Exchange Board of India \(SEBI\)\b(?!\])/,
    replace: '[Securities and Exchange Board of India (SEBI)](https://www.sebi.gov.in)',
    slugs: ['brsr', 'india'],
  },
  // CSRD - EU/CSRD articles
  {
    match: /\bCorporate Sustainability Reporting Directive \(CSRD\)\b(?!\])/,
    replace: '[Corporate Sustainability Reporting Directive (CSRD)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022L2464)',
    slugs: ['csrd', 'europe', 'european', 'double-materiality', 'csrd-vs-gri'],
  },
  // SECR - UK articles
  {
    match: /\bStreamlined Energy and Carbon Reporting \(SECR\)\b(?!\])/,
    replace: '[Streamlined Energy and Carbon Reporting (SECR)](https://www.gov.uk/government/collections/streamlined-energy-and-carbon-reporting)',
    slugs: ['secr', 'uk'],
  },
  // UK ETS
  {
    match: /\bUK Emissions Trading Scheme\b(?!\])/,
    replace: '[UK Emissions Trading Scheme](https://www.gov.uk/guidance/uk-emissions-trading-scheme)',
    slugs: ['uk-ets'],
  },
  // EU ETS
  {
    match: /\bEU Emissions Trading System\b(?!\])/,
    replace: '[EU Emissions Trading System](https://climate.ec.europa.eu/eu-action/eu-emissions-trading-system-eu-ets_en)',
    slugs: ['eu-ets', 'cbam'],
  },
  // CBAM
  {
    match: /\bCarbon Border Adjustment Mechanism \(CBAM\)\b(?!\])/,
    replace: '[Carbon Border Adjustment Mechanism (CBAM)](https://taxation.ec.europa.eu/carbon-border-adjustment-mechanism_en)',
    slugs: ['cbam'],
  },
  // SBTi
  {
    match: /\bScience Based Targets initiative\b(?!\])/,
    replace: '[Science Based Targets initiative](https://sciencebasedtargets.org)',
    slugs: ['sbti', 'net-zero', 'carbon-neutral'],
  },
  // TCFD
  {
    match: /\bTask Force on Climate-related Financial Disclosures\b(?!\])/,
    replace: '[Task Force on Climate-related Financial Disclosures](https://www.ifrs.org/groups/task-force-on-climate-related-financial-disclosures/)',
    slugs: ['tcfd', 'cdp', 'csrd-vs-gri', 'esg'],
  },
  // CDP
  {
    match: /\bCDP \(Carbon Disclosure Project\)\b(?!\])/,
    replace: '[CDP (Carbon Disclosure Project)](https://www.cdp.net/en)',
    slugs: ['cdp'],
  },
  // GRI
  {
    match: /\bGlobal Reporting Initiative \(GRI\)\b(?!\])/,
    replace: '[Global Reporting Initiative (GRI)](https://www.globalreporting.org/standards/)',
    slugs: ['gri', 'esg', 'brsr-vs-esg', 'csrd-vs-gri'],
  },
  // CCTS / MoEFCC
  {
    match: /\bMinistry of Environment, Forest and Climate Change\b(?!\])/,
    replace: '[Ministry of Environment, Forest and Climate Change](https://moef.gov.in)',
    slugs: ['ccts', 'india'],
  },
  // ESOS
  {
    match: /\bEnergy Savings Opportunity Scheme \(ESOS\)\b(?!\])/,
    replace: '[Energy Savings Opportunity Scheme (ESOS)](https://www.gov.uk/guidance/energy-savings-opportunity-scheme-esos)',
    slugs: ['esos'],
  },
  // Paris Agreement / UNFCCC
  {
    match: /\bParis Agreement\b(?!\])/,
    replace: '[Paris Agreement](https://unfccc.int/process-and-meetings/the-paris-agreement)',
    slugs: ['net-zero', 'carbon-neutral', 'sbti', 'carbon-credits'],
  },
  // UK Gov conversion factors - where emission factors are discussed in UK articles
  {
    match: /\bUK government(?:'s)? conversion factors\b/i,
    replace: '[UK government conversion factors](https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting)',
    slugs: ['uk', 'secr'],
  },
  // IPCC
  {
    match: /\bIPCC(?:'s)? Sixth Assessment Report\b(?!\])/,
    replace: '[IPCC Sixth Assessment Report](https://www.ipcc.ch/assessment-report/ar6/)',
    slugs: ['net-zero', 'carbon-neutral', 'carbon-credits', 'sbti'],
  },
];

// Remove frontmatter from content before processing
function splitFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: '---\n' + match[1] + '\n---\n', body: match[2] };
}

// Check if a position in text is already inside a markdown link
function isInsideLink(text, index) {
  // Look backwards for [
  const before = text.substring(0, index);
  const lastOpen = before.lastIndexOf('[');
  const lastClose = before.lastIndexOf(']');
  if (lastOpen > lastClose) return true; // inside link text
  // Check for ](url) pattern after
  const after = text.substring(index);
  const parenOpen = after.indexOf('](');
  if (parenOpen !== -1 && parenOpen < 10) return true;
  return false;
}

function countExternalLinks(body) {
  const matches = body.match(/\]\(https?:\/\/(?!greenio\.co)/g);
  return matches ? matches.length : 0;
}

function countInternalLinks(body) {
  const matches = body.match(/\]\(\/blog\//g);
  return matches ? matches.length : 0;
}

function slugMatches(slug, slugPatterns) {
  if (!slugPatterns) return true;
  return slugPatterns.some(p => slug.includes(p));
}

const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.mdx'));
let updated = 0;

for (const file of files) {
  const fp = path.join(blogDir, file);
  const content = fs.readFileSync(fp, 'utf8');
  const slug = file.replace('.mdx', '');

  const { frontmatter, body } = splitFrontmatter(content);
  let newBody = body;
  let externalLinksAdded = 0;

  for (const rule of INLINE_RULES) {
    if (externalLinksAdded >= 2) break;
    if (!slugMatches(slug, rule.slugs)) continue;

    const match = newBody.match(rule.match);
    if (!match) continue;

    const idx = newBody.search(rule.match);
    if (isInsideLink(newBody, idx)) continue;

    // Check that after adding, external <= internal - 1
    const internalCount = countInternalLinks(newBody);
    const externalCount = countExternalLinks(newBody);
    if (externalCount + 1 >= internalCount) continue; // would violate rule

    newBody = newBody.replace(rule.match, rule.replace);
    externalLinksAdded++;
  }

  if (externalLinksAdded > 0) {
    fs.writeFileSync(fp, frontmatter + newBody);
    updated++;
    console.log(`${file}: +${externalLinksAdded} external link(s) (internal: ${countInternalLinks(newBody)}, external: ${countExternalLinks(newBody)})`);
  }
}

console.log(`\nTotal updated: ${updated}/${files.length}`);
