# Sistema de Ponto

API de controle de ponto: login, gestão de funcionários e jornadas, registro de marcações, espelho de ponto com horas trabalhadas, atrasos, horas extras e faltas, e correções justificadas que preservam o registro original.

**Stack:** TypeScript · NestJS 11 · Prisma 6 · PostgreSQL · JWT · Swagger · Vitest

> ⚠️ **Antes de usar oficialmente**, leia [docs/CONFORMIDADE.md](docs/CONFORMIDADE.md). Este sistema **não está homologado** como REP-P da Portaria MTP nº 671/2021.

---

## Instalação e execução local

Pré-requisitos: Node.js 20+ (testado com 22), npm e PostgreSQL 14+ (ou Docker).

```bash
# 1. Dependências
npm install

# 2. Banco de dados (pule se já tiver um PostgreSQL)
docker compose up -d

# 3. Variáveis de ambiente
cp .env.example .env
# edite .env e preencha JWT_SECRET (o comando para gerar está no arquivo)

# 4. Migrations
npx prisma migrate deploy

# 5. Primeiro administrador (não existe cadastro público)
ADMIN_NAME="Administrador" ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD='troque-esta-senha' npm run admin:create

# 6. Executar
npm run start:dev         # desenvolvimento (watch)
# ou
npm run build && npm run start:prod
```

- Front-end: `cd web && npm install && npm run dev` → `http://localhost:5173` (detalhes em [web/README.md](web/README.md))
- API: `http://localhost:3333/api`
- Swagger: `http://localhost:3333/swagger` (faça login em `POST /api/auth/login` e use o `accessToken` no botão **Authorize**)

### Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | sim | – | URL do PostgreSQL |
| `JWT_SECRET` | sim | – | Segredo HS256, mínimo de 32 caracteres |
| `PORT` | não | `3333` | Porta HTTP |
| `NODE_ENV` | não | `development` | `development`, `test` ou `production` |
| `JWT_ACCESS_EXPIRES_IN` | não | `1h` | Validade do access token |
| `JWT_REFRESH_EXPIRES_IN` | não | `7d` | Validade do refresh token |
| `APP_TIMEZONE` | não | `America/Sao_Paulo` | Fuso que define o "dia" de trabalho e interpreta os horários das jornadas |
| `CORS_ORIGIN` | não | vazio (CORS desligado) | Origens permitidas, separadas por vírgula |

A aplicação não sobe se alguma variável for inválida.

## Testes

```bash
npm test               # unitários: regras de cálculo do espelho (sem banco)
npm run test:e2e       # e2e: API completa contra PostgreSQL real
npm run test:all       # os dois
```

Os testes e2e usam o PostgreSQL de `DATABASE_URL`, mas cada arquivo de teste cria um **schema próprio e temporário** (`test_<uuid>`), aplica as migrations reais e o remove ao final. Seus dados não são tocados. O usuário do banco precisa de permissão para criar schemas.

O que é coberto: login, refresh, troca de senha e invalidação de tokens, limite de tentativas, permissões de todas as rotas administrativas, cadastro e paginação de funcionários, registro de ponto (inclusive cliques simultâneos), filtros por funcionário/período no fuso local, espelho com múltiplas marcações, intervalos, atraso, hora extra, jornada noturna, falta e dia incompleto, correções preservando o original e efeito da configuração da jornada nos cálculos.

---

## Como funciona

### Perfis e permissões

- **Não existe cadastro público.** O primeiro admin é criado por `npm run admin:create`; os demais usuários são criados por um admin. O papel (`EMPLOYEE`/`ADMIN`) só pode ser definido por um admin.
- Todas as rotas exigem token, exceto `login` e `refresh`.
- O papel e o status são lidos do banco a cada requisição: desativar um usuário ou mudar seu papel vale imediatamente, mesmo com tokens já emitidos.
- Trocar ou redefinir a senha invalida todos os tokens anteriores do usuário.
- Funcionários consultam apenas os próprios registros (`403` ao tentar outro `employeeId`).
- Um admin não pode corrigir as próprias marcações, nem desativar ou rebaixar a própria conta.
- Funcionários nunca são excluídos: são desativados (`active=false`) e seus registros são mantidos.

### Marcações

- `POST /api/punches` registra uma marcação com o **horário do servidor**. O cliente não envia horário nem tipo.
- Não há tipo "entrada/saída" gravado: em cada jornada, a ordem cronológica define 1ª = entrada, 2ª = saída, 3ª = entrada (volta do intervalo)... Isso permite qualquer quantidade de marcações e intervalos por dia, e uma correção nunca deixa os tipos inconsistentes.
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
- **Sem jornada configurada:** horas trabalhadas são calculadas; atraso, extra e falta ficam `null` (não há base de comparação).
- Período máximo por consulta: 93 dias.

