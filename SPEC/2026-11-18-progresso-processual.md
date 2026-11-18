# Indicador de progresso processual

Data: 2026-11-18. Status: aprovada e implementada no frontend.

## 1. Objetivo e escopo

Exibir na página `/processos/:id` a situação do fluxo operacional, utilizando os
contratos existentes. O percentual representa etapas deste sistema, não o avanço
jurídico do processo nem a realização efetiva dos leilões.

Implementação prevista no domínio frontend `features/processos/`, com cálculo
puro separado da apresentação. Sem endpoint, persistência, dependência ou regra
de negócio novos; preservar contratos HTTP/MCP, permissões e ações existentes.

## 2. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Exibir indicador horizontal após o cabeçalho do detalhe, antes dos cards existentes. |
| RF02 | Representar, nesta ordem: Recebimento, Análise, Leilão, Edital e Marketing. |
| RF03 | Identificar cada etapa como `concluida`, `atual`, `pendente` ou `erro`, com texto/ícone além da cor. |
| RF04 | Exibir percentual de conclusão calculado pelas regras abaixo. |
| RF05 | Refletir falha de análise, reanálise, cancelamento de leilão e resultado dos envios para marketing. |
| RF06 | Atualizar após análise/reanálise, agendamento/cancelamento, geração/regeneração de edital e envio/reenvio para marketing, inclusive falhas que persistam novo estado. |
| RF07 | Reutilizar componentes, TanStack Query, cliente HTTP, cores, tipografia e espaçamentos atuais; manter a mesma leitura para admin e operador. |

- Usar lista ordenada acessível, nomes visíveis, descrição do estado e
  `aria-current="step"` na etapa atual, quando existir. Apresentar percentual com
  semântica de barra de progresso, mínimo 0 e máximo 100.
- Em telas estreitas, permitir rolagem horizontal dentro do indicador, sem
  expandir a página nem ocultar permanentemente etapas. Não adicionar ações ao
  indicador nem alterar os controles existentes.

## 3. Dados utilizados

| Fonte existente | Utilização |
|---|---|
| `GET /api/processos/{id}` → `ProcessoDetalheOut` | `id`, `status`, `checklist`, `relatorio` e `leilao`. |
| `LeilaoOut` dentro do detalhe | `id`, `status` e `edital_id`. O backend atualmente retorna somente o leilão ativo; cancelamento passa a ser representado por `leilao: null`. |
| `GET /api/marketing/envios` → `EnvioOut[]` | Selecionar apenas registros cujo `leilao_id` corresponda ao leilão ativo do processo. |

- Reutilizar `chavesProcessos.detalhe(id)` e `chavesMarketing.envios`. Consultar o
  histórico de marketing apenas quando as quatro primeiras etapas estiverem
  concluídas; ausência de necessidade não exige essa consulta.
- Não consultar listagem paginada de processos nem dashboard para obter progresso.
- Selecionar a tentativa de marketing mais recente por `enviado_em DESC, id DESC`,
  comparando instantes e usando UUID como desempate, independentemente da ordem
  recebida. Nunca associar por número do processo, que pode ser nulo ou repetido.
- Não inferir entrega externa do e-mail: `enviado` significa sucesso registrado
  pelo backend, inclusive com `EMAIL_BACKEND=file`.

## 4. Cálculo e estados

Cada etapa vale **20 pontos percentuais**. Somente a sequência contínua de etapas
concluídas, começando pelo Recebimento, contribui para o percentual:

`percentual = 20 × quantidade de etapas consecutivas concluídas`.

| Etapa | Evidência de conclusão |
|---|---|
| Recebimento | Detalhe do processo carregado com sucesso. |
| Análise | `status = 'analisado'`, com `checklist` e `relatorio` não nulos. |
| Leilão | Análise concluída e `leilao` presente com `status = 'agendado'`. Significa agendamento, sem aguardar a data do evento. |
| Edital | Etapas anteriores concluídas e `leilao.edital_id` não nulo. |
| Marketing | Etapas anteriores concluídas e tentativa mais recente do leilão ativo com `status = 'enviado'`. |

### Precedência

1. Marcar como `concluida` a sequência confirmada pelas evidências acima.
2. A primeira etapa não concluída é `atual`, salvo evidência de erro: Análise
   quando `processo.status = 'erro'`; Marketing quando a última tentativa é `erro`.
   Nesse caso, marcar essa etapa como `erro`, sem outra etapa `atual`.
3. Todas as etapas posteriores são `pendente`, mesmo que existam artefatos antigos.
4. Com todas concluídas, mostrar 100%, sem etapa atual ou pendente.

| Situação confirmada | Estado relevante / percentual |
|---|---|
| Processo recebido, sem análise concluída | Análise atual, “Aguardando análise”; 20%. |
| `status = 'analisando'` | Análise atual, “Análise em andamento”; 20%. |
| Falha de análise, inclusive em reanálise com documentos antigos | Análise em erro; etapas posteriores pendentes; 20%. |
| Análise concluída, sem leilão ativo | Leilão atual, “Aguardando agendamento”; 40%. |
| Leilão ativo, sem edital | Edital atual; 60%. |
| Edital presente, sem tentativa de marketing | Marketing atual, “Aguardando envio”; 80%. |
| Última tentativa de marketing falhou | Marketing em erro; 80%, mesmo que uma tentativa anterior tenha sucesso. |
| Última tentativa de marketing teve sucesso | Todas concluídas; 100%, mesmo que existam erros anteriores. |

