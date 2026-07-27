import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Props {
  text: string;
  /** Override the query (defaults to the global task search query) */
  query?: string;
  className?: string;
}

/**
 * Renders `text`, wrapping every occurrence of the active search query
 * in a highlighted <mark>.
 */
export default function HighlightText({ text, query, className }: Props) {
  const { searchQuery } = useApp();
  const q = (query ?? searchQuery ?? '').trim();

  const parts = useMemo(() => {
    if (!q || !text) return null;
    try {
      const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
      const split = text.split(re);
      if (split.length <= 1) return null;
      return split;
    } catch {
      return null;
    }
  }, [text, q]);

  if (!parts) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className={`rounded-[3px] px-0.5 bg-accent/40 text-foreground ${className ?? ''}`}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
