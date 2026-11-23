import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, getAuthToken, setAuthToken } from '../lib/api';
import { isClientSupabaseConfigured, supabaseClient } from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';

interface BootstrapStatus {
  hasUsers: boolean;
  provider: 'supabase' | 'local';
  schemaReady?: boolean;
  schemaError?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  hasUsers: boolean;
  provider: 'supabase' | 'local';
  schemaReady: boolean;
  schemaError: string;
  login: (email: string, password: string) => Promise<UserProfile>;
  registerFirstAdmin: (payload: {
    email: string;
    password: string;
    full_name: string;
    nip: string;
    department: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUsers, setHasUsers] = useState(true);
  const [provider, setProvider] = useState<'supabase' | 'local'>('local');
  const [schemaReady, setSchemaReady] = useState(true);
  const [schemaError, setSchemaError] = useState('');

  const refreshBootstrap = useCallback(async () => {
    try {
      const status = await apiFetch<BootstrapStatus>('/api/auth/bootstrap-status');
      setHasUsers(status.hasUsers);
      setProvider(status.provider);
      setSchemaReady(status.schemaReady !== false);
      setSchemaError(status.schemaError || '');
    } catch {
      // keep existing state
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const status = await apiFetch<BootstrapStatus>('/api/auth/bootstrap-status');
        if (!active) return;
        setHasUsers(status.hasUsers);
        setProvider(status.provider);
        setSchemaReady(status.schemaReady !== false);
        setSchemaError(status.schemaError || '');

        const token = getAuthToken();
        if (token) {
          try {
            const me = await apiFetch<{ user: UserProfile; provider: 'supabase' | 'local' }>(
              '/api/auth/me'
            );
            if (!active) return;
            setUser(me.user);
            setProvider(me.provider);
          } catch {
            setAuthToken(null);
            if (active) setUser(null);
          }
        }
      } catch (err) {
        if (!active) return;
        setSchemaReady(false);
        setSchemaError(err instanceof Error ? err.message : 'Gagal menghubungi server.');
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      setUser(res.user);
      setHasUsers(true);
      return res.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404') && isClientSupabaseConfigured && supabaseClient) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error || !data.session || !data.user) {
          throw new Error(error?.message || 'Email atau password salah.');
        }
        const meta = (data.user.user_metadata || {}) as Record<string, string>;
        const role: UserRole =
          meta.role === 'admin' || meta.role === 'guru' || meta.role === 'tenaga_kependidikan'
            ? meta.role
            : 'admin';
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          full_name: meta.full_name || (data.user.email || email).split('@')[0],
          nip: meta.nip || '',
          role,
          department: meta.department || '',
          created_at: data.user.created_at || new Date().toISOString(),
        };
        setAuthToken(data.session.access_token);
        setUser(profile);
        setHasUsers(true);
        return profile;
      }
      throw err;
    }
  }, []);

  const registerFirstAdmin = useCallback(
    async (payload: {
      email: string;
      password: string;
      full_name: string;
      nip: string;
      department: string;
    }) => {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register-first', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(res.token);
      setUser(res.user);
      setHasUsers(true);
      return res.user;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error during logout
    }
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasUsers,
        provider,
        schemaReady,
        schemaError,
        login,
        registerFirstAdmin,
        logout,
        refreshBootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
