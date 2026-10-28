import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { api, getTokens, SESSION_EXPIRED_EVENT, setTokens } from './api';
import type { Employee, Tokens } from './types';

interface AuthContextValue {
  user: Employee | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Guarda o novo par de tokens (troca de senha invalida os anteriores). */
  replaceTokens: (tokens: Tokens) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ME_KEY = ['auth', 'me'];
const USER_KEY = 'ponto.user';

/** Último usuário carregado: sem internet, o app abre com ele em vez de esperar a rede. */
function getCachedUser(): Employee | undefined {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as Employee) : undefined;
  } catch {
    return undefined;
  }
}

function setCachedUser(user: Employee | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // armazenamento indisponível (modo privado restrito)
  }
}

async function fetchMe() {
  const user = await api<Employee>('/auth/me');
  setCachedUser(user);
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: () => (getTokens() ? fetchMe() : null),
    // Mostra o usuário guardado na hora e confirma com a API assim que houver conexão
    initialData: () => (getTokens() ? getCachedUser() : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const logout = () => {
    setTokens(null);
    setCachedUser(null);
    queryClient.clear();
    queryClient.setQueryData(ME_KEY, null);
  };

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  });

  const login = async (email: string, password: string) => {
    const tokens = await api<Tokens>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setTokens(tokens);
    queryClient.clear();
    await queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe });
  };

  const user = me.data ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: me.isPending,
        isAdmin: user?.role === 'ADMIN',
        login,
        logout,
        replaceTokens: setTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
