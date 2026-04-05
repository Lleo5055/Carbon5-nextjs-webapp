/**
 * Adds missing internal links to the 8 articles with only 1 internal link.
 * Each replacement is specific to a phrase that naturally exists in that article.
 */

const fs = require('fs');
const path = require('path');
const blogDir = path.join(process.cwd(), 'content/blog');

const FIXES = [
  {
    slug: 'carbon-accounting-construction-india',
    replacements: [
      {
        find: /\bBRSR\b(?!\])/,
        replace: '[BRSR](/blog/what-is-brsr-reporting)',
      },
      {
        find: /\bScope 3 \(indirect emissions\)\b/,
        replace: '[Scope 3 (indirect emissions)](/blog/how-to-calculate-scope-3-emissions)',
      },
    ],
  },
  {
    slug: 'carbon-accounting-hotels-india',
    replacements: [
      {
        find: /\bBRSR reporting\b(?!\])/,
        replace: '[BRSR reporting](/blog/what-is-brsr-reporting)',
      },
      {
        find: /\bScope 1 emissions\b(?!\])(?! account)/,
        replace: '[Scope 1 emissions](/blog/how-to-calculate-scope-1-emissions)',
      },
    ],
  },
  {
    slug: 'carbon-accounting-manufacturing-france',
    replacements: [
      {
        find: /\bCSRD\b(?!\])/,
        replace: '[CSRD](/blog/what-is-csrd)',
      },
      {
        find: /\bScope 3\b(?!\])/,
        replace: '[Scope 3](/blog/how-to-calculate-scope-3-emissions)',
      },
    ],
  },
  {
    slug: 'carbon-accounting-manufacturing-germany',
    replacements: [
      {
        find: /\bCSRD\b(?!\])/,
        replace: '[CSRD](/blog/what-is-csrd)',
      },
      {
        find: /\bScope 3\b(?!\])/,
        replace: '[Scope 3](/blog/how-to-calculate-scope-3-emissions)',
      },
    ],
  },
  {
    slug: 'carbon-accounting-retail-uk',
    replacements: [
      {
        find: /\bSECR\b(?!\])/,
        replace: '[SECR](/blog/what-is-secr-reporting)',
      },
      {
        find: /\bScope 1\b(?!\])/,
        replace: '[Scope 1](/blog/how-to-calculate-scope-1-emissions)',
      },
    ],
  },
  {
    slug: 'carbon-accounting-textile-india',
    replacements: [
      {
        find: /\bBRSR\b(?!\])/,
        replace: '[BRSR](/blog/what-is-brsr-reporting)',
      },
      {
        find: /\bScope 3\b(?!\])/,
        replace: '[Scope 3](/blog/how-to-calculate-scope-3-emissions)',
      },
    ],
  },
  {
    slug: 'how-to-reduce-scope-2-emissions',
    replacements: [
      {
        find: /\bScope 1 emissions\b(?!\])/,
        replace: '[Scope 1 emissions](/blog/how-to-reduce-scope-1-emissions)',
      },
      {
        find: /\bScope 3\b(?!\])/,
        replace: '[Scope 3](/blog/how-to-reduce-scope-3-emissions)',
      },
    ],
  },
  {
    slug: 'scope-3-category-11-use-of-sold-products',
    replacements: [
      {
        find: /\bScope 1\b(?!\])/,
        replace: '[Scope 1](/blog/how-to-calculate-scope-1-emissions)',
      },
      {
        find: /\bGHG Protocol\b(?!\])/,
        replace: '[GHG Protocol](/blog/ghg-protocol-explained)',
      },
    ],
  },
];

function splitFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: '---\n' + match[1] + '\n---\n', body: match[2] };
}

for (const fix of FIXES) {
  const fp = path.join(blogDir, fix.slug + '.mdx');
  const content = fs.readFileSync(fp, 'utf8');
  const { frontmatter, body } = splitFrontmatter(content);
  let newBody = body;
  let added = 0;

  for (const r of fix.replacements) {
    if (newBody.search(r.find) === -1) continue;
    newBody = newBody.replace(r.find, r.replace);
    added++;
  }

  fs.writeFileSync(fp, frontmatter + newBody);
  const intCount = (newBody.match(/\]\(\/blog\//g) || []).length;
  console.log(fix.slug + ': +' + added + ' internal links (total internal: ' + intCount + ')');
}
