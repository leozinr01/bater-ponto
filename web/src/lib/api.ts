import type { Tokens } from './types';

const BASE_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;
const STORAGE_KEY = 'ponto.tokens';
/** Uma requisição pendurada vira erro em vez de deixar a tela carregando para sempre. */
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  try {
    if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento indisponível (modo privado restrito)
  }
}

/** Disparado quando a sessão não pode mais ser renovada. */
export const SESSION_EXPIRED_EVENT = 'ponto:session-expired';

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  /** Rotas públicas (login/refresh) não enviam token nem tentam renovar. */
  auth?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Erro ${res.status}`;
  try {
    const body = await res.json();
    if (Array.isArray(body.message)) message = body.message.join('\n');
    else if (typeof body.message === 'string') message = body.message;
  } catch {
    // corpo vazio ou não-JSON
  }
  if (res.status === 429) {
    message = 'Muitas tentativas. Aguarde 1 minuto e tente novamente.';
  }
  return new ApiError(res.status, message);
}

// Uma única renovação em andamento, compartilhada por requisições simultâneas
let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = getTokens()?.refreshToken;
    if (!refreshToken) return false;
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      setTokens((await res.json()) as Tokens);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(
  path: string,
  { method = 'GET', body, query, auth = true }: RequestOptions = {},
): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = auth ? getTokens()?.accessToken : undefined;
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth && getTokens()) {
      if (await refreshTokens()) {
        res = await send();
      } else {
        setTokens(null);
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(0, 'O servidor demorou demais para responder. Tente novamente.');
    }
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Erro inesperado';
}
