# Checklists especializados por categoria de bem

Data: 19/11/2026. Status: aprovação condicional informada pela equipe; ajustes documentados, não implementada.

## 1. Escopo e referências

Suportar imóveis, materiais e veículos no mesmo checklist, reutilizando o domínio
`processos`, os campos comuns e o fluxo atual de extração, edição e revisão humana.
Não criar novos critérios jurídicos, consultas ao DETRAN/SEFA ou exportação nesta etapa.

Fontes do cliente, lidas localmente em `docs/referencias-cliente/`:

- **I:** `DOC 1 modelo checklist - imoveis.docx`.
- **M:** `DOC 2 modelo checklist - material.docx`.
- **V:** `DOC 3 modelo checklist - veículos.docx`.

Somente esses três modelos fundamentam os campos. A minuta de edital e a agenda
da pasta não foram analisadas. Originais, dados preenchidos e metadados pessoais
não integram esta especificação nem devem entrar no Git, fixtures ou prompts de
desenvolvimento. Exemplos futuros devem ser sintéticos.

Referências técnicas comparadas:

- `src/backend/app/processos/{schemas,prompts,models,service,router}.py`.
- `src/frontend/src/api/{types,processos}.ts`.
- `src/frontend/src/features/processos/{ChecklistForm,ChecklistView,BemChecklist,ParteChecklist,CamposChecklist,ListaChecklist,checklistEdicao}.tsx/ts`.
- `AprovacaoChecklistCard.tsx`, `HistoricoChecklistCard.tsx` no mesmo domínio.
- `src/backend/app/mcp_server.py`, `app/editais/service.py`, `app/marketing/service.py`.
- `SPEC/2026-10-01-backend.md` e `SPEC/2026-11-18-edicao-checklist.md`.

## 2. Matriz comparativa dos campos

✓ = presente no modelo; — = sem campo específico. Ausência no modelo não significa
inexistência jurídica ou autorização para apagar dados. Caminhos sem prefixo estão
em `bens[]`, salvo indicação. **Novo** indica proposta, não implementação existente.