### Reanálise, cancelamento e documentos

- Reanálise em andamento ou com erro interrompe a sequência na Análise. Não
  apagar nem invalidar documentos, leilões ou envios no banco. Após sucesso,
  recalcular usando o detalhe e histórico atuais; artefatos preservados podem
  restaurar diretamente um percentual maior.
- Cancelamento remove o leilão ativo do detalhe: se a análise permanece concluída,
  voltar a 40%. Editais e envios do leilão cancelado não contam. Novo agendamento
  usa exclusivamente o novo `leilao.id`, começando em 60% enquanto não houver edital.
- Regeneração/edição de edital não invalida automaticamente Marketing. A API liga
  envios ao leilão, sem identificar a versão enviada; não inferir essa associação
  nem criar exigência de reenvio. Eventuais pendências do checklist também não
  criam novas regras de conclusão ou bloqueios para os controles existentes.
- Se `status = 'analisado'` vier sem checklist ou relatório, manter Análise atual
  em 20%, indicando dados incompletos; não inventar erro de negócio.

## 5. Atualização e indisponibilidade

- Usar os estados de mutação existentes para destacar a operação em andamento,
  sem concluir etapas antes da confirmação da API. Enquanto o resultado de uma
  operação estiver pendente, substituir o percentual por “Atualizando progresso…”.
- Após sucesso ou falha, invalidar/refazer as consultas afetadas. Falha de envio
  pode persistir `EnvioOut.status = 'erro'` mesmo com resposta HTTP `502`; portanto,
  atualizar também o histórico nesse caso. Falha de análise exige novo detalhe.
- Quando o leilão ativo mudar, descartar sua associação anterior imediatamente:
  respostas atrasadas ou cache de outro processo/leilão não podem alterar o
  indicador atual. Não exigir polling ou sincronização entre abas em tempo real.
- Na entrada/retorno à página, consultar dados atualizados conforme TanStack Query.
- Sem detalhe válido, não calcular percentual. Se uma consulta necessária estiver
  carregando, mostrar “Consultando progresso…”. Se falhar, mostrar “Progresso
  indisponível” com o tratamento visual existente, sem assumir histórico vazio,
  exibir percentual ou confundir falha HTTP com etapa de negócio em erro.
- A indisponibilidade do indicador não bloqueia os demais cards; preservar o
  tratamento atual de `401`, erros de detalhe e permissões. Não exibir
  destinatários ou mensagens internas de SMTP no indicador.

## 6. Critérios de aceite

| ID | Evidência esperada |
|---|---|
| CA01 | Detalhe apresenta as cinco etapas na ordem definida, percentual acessível e identidade visual original; leitura funciona em tela estreita e sem depender somente de cores. |
| CA02 | Fluxo recebido → analisado → agendado → edital → envio bem-sucedido produz 20%, 40%, 60%, 80% e 100%; primeira etapa incompleta é atual e posteriores ficam pendentes. |
| CA03 | Análise em execução mostra etapa atual; falha inicial ou de reanálise mostra erro e 20%, mesmo com checklist, relatório, leilão, edital e envios antigos. |
| CA04 | Reanálise bem-sucedida restaura o progresso conforme os registros preservados, sem apagar dados ou exigir novamente ações já comprovadas. |
| CA05 | Cancelamento retorna a 40% quando a análise está concluída; dados do leilão cancelado não contam no novo agendamento. |
| CA06 | Falha de envio resulta em 80% e Marketing em erro; reenvio bem-sucedido restaura 100%; erro posterior a sucesso retorna a 80%. |
| CA07 | Envios de outro leilão/processo não interferem; tentativa mais recente é selecionada por instante e UUID, inclusive com resposta desordenada e número do processo nulo. |
| CA08 | Regeneração/edição de edital preserva conclusão de Marketing quando a última tentativa do mesmo leilão é bem-sucedida, sem supor vínculo com versão. |
| CA09 | Durante mutações, não há conclusão antecipada; ao terminar, sucesso ou falha persistida atualiza o indicador sem recarregar manualmente a página. |
| CA10 | Carregamento/falha do histórico necessário não aparecem como 80%/histórico vazio ou erro de envio; respostas antigas não contaminam outro processo ou leilão. |
| CA11 | Cálculo não altera dados, permissões, contratos HTTP/MCP ou regras de análise/agendamento/envio; admin e operador visualizam os mesmos estados para os mesmos dados. |

Validação implementada: testes unitários da função de cálculo e testes de UI com
MSW, incluindo transições, erros, reanálise, cancelamento e consultas concorrentes.
Backend, regras de negócio e contratos HTTP/MCP permanecem preservados.

## 7. Referências

- [Regras do projeto](../CLAUDE.md) e [frontend](../src/frontend/CLAUDE.md).
- [Contrato backend](2026-10-01-backend.md), schemas e rotas de processos,
  agenda e marketing; `src/backend/app/processos/service.py` e
  `src/backend/app/agenda/service.py` fundamentam preservação de artefatos e
  representação do cancelamento.
- `src/frontend/src/features/processos/ProcessoDetalhePage.tsx`,
  `src/frontend/src/features/marketing/EnviarMarketingCard.tsx` e
  `src/frontend/src/api/marketing.ts`: composição, mutações e consultas existentes.
