# Conformidade legal: o que ainda precisa ser validado

> Este documento é uma avaliação técnica para orientar os próximos passos. **Não é parecer jurídico.** Antes do uso oficial, valide com advogado trabalhista e/ou contador, e confira o texto vigente da Portaria MTP nº 671/2021 e da CLT, que podem ter sido alterados.

## Situação atual

**O sistema não deve ser apresentado como legalmente conforme.** Ele implementa um núcleo funcional e alguns princípios da Portaria 671 (registro original imutável, correções justificadas e rastreáveis, nenhuma restrição à marcação, horário definido pelo servidor). Mas não atende os requisitos formais de um REP-P, e várias regras da CLT que afetam o cálculo não estão modeladas.

## Quando o controle de ponto é obrigatório

- A CLT (art. 74, §2º) exige registro de jornada para estabelecimentos com **mais de 20 empregados**. Abaixo disso o controle é opcional, mas, se existir, ainda serve como prova em processos trabalhistas.
- A Portaria 671/2021 prevê três modalidades de registro eletrônico: **REP-C** (equipamento convencional), **REP-A** (sistema alternativo autorizado por acordo ou convenção coletiva) e **REP-P** (programa de computador). Um sistema web como este se encaixaria como **REP-P**, ou como **REP-A** se houver instrumento coletivo que o autorize.
- O registro por exceção e outras flexibilizações dependem de acordo individual ou coletivo.

**Primeira decisão do negócio:** em qual modalidade o sistema vai operar. Os requisitos mudam bastante entre REP-P e REP-A.

## Já atendido (parcialmente)

| Princípio | Como o sistema atende |
| --- | --- |
| Marcações originais não podem ser alteradas nem apagadas | Correções só desconsideram (`voidedAt`) e incluem marcações. Não há UPDATE de horário nem DELETE |
| Tratamento de marcações com motivo e rastreabilidade | Toda correção exige justificativa e grava autor, data e vínculo com a original |
| Proibido restringir a marcação | Marcações sempre aceitas, exceto duplicatas em menos de 1 minuto |
| Proibida marcação automática | Toda marcação nasce de ação do funcionário ou de correção justificada do admin |
| Proibido exigir autorização prévia para hora extra | Não existe esse fluxo |
| Funcionário acessa os próprios registros | Histórico (inclusive correções) e espelho disponíveis ao próprio funcionário |
| Horário confiável | O horário vem do servidor, não do cliente |

## Requisitos de REP-P ainda NÃO implementados

Itens que, pelo que conhecemos da Portaria 671, são exigidos de um REP-P e precisam ser confirmados no texto vigente:

1. **Registro do programa no INPI**.
2. **Atestado Técnico e Termo de Responsabilidade** emitido pelo desenvolvedor/fornecedor, nos moldes da Portaria.
3. **Comprovante de registro de ponto** entregue ao trabalhador a cada marcação, com dados exigidos (empregador, trabalhador, data/hora, NSR) e assinatura eletrônica.
4. **NSR (Número Sequencial de Registro)** contínuo e sem lacunas.
5. **AFD (Arquivo Fonte de Dados)** no leiaute oficial, com **assinatura digital ICP-Brasil**, disponível para fiscalização.
6. **AEJ (Arquivo Eletrônico de Jornada)** gerado pelo Programa de Tratamento de Registro de Ponto, no leiaute oficial.
7. **Identificação do empregador e do trabalhador** nos registros (CNPJ/CPF do empregador, CPF do trabalhador, local de prestação de serviço). O modelo de dados atual não tem esses campos.
8. **Sincronização com a Hora Legal Brasileira** e garantia de precisão do relógio do servidor (NTP monitorado).
9. **Espelho de ponto** no formato e com as informações exigidas, disponibilizado ao trabalhador periodicamente.
10. **Guarda e disponibilização** dos arquivos e registros pelo prazo legal, inclusive após o desligamento.

## Regras da CLT que afetam o cálculo e não estão modeladas

| Regra | Referência | Situação |
| --- | --- | --- |
| Tolerância de 5 min por marcação, máx. 10 min diários | CLT art. 58, §1º | Tolerâncias são configuráveis, mas aplicadas por dia (atraso e saldo diário), não por marcação. Validar se o modelo atende |
| Hora noturna reduzida (52m30s) e adicional noturno (22h às 5h) | CLT art. 73 | **Não implementado.** Jornadas noturnas são calculadas em minutos de relógio |
| Limite de 2h extras/dia e adicional mínimo de 50% | CLT art. 59; CF art. 7º, XVI | Horas extras são contadas, mas sem limite, alerta ou cálculo de adicional |
| Banco de horas e compensação | CLT art. 59, §§2º, 5º e 6º | Não implementado |
| Intervalo intrajornada mínimo (1h para jornadas > 6h; 15 min entre 4h e 6h) | CLT art. 71 | Intervalos são calculados, mas não há alerta de descumprimento |
| Interjornada mínima de 11h | CLT art. 66 | Não verificado |
| Descanso semanal remunerado, feriados nacionais/locais | Lei 605/1949 | **Feriados não existem no sistema**: um feriado em dia útil aparece como falta |
| Férias, atestados, afastamentos, abonos | CLT e normas diversas | Não implementado. Hoje só é possível corrigir marcações, não abonar ausências |
| Escalas (12x36, revezamento), jornadas diferentes por dia da semana | CLT art. 59-A e acordos | A jornada tem um único horário e carga para todos os dias de trabalho |
| Histórico de jornada | — | O espelho usa a jornada **atual** do funcionário, inclusive para períodos passados. Mudar uma jornada altera o cálculo retroativo |
| Convenção coletiva da categoria | — | Pode trazer tolerâncias, adicionais e regras próprias que precisam ser parametrizadas |

## LGPD e segurança

- Registros de ponto são dados pessoais de empregados. Definir base legal (cumprimento de obrigação legal), prazo de retenção, controle de acesso e canal para o titular.
- Não coletamos geolocalização nem biometria. Se forem adicionadas, exigem avaliação específica (dado sensível no caso de biometria).
- Backups criptografados, testados e com retenção compatível com o prazo legal são pré-requisito para uso real.

## Próximos passos sugeridos

1. Decidir a modalidade (REP-P ou REP-A) com o jurídico e verificar a convenção coletiva aplicável.
2. Modelar empresa/estabelecimento e CPF do trabalhador; adicionar NSR.
3. Implementar feriados, abonos/afastamentos e histórico de jornada (correções de cálculo com maior impacto prático).
4. Implementar adicional noturno/hora reduzida e alertas de limites (extras, intervalos, interjornada).
5. Se for REP-P: comprovante assinado, AFD/AEJ no leiaute oficial com assinatura ICP-Brasil, registro no INPI e atestado técnico.
