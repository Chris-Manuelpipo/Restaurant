import type { ApiError, SessionResponse } from '@evolyx/shared';

/**
 * Client de l'API.
 *
 * Deux choses lui incombent, et rien d'autre :
 *  - porter le jeton d'accès ;
 *  - renouveler la session **une fois** quand il expire, puis rejouer la requête. Le gérant
 *    ne doit jamais être renvoyé à l'écran de connexion au milieu d'un service.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3010';
const BASE = `${API_URL}/api/v1`;

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

/**
 * Le jeton vit hors de React, mais React doit réagir quand il change : sans cet abonnement,
 * l'écran qui suit une connexion resterait persuadé qu'il n'y a pas de session.
 */
const listeners = new Set<() => void>();

export function subscribeToToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) sessionStorage.setItem('evolyx:token', token);
    else sessionStorage.removeItem('evolyx:token');
  } catch {
    /* stockage refusé : la session vivra le temps de l'onglet */
  }
  for (const listener of listeners) listener();
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    accessToken = sessionStorage.getItem('evolyx:token');
  } catch {
    accessToken = null;
  }
  return accessToken;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, body: ApiError | null, fallback: string) {
    super(body?.error?.message ?? fallback);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body?.error?.code ?? 'UNKNOWN';
    this.details = body?.error?.details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Requête déjà rejouée après renouvellement : on ne recommence pas indéfiniment. */
  retried?: boolean;
  raw?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retried, raw, headers, ...rest } = options;
  const token = getAccessToken();

  const isFormData = body instanceof FormData;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: isFormData ? body : JSON.stringify(body) }
      : {}),
  });

  if (response.status === 401 && !retried) {
    const renewed = await refreshSession();
    if (renewed) return request<T>(path, { ...options, retried: true });
  }

  if (!response.ok) {
    let payload: ApiError | null = null;
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      /* réponse sans corps JSON */
    }
    throw new ApiRequestError(response.status, payload, 'La requête a échoué.');
  }

  if (raw) return (await response.blob()) as T;
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Un seul renouvellement à la fois, même si dix requêtes échouent en même temps. */
async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setAccessToken(null);
        return false;
      }
      const body = (await response.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/* ── Raccourcis ─────────────────────────────────────────────────────────── */

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T,>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form });
  },
  blob: (path: string) => request<Blob>(path, { raw: true }),
};

export async function login(email: string, password: string): Promise<SessionResponse> {
  const { accessToken: token } = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setAccessToken(token);
  return api.get<SessionResponse>('/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

/** URL absolue d'un média servi par l'API. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('/') ? `${API_URL}${path}` : path;
}

export { API_URL };
