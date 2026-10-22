# Sistema de Ponto · TAI Project — Front-end (PWA)

Interface web da API de ponto. **Stack:** React 19 · Vite · TypeScript · Tailwind CSS 4 · React Router · TanStack Query.

## Executar

Com a API rodando em `http://localhost:3333` (veja o README da raiz):

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Em desenvolvimento, o Vite encaminha `/api` para a API, então não é preciso configurar `CORS_ORIGIN`. Para apontar para outra API local: `API_URL=http://localhost:4000 npm run dev`.

## Build de produção

```bash
npm run build      # gera web/dist (arquivos estáticos)
```

- Servindo o front **no mesmo domínio** da API (proxy reverso encaminhando `/api` para o Nest): deixe `VITE_API_URL` vazio.
- Servindo **em outro domínio**: defina `VITE_API_URL=https://api.suaempresa.com` antes do build e inclua o domínio do front em `CORS_ORIGIN` na API.
- Configure o servidor para devolver `index.html` em qualquer rota (SPA), ex.: `try_files $uri /index.html;` no nginx.

## PWA (app instalável)

O front é um PWA: pode ser instalado no celular e no computador e abre em tela cheia, como um app.

- **Testar localmente:** o service worker só roda no build de produção.
  ```bash
  npm run build && npm run preview   # http://localhost:4173 (com a API rodando)
  ```
  No Chrome/Edge aparece o ícone de instalar na barra de endereço, e o botão **Instalar app** no menu.
- **No celular** o PWA exige **HTTPS**, então só funciona depois do deploy (ex.: Vercel).
  Android/Chrome oferece a instalação; no iPhone é pelo Safari, em Compartilhar → Adicionar à Tela de Início
  (o app mostra esse passo a passo).
- **Atualizações:** quando sai uma versão nova, o app mostra "Nova versão disponível · Atualizar".
- **Sem internet:** o app abre (fica em cache), mas o botão de ponto é desativado. A API nunca é
  cacheada: o horário do ponto é sempre o do servidor.
- **Ícones:** gerados a partir de `public/pwa-icon.svg` e `public/pwa-maskable.svg` com `npm run icons`.

## Telas

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/login` | público | Login (não há cadastro público) |
| `/` | todos | Relógio, botão de registrar ponto e resumo de hoje (linha do tempo, saída prevista) |
| `/registros` | todos | Aba **Por dia**: resumo do mês, semana clicável e dias agrupados por semana; imprime como espelho de ponto. Aba **Marcações**: cada marcação, com correções (`/espelho` e `/historico` redirecionam para cá) |
| `/conta` | todos | Dados, jornada e troca de senha |
| `/admin/relatorio` | admin | Totais do mês por funcionário, exportação em CSV |
| `/admin/funcionarios` | admin | Cadastro, edição, jornada, redefinição de senha, desativação |
| `/admin/jornadas` | admin | Cadastro e edição de jornadas |

**Correções (admin):** no espelho de outro funcionário, clique num horário para trocar o horário ou desconsiderar a marcação, ou em **+** para incluir uma marcação faltante. A justificativa é obrigatória. Os horários são informados no fuso da empresa (`APP_TIMEZONE`) e enviados com deslocamento explícito.

## Estrutura

```
src/
  lib/          cliente HTTP (tokens + refresh automático), auth, hooks de dados, formatação de datas
  components/   UI base, layout, modais de correção, seletor de funcionário
  pages/        telas; pages/admin = telas de administrador
```

Os tokens ficam no `localStorage`. Um 401 tenta renovar com o refresh token uma vez; se falhar, a sessão é encerrada.
