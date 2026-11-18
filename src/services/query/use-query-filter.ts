'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

export type QueryParamValue = string | number | boolean | undefined | null;
export type QueryParamsRecord = Record<string, QueryParamValue>;

export interface QueryFunctionContext<TData, TParams extends QueryParamsRecord> {
  queryKey: readonly string[];
  params: TParams;
  data: TData[];
}

export type QueryFilterFn<TData, TParams extends QueryParamsRecord> = (
  ctx: QueryFunctionContext<TData, TParams>
) => TData[];

export function buildSearchParamsString(params: QueryParamsRecord, defaults: QueryParamsRecord = {}): string {
  if (typeof window === 'undefined') return '';
  const searchParams = new URLSearchParams(window.location.search);
  Object.entries(params).forEach(([key, val]) => {
    const defVal = defaults[key];
    if (val === undefined || val === null || val === '' || val === defVal) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, String(val));
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : window.location.pathname;
}

export function readUrlQueryParams<TParams extends QueryParamsRecord>(defaults: TParams): TParams {
  if (typeof window === 'undefined') return defaults;
  const sp = new URLSearchParams(window.location.search);
  const next = { ...defaults };
  (Object.keys(defaults) as Array<keyof TParams>).forEach((key) => {
    const raw = sp.get(String(key));
    if (raw !== null) {
      const defVal = defaults[key];
      if (typeof defVal === 'number') {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) next[key] = parsed as TParams[keyof TParams];
      } else if (typeof defVal === 'boolean') {
        next[key] = (raw === 'true') as TParams[keyof TParams];
      } else {
        next[key] = raw as TParams[keyof TParams];
      }
    }
  });
  return next;
}

export interface UseQueryFilterOptions<TData, TParams extends QueryParamsRecord> {
  queryKey: readonly string[];
  initialParams: TParams;
  data: TData[];
  queryFn: QueryFilterFn<TData, TParams>;
  syncUrl?: boolean;
}

export function useQueryFilter<TData, TParams extends QueryParamsRecord>({
  queryKey,
  initialParams,
  data,
  queryFn,
  syncUrl = true
}: UseQueryFilterOptions<TData, TParams>) {
  const [params, setParamsState] = useState<TParams>(initialParams);
  const [urlReady, setUrlReady] = useState(!syncUrl);
  const initialParamsRef = useRef(initialParams);
  initialParamsRef.current = initialParams;

  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    setParamsState(readUrlQueryParams(initialParamsRef.current));
    setUrlReady(true);
  }, [syncUrl]);

  useEffect(() => {
    if (!syncUrl || !urlReady || typeof window === 'undefined') return;
    const nextUrl = buildSearchParamsString(params, initialParams);
    window.history.replaceState(null, '', nextUrl);
  }, [params, initialParams, syncUrl, urlReady]);

  const setParam = useCallback(<K extends keyof TParams>(key: K, value: TParams[K]) => {
    setParamsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setParams = useCallback((patch: Partial<TParams>) => {
    setParamsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetParams = useCallback(() => {
    setParamsState(initialParams);
  }, [initialParams]);

  const filteredData = useMemo(() => {
    return queryFn({
      queryKey,
      params,
      data
    });
  }, [queryFn, queryKey, params, data]);

  return {
    params,
    setParam,
    setParams,
    resetParams,
    data: filteredData,
    totalCount: data.length,
    filteredCount: filteredData.length
  };
}

