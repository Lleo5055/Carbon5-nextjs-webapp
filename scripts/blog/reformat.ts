/**
 * scripts/blog/reformat.ts
 * Improve heading hierarchy of already-published MDX blogs without changing content.
 *
 * Usage:
 *   # Fix specific slugs:
 *   npx ts-node --project scripts/tsconfig.json scripts/blog/reformat.ts --slugs what-is-carbon-accounting,carbon-accounting-india
 *
 *   # Fix ALL published blogs:
 *   npx ts-node --project scripts/tsconfig.json scripts/blog/reformat.ts --all
 */

import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── Env ────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

// ── Prompt ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert technical editor specialising in SEO-optimised content structure.
Your job is to improve the heading hierarchy of a blog post body WITHOUT changing any text, facts, CTAs, links, or meaning.

Rules:
1. Keep ALL existing ## (H2) headings exactly as written.
2. Within each H2 section, identify 2-3 logical subsections and promote or add ### (H3) headings to label them. If suitable H3 headings already exist, keep them. If not, add short descriptive ### headings before the relevant paragraphs.
3. Where a H3 section has clear sub-points (e.g. a numbered list or a multi-step explanation), add #### (H4) headings for each sub-point.
4. Do NOT add, remove, or reword any paragraph text, bullet points, links, or <BlogCTA> components.
5. Do NOT use em dashes (—). Use a hyphen (-) if needed.
6. Return ONLY the updated blog body — no frontmatter, no commentary, no code fences around the output.`;

function buildUserPrompt(content: string, title: string): string {
  return `Here is the blog body for "${title}". Improve the heading hierarchy by adding H3 and H4 subheadings where appropriate. Do not change any content.

---
${content}
---`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

async function reformatBlog(client: Anthropic, slug: string): Promise<void> {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${slug}.mdx — skipping`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content } = matter(raw);
  const title = (frontmatter.title as string) ?? slug;

  console.log(`  Reformatting: ${title}...`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(content, title) }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No text response for ${slug}`);
  }

  const improvedContent = textBlock.text
    // Strip any accidental code fences Claude might add
    .replace(/^```(?:mdx|markdown)?\n?/m, '')
    .replace(/\n?```$/m, '')
    // Remove em dashes just in case
    .replace(/—/g, ' - ')
    .trim();

  // Rebuild the MDX file: frontmatter + improved body
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === 'string') {
      lines.push(`${key}: "${(value as string).replace(/"/g, "'")}"`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value as Record<string, string>[]) {
        const entries = Object.entries(item);
        lines.push(`  - ${entries[0][0]}: "${String(entries[0][1]).replace(/"/g, "'")}"`);
        for (const [k, v] of entries.slice(1)) {
          lines.push(`    ${k}: "${String(v).replace(/"/g, "'")}"`);
        }
      }
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(improvedContent);

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`  ✅ Updated: content/blog/${slug}.mdx`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let slugs: string[] = [];

  if (args.includes('--all')) {
    slugs = getAllSlugs();
    if (slugs.length === 0) {
      console.log('No published blogs found in content/blog/');
      return;
    }
    console.log(`\n📝 Reformatting ALL ${slugs.length} blog(s)...\n`);
  } else {
    const slugsFlag = args.indexOf('--slugs');
    if (slugsFlag === -1 || !args[slugsFlag + 1]) {
      console.error('Usage:');
      console.error('  --slugs slug1,slug2   Fix specific slugs');
      console.error('  --all                 Fix all published blogs');
      process.exit(1);
    }
    slugs = args[slugsFlag + 1].split(',').map(s => s.trim()).filter(Boolean);
    console.log(`\n📝 Reformatting ${slugs.length} blog(s): ${slugs.join(', ')}\n`);
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  for (const slug of slugs) {
    try {
      await reformatBlog(client, slug);
    } catch (err) {
      console.error(`❌ Failed for ${slug}:`, err);
    }
  }

  console.log('\n✅ Done. Restart your dev server to see changes.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});