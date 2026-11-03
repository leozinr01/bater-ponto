import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ToastProvider } from './components/toast';
import { AuthProvider } from './lib/auth';
import { createQueryClient } from './lib/query-client';
import type { Employee } from './lib/types';

const USER: Employee = {
  id: 'u1',
  name: 'Teste',
  email: 'teste@leo.com',
  role: 'EMPLOYEE',
  active: true,
  workScheduleId: null,
  createdAt: '2026-11-03T12:00:00.000Z',
  updatedAt: null,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** API falsa: só login e /auth/me respondem; o resto fica carregando (as telas não importam aqui). */
function mockApi({ password }: { password: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/login')) {
        const body = JSON.parse(String(init?.body));
        return body.password === password
          ? json(200, { accessToken: 'access', refreshToken: 'refresh' })
          : json(401, { message: 'E-mail ou senha inválidos' });
      }
      if (url.endsWith('/auth/me')) {
        const auth = new Headers(init?.headers).get('Authorization');
        return auth === 'Bearer access' ? json(200, USER) : json(401, { message: 'Não autenticado' });
      }
      return new Promise<Response>(() => {});
    }),
  );
}

function renderApp(path: string) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitLogin(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('login', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('vai direto para o Bater ponto, sem precisar recarregar a página', async () => {
    mockApi({ password: 'teste1234' });
    renderApp('/login');

    // A tela de login já resolveu "ninguém logado" (null) antes do login: era esse valor,
    // ainda recente para o cache, que deixava a tela presa no login
    await submitLogin('teste@leo.com', 'teste1234');

    expect(await screen.findAllByRole('link', { name: /Bater ponto/ })).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();
  });

  it('vai para o Bater ponto mesmo vindo de outra página', async () => {
    mockApi({ password: 'teste1234' });
    renderApp('/registros');

    await submitLogin('teste@leo.com', 'teste1234');

    // Menu lateral e barra do celular: o item ativo é o Bater ponto
    const links = await screen.findAllByRole('link', { name: /Bater ponto/ });
    for (const link of links) expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('senha errada mostra o erro e continua no login', async () => {
    mockApi({ password: 'teste1234' });
    renderApp('/login');

    await submitLogin('teste@leo.com', 'errada123');

    expect(await screen.findByText('E-mail ou senha inválidos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });
});
