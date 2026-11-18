# Listagem de processos — pesquisa, filtros e paginação

Data: 2026-11-18. Status: especificação proposta, ainda não implementada.

## 1. Objetivo e escopo

Permitir localizar processos sem carregar toda a coleção no navegador. Pesquisa,
filtros, ordenação, contagem e paginação serão executados no backend, sobre o
PostgreSQL. O frontend enviará os parâmetros e apresentará a página recebida.

Esta spec substitui somente o contrato de `GET /api/processos` descrito em
[backend](2026-10-01-backend.md), §3. Os demais endpoints permanecem com seus
contratos atuais. Referências: [frontend](2026-10-01-frontend.md) e
[baseline herdada](../docs/baseline-ap1.md).

Fora do escopo: pesquisa no texto do PDF, busca aproximada, exportação, seleção em
lote, novos perfis, novas entidades e alterações nos fluxos de análise ou leilão.

## 2. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Um campo de pesquisa consultará nome do arquivo **ou** número do processo, por ocorrência parcial e sem diferenciar maiúsculas/minúsculas. |
| RF02 | Permitir filtrar por um dos status existentes ou selecionar todos. |
| RF03 | Permitir filtrar pela data de cadastro (`criado_em`), com início e fim opcionais e inclusivos. |
| RF04 | Ordenar por cadastro: mais recentes primeiro (padrão) ou mais antigos primeiro. |
| RF05 | Paginar no servidor, com navegação anterior/próxima e tamanho de página selecionável. |
| RF06 | Exibir o total encontrado após pesquisa/filtros, independentemente da página. |
| RF07 | Oferecer “Limpar filtros”, restaurando o estado inicial e consultando novamente o backend. |

### Interação e apresentação

- Manter rota `/`, título, upload, colunas, links, badges e exclusão exclusiva de
  administrador. Reutilizar componentes, cores, tipografia e espaçamentos atuais,
  sem nova biblioteca visual.
- Formulário com pesquisa, status (“Todos”), “Cadastrado de” e “Até”, além de
  “Filtrar” e “Limpar filtros”. Submeter pelo botão ou Enter aplica os valores e
  retorna à página 1; editar esses campos isoladamente não dispara consultas.
- Ordenação e tamanho de página aplicam-se imediatamente aos filtros já aplicados
  e retornam à página 1. Navegar entre páginas preserva esses filtros e a ordem.
- Tamanhos disponíveis: 10, 20, 50 e 100; padrão 20. A indicação “Página P de T”
  aparece somente quando há resultados; anterior/próxima ficam desabilitados nos
  limites e durante carregamento.
- Exibir “N processos encontrados” (singular para 1) e, quando houver itens,
  “Exibindo A–B de N”. O total virá da API, nunca de `itens.length`.
- Sem registros e sem filtros aplicados, preservar “Nenhum processo enviado
  ainda.”; com pesquisa/filtros sem correspondência, mostrar “Nenhum processo
  encontrado.”. Exibir total zero e desabilitar a navegação nos dois casos.
- Limpar restaura pesquisa vazia, todos os status, datas vazias, ordem `desc`,
  página 1 e tamanho 20, inclusive os valores ainda não submetidos no formulário.
- Preservar estados de carregamento/erro. Uma resposta antiga não deve substituir
  uma consulta mais recente; falha não deve ser apresentada como zero resultados.
- Após upload, atualizar a consulta e voltar à página 1, preservando os filtros.
  Após exclusão, atualizar página e total. Se a página ficar além da última,
  consultar a última válida (ou página 1 para total zero), com no máximo uma
  correção automática por resposta, evitando repetição infinita.
- Controles terão rótulos acessíveis e funcionamento por teclado. O frontend não
  filtrará, ordenará ou recortará localmente a coleção retornada.

## 3. Contrato da API

`GET /api/processos` — sessão obrigatória; disponível para `admin` e `operador`.
Leitura sem alteração de dados; sem nova exigência de CSRF para este GET.

| Query parameter | Tipo / padrão | Regra |
|---|---|---|
| `busca` | string opcional | Remover espaços nas extremidades; vazio significa sem pesquisa; máximo 255 caracteres após normalização. |
| `status` | string opcional | `recebido`, `analisando`, `analisado` ou `erro`; omitir para todos. |
| `data_inicio` | data opcional | `YYYY-MM-DD`, data válida do calendário. |
| `data_fim` | data opcional | Mesmo formato; quando ambas existem, deve ser maior ou igual ao início. |
| `ordem` | `asc` ou `desc`; `desc` | Somente ordenação por `criado_em`; não aceitar nomes de colunas/expressões SQL. |
| `pagina` | inteiro; 1 | Maior ou igual a 1. |
| `tamanho_pagina` | inteiro; 20 | Entre 1 e 100, inclusive; a API aceita também tamanhos intermediários. |

Exemplo:

```text
GET /api/processos?busca=imovel&status=analisado&data_inicio=2026-11-01&data_fim=2026-11-18&ordem=desc&pagina=1&tamanho_pagina=20
```

Resposta `200`, inclusive para seleção vazia ou página além da última:

```text
ProcessosPaginaOut {
  itens: ProcessoOut[],
  total: integer,
  pagina: integer,
  tamanho_pagina: integer,
  total_paginas: integer
}
```

- `ProcessoOut` mantém os campos da spec backend; não incluir PDF, caminho do
  arquivo, texto extraído ou conteúdo de checklist/relatório.
