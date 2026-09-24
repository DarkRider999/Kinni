import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { AuthUser, Entitlement, ProvidersInfo } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  entitlement: Entitlement | null;
  providers: ProvidersInfo | null;
  ready: boolean;
  /** Set when a Google/Facebook/GitHub sign-in bounced back with an error. */
  oauthError: string | null;
  clearOauthError: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setEntitlement: (e: Entitlement | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Reads `#auth=<token>` / `#auth_error=<msg>` left by the OAuth callback, then clears the hash. */
function takeOAuthResult(): { token?: string; error?: string } {
  if (typeof window === 'undefined' || !window.location.hash) return {};
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('auth') ?? undefined;
  const error = params.get('auth_error') ?? undefined;
  if (token || error) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return { token, error };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [providers, setProviders] = useState<ProvidersInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setEntitlement(null);
      return;
    }
    try {
      const me = await api.me();
      setUser(me.user);
      setEntitlement(me.entitlement);
    } catch {
      tokenStore.set(null);
      setUser(null);
      setEntitlement(null);
    }
  }, []);

  // On first load: accept an OAuth result, restore the session, load sign-in options.
  useEffect(() => {
    const { token, error } = takeOAuthResult();
    if (token) tokenStore.set(token);
    if (error) setOauthError(error);
    api.providers().then(setProviders).catch(() => setProviders(null));
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.token);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password);
    tokenStore.set(res.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    setEntitlement(null);
  }, []);

  const clearOauthError = useCallback(() => setOauthError(null), []);

  const value = useMemo(
    () => ({ user, entitlement, providers, ready, oauthError, clearOauthError, login, register, logout, refresh, setEntitlement }),
    [user, entitlement, providers, ready, oauthError, clearOauthError, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
