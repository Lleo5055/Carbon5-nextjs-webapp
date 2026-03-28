import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { BlogMeta, BlogPost } from './types';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

export function getAllBlogMeta(): BlogMeta[] {
  const slugs = getAllBlogSlugs();
  return slugs
    .map(slug => {
      const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(raw);
      return { ...(data as BlogMeta), slug };
    })
    .filter(b => b.status === 'published')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBlogPost(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { ...(data as BlogMeta), slug, content };
}

export function getRelatedBlogs(
  currentSlug: string,
  country: string,
  level: number,
  limit = 5,
): BlogMeta[] {
  const all = getAllBlogMeta();
  const scored = all
    .filter(b => b.slug !== currentSlug)
    .map(b => {
      let score = 0;
      if (b.country === country) score += 3;
      if (Math.abs(b.level - level) <= 1) score += 2;
      return { blog: b, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(s => s.blog);
}

/** Strip markdown bold/italic/code from a heading string for display */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
}

/** Extract H2 and H3 headings from raw MDX content for TOC */
export function extractHeadings(
  content: string,
): Array<{ text: string; id: string; depth: 2 | 3 }> {
  const lines = content.split('\n');
  const headings: Array<{ text: string; id: string; depth: 2 | 3 }> = [];
  for (const line of lines) {
    const m2 = line.match(/^## (.+)/);
    const m3 = line.match(/^### (.+)/);
    if (m2) {
      const raw = m2[1].trim();
      const text = stripMarkdown(raw);
      headings.push({ text, id: slugify(text), depth: 2 });
    } else if (m3) {
      const raw = m3[1].trim();
      const text = stripMarkdown(raw);
      headings.push({ text, id: slugify(text), depth: 3 });
    }
  }
  return headings;
}

/** Extract FAQ questions from headings starting with question words */
export function extractFAQs(
  content: string,
): Array<{ question: string; answer: string }> {
  const FAQ_STARTERS = /^(What|How|Is|When|Why|Who|Which|Can|Does|Should)/i;
  const lines = content.split('\n');
  const faqs: Array<{ question: string; answer: string }> = [];
  let i = 0;
  while (i < lines.length) {
    const h2 = lines[i].match(/^## (.+)/);
    if (h2 && FAQ_STARTERS.test(h2[1].trim())) {
      const question = h2[1].trim();
      const answerLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('## ')) {
        if (lines[i].trim()) answerLines.push(lines[i].trim());
        i++;
      }
      const answer = answerLines
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .slice(0, 500);
      if (answer) faqs.push({ question, answer });
    } else {
      i++;
    }
  }
  return faqs;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
