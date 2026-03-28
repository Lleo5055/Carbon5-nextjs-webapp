import React from 'react';

/** Recursively extract plain text from React children */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) {
    return extractText((children.props as { children?: React.ReactNode }).children);
  }
  return '';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

export function H2({ children, ...props }: HeadingProps) {
  const id = slugify(extractText(children));
  return (
    <h2 id={id} {...props}>
      {children}
    </h2>
  );
}

export function H3({ children, ...props }: HeadingProps) {
  const id = slugify(extractText(children));
  return (
    <h3 id={id} {...props}>
      {children}
    </h3>
  );
}

export function H4({ children, ...props }: HeadingProps) {
  const id = slugify(extractText(children));
  return (
    <h4 id={id} {...props}>
      {children}
    </h4>
  );
}