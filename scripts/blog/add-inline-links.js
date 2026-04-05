/**
 * Adds natural inline external links to blog articles.
 * Rules:
 * - Max 2 external links per article total (including already existing ones)
 * - Only replaces first unlinked plain-text occurrence
 * - Never modifies frontmatter
 * - Internal links must always outnumber external links
 */

const fs = require('fs');
const path = require('path');

const blogDir = path.join(process.cwd(), 'content/blog');

// Priority-ordered rules. For each article, the first matching rule that fits
// within the 2-external and internal>external constraints is applied.
// slugs: null = all articles, array = only articles whose slug contains one of these strings
const INLINE_RULES = [
  // GHG Protocol - highest coverage (58 articles)
  {
    match: /\bGHG Protocol\b(?!\])/,
    replace: '[GHG Protocol](https://ghgprotocol.org/corporate-standard)',
    slugs: null,
  },
  // CSRD - 67 articles
  {
    match: /\bCSRD\b(?!\])/,
    replace: '[CSRD](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022L2464)',
    slugs: null,
  },
  // BRSR - 47 articles
  {
    match: /\bBRSR\b(?!\])/,
    replace: '[BRSR](https://www.sebi.gov.in/legal/circulars/may-2021/business-responsibility-and-sustainability-reporting-by-listed-entities_50096.html)',
    slugs: null,
  },
  // SECR - 34 articles
  {
    match: /\bSECR\b(?!\])/,
    replace: '[SECR](https://www.gov.uk/government/collections/streamlined-energy-and-carbon-reporting)',
    slugs: null,
  },
  // SEBI - 16 articles
  {
    match: /\bSEBI\b(?!\])/,
    replace: '[SEBI](https://www.sebi.gov.in)',
    slugs: ['brsr', 'india'],
  },
  // CCTS - 18 articles
  {
    match: /\bCCTS\b(?!\])/,
    replace: '[CCTS](https://moef.gov.in/en/division/environment-divisions/climate-change-2/carbon-credit-trading-scheme/)',
    slugs: ['ccts', 'india'],
  },
  // SBTi - 14 articles
  {
    match: /\bSBTi\b(?!\])/,
    replace: '[SBTi](https://sciencebasedtargets.org)',
    slugs: null,
  },
  // EU ETS - 12 articles
  {
    match: /\bEU ETS\b(?!\])/,
    replace: '[EU ETS](https://climate.ec.europa.eu/eu-action/eu-emissions-trading-system-eu-ets_en)',
    slugs: null,
  },
  // CBAM - 8 articles
  {
    match: /\bCBAM\b(?!\])/,
    replace: '[CBAM](https://taxation.ec.europa.eu/carbon-border-adjustment-mechanism_en)',
    slugs: ['cbam', 'export', 'manufacturing'],
  },
  // GRI - 8 articles
  {
    match: /\bGRI\b(?!\])/,
    replace: '[GRI](https://www.globalreporting.org/standards/)',
    slugs: null,
  },
  // ISO 14064 - 8 articles
  {
    match: /\bISO 14064\b(?!\])/,
    replace: '[ISO 14064](https://www.iso.org/standard/66453.html)',
    slugs: null,
  },
  // TCFD - 6 articles
  {
    match: /\bTCFD\b(?!\])/,
    replace: '[TCFD](https://www.ifrs.org/groups/task-force-on-climate-related-financial-disclosures/)',
    slugs: null,
  },
  // ESOS - 4 articles
  {
    match: /\bESOS\b(?!\])/,
    replace: '[ESOS](https://www.gov.uk/guidance/energy-savings-opportunity-scheme-esos)',
    slugs: ['esos', 'uk'],
  },
  // CDP - 4 articles
  {
    match: /\bCDP\b(?!\])/,
    replace: '[CDP](https://www.cdp.net/en)',
    slugs: ['cdp', 'scope-3'],
  },
  // UK ETS - 3 articles
  {
    match: /\bUK ETS\b(?!\])/,
    replace: '[UK ETS](https://www.gov.uk/guidance/uk-emissions-trading-scheme)',
    slugs: null,
  },
  // Paris Agreement - 2 articles
  {
    match: /\bParis Agreement\b(?!\])/,
    replace: '[Paris Agreement](https://unfccc.int/process-and-meetings/the-paris-agreement)',
    slugs: null,
  },
  // IPCC - 14 articles
  {
    match: /\bIPCC\b(?!\])/,
    replace: '[IPCC](https://www.ipcc.ch/assessment-report/ar6/)',
    slugs: null,
  },
];

function splitFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: '---\n' + match[1] + '\n---\n', body: match[2] };
}

function isInsideLink(text, index) {
  const before = text.substring(0, index);
  const lastOpen = before.lastIndexOf('[');
  const lastClose = before.lastIndexOf(']');
  if (lastOpen > lastClose) return true;
  return false;
}

function countExternalLinks(body) {
  const matches = body.match(/\]\(https?:\/\/(?!greenio\.co)[^)]+\)/g);
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
  let externalCount = countExternalLinks(newBody);
  const internalCount = countInternalLinks(newBody);
  let added = 0;

  for (const rule of INLINE_RULES) {
    if (externalCount >= 2) break;
    if (!slugMatches(slug, rule.slugs)) continue;

    const idx = newBody.search(rule.match);
    if (idx === -1) continue;
    if (isInsideLink(newBody, idx)) continue;

    // Ensure internal always outnumbers external after adding
    if (externalCount + 1 >= internalCount) continue;

    newBody = newBody.replace(rule.match, rule.replace);
    externalCount++;
    added++;
  }

  if (added > 0) {
    fs.writeFileSync(fp, frontmatter + newBody);
    updated++;
    console.log(`${slug}: +${added} link(s) | internal: ${internalCount} external: ${externalCount}`);
  }
}

console.log(`\nTotal updated: ${updated}/${files.length}`);
