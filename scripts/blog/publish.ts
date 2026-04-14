/**
 * scripts/blog/publish.ts
 * Read approved rows from Google Sheets, create MDX files, update sheet status.
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/blog/publish.ts
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { CONTENT_PLAN } from './content-plan';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── Env ────────────────────────────────────────────────────────────────────────

const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '';
const BLOG_PIPELINE_SHEET_ID = process.env.BLOG_PIPELINE_SHEET_ID ?? '';

if (!GOOGLE_SERVICE_ACCOUNT_KEY) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
if (!BLOG_PIPELINE_SHEET_ID) throw new Error('BLOG_PIPELINE_SHEET_ID is not set');

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const SHEET_NAME = 'Pipeline';
const BASE_URL = 'https://greenio.co';

// Column indices (0-based)
const COL = {
  DAY: 0,
  SLOT: 1,
  TITLE: 2,
  SLUG: 3,
  LEVEL: 4,
  COUNTRY: 5,
  KEYWORDS: 6,
  INTERNAL_LINKS: 7,
  EXTERNAL_LINKS: 8,
  STATUS: 9,
  GENERATED_AT: 10,
  PUBLISHED_AT: 11,
  WORD_COUNT: 12,
  MDX_PATH: 13,
  CONTENT: 14,
} as const;

// ── Google Sheets ──────────────────────────────────────────────────────────────

async function getSheets() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const serviceAccountKey = keyPath.startsWith('{')
    ? JSON.parse(keyPath)
    : JSON.parse(fs.readFileSync(path.resolve(process.cwd(), keyPath), 'utf-8'));

  const credentials = serviceAccountKey as {
    client_email: string;
    private_key: string;
  };

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getBlogMeta(slug: string) {
  for (const day of CONTENT_PLAN) {
    for (const blog of day.blogs) {
      if (blog.slug === slug) return blog;
    }
  }
  return null;
}

function extractDescription(content: string, title: string): { description: string; body: string } {
  const match = content.match(/^<!-- description: (.+) -->\n?/);
  if (match) {
    return {
      description: match[1].trim(),
      body: content.replace(/^<!-- description: .+ -->\n?/, ''),
    };
  }
  return { description: title, body: content };
}

function buildFrontmatter(
  slug: string,
  title: string,
  description: string,
  keywords: string,
  internalLinksRaw: string,
  country: string,
  date: string,
): string {

  const meta = getBlogMeta(slug);

  const externalLinks = meta?.externalLinks ?? [];

  const internalLinkSlugs = internalLinksRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const internalLinks = internalLinkSlugs.map(s => ({
    slug: s,
    title: s.replace(/-/g, ' '),
    relationship: 'related',
  }));

  const relatedBlogs = internalLinkSlugs.slice(0, 5).map(s => ({
    slug: s,
    title: s.replace(/-/g, ' '),
    flag: meta?.flag ?? '🌍',
  }));

  const frontmatter = {
    title,
    description,
    date,
    author: 'Greenio',
    level: meta?.level ?? 3,
    levelLabel: meta?.levelLabel ?? 'Intermediate',
    country,
    locale: meta?.locale ?? 'en',
    flag: meta?.flag ?? '🌍',
    regulation: meta?.regulation ?? '',
    keywords,
    canonicalUrl: `${BASE_URL}/blog/${slug}`,
    ogImage: `${BASE_URL}/og-blog.png`,
    internalLinks,
    relatedBlogs,
    slug,
    status: 'published',
    readingTime: `${Math.ceil((meta?.wordCount ?? 1000) / 200)} min read`,
    excerpt: title,
  };

  const lines: string[] = ['---'];

  lines.push(`title: "${frontmatter.title.replace(/"/g, "'")}"`);
  lines.push(`description: "${frontmatter.description.slice(0, 160).replace(/"/g, "'")}"`);
  lines.push(`date: "${frontmatter.date}"`);
  lines.push(`author: "${frontmatter.author}"`);
  lines.push(`level: ${frontmatter.level}`);
  lines.push(`levelLabel: "${frontmatter.levelLabel}"`);
  lines.push(`country: "${frontmatter.country}"`);
  lines.push(`locale: "${frontmatter.locale}"`);
  lines.push(`flag: "${frontmatter.flag}"`);
  lines.push(`regulation: "${frontmatter.regulation}"`);
  lines.push(`keywords: "${frontmatter.keywords}"`);
  lines.push(`canonicalUrl: "${frontmatter.canonicalUrl}"`);
  lines.push(`ogImage: "${frontmatter.ogImage}"`);

  if (frontmatter.internalLinks.length > 0) {
    lines.push('internalLinks:');
    for (const il of frontmatter.internalLinks) {
      lines.push(`  - slug: "${il.slug}"`);
      lines.push(`    title: "${il.title}"`);
      lines.push(`    relationship: "${il.relationship}"`);
    }
  } else {
    lines.push('internalLinks: []');
  }

  if (externalLinks.length > 0) {
    lines.push('externalLinks:');
    for (const link of externalLinks) {
      lines.push(`  - anchor: "${link.anchor.replace(/"/g, "'")}"`);
      lines.push(`    url: "${link.url}"`);
    }
  } else {
    lines.push('externalLinks: []');
  }

  if (frontmatter.relatedBlogs.length > 0) {
    lines.push('relatedBlogs:');
    for (const rb of frontmatter.relatedBlogs) {
      lines.push(`  - slug: "${rb.slug}"`);
      lines.push(`    title: "${rb.title}"`);
      lines.push(`    flag: "${rb.flag}"`);
    }
  } else {
    lines.push('relatedBlogs: []');
  }

  lines.push(`slug: "${frontmatter.slug}"`);
  lines.push(`status: "${frontmatter.status}"`);
  lines.push(`readingTime: "${frontmatter.readingTime}"`);
  lines.push(`excerpt: "${frontmatter.excerpt.slice(0, 200).replace(/"/g, "'")}"`);

  lines.push('---');

  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {

  console.log('\n📋 Reading approved blogs from Google Sheets...\n');

  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: BLOG_PIPELINE_SHEET_ID,
    range: `${SHEET_NAME}!A:O`,
  });

  const rows = res.data.values ?? [];

  if (rows.length <= 1) {
    console.log('No rows found (or only header row). Nothing to publish.');
    return;
  }

  fs.mkdirSync(BLOG_DIR, { recursive: true });

  let published = 0;

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {

    const row = rows[rowIdx];
    const status = row[COL.STATUS] ?? '';

    if (status.toLowerCase() !== 'approved') continue;

    const slug = (row[COL.SLUG] ?? '').trim();
    const title = row[COL.TITLE] ?? '';
    const keywords = row[COL.KEYWORDS] ?? '';
    const internalLinks = row[COL.INTERNAL_LINKS] ?? '';
    const country = row[COL.COUNTRY] ?? '';
    const rawContent = row[COL.CONTENT] ?? '';

    if (!slug || !rawContent) {
      console.warn(`⚠️  Row ${rowIdx + 1}: Missing slug or content, skipping.`);
      continue;
    }

    const { description, body: content } = extractDescription(rawContent, title);
    const date = new Date().toISOString().split('T')[0];

    const frontmatter = buildFrontmatter(
      slug,
      title,
      description,
      keywords,
      internalLinks,
      country,
      date
    );

    const mdxContent = `${frontmatter}\n\n${content}`;
    const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

    fs.writeFileSync(filePath, mdxContent, 'utf-8');

    const sheetRowNum = rowIdx + 1;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: BLOG_PIPELINE_SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `${SHEET_NAME}!J${sheetRowNum}`,
            values: [['Published']],
          },
          {
            range: `${SHEET_NAME}!L${sheetRowNum}`,
            values: [[new Date().toISOString()]],
          },
          {
            range: `${SHEET_NAME}!N${sheetRowNum}`,
            values: [[`content/blog/${slug}.mdx`]],
          },
        ],
      },
    });

    console.log(`✅ Published: ${title} → content/blog/${slug}.mdx`);
    published++;

  }

  if (published === 0) {
    console.log('No approved blogs found. Set Status → "Approved" in the sheet to publish.');
  } else {
    console.log(`\n✅ Published ${published} blog(s). Commit and push content/blog/ to deploy.\n`);
  }

}

main().catch(err => {
  console.error(err);
  process.exit(1);
});