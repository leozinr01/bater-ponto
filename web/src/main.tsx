import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { PwaPrompts } from './components/PwaPrompts';
import { ToastProvider } from './components/toast';
import { ApiError } from './lib/api';
import { AuthProvider } from './lib/auth';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Erros 4xx não melhoram com nova tentativa
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
      // Trocar de página não busca tudo de novo; marcações e correções invalidam na hora
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
            <PwaPrompts />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
