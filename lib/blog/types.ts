export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  level: number;
  levelLabel: string;
  country: string;
  locale: string;
  flag: string;
  regulation: string;
  keywords: string;
  canonicalUrl: string;
  ogImage: string;
  internalLinks: Array<{ slug: string; title: string; relationship: string }>;
  relatedBlogs: Array<{ slug: string; title: string; flag: string }>;
  slug: string;
  status: string;
  readingTime: string;
  excerpt: string;
}

export interface BlogPost extends BlogFrontmatter {
  content: string;
}

export interface BlogMeta extends BlogFrontmatter {
  slug: string;
}
