import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password);
    tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
