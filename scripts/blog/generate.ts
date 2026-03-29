/**
 * scripts/blog/generate.ts
 * Generate blog content via Claude API and save to Google Sheets.
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/blog/generate.ts --day 1
 */

import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { CONTENT_PLAN, type BlogItem } from './content-plan';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── Env ────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '';
const BLOG_PIPELINE_SHEET_ID = process.env.BLOG_PIPELINE_SHEET_ID ?? '';

if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
if (!GOOGLE_SERVICE_ACCOUNT_KEY) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
if (!BLOG_PIPELINE_SHEET_ID) throw new Error('BLOG_PIPELINE_SHEET_ID is not set');

// ── Google Sheets ──────────────────────────────────────────────────────────────

const SHEET_NAME = 'Pipeline';

const HEADERS = [
  'Day', 'Slot', 'Title', 'Slug', 'Level', 'Country', 'Keywords',
  'Internal Links', 'Status', 'Generated At', 'Published At',
  'Word Count', 'MDX Path', 'Content',
];

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

async function ensureHeaders(sheets: ReturnType<typeof google.sheets>): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: BLOG_PIPELINE_SHEET_ID,
    range: `${SHEET_NAME}!A1:N1`,
  });

  const existing = res.data.values?.[0];
  if (!existing || existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: BLOG_PIPELINE_SHEET_ID,
      range: `${SHEET_NAME}!A1:N1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
    console.log('✅ Header row created');
  }
}

async function appendBlogRow(
  sheets: ReturnType<typeof google.sheets>,
  day: number,
  slot: number,
  blog: BlogItem,
  content: string,
): Promise<void> {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const row = [
    day,
    slot,
    blog.title,
    blog.slug,
    blog.level,
    blog.country,
    blog.keywords.join(', '),
    blog.internalLinks.join(', '),
    'Draft',
    new Date().toISOString(),
    '',
    wordCount,
    `content/blog/${blog.slug}.mdx`,
    content,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: BLOG_PIPELINE_SHEET_ID,
    range: `${SHEET_NAME}!A:N`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

// ── Claude ─────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const currentYear = new Date().getFullYear();
  return `You are an expert carbon accounting and ESG compliance writer with deep knowledge of BRSR, CCTS, SECR, CSRD and the GHG Protocol. Write accurate, comprehensive, SEO-optimized blog posts for Greenio — a carbon accounting platform serving 14 countries.

The current year is ${currentYear}. When referring to the current regulatory landscape, current year deadlines, or present-day context, always use ${currentYear}. Only use earlier years (e.g. 2024, 2025) when referring to specific historical regulatory phases or past financial year ranges.

Rules:
1. Always include exactly 2 <BlogCTA> components at the positions specified in the prompt.
2. Include 3-5 inline markdown links to related blogs using the format [anchor text](/blog/slug).
3. Always include a FAQ section with 4-5 questions (use ## What... ## How... ## Is... ## When... format so they are auto-detected as FAQ schema).
4. Mention Greenio naturally in context - never forced.
5. Heading hierarchy is critical for SEO: use ## (H2) for main sections, ### (H3) for subsections within each H2, and #### (H4) for specific details within H3s where appropriate. Aim for 2-3 H3s under each H2. This creates proper content hierarchy and improves readability.
6. NEVER use em dashes (--) or the — character. Use a regular hyphen-minus (-) or a colon (:) instead.
7. Be accurate about all regulatory details - BRSR, CCTS, SECR, CSRD deadlines and requirements.
8. Write for a business audience - CFOs, sustainability managers, compliance officers.
9. Output only the blog body content (no frontmatter - that is added separately).
10. Use MDX-compatible syntax. Do not use curly braces in text unless inside a JSX component.
11. Every H2 heading should contain a target keyword where natural.
12. Use short paragraphs (2-4 sentences max). Use bullet points and numbered lists to improve scannability.`;
}

async function generateBlog(client: Anthropic, blog: BlogItem): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: blog.prompt }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in Claude response');
  return textBlock.text;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dayFlagIdx = args.indexOf('--day');
  if (dayFlagIdx === -1 || !args[dayFlagIdx + 1]) {
    console.error('Usage: npx ts-node scripts/blog/generate.ts --day <number>');
    process.exit(1);
  }
  const day = parseInt(args[dayFlagIdx + 1], 10);
  if (isNaN(day) || day < 1 || day > 30) {
    console.error('--day must be a number between 1 and 30');
    process.exit(1);
  }

  const dayPlan = CONTENT_PLAN.find(d => d.day === day);
  if (!dayPlan) {
    console.error(`No content plan found for day ${day}`);
    process.exit(1);
  }

  console.log(`\n🚀 Generating ${dayPlan.blogs.length} blog(s) for Day ${day}...\n`);

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const sheets = await getSheets();
  await ensureHeaders(sheets);

  for (let i = 0; i < dayPlan.blogs.length; i++) {
    const blog = dayPlan.blogs[i];
    const slot = i + 1;
    console.log(`Generating blog ${slot}/${dayPlan.blogs.length}: ${blog.title}...`);

    try {
      const content = await generateBlog(anthropic, blog);
      await appendBlogRow(sheets, day, slot, blog, content);
      console.log(`✅ Saved to Google Sheets: ${blog.slug}\n`);
    } catch (err) {
      console.error(`❌ Failed for ${blog.slug}:`, err);
    }
  }

  console.log(`\n✅ Day ${day} complete. Review in Google Sheets and set Status → "Approved" to publish.\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