| Campo/grupo do cliente | I | M | V | Cobertura atual / adequação proposta |
|---|:---:|:---:|:---:|---|
| Vara, número e juiz | ✓ | ✓ | ✓ | `Checklist.vara`, `numero_processo`, `juiz`; manter `tipo_justica`. |
| Partes, CPF/CNPJ e representação | ✓ | ✓ | ✓ | `exequente`, `executados[]`, `advogados[].nome/oab/ref`; **novo** `Parte.representacao` para texto institucional sem inventar advogado. |
| CPF do advogado | — | ✓ | — | Ausente em `Advogado` atual (`nome`, `oab`, `ref`); **novo** `Advogado.cpf`, string opcional/anulável, independente do CPF/CNPJ da parte. |
| Procuração | ✓ | ✓ | ✓ | Reutilizar `Advogado.ref` quando vinculada ao advogado; **novo** `Parte.procuracao_ref` quando a referência pertence à parte/representação sem advogado identificado. Não duplicar referências por suposição. |
| Citação e referência | ✓ | ✓ | ✓ | `Executado.citado`, `citacao_forma`, `citacao_ref`. |
| CDA / título executivo | ✓ | ✓ | ✓ | `Execucao.cda` cobre CDA; **novo** `titulo_executivo` para título genérico, sem renomear CDA. |
| Natureza, classe, dívida e data | ✓ | ✓ | ✓ | `Execucao.natureza_divida/classe/valor_divida/data_divida`; **novo** `valor_divida_ref` para referência separada do valor. |
| Descrição completa e localização | ✓ | ✓ | ✓ | `descricao`, `localizacao`; manter descrição integral, inclusive identificadores. |
| Data/referência da penhora e depositário | ✓ | ✓ | ✓ | `data_penhora`, `penhora_ref`, `fiel_depositario`. |
| Intimação do executado e data | ✓ | ✓ | ✓ | `executado_intimado`, `data_intimacao`, `intimacao_ref`; **novo** `intimacao_forma` para não misturar forma e identificador documental. |
| Avaliação, data e oficial | ✓ | ✓ | ✓ | `valor_avaliacao`, `data_avaliacao`, `oficial_avaliacao`; **novo** `avaliacao_ref`. |
| Reavaliação, data e oficial | ✓ | ✓ | ✓ | `valor_reavaliacao`, `data_reavaliacao`; **novos** `oficial_reavaliacao`, `reavaliacao_ref`. |
| Intimação da reavaliação e data | ✓ | — | ✓ | **Novos** `intimacao_reavaliacao`, `data_intimacao_reavaliacao`, `intimacao_reavaliacao_ref`; descrição textual, sem presumir destinatário. |
| Matrícula e certidão | ✓ | — | — | `matricula`, `certidao_matricula_ref`, preservados nos caminhos atuais. |
| Propriedade e intimação do cônjuge | ✓ | — | — | `propriedade` existe; **novo** `imovel.intimacao_conjuge`, textual, sem inferir existência de cônjuge. |
| Averbação da penhora/ano e data | ✓ | — | — | `averbacao_penhora` textual existe; **novo** `imovel.data_averbacao_penhora`; não converter ano isolado em data inventada. |
| Hipoteca e enfiteuse/aforamento | ✓ | — | — | `hipoteca`, `enfiteuse`, preservados. |
| Outras penhoras | ✓ | — | ✓ | `outras_penhoras`; campo comum reutilizado, sem duplicação. |
| Identificação do veículo na descrição | — | — | ✓ | Texto existe somente em `descricao`; **novos** `veiculo.marca_modelo`, `placa`, `cor`, `ano`, `modelo`, `chassi`. `ano`/`modelo` preservam os rótulos do modelo, sem presumir fabricação/ano-modelo quando ambíguos. |
| RENAVAM, grafado “RENAVAN” na descrição | — | — | ✓ | **Novo** `veiculo.renavam`, string opcional/anulável; preservar zeros à esquerda e descrição original, sem reproduzir a grafia do rótulo na chave da API. |
| Proprietário no DETRAN | — | — | ✓ | **Novo** `veiculo.proprietario_detran`; não substituir automaticamente `propriedade`. |
| “INT.” na seção DETRAN/SEFA | — | — | ✓ | **Novo** `veiculo.intimacao_detran`, textual; significado/destinatário pendente de confirmação. |
| Credor fiduciário | — | — | ✓ | **Novo** `veiculo.credor_fiduciario`, textual, preservando negativa expressa. |
| Multas e débitos | — | — | ✓ | **Novo** `veiculo.multas_debitos`, textual; não pressupor valor, quitação ou consulta externa. |
| Recursos | ✓ | ✓ | ✓ | `Checklist.recursos`. |
| Relatório / fatos processuais | ✓ | ✓ | ✓ | `Relatorio.resumo/etapas[]` já separados do checklist; síntese atual não garante transcrição integral do modelo. Não mover nem substituir esse contrato. |
| Leilão/edital e observações | ✓ | ✓ | ✓ | `Checklist.observacoes_leilao[]`; fatos narrativos, sem executar automaticamente as ações descritas. |
| Local/data e assinatura do documento | ✓ | ✓ | ✓ | Elementos da futura apresentação; não extrair como data do processo nem equiparar assinatura à aprovação no sistema. |

O modelo de materiais não apresenta campos exclusivos de quantidade, unidade,
número de série ou conservação. Não adicioná-los por suposição. RENAVAM aparece
na descrição do veículo como “RENAVAN”. O modelo de imóveis repete o bloco
por bem; não fixar a quantidade de bens a essa amostra.

