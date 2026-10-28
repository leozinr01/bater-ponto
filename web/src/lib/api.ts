import type { Tokens } from './types';

const BASE_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;
const STORAGE_KEY = 'ponto.tokens';
/** Uma requisição pendurada vira erro em vez de deixar a tela carregando para sempre. */
const TIMEOUT_MS = 20_000;

/**
 * http = a API respondeu com erro; network = sem resposta (sem rede ou demora): o pedido
 * pode ter chegado ao servidor; session = a sessão expirou e não deu para renovar agora,
 * então o pedido não foi processado.
 */
export type ApiErrorKind = 'http' | 'network' | 'session';

export class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;

  constructor(status: number, message: string, kind: ApiErrorKind = 'http') {
    super(message);
    this.status = status;
    this.kind = kind;
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

/** Diferença (ms) entre o relógio do servidor e o do aparelho. */
let serverClockOffset = 0;

/** Respostas mais lentas que isso não servem para acertar o relógio. */
const MAX_CLOCK_SAMPLE_RTT_MS = 1000;

/**
 * Acerta a diferença de relógio pelo cabeçalho Date das respostas da API. O cabeçalho
 * tem precisão de segundo, então diferenças menores que 2s são ignoradas; respostas
 * lentas são descartadas para a demora da rede não parecer diferença de relógio.
 */
function trackServerClock(res: Response, sentAt: number) {
  const receivedAt = Date.now();
  if (receivedAt - sentAt > MAX_CLOCK_SAMPLE_RTT_MS) return;
  const header = res.headers.get('date');
  const server = header ? Date.parse(header) : NaN;
  if (isNaN(server)) return;
  const offset = server + 500 - (sentAt + receivedAt) / 2;
  serverClockOffset = Math.abs(offset) >= 2000 ? offset : 0;
}

/** Agora pelo relógio do servidor: o mesmo horário que vai para as marcações. */
export function serverNow(): Date {
  return new Date(Date.now() + serverClockOffset);
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

/**
 * ok = sessão renovada; denied = a API recusou o refresh token (sessão encerrada);
 * unavailable = não deu para renovar agora (sem rede, demora, limite de tentativas,
 * erro no servidor): a sessão continua e a próxima requisição tenta de novo.
 */
type RefreshResult = 'ok' | 'denied' | 'unavailable';

// Uma única renovação em andamento, compartilhada por requisições simultâneas
let refreshing: Promise<RefreshResult> | null = null;

function refreshTokens(): Promise<RefreshResult> {
  refreshing ??= (async (): Promise<RefreshResult> => {
    const refreshToken = getTokens()?.refreshToken;
    if (!refreshToken) return 'denied';
    try {
      const sentAt = Date.now();
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      trackServerClock(res, sentAt);
      if (res.status === 400 || res.status === 401) return 'denied';
      if (!res.ok) return 'unavailable';
      setTokens((await res.json()) as Tokens);
      return 'ok';
    } catch {
      return 'unavailable';
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
  const send = async () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = auth ? getTokens()?.accessToken : undefined;
    if (token) headers.Authorization = `Bearer ${token}`;
    const sentAt = Date.now();
    const response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    trackServerClock(response, sentAt);
    return response;
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth && getTokens()) {
      const refreshed = await refreshTokens();
      if (refreshed === 'ok') {
        res = await send();
      } else if (refreshed === 'denied') {
        setTokens(null);
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      } else {
        throw new ApiError(
          0,
          'Não foi possível renovar a sessão agora. Verifique a conexão e tente novamente.',
          'session',
        );
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(0, 'O servidor demorou demais para responder. Tente novamente.', 'network');
    }
    throw new ApiError(0, 'Não foi possível conectar ao servidor.', 'network');
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Erro inesperado';
}
