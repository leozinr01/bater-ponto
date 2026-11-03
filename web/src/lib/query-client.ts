import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/** Cliente do React Query com as regras do app (também usado nos testes). */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Erros 4xx não melhoram com nova tentativa; sessão sem renovar também não (só
        // insistiria na rota de renovação)
        retry: (count, error) =>
          !(
            error instanceof ApiError &&
            ((error.status >= 400 && error.status < 500) || error.kind === 'session')
          ) && count < 2,
        refetchOnWindowFocus: true,
        // Trocar de página não busca tudo de novo; marcações e correções invalidam na hora
        staleTime: 30_000,
      },
    },
  });
}