## 3. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Classificar cada item de `bens[]` individualmente como imóvel, material ou veículo, permitindo categoria não informada. Um processo pode conter quaisquer combinações. |
| RF02 | Reutilizar descrição, penhora, intimação, avaliações e demais campos existentes; acrescentar os campos ausentes da matriz sem renomear ou remover campos legados. |
| RF03 | Exibir seletor de categoria por bem, seções comuns e campos especializados na edição e na visualização. Materiais usam os campos comuns. |
| RF04 | Permitir adicionar, editar e remover bens de categorias distintas mantendo identidade local, ordem, referências, listas e dados dos demais bens. |
| RF05 | Ao trocar categoria, conservar dados comuns e especializados já preenchidos. Campos de outra categoria permanecem acessíveis em seção identificada; não apagar, converter nem transferir valores silenciosamente. |
| RF06 | Atualizar Pydantic, tipos TypeScript, validação, prompts e fixtures sintéticas coerentemente. A extração deve produzir um item por bem e respeitar o schema completo. |
| RF07 | Ler, exibir, editar e salvar checklists antigos sem reanálise obrigatória ou classificação automática em massa. Não exigir preenchimento dos novos campos. |
| RF08 | Preservar confirmação de descarte, rascunho durante falhas/refetch, bloqueio de duplo envio e atualização de consultas após salvar. |
| RF09 | Preservar revisão/aprovação humana e eventos existentes de análise, reanálise, edição e aprovação; nenhuma extração aprova automaticamente o resultado. |
| RF10 | Manter a organização por domínio, componentes e identidade visual existentes; separar validação/modelagem da apresentação dinâmica. |

## 4. Modelagem proposta

Evolução aditiva de `BemPenhorado`, sem herança polimórfica, tabelas por categoria
ou renomeação de caminhos. Manter **todos os campos atuais**, inclusive os
imobiliários no nível original, para não quebrar dados e consumidores.

| Estrutura | Campos novos e tipos |
|---|---|
| `Advogado` | `cpf: string\|null`, opcional na entrada, default `null`. |
| `Parte` / `Executado` por herança | `representacao: string\|null`, `procuracao_ref: string\|null`. |
| `Execucao` | `titulo_executivo: string\|null`, `valor_divida_ref: string\|null`. |
| `BemPenhorado` | `categoria: "imovel"\|"material"\|"veiculo"\|null`; `intimacao_forma`, `avaliacao_ref`, `oficial_reavaliacao`, `reavaliacao_ref`, `intimacao_reavaliacao`, `intimacao_reavaliacao_ref`: `string\|null`; `data_intimacao_reavaliacao: date\|null`; `imovel: DadosImovel\|null`; `veiculo: DadosVeiculo\|null`. |
| `DadosImovel` | `intimacao_conjuge: string\|null`, `data_averbacao_penhora: date\|null`. |
| `DadosVeiculo` | `marca_modelo`, `placa`, `cor`, `ano`, `modelo`, `chassi`, `renavam`, `proprietario_detran`, `intimacao_detran`, `credor_fiduciario`, `multas_debitos`: `string\|null`. Todos opcionais na entrada, default `null`. |

Todos os novos campos têm default `null` no backend; propriedades ausentes em
JSON legado são interpretadas como desconhecidas. Tipos de resposta espelhados
no frontend, com normalização na fronteira quando necessária; não redefinir tipos
de API dentro dos componentes. Blocos especializados podem coexistir para preservar
uma correção de categoria; sua presença isolada não determina classificação.

Persistência continua em `checklists.dados` JSONB. Não há necessidade prevista
de nova tabela ou migração de dados em massa. A leitura compatível não regrava
dados, gera revisão ou altera aprovação/histórico. Manter o vínculo processo →
checklist e a persistência pelo service existente.

### Validação e extração

- Valores monetários existentes: strings decimais com duas casas, nunca float;
  datas completas válidas em `YYYY-MM-DD`. Ano e modelo do veículo permanecem texto.
- Novos campos são opcionais/anuláveis; não criar máscaras de placa/chassi, regras
  de titularidade, obrigatoriedade de intimações ou validações jurídicas.
