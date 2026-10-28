# Sistema de Ponto · TAI Project

[![CI](https://github.com/leozinr01/bater-ponto/actions/workflows/ci.yml/badge.svg)](https://github.com/leozinr01/bater-ponto/actions/workflows/ci.yml)

Controle de ponto da TAI Project: o funcionário bate o ponto pelo app (PWA instalável no celular), acompanha as horas do dia e do mês, e o administrador gerencia funcionários e jornadas, corrige marcações com justificativa e tira o relatório da equipe.

| Parte | Pasta | Stack |
| --- | --- | --- |
| **API** | raiz (`src/`) | TypeScript · NestJS 11 · Prisma 6 (driver `pg`) · PostgreSQL · JWT · Swagger · Vitest |
| **App (PWA)** | [`web/`](web/README.md) | React 19 · Vite · TypeScript · Tailwind CSS 4 · TanStack Query · vite-plugin-pwa |
| **Banco** | `prisma/` | PostgreSQL (Supabase em produção, Postgres local ou Docker no desenvolvimento) |

> ⚠️ **Antes de usar oficialmente**, leia [docs/CONFORMIDADE.md](docs/CONFORMIDADE.md). Este sistema **não está homologado** como REP-P da Portaria MTP nº 671/2021.

---

## O que o app faz

**Funcionário**
- **Bater ponto:** relógio, botão "Registrar entrada/saída" e o resumo de hoje: horas trabalhadas, progresso da jornada, saída prevista e a linha do tempo das marcações (entrada em verde, saída em vermelho, intervalos).
- **Registros:** aba **Por dia** com o resumo do mês, a semana clicável (toque num dia para ver os horários) e os dias agrupados por semana; aba **Marcações** com cada marcação e as correções feitas. Imprime no formato de **espelho de ponto**.
- **Banco de horas:** saldo acumulado desde o cadastro (horas extras − falta de horas − folgas de banco ± ajustes) e extrato mês a mês. O administrador lança ajustes (ex.: horas pagas em folha) e "Folga de banco" como tipo de abono nos Registros; o Relatório mostra o saldo de cada um.
- **Minha conta:** dados, jornada e troca de senha.

**Administrador** (além do acima)
- **Hoje:** painel ao vivo da equipe: quem está trabalhando, em intervalo, atrasado, ainda não chegou, encerrou ou está de folga, com horas do dia e progresso da jornada. Atualiza a cada minuto.
- **Relatório** do mês por funcionário, com exportação em CSV.
- **Feriados:** cadastro por ano e importação dos feriados nacionais (incluindo a Paixão de Cristo, que muda todo ano). Em dia de trabalho, feriado não gera falta e o tempo trabalhado conta como extra.
- **Alertas da CLT** nos registros e no relatório: intervalo abaixo do mínimo (art. 71), mais de 2h extras no dia (art. 59) e menos de 11h de descanso entre jornadas (art. 66).
- **Funcionários:** cadastro, perfil, jornada, redefinição de senha e desativação (ninguém é excluído).
- **Jornadas:** entrada prevista, carga diária, dias de trabalho e tolerâncias. Mudanças (na jornada ou na de um funcionário) valem a partir do dia em que são feitas: os meses anteriores não são recalculados.
- **Correções** direto nos Registros de outro funcionário: incluir marcação faltante, trocar horário ou desconsiderar, sempre com justificativa.
- **Abonos:** atestado, férias, afastamento ou abono de dias inteiros, lançados nos Registros (inclusive direto de um dia marcado como falta). Os dias de trabalho cobertos não geram falta nem horas previstas. Cancelar não apaga: o lançamento fica no histórico.

**App instalável (PWA):** abre em tela cheia com barra de abas no celular, convite de instalação (inclusive passo a passo no iPhone), QR code para instalar a partir do computador e aviso de nova versão. Sem internet o app abre, mas o ponto fica bloqueado: o horário é sempre o do servidor. Detalhes em [web/README.md](web/README.md).

---

## Rodando localmente

Pré-requisitos: **Node.js 20+** (testado com 22 e 24), npm e um PostgreSQL 14+ (local, Docker ou Supabase).

```bash
# 1. Dependências da API e do app
npm install
npm install --prefix web

# 2. Banco (pule se for usar Supabase ou um Postgres já instalado)
docker compose up -d

# 3. Variáveis de ambiente
cp .env.example .env
# edite .env: DATABASE_URL e JWT_SECRET (o comando para gerar está no arquivo)

# 4. Tabelas
npx prisma migrate deploy

# 5. Primeiro administrador (não existe cadastro público)
ADMIN_NAME="Administrador" ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD='troque-esta-senha' npm run admin:create
```

No **PowerShell**, o passo 5 fica assim:

```powershell
$env:ADMIN_NAME="Administrador"; $env:ADMIN_EMAIL="admin@empresa.com"; $env:ADMIN_PASSWORD="troque-esta-senha"; npm run admin:create
```

Para apresentar o sistema com dados (opcional, **só em banco de desenvolvimento ou de demonstração**, nunca no de produção): `CONFIRM_DEMO_SEED=sim npm run seed:demo` cria 2 jornadas, os feriados nacionais e 8 funcionários fictícios (`@demo.local`, senha `demo1234`) com cerca de 2 meses de marcações variadas. No PowerShell: `$env:CONFIRM_DEMO_SEED="sim"; npm run seed:demo`.

Depois, em dois terminais:

```bash
npm run start:dev          # API em http://localhost:3333/api (Swagger em /swagger com SWAGGER_ENABLED=true)
npm run dev --prefix web   # App em http://localhost:5173
```

O app encaminha `/api` para a API, então em desenvolvimento não é preciso configurar CORS. Para testar o **PWA instalável** (service worker), use o build de produção: `npm run build --prefix web && npm run preview --prefix web` → `http://localhost:4173`.

### Variáveis de ambiente da API

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | sim | – | URL do PostgreSQL (veja abaixo para Supabase) |
| `JWT_SECRET` | sim | – | Segredo HS256, mínimo de 32 caracteres |
| `PORT` | não | `3333` | Porta HTTP |
| `NODE_ENV` | não | `development` | `development`, `test` ou `production` |
| `JWT_ACCESS_EXPIRES_IN` | não | `1h` | Validade do access token |
| `JWT_REFRESH_EXPIRES_IN` | não | `7d` | Validade do refresh token |
| `APP_TIMEZONE` | não | `America/Sao_Paulo` | Fuso que define o "dia" de trabalho e interpreta os horários das jornadas |
| `CORS_ORIGIN` | não | vazio (desligado) | Origens permitidas, separadas por vírgula. Necessário quando o app fica em outro domínio |
| `SWAGGER_ENABLED` | não | `false` | `true` liga a documentação interativa em `/swagger`. Deixe desligado em produção |

A API não sobe se alguma variável for inválida. As variáveis do app (`VITE_API_URL`, `VITE_PUBLIC_URL`) estão em [web/.env.example](web/.env.example).

### Banco no Supabase

- Use a URL do **pooler** (painel do projeto → **Connect** → Connection string): *Session pooler* (porta 5432) ou *Transaction pooler* (porta 6543). Alguns provedores e redes corporativas bloqueiam a 5432; nesse caso use a 6543.
- Caracteres especiais da senha precisam ser codificados na URL (`@` vira `%40`). Prefira senhas só com letras e números.
- A API usa o **driver `pg` dentro do Prisma** ([src/infra/database/prisma.service.ts](src/infra/database/prisma.service.ts)): cada consulta é uma única ida e volta ao banco e funciona nos dois modos do pooler. Com o motor nativo do Prisma e `pgbouncer=true`, cada consulta virava 4 idas e voltas. O parâmetro `pgbouncer` na URL é ignorado.
- **SSL:** banco remoto usa conexão criptografada sem verificar o certificado (o mesmo padrão `sslmode=prefer` do Prisma). Para verificar, baixe o certificado do Supabase (Project Settings → Database → SSL) e acrescente `sslmode=verify-full&sslrootcert=<caminho>` na URL.
- **Desempenho:** cada consulta custa a distância entre a API e o banco. Em produção, hospede a API **na mesma região** do banco; para desenvolver, um Postgres local é instantâneo.

---

## Testes

```bash
npm test               # unitários: regras de cálculo do espelho (sem banco)
npm run test:e2e       # e2e: API completa contra PostgreSQL real
npm run test:all       # os dois
npm run typecheck      # tipos da API
npm run typecheck --prefix web   # tipos do app
```

Os testes e2e usam o PostgreSQL de `DATABASE_URL`, mas cada arquivo cria um **schema próprio e temporário** (`test_<uuid>`), aplica as migrations reais e o remove no final. Os dados existentes não são tocados. O usuário do banco precisa de permissão para criar schemas. Prefira rodá-los contra um Postgres local.

Cobertura: login, refresh, troca de senha e invalidação de tokens, limite de tentativas, permissões de todas as rotas administrativas, cadastro e paginação de funcionários, registro de ponto (inclusive cliques simultâneos), filtros por funcionário/período no fuso local, espelho com múltiplas marcações, intervalos, atraso, hora extra, jornada noturna, falta e dia incompleto, correções preservando o original e efeito da jornada nos cálculos, feriados (importação e efeito nas faltas), abonos (sobreposição, cancelamento e permissões), painel do dia e alertas da CLT.

O **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) roda a cada push na `main` e em pull requests: tipos, unitários e e2e da API contra um PostgreSQL descartável, e build do app.

---

## Deploy

Arquitetura recomendada:

| Parte | Onde | Observações |
| --- | --- | --- |
| App (PWA) | Vercel, Netlify ou Cloudflare Pages | Raiz `web/`, build `npm run build`, saída `dist/`. Defina `VITE_API_URL` com o endereço da API. Configure a SPA para devolver `index.html` em qualquer rota |
| API | Render, Railway, Fly.io ou VPS | `npm run build && npm run start:prod`. Mesma região do banco. Planos grátis que "dormem" deixam o primeiro ponto do dia lento |
| Banco | Supabase | Ative backups antes do uso real |

Na API de produção: `NODE_ENV=production`, `JWT_SECRET` forte e exclusivo, `CORS_ORIGIN` com o domínio do app e `npx prisma migrate deploy` a cada versão com migration nova.

O PWA só pode ser instalado no celular com **HTTPS**, ou seja, depois do deploy. A partir daí o QR code de instalação (login e Minha conta) aponta sozinho para o endereço público.

---

## Como funciona

### Perfis e permissões

- **Não existe cadastro público.** O primeiro admin é criado por `npm run admin:create`; os demais usuários são criados por um admin, que também define o papel (`EMPLOYEE`/`ADMIN`).
- Todas as rotas exigem token, exceto `login` e `refresh`. O app renova o token sozinho e encerra a sessão se a renovação falhar.
- O papel e o status são lidos do banco a cada requisição: desativar um usuário ou mudar seu papel vale na hora, mesmo com tokens já emitidos.
- Trocar ou redefinir a senha invalida todos os tokens anteriores do usuário.
- Funcionários consultam apenas os próprios registros (`403` ao tentar outro `employeeId`).
- Um admin não pode corrigir as próprias marcações, nem desativar ou rebaixar a própria conta.
- Funcionários nunca são excluídos: são desativados (`active=false`) e seus registros são mantidos.

### Marcações

- `POST /api/punches` registra uma marcação com o **horário do servidor**. O cliente não envia horário nem tipo.
- Não há tipo "entrada/saída" gravado: em cada jornada, a ordem cronológica define 1ª = entrada, 2ª = saída, 3ª = entrada (volta do intervalo)... Isso permite qualquer quantidade de marcações e intervalos, e uma correção nunca deixa os tipos inconsistentes.
- Uma segunda marcação do mesmo funcionário em menos de 1 minuto é recusada (`409`) como clique duplicado. Requisições simultâneas são serializadas por funcionário (lock no banco).
- Fora isso, marcações nunca são bloqueadas (a Portaria 671 proíbe restringir a marcação).

### Espelho de ponto (`GET /api/punches/timesheet`)

Regras do cálculo ([src/punches/timesheet.ts](src/punches/timesheet.ts)):

- **Jornada:** marcações consecutivas pertencem à mesma jornada enquanto o intervalo entre saída e nova entrada for menor que 6h e nenhum período contínuo de trabalho passar de 14h. Assim, esquecer a saída de um dia não transforma a entrada do dia seguinte em "saída".
- **Dia da jornada:** a data local (`APP_TIMEZONE`) da primeira marcação. Uma jornada 22:00 → 06:00 conta inteira no dia em que começou.
- **Horas trabalhadas:** soma de **todos** os pares entrada/saída. Intervalos são os espaços entre os pares. Marcações valem com precisão de minuto.
- **Dia incompleto** (número ímpar de marcações): **nenhum horário é inventado**. Contam só os pares completos, o dia aparece como `incomplete` e extra/falta fica `null` até a correção. Se a jornada aberta é recente, o status é `in_progress`.
- **Atraso:** primeira marcação comparada ao `startTime` da jornada. Até `lateToleranceMinutes` não é computado; acima disso conta o atraso inteiro.
- **Hora extra / falta de horas:** trabalhado − `dailyMinutes`. Diferenças até `overtimeToleranceMinutes` são zeradas. Em dia que não é de trabalho, tudo é hora extra.
- **Falta (`absent`):** dia de trabalho passado sem marcações, a partir da data de cadastro. É contada em `absentDays`, separada da falta de horas.
- **Sem jornada configurada:** horas trabalhadas são calculadas; atraso, extra e falta ficam `null`.
- Período máximo por consulta: 93 dias.

### Correções (admin, sempre com justificativa)

| Operação | Rota | Efeito |
| --- | --- | --- |
| Incluir marcação faltante | `POST /api/punches/manual` | Nova marcação com `source=ADMIN`, autor e motivo |
| Desconsiderar marcação | `POST /api/punches/:id/void` | Marca `voidedAt`, autor e motivo. **Nada é apagado** |
| Trocar horário | `POST /api/punches/:id/replace` | Desconsidera a original e inclui a nova (`replacesId`) na mesma transação |

A lista de marcações (`GET /api/punches`) mostra as desconsideradas por padrão (`includeVoided=false` para ocultar). O cálculo usa só as válidas. Horários manuais têm fuso explícito (`2026-10-20T08:00:00-03:00`) e não podem estar no futuro; o app monta esse formato a partir da data e hora digitadas no fuso da empresa.

### Fuso horário

Instantes são gravados como `timestamptz` (UTC) e devolvidos em UTC (`timestamp`) e no fuso da empresa (`localTime`). Datas de filtro (`from`/`to`, `YYYY-MM-DD`) e horários de jornada são interpretados no `APP_TIMEZONE`.

---

## Endpoints

Prefixo `/api`. Detalhes de payloads e respostas no Swagger (`/swagger`), disponível com `SWAGGER_ENABLED=true`.

| Método | Rota | Quem | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/login` | público | Login, devolve `accessToken` e `refreshToken` (limite de 10/min) |
| POST | `/auth/refresh` | público | Novo par de tokens a partir do refresh token |
| GET | `/auth/me` | autenticado | Dados do usuário logado |
| POST | `/auth/password` | autenticado | Troca a própria senha |
| POST | `/employees` | admin | Cadastra funcionário/admin |
| GET | `/employees` | admin | Lista (`search`, `active`, `role`, `page`, `pageSize`) |
| GET / PATCH | `/employees/:id` | admin | Consulta / atualiza nome, e-mail, papel, jornada, status |
| POST | `/employees/:id/password` | admin | Redefine a senha |
| POST / GET | `/work-schedules` | admin | Cadastra / lista jornadas |
| GET / PATCH | `/work-schedules/:id` | admin | Consulta / atualiza jornada |
| POST | `/punches` | autenticado | Registra marcação |
| GET | `/punches` | autenticado* | Marcações (`employeeId`, `from`, `to`, `includeVoided`, paginação) |
| GET | `/punches/timesheet` | autenticado* | Espelho do período (`employeeId`, `from`, `to`) |
| GET | `/punches/report` | admin | Totais do período por funcionário (paginado) |
| POST | `/punches/manual` | admin | Correção: inclusão |
| POST | `/punches/:id/void` | admin | Correção: desconsiderar |
| POST | `/punches/:id/replace` | admin | Correção: trocar horário |

\* Funcionário: apenas os próprios dados. Admin: qualquer funcionário via `employeeId`.

Listas paginadas respondem `{ data: [...], meta: { page, pageSize, total, totalPages } }` (`pageSize` máximo 100). Erros de validação respondem `400` com `message` contendo a lista de problemas.

---

## Estrutura

```
src/                 API (NestJS)
  auth/              login, refresh, guards globais (JWT + papéis), decorators
  employees/         cadastro e gestão de usuários (admin)
  work-schedules/    jornadas de trabalho (admin)
  punches/           marcações, correções, espelho e relatório
    timesheet.ts     regras de cálculo (funções puras, testadas em timesheet.spec.ts)
  common/            paginação, fuso horário, helpers de Swagger
  infra/             Prisma (driver pg) e variáveis de ambiente
prisma/              schema, migrations e script de criação do admin
test/                testes e2e
web/                 app (PWA)
  src/pages/         telas: ponto, registros, conta e admin/
  src/components/    UI, layout, linha do tempo, correções, PWA
  src/lib/           cliente HTTP, autenticação, consultas, datas, PWA
  public/            ícones do app e SVGs de origem
docs/                conformidade legal
```

---

## Antes de produção

- **Backups** automáticos e testados do banco (no Supabase, plano com backup diário ou point-in-time recovery; ou `pg_dump` agendado com retenção). Registros de ponto precisam ser guardados por anos.
- HTTPS obrigatório, `NODE_ENV=production`, `JWT_SECRET` forte e exclusivo, `CORS_ORIGIN` restrito ao domínio do app.
- Senha do banco forte e guardada só nas variáveis de ambiente da hospedagem; usuário de banco com privilégios mínimos para a aplicação (separado do que roda migrations).
- O limite de tentativas de login é em memória por instância; com várias instâncias, use um storage compartilhado.
- Logs de acesso e monitoramento; política de privacidade/LGPD para os dados dos funcionários.
- O Swagger só sobe com `SWAGGER_ENABLED=true` (deixe sem a variável em produção), e a API responde com os cabeçalhos de segurança do `helmet`.
- Itens legais em [docs/CONFORMIDADE.md](docs/CONFORMIDADE.md).

### Dados legados

A migration `nucleo_ponto` converteu os horários da versão anterior para `timestamptz` preservando o instante (eram UTC). A migration `remove_legado` apaga o que não é mais usado: a coluna `punch_clocks.type` (o tipo vem da ordem cronológica) e a tabela `settings` (substituída pelas jornadas). **Antes de aplicá-la num banco com dados da versão anterior**, confira se não há nada a aproveitar nelas.
