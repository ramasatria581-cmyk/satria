import { isClientSupabaseConfigured } from './supabase';
import { handleSupabaseClientFallback } from './supabaseFallback';

const TOKEN_KEY = 'smk_pu_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  // When deployed to static/SPA host (e.g. Vercel without Express server),
  // /api/* returns 404 or HTML fallback instead of JSON.
  if ((res.status === 404 || res.status === 405 || !isJson) && url.startsWith('/api/')) {
    if (isClientSupabaseConfigured) {
      return handleSupabaseClientFallback<T>(url, options);
    }
    throw new Error(
      'Server backend (/api) tidak ditemukan (404). Jika deploy di Vercel, pastikan VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY sudah diisi di Environment Variables.'
    );
  }

  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && String(data.error)) ||
      `Permintaan gagal (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