- `Advogado.cpf` e `veiculo.renavam` são texto, nunca números: preservar zeros à
  esquerda e conteúdo informado, sem máscaras obrigatórias, cálculo de dígitos ou
  preenchimento por dedução. Extrair “RENAVAN” como `renavam` somente quando presente;
  CPF do advogado pertence ao respectivo advogado, no exequente ou executado.
- `null` significa desconhecido; `false` nos booleanos existentes significa
  negativa expressa. Texto “não há” informado nos autos deve ser preservado,
  sem ser convertido em ausência de informação. Não usar zero como desconhecido.
- Ausência de detalhe não autoriza fabricar categoria, identificador, pessoa,
  débito ou data. Categoria só por evidência inequívoca; ambiguidade resulta em
  `null` e possibilidade de revisão humana. Não usar matrícula legada como migração
  automática de categoria. Não resolver contradições narrativas por suposição.
- O prompt deve distinguir os três grupos, aceitar processo misto, explicar cada
  campo novo, manter referências exatamente como nos autos e não consultar sites.
  Não inserir exemplos preenchidos dos DOCX nos prompts nem usar seus dados como
  conteúdo do processo analisado. Manter `SYSTEM_RELATORIO` e seu contrato separado.
- Manter `descricao` integral mesmo quando dados forem estruturados. Para nomes e
  descrição já não anuláveis, preservar o contrato atual: string vazia quando
  desconhecidos, sem inventar conteúdo ou mudar o campo para `null` nesta evolução.
- Erros devem indicar caminhos como `bens.1.veiculo.placa`; validação de categoria
  inválida retorna o erro de schema existente, sem tratamento global novo.

## 5. Contratos e compatibilidade retroativa

| Operação existente | Comportamento esperado |
|---|---|
| `GET /api/processos/{id}` | Mesmo envelope, checklist enriquecido aditivamente, aprovação preservada. |
| `POST /api/processos/{id}/analisar` | Mesma operação/status; extração com schema estendido e revisão humana posterior. |
| `PUT /api/processos/{id}/checklist` | Objeto `Checklist` completo; resposta `200 Checklist`, incluindo campos especializados. |
| `POST /api/processos/{id}/checklist/aprovacao` | Mesmo body `{revisao}`; conflito de revisão mantém `409`, sem atalhos por categoria. |
| `GET /api/processos/{id}/checklist/historico` | Mesmo formato e limite de 20 eventos; não inventar snapshots ou diferenças campo a campo. |
| MCP | Mesmas ferramentas, parâmetros, estruturas externas e acesso somente leitura; campos legados do caderno permanecem, novos detalhes são aditivos. |

Não criar endpoint por categoria nem PATCH. O cliente atualizado envia o objeto
completo sem perder campos ocultos. Payloads legados continuam válidos pelos
defaults novos; round-trip de dados antigos preserva seus valores originais.
Como o PUT substitui o checklist, não prometer preservação de campos novos por
clientes antigos que os removam do payload: publicar backend/frontend de forma
coordenada. Sem merge heurístico por posição, descrição ou matrícula.

Leitura e abertura do editor não invalidam aprovação. Salvar edição (inclusive
troca de categoria) e reanalisar seguem a regra atual: nova revisão; aprovação da
revisão anterior não aprova a nova. Conservar eventos anteriores e registrar a
ação atual pelo service, sem criar ações adicionais. Falha não grava evento de
sucesso. Atualizar as consultas de detalhe, pendências e histórico afetadas.

Não modificar regras de pendências, agenda, progresso, edital, valores ou marketing
por categoria nesta entrega. Consumidores que usam descrição, matrícula e valores
comuns devem continuar funcionando para bens mistos. Campos novos não disparam
regeneração documental ou envio automático.

## 6. Preparação para futura exportação DOCX

