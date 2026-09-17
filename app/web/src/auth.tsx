/**
 * XAMOTO — Session.
 *
 * Le jeton est conservé sur l'appareil (localStorage) : l'application doit
 * fonctionner en zone à réseau instable. Aucune donnée sensible n'est stockée
 * dans le navigateur au-delà du jeton et du dernier rapport consulté.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  locale: string;
  country: string | null;
  plan: string;
  role: string;
  garageId: string | null;
}

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string; country?: string; locale?: string }) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const result = await api.get<{ user: SessionUser }>('/api/auth/me');
      setUser(result.user);
    } catch {
      // Jeton expiré ou révoqué : on repart proprement en mode non connecté.
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: SessionUser }>('/api/auth/login', { email, password });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string; country?: string; locale?: string }) => {
      const result = await api.post<{ token: string; user: SessionUser }>('/api/auth/register', input);
      setToken(result.token);
      setUser(result.user);
    },
    [],
  );

  const loginDemo = useCallback(async () => {
    const result = await api.post<{ token: string; user: SessionUser; noticeFr: string }>('/api/auth/demo', {});
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      /* même si le serveur est injoignable, la session locale doit être fermée */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, login, register, loginDemo, logout, refresh }),
    [user, loading, login, register, loginDemo, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
}
