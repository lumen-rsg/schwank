'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function resolvePersistedSection<T extends string>(
  sections: readonly T[],
  hash: string,
  stored: string,
  fallback: T,
) {
  const candidate = hash || stored;
  return sections.includes(candidate as T) ? (candidate as T) : fallback;
}

export function usePersistedSection<T extends string>(
  userId: number,
  sections: readonly T[],
  fallback: T,
) {
  const [active, setActive] = useState<T>(fallback);
  const hydrated = useRef(false);

  useEffect(() => {
    const storageKey = `schwank-section:${userId}`;
    const hash = window.location.hash.slice(1);
    const stored = window.localStorage.getItem(storageKey) || '';
    queueMicrotask(() =>
      setActive(resolvePersistedSection(sections, hash, stored, fallback)),
    );
    hydrated.current = true;
  }, [fallback, sections, userId]);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(`schwank-section:${userId}`, active);
    const url = new URL(window.location.href);
    url.hash = active === fallback ? '' : active;
    window.history.replaceState(null, '', url);
  }, [active, fallback, userId]);

  const selectSection = useCallback(
    (section: string) => {
      if (sections.includes(section as T)) setActive(section as T);
    },
    [sections],
  );

  return [active, selectSection] as const;
}