A matriz define o mapeamento de dados para os três modelos: cabeçalho/partes e
execução compartilhados; blocos repetidos por bem; detalhes conforme categoria;
recursos, relatório e observações nas seções correspondentes. Manter nomes de
domínio estáveis, referências e ordem dos bens; não armazenar HTML/OOXML no JSON.

Uma futura exportação deverá selecionar os bens de cada categoria sem duplicar
seus registros e sem perder o contexto compartilhado. Política para processo misto
(arquivo único ou múltiplos), categoria desconhecida, apresentação de campos vazios,
fidelidade do relatório, local/data e assinatura exige especificação própria.
Não criar gerador, template sanitizado, rota ou botão de exportação agora.

## 7. Critérios de aceite

| ID | Critério verificável na implementação futura |
|---|---|
| CA01 | Um checklist sintético com imóvel, material, veículo e categoria desconhecida pode ser extraído, editado, salvo e reaberto sem troca de dados entre itens. |
| CA02 | Todos os campos da matriz possuem destino existente/proposto; os novos são editáveis e aparecem na visualização correspondente. Materiais não recebem campos exclusivos inventados. |
| CA03 | Selecionar categoria altera seções visíveis; trocar/reverter categoria preserva valores, ordem e foco, inclusive dados de outra categoria acessíveis para correção. |
| CA04 | JSON antigo sem campos novos continua válido; GET/editor não alteram persistência, revisão, aprovação nem histórico. Editar um campo preserva integralmente os demais. |
| CA05 | Dados ausentes permanecem desconhecidos; negativas explícitas são preservadas; extração não replica conteúdo dos modelos nem deduz ano-modelo, destinatário de “INT.” ou classificação duvidosa. |
| CA06 | Enum, datas e dinheiro inválidos recebem erros pelo padrão atual; opcionais vazios são aceitos, sem novas regras jurídicas ou obrigatoriedades. |
| CA07 | Edição/reanálise invalida a aprovação da revisão anterior conforme o mecanismo existente; aprovação obsoleta retorna `409`. Eventos anteriores e autoria são preservados, sem afirmar histórico de valores inexistente. |
| CA08 | Falhas de extração/salvamento e navegação com rascunho preservam os comportamentos atuais; somente sucesso confirma dados e atualiza consultas afetadas. |
| CA09 | Contratos HTTP/MCP e consumidores de edital/marketing/pendências mantêm seus campos e regras anteriores; processo misto não causa erro por ausência de matrícula ou detalhes especializados. |
| CA10 | Tipos Pydantic/TS, prompt, fake e MSW usam o mesmo contrato; testes futuros cobrem três categorias, mistura, legado, campos ocultos, validação e aprovação/histórico com dados sintéticos. |
| CA11 | Layout reutiliza componentes, seções e acessibilidade atuais, com navegação por teclado e apresentação em tela estreita. |
| CA12 | Somente código/documentação e fixtures sintéticas são versionados; originais e dados processuais reais permanecem fora do Git. Exportação DOCX continua explicitamente pendente. |
| CA13 | O rótulo “RENAVAN” do modelo é mapeado para `veiculo.renavam`; edição, PUT, GET e reabertura preservam zeros à esquerda. Ausência/`null` são aceitos, sem inventar valor. |
| CA14 | `Advogado.cpf` é editável e persistido por advogado, inclusive em listas de partes diferentes, sem confundir com `Parte.cpf_cnpj`. Ausência/`null` e dados legados são aceitos; zeros à esquerda permanecem, sem validação jurídica nova. |

O contrato proposto está refletido em `SPEC/2026-10-01-backend.md` e na extensão
de `SPEC/2026-11-18-edicao-checklist.md`; sua implementação e a adequação dos
tipos/consumidores permanecem pendentes. Confirmar com o
cliente o sentido de “INT.” na seção DETRAN/SEFA e dos rótulos ano/modelo antes de
qualquer interpretação além do texto. Esta sessão produziu somente documentação;
não houve testes, builds, lint, auditorias ou comprovação de implementação.
