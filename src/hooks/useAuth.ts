
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, createElement } from 'react';
import { UnifiedUser } from '@/types/unified';
import { authApi, profileApi } from '@/data/api';
import { usePathname } from 'next/navigation';

interface AuthContextType {
  user: UnifiedUser | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; first_name?: string; last_name?: string }) => Promise<void>;
  logout: (options?: { redirect?: boolean }) => Promise<void>;
  refreshUser: () => Promise<void>;
  setAuthenticatedUser: (user: UnifiedUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const userData = await profileApi.getMe();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/auth/campaign-access')) {
      setLoading(false);
      return;
    }
    refreshUser();
  }, [pathname, refreshUser]);

  const login = async (email: string, password: string) => {
    const authResponse = await authApi.login({ email, password });
    if (authResponse.user) {
      setUser(authResponse.user);
    } else {
      setUser(await profileApi.getMe());
    }
    setLoading(false);
  };

  const setAuthenticatedUser = useCallback((authenticatedUser: UnifiedUser) => {
    setUser(authenticatedUser);
    setLoading(false);
  }, []);

  const register = async (data: { email: string; username: string; password: string; first_name?: string; last_name?: string }) => {
    await authApi.register(data);
    const userData = await profileApi.getMe();
    setUser(userData);
    setLoading(false);
  };

  const logout = async (options: { redirect?: boolean } = {}) => {
    setUser(null);
    if (options.redirect !== false) {
      window.location.replace('/');
      void authApi.logout();
      return;
    }
    await authApi.logout();
  };

  const isAuthenticated = Boolean(user);
  const userId = user?.id ?? null;

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        loading,
        isLoading: loading,
        isAuthenticated,
        userId,
        login,
        register,
        logout,
        refreshUser,
        setAuthenticatedUser,
      },
    },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      loading: false,
      isLoading: false,
      isAuthenticated: false,
      userId: null,
      login: async () => undefined,
      register: async () => undefined,
      logout: async () => undefined,
      refreshUser: async () => undefined,
      setAuthenticatedUser: () => undefined,
    } satisfies AuthContextType;
  }
  return context;
}
