# Dashboard gerencial

Data: 2026-11-18. Status: aprovada e implementada; execução E2E pendente.

## 1. Objetivo e escopo

Apresentar uma visão consolidada dos registros atuais do banco, com indicadores
calculados no backend, independentemente de `GET /api/processos` e sua paginação.
Disponível para `admin` e `operador`, conforme as permissões atuais de leitura.

Decisões aprovadas: contar cada versão persistida de edital; apresentar até cinco
leilões distintos, considerando a próxima etapa ainda não vencida de cada um.

Fora do escopo: filtros por período, histórico de indicadores, exportação,
atualização em tempo real, novos serviços, dependências ou alterações no banco.

## 2. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Exibir o total de processos cadastrados. |
| RF02 | Exibir a quantidade de processos em cada status: `recebido`, `analisando`, `analisado` e `erro`. |
| RF03 | Exibir o total de leilões com status `agendado`. |
| RF04 | Exibir o total de editais gerados, incluindo suas versões persistidas. |
| RF05 | Exibir o total de registros de envio para marketing com status `enviado`. |
| RF06 | Apresentar gráfico de barras com a distribuição dos processos pelos quatro status, usando as quantidades da API. |
| RF07 | Listar até cinco processos mais recentes, mostrando arquivo, número ou “—”, status, cadastro e link para o detalhe. |
| RF08 | Listar até cinco próximos leilões, mostrando processo, próxima etapa, data/hora e link para o respectivo processo. |
| RF09 | Adicionar “Dashboard” ao menu principal, com rota protegida `/dashboard`, disponível aos dois perfis. Preservar `/` como listagem de processos. |

### Apresentação e atualização

- Título “Dashboard”; indicadores em cards e listas em tabelas responsivas,
  preservando cores, tipografia e espaçamentos existentes. Reutilizar `Card`,
  `StatusBadge`, `Alerta`, links e formatadores compatíveis.
- Gráfico sem nova biblioteca: HTML/CSS ou SVG, com rótulo e quantidade legíveis
  para cada status; cor não será a única forma de identificar os dados.
- Links das duas listas apontam para `/processos/{processo_id}`; na lista de
  processos, usar o próprio `id`. Número ausente não impede navegação.
- Durante a consulta, indicar carregamento; falhas seguem o tratamento de erros
  existente e não são apresentadas como indicadores zerados. Resposta `401`
  mantém o fluxo atual de autenticação.
- Base vazia: indicadores e quatro status em zero, mensagem “Nenhum processo
  cadastrado.” no gráfico/lista e “Nenhum leilão próximo.” na lista de leilões.
- Consultar ao entrar ou retornar à página, usando TanStack Query e chave própria
  `['dashboard']`. Invalidar essa chave após mutações bem-sucedidas que alterem
  seus dados. Não exigir polling nem estado global adicional.

## 3. Contrato da API

`GET /api/dashboard` — sem body, filtros ou paginação; exige sessão autenticada.
Operação somente de leitura, sem nova exigência de CSRF.

Resposta `200`, inclusive quando o banco está vazio:

```text
DashboardOut {
  referencia_em: datetime,
  timezone: string,
  total_processos: integer,
  processos_por_status: {
    recebido: integer,
    analisando: integer,
    analisado: integer,
    erro: integer
  },
  total_leiloes_agendados: integer,
  total_editais_gerados: integer,
  total_envios_marketing_sucesso: integer,
  processos_recentes: ProcessoOut[],
  proximos_leiloes: ProximoLeilaoOut[]
}

ProximoLeilaoOut {
  id: UUID,
  processo_id: UUID,
  nome_arquivo: string,
  numero_processo: string|null,
  primeiro_leilao_em: datetime,
  segundo_leilao_em: datetime,
  proximo_leilao_em: datetime,
  etapa: "primeiro"|"segundo"
}
```

- Contadores são inteiros não negativos; todas as chaves de status são obrigatórias.
- Arrays contêm de zero a cinco itens; sem correspondência, retornar `[]`.
- Reutilizar `ProcessoOut` sem alterar seu contrato. UUIDs são strings no JSON;
  datetimes são ISO 8601 com fuso, serializados em UTC.
- `referencia_em` é o instante capturado uma vez pelo backend para a consulta.
  `timezone` informa `Settings.TIMEZONE`, padrão `America/Belem`.
  O frontend formata datas nesse fuso,
  respeitando os formatadores atuais e sem depender do fuso do navegador.
- Sessão ausente/expirada/inválida: `401`, conforme contrato atual. Falha interna:
  tratamento existente, com `ErroOut { detail: string }`, sem detalhes sensíveis.
  Não criar handler global de exceções para esta funcionalidade.

## 4. Regras de negócio e consulta

