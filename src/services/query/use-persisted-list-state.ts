'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type PrimitiveStateValue = string | number | boolean;
type WidenValue<V> = V extends boolean ? boolean : V extends number ? number : string;
type WidenRecord<T extends Record<string, PrimitiveStateValue>> = { [K in keyof T]: WidenValue<T[K]> };

export interface PersistedListOptions {
  syncUrl?: boolean;
  readyToScroll?: boolean;
  highlightMs?: number;
}

interface StoredScrollAnchor {
  scrollY: number;
  rowId?: string;
  savedAt: number;
}

function coerceParam(raw: string, defVal: PrimitiveStateValue): PrimitiveStateValue {
  if (typeof defVal === 'number') {
    const num = Number(raw);
    return Number.isNaN(num) ? defVal : num;
  }
  if (typeof defVal === 'boolean') return raw === 'true';
  return raw;
}

/** Lưu bền vững bộ lọc, số dòng hiển thị và vị trí cuộn + bản ghi vừa mở qua sessionStorage/URL. */
export function usePersistedListState<T extends Record<string, PrimitiveStateValue>>(
  storageKey: string,
  defaults: T,
  options: PersistedListOptions = {}
) {
  type StateT = WidenRecord<T>;
  const { syncUrl = false, readyToScroll = true, highlightMs = 1800 } = options;
  const [state, setState] = useState<StateT>(defaults as unknown as StateT);
  const [isReady, setIsReady] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const scrollYRef = useRef(0);
  const didRestoreRef = useRef(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateKey = `vtvl_list_state:${storageKey}`;
  const scrollKey = `vtvl_list_scroll:${storageKey}`;

  useEffect(() => {
    didRestoreRef.current = false;
    setIsReady(false);
    const next: Record<string, PrimitiveStateValue> = { ...defaultsRef.current };
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(stateKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          Object.keys(defaultsRef.current).forEach((k) => {
            if (parsed[k] !== undefined) {
              next[k] = coerceParam(String(parsed[k]), defaultsRef.current[k]);
            }
          });
        }
      } catch { /* ignore */ }
      if (syncUrl) {
        const sp = new URLSearchParams(window.location.search);
        Object.keys(defaultsRef.current).forEach((k) => {
          const raw = sp.get(k);
          if (raw !== null) next[k] = coerceParam(raw, defaultsRef.current[k]);
        });
      }
    }
    setState(next as StateT);
    setIsReady(true);
  }, [stateKey, syncUrl]);

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(stateKey, JSON.stringify(state));
    } catch { /* ignore */ }
    if (syncUrl) {
      const sp = new URLSearchParams(window.location.search);
      Object.entries(state).forEach(([k, val]) => {
        if (val === defaultsRef.current[k] || val === '') sp.delete(k);
        else sp.set(k, String(val));
      });
      const qs = sp.toString();
      const targetUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(window.history.state, '', targetUrl);
    }
  }, [state, isReady, stateKey, syncUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => { scrollYRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const flashHighlight = useCallback((rowId?: string) => {
    if (!rowId) return;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedId(rowId);
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), highlightMs);
  }, [highlightMs]);

  const applyAnchorScroll = useCallback((anchor: StoredScrollAnchor) => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      if (anchor.scrollY > 0) {
        window.scrollTo({ top: anchor.scrollY, behavior: 'instant' as ScrollBehavior });
      }
      if (anchor.rowId) {
        const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(anchor.rowId) : anchor.rowId;
        const el = document.querySelector(`[data-row-anchor="${safeId}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < 72 || rect.bottom > window.innerHeight - 64) {
            el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          }
        }
        flashHighlight(anchor.rowId);
      }
    });
  }, [flashHighlight]);

  const saveScrollAnchor = useCallback((rowId?: string) => {
    if (typeof window === 'undefined') return;
    const payload: StoredScrollAnchor = { scrollY: window.scrollY || scrollYRef.current || 0, rowId, savedAt: Date.now() };
    try { sessionStorage.setItem(scrollKey, JSON.stringify(payload)); } catch { /* ignore */ }
  }, [scrollKey]);

  const restoreAnchorNow = useCallback((rowId?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(scrollKey);
      const parsed = raw ? (JSON.parse(raw) as StoredScrollAnchor) : { scrollY: scrollYRef.current, savedAt: Date.now() };
      applyAnchorScroll({ ...parsed, rowId: rowId || parsed.rowId });
      sessionStorage.removeItem(scrollKey);
    } catch { /* ignore */ }
  }, [scrollKey, applyAnchorScroll]);

  useEffect(() => {
    if (!isReady || !readyToScroll || didRestoreRef.current || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(scrollKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredScrollAnchor;
      didRestoreRef.current = true;
      sessionStorage.removeItem(scrollKey);
      if (Date.now() - (parsed.savedAt || 0) < 30 * 60 * 1000) applyAnchorScroll(parsed);
    } catch { /* ignore */ }
  }, [isReady, readyToScroll, scrollKey, applyAnchorScroll]);

  const setField = useCallback(<K extends keyof StateT>(key: K, value: StateT[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patchFields = useCallback((patch: Partial<StateT>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  return { state, setField, patchFields, highlightedId, saveScrollAnchor, restoreAnchorNow };
}
