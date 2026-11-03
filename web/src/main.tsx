import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/toast';
import { AuthProvider } from './lib/auth';
import { createQueryClient } from './lib/query-client';
import './index.css';

const queryClient = createQueryClient();

// O app deixou de ser PWA: remove o service worker de quem instalou a versão antiga
navigator.serviceWorker?.getRegistrations().then((registrations) => {
  for (const registration of registrations) registration.unregister();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