- `total`: quantidade após todos os filtros e antes de `LIMIT/OFFSET`.
- `total_paginas`: teto de `total / tamanho_pagina`; zero quando `total = 0`.
- `pagina` e `tamanho_pagina`: valores solicitados ou seus padrões.
- Página fora do intervalo retorna `itens: []`, preservando o total e a página
  solicitada; não é erro nem redirecionamento silencioso pelo backend.
- Sem parâmetros, retornar a primeira página de até 20 itens, em ordem decrescente.

Erros no formato `ErroOut { detail: string }`:

| Situação | HTTP / mensagem |
|---|---|
| Sessão ausente, expirada ou inválida | `401`, mantendo o comportamento atual. |
| Parâmetro reconhecido inválido | `422`, `Parâmetro <nome> inválido`. |
| Período invertido | `422`, `Data inicial deve ser anterior ou igual à data final`. |

O frontend validará os mesmos limites para orientar o usuário; o backend continuará
sendo a autoridade. Status, datas, ordem e números presentes como string vazia são
inválidos; apenas `busca` vazia equivale à omissão. Valores inválidos não serão
ajustados silenciosamente. Erros não reproduzirão os valores recebidos na mensagem.

## 4. Regras de consulta e compatibilidade

- Pesquisa: `(nome_arquivo contém busca OR numero_processo contém busca)`; combinar
  esse grupo com status e período por **AND**. Número nulo não impede resultado
  pelo nome. Manter acentos e pontuação: não há normalização de número CNJ ou
  remoção de acentos nesta entrega.
- `%`, `_`, aspas e barras na busca serão literais, não curingas/comandos SQL.
  Usar ORM/parâmetros vinculados, escapando metacaracteres de `LIKE/ILIKE`.
- Interpretar datas no `Settings.TIMEZONE` (padrão `America/Belem`). Início inclui
  00:00 local; fim inclui o dia inteiro, usando limite exclusivo de 00:00 do dia
  seguinte. Converter limites para comparação com `criado_em` em UTC. Não filtrar
  por `analisado_em`; aceitar intervalo aberto e datas futuras válidas.
- Ordenação estável: `criado_em DESC, id DESC` ou `criado_em ASC, id ASC`.
  Aplicar filtros, ordenação e paginação no banco. Total e itens terão os mesmos
  predicados; não carregar todos os registros para processá-los em Python.
- Não exigir snapshot entre requisições: inserções/exclusões concorrentes podem
  alterar o total e deslocar páginas. Com dados estáveis, não haverá repetição ou
  omissão entre páginas consecutivas.
- Preservar routers → services → SQLAlchemy, schemas Pydantic e tipos TypeScript
  correspondentes. Não introduzir dependências ou mudanças de modelo de dados.
- A resposta muda de array para envelope: na implementação futura, atualizar em
  conjunto o contrato anterior, cliente HTTP, tipos, página, chaves de cache,
  handlers MSW e testes afetados. As chaves distinguirão todos os parâmetros da
  consulta aplicada, mantendo a invalidação das listagens.
- Preservar o contrato MCP `listar_processos`, que retorna uma lista: a paginação
  HTTP não poderá truncar ou mudar implicitamente sua resposta. Os mocks devem
  espelhar o novo contrato HTTP, sem substituir a implementação real no backend.

## 5. Critérios de aceite para a implementação futura

| ID | Evidência esperada |
|---|---|
| CA01 | Sem parâmetros, API retorna envelope, no máximo 20 itens, total completo e ordem padrão. |
| CA02 | Pesquisa parcial encontra nome ou número, ignora caixa, remove espaços externos e mantém busca literal para `%`, `_`, aspas e barras; número nulo é coberto. |
| CA03 | Status isolado e pesquisa + status + período retornam somente a interseção correta; pesquisa sem correspondência retorna total zero. |
| CA04 | Início/fim isolados e mesmo dia funcionam. Para o dia 18/11/2026 em Belém, `03:00Z` do dia 18 é incluído e `03:00Z` do dia 19 é excluído. |
| CA05 | Cada status válido é aceito; status/ordem inválidos, datas inválidas/invertidas, busca acima do limite, página zero/negativa/fracionária e tamanho fora de 1–100 recebem `422` textual. |
| CA06 | Ordem crescente/decrescente e desempate por UUID produzem páginas determinísticas, sem duplicações com dados estáveis. |
| CA07 | Com 21 registros e tamanho 20, há páginas com 20 e 1 item, total 21 e duas páginas; a terceira retorna itens vazios e os mesmos metadados. |
| CA08 | Base vazia retorna total e total_paginas zero; autenticação ausente recebe `401`; ambos os perfis autenticados acessam a listagem. |
| CA09 | UI envia os parâmetros à API; aplicar/limpar/ordenar/trocar tamanho retorna à página 1; navegação preserva filtros e contagem global. |
| CA10 | UI apresenta singular/plural, vazio, erro e carregamento; desabilita navegação nos limites; resposta atrasada não troca os resultados da consulta atual. |
| CA11 | Upload/exclusão atualizam os resultados sem perder filtros; exclusão do último item de uma página corrige a navegação sem loop. |
| CA12 | Upload, detalhe, permissões de exclusão e contrato MCP permanecem funcionais; MSW corresponde à API e o E2E usa backend real com fake/file. |

Os critérios deverão ser demonstrados por testes de API com PostgreSQL isolado,
testes de UI com MSW e um E2E da listagem. Esta etapa apenas especifica esses
testes; não os cria nem os executa.