### Correções (admin, sempre com justificativa)

| Operação | Rota | Efeito |
| --- | --- | --- |
| Incluir marcação faltante | `POST /api/punches/manual` | Nova marcação com `source=ADMIN`, autor e motivo |
| Desconsiderar marcação | `POST /api/punches/:id/void` | Marca `voidedAt`, autor e motivo. **Nada é apagado** |
| Trocar horário | `POST /api/punches/:id/replace` | Desconsidera a original e inclui a nova (`replacesId`) na mesma transação |

O histórico (`GET /api/punches`) mostra as marcações desconsideradas por padrão (`includeVoided=false` para ocultar). O cálculo usa só as válidas. Horários manuais devem ter fuso explícito (`2026-10-20T08:00:00-03:00`) e não podem estar no futuro.

### Fuso horário

Instantes são gravados como `timestamptz` (UTC) e devolvidos em UTC (`timestamp`) e no fuso da empresa (`localTime`). Datas de filtro (`from`/`to`, `YYYY-MM-DD`) e horários de jornada são interpretados no `APP_TIMEZONE`.

---

## Endpoints

Prefixo `/api`. Detalhes de payloads e respostas no Swagger.

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
| GET | `/punches` | autenticado* | Histórico (`employeeId`, `from`, `to`, `includeVoided`, paginação) |
| GET | `/punches/timesheet` | autenticado* | Espelho do período (`employeeId`, `from`, `to`) |
| GET | `/punches/report` | admin | Totais do período por funcionário (paginado) |
| POST | `/punches/manual` | admin | Correção: inclusão |
| POST | `/punches/:id/void` | admin | Correção: desconsiderar |
| POST | `/punches/:id/replace` | admin | Correção: trocar horário |

\* Funcionário: apenas os próprios dados. Admin: qualquer funcionário via `employeeId`.

Listas paginadas respondem `{ data: [...], meta: { page, pageSize, total, totalPages } }` (`pageSize` máximo 100). Erros de validação respondem `400` com `message` contendo a lista de problemas.

### Exemplo rápido

```bash
API=http://localhost:3333/api
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@empresa.com","password":"troque-esta-senha"}' | jq -r .accessToken)

# Jornada 8h, seg-sex, entrada 08:00, tolerâncias de 10 min
SCHEDULE=$(curl -s -X POST $API/work-schedules -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Comercial","startTime":"08:00","dailyMinutes":480,"workDays":[1,2,3,4,5],"lateToleranceMinutes":10,"overtimeToleranceMinutes":10}' | jq -r .id)

curl -s -X POST $API/employees -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Maria\",\"email\":\"maria@empresa.com\",\"password\":\"senha-da-maria\",\"workScheduleId\":\"$SCHEDULE\"}"

curl -s "$API/punches/timesheet?employeeId=<id>&from=2026-10-01&to=2026-10-31" -H "Authorization: Bearer $TOKEN"
```

---

## Estrutura

```
src/
  auth/            login, refresh, guards globais (JWT + papéis), decorators
  employees/       cadastro e gestão de usuários (admin)
  work-schedules/  jornadas de trabalho (admin)
  punches/         marcações, correções, espelho e relatório
    timesheet.ts   regras de cálculo (funções puras, testadas em timesheet.spec.ts)
  common/          paginação, fuso horário, helpers de Swagger
  infra/           Prisma e variáveis de ambiente
prisma/            schema, migrations e script de criação do admin
test/              testes e2e
```

## Antes de produção

Fora do escopo desta etapa, mas necessário antes do uso real:

- **Backups** automáticos e testados do PostgreSQL (ex.: `pg_dump` diário + retenção, ou backup gerenciado com point-in-time recovery). Registros de ponto precisam ser guardados por anos.
- HTTPS obrigatório (proxy reverso ou plataforma), `NODE_ENV=production`, `JWT_SECRET` forte e exclusivo, `CORS_ORIGIN` restrito.
- Usuário de banco com privilégios mínimos para a aplicação (separado do que roda migrations).
- O limite de tentativas de login é em memória por instância; com várias instâncias, use um storage compartilhado.
- Logs de acesso e monitoramento; política de privacidade/LGPD para os dados dos funcionários.
- Desabilitar ou proteger o Swagger em produção, se a API for pública.
- Itens legais em [docs/CONFORMIDADE.md](docs/CONFORMIDADE.md).

### Dados legados

A migration `nucleo_ponto` não apaga dados da versão anterior: a coluna `punch_clocks.type` e a tabela `settings` foram mantidas, mas não são mais usadas. Os horários existentes foram convertidos para `timestamptz` preservando o instante (eram UTC). Depois de confirmar que não há nada a aproveitar nelas, podem ser removidas numa migration futura.