| Indicador/lista | Regra |
|---|---|
| Total de processos | `COUNT` dos registros existentes em `processos`, sem filtros. Não representa registros já excluídos. |
| Processos por status | Contagem por status atual; status sem registros recebe zero. A soma dos quatro corresponde ao total, com dados estáveis. |
| Leilões agendados | Contar registros de `leiloes` com `status = 'agendado'`, inclusive com datas passadas. Excluir `cancelado`; não alterar status automaticamente. Cada registro conta uma vez, não uma vez por etapa. |
| Editais gerados | Contar registros existentes em `editais`. Nova geração/versão aumenta o total; edição do mesmo registro não aumenta. Incluir editais vinculados a leilões posteriormente cancelados. |
| Envios bem-sucedidos | Contar registros de `envios_marketing` com `status = 'enviado'`. Excluir `erro`; reenvios bem-sucedidos contam separadamente, sem multiplicar pelo número de destinatários. Usar o status persistido, sem tentar confirmar entrega externa. |
| Processos recentes | `ORDER BY criado_em DESC, id DESC LIMIT 5`, considerando todos os status. |
| Próximos leilões | Somente `agendado`. Se `primeiro_leilao_em >= referencia_em`, próxima etapa é `primeiro`; senão, se `segundo_leilao_em >= referencia_em`, é `segundo`. Se ambas passaram, excluir da lista. Retornar cada registro uma vez, em `proximo_leilao_em ASC, id ASC`, com `LIMIT 5`. |

- Comparar instantes com fuso em UTC; incluir etapa exatamente em `referencia_em`.
  Não recalcular datas, janela de agendamento, feriados ou bloqueios no dashboard.
- Agregações, seleção da próxima etapa, ordenação e limites acontecem no banco,
  via SQLAlchemy e parâmetros vinculados. Não carregar coleções completas para
  processar em Python, nem obter indicadores de endpoints de listagem.
- Evitar contagens multiplicadas por joins e consultas por item. Buscar apenas
  os dados necessários; não retornar PDFs, caminhos, textos extraídos, conteúdo
  de editais/checklists, destinatários ou detalhes internos de falhas.
- Ler o banco a cada requisição; não criar cache persistente ou tabelas de resumo.
  Não exigir snapshot entre consultas concorrentes; invariantes são verificadas
  com dados estáveis. Exclusões em cascata refletem-se nos indicadores seguintes.
- Preservar routers → services → SQLAlchemy e schemas Pydantic; domínio
  `app/dashboard/` com `router.py`, `service.py` e `schemas.py`, sem novo model.
  No frontend: `features/dashboard/`, cliente `api/dashboard.ts` e tipos em
  `api/types.ts`; componentes de domínio não importam outros domínios.
- Registrar a rota no mecanismo existente. Manter contratos HTTP atuais e MCP;
  não criar ferramenta MCP. MSW deverá espelhar o novo endpoint. Na implementação,
  atualizar as specs backend/frontend antes das respectivas alterações de código.
- Esta consulta não aciona LLM, geração de documentos, envio de e-mail ou outro
  serviço externo; usa somente dados já persistidos.

## 5. Critérios de aceite

| ID | Evidência esperada |
|---|---|
| CA01 | Com mais de 20 processos, total e distribuição refletem todos os registros, independentemente da paginação/filtros da listagem. |
| CA02 | Os quatro status são retornados, inclusive zeros; soma e total coincidem em base estável. |
| CA03 | Cancelados não contam como agendados; agendados com ambas as datas passadas contam no indicador, mas não aparecem entre próximos leilões. |
| CA04 | Duas versões de edital contam como dois; editar uma versão mantém o total. Envios `enviado` contam individualmente; erros e número de destinatários não aumentam o indicador. |
| CA05 | Processos recentes têm no máximo cinco itens, em ordem decrescente de cadastro, com desempate por UUID; menos registros retornam apenas os existentes. |
| CA06 | Próximos leilões têm no máximo cinco registros distintos, em ordem de próxima etapa e UUID; primeira passada/segunda futura inclui a segunda; ambas passadas excluem; instante exatamente igual é incluído. |
| CA07 | Banco vazio produz `200`, contadores zerados, quatro status e arrays vazios; UI exibe estados vazios sem erro ou divisão por zero. |
| CA08 | Admin e operador acessam endpoint, rota e menu; visitante recebe `401` na API e segue para login na UI. Nenhuma permissão de mutação é ampliada. |
| CA09 | Cards, barras e listas correspondem à resposta; todos os links abrem o processo correto, inclusive quando seu número é nulo. |
| CA10 | Carregamento e erro são distintos de vazio; entrar/retornar consulta dados atualizados; mutações relevantes invalidam o dashboard; página funciona por teclado e em telas estreitas. |
| CA11 | Nenhum consumidor do dashboard depende de `GET /api/processos`; contrato MCP, listagem e demais fluxos permanecem intactos; MSW reproduz o contrato. |

Validação: testes de API/serviço com PostgreSQL isolado e relógio controlado e
testes de UI com MSW. Cenário E2E criado para backend real, `LLM_PROVIDER=fake` e
`EMAIL_BACKEND=file`; sua execução fica pendente, conforme restrições da sessão.

## 6. Referências locais

- [Regras do projeto](../CLAUDE.md), [backend](../src/backend/CLAUDE.md) e
  [frontend](../src/frontend/CLAUDE.md).
- [Contrato backend](2026-10-01-backend.md), §§1–3; [frontend](2026-10-01-frontend.md).
- Modelos: `src/backend/app/{processos,agenda,editais,marketing}/models.py`;
  `src/backend/app/agenda/schemas.py`; navegação em
  `src/frontend/src/app/Layout.tsx`.
