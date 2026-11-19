# Exportação de checklists processuais em DOCX

Data: 19/11/2026. Status: proposta para revisão; não implementada.

## 1. Escopo e referências

Gerar no backend documentos de imóveis, materiais e veículos com os dados
persistidos, reproduzindo os três modelos locais em `docs/referencias-cliente/`:
`DOC 1 modelo checklist - imoveis.docx`, `DOC 2 modelo checklist - material.docx`
e `DOC 3 modelo checklist - veículos.docx`. Não analisar a agenda ou minuta de edital.
Não chamar LLM, consultar serviços externos, classificar bens ou alterar dados
durante a exportação. Originais e dados reais não serão versionados.

Referências de implementação: `processos/{schemas,models,service,router}.py`,
`editais/{docx,router}.py`, `api/{processos,client,types}.ts`,
`features/processos/{ProcessoDetalhePage,DocumentosProcessoCard}.tsx`,
`lib/baixarArquivo.ts`, specs de backend, edição e
[checklists especializados](2026-11-19-checklists-especializados.md).

## 2. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Exportar um DOCX por categoria explicitamente selecionada: `imovel`, `material` ou `veiculo`. |
| RF02 | Incluir todos os bens da categoria, na ordem persistida, repetindo o bloco correspondente sem limite fixado pela amostra do cliente. |
| RF03 | Em processo misto, oferecer downloads separados; repetir os dados processuais compartilhados e incluir somente os bens selecionados. Não oferecer ZIP ou documento combinado nesta etapa. |
| RF04 | Avisar na interface e em cada arquivo quando houver bens com `categoria=null` ou ausente, informando quantidade e posições originais. Não inferir classificação pela matrícula/descrição nem ignorar esses bens silenciosamente. |
| RF05 | Reproduzir estrutura, tabelas, mesclagens, seções, fontes, bordas, alinhamentos e espaçamentos dos modelos, com expansão para conteúdo variável. |
| RF06 | Incluir processo, partes/advogados, execução, penhora, avaliações, campos especializados, recursos, relatório e observações, preservando referências documentais. |
| RF07 | Preencher exclusivamente a partir do snapshot persistido; não exportar rascunhos do editor, exemplos dos modelos ou valores de outros processos. |
| RF08 | Permitir exportação sem aprovação, identificando explicitamente o documento como não aprovado. Usar o mecanismo de aprovação da revisão atual, sem criar aprovação própria para o arquivo. |
| RF09 | Disponibilizar download no detalhe do processo, com estado de carregamento, prevenção de repetição durante a requisição e erro conforme os componentes existentes. |
| RF10 | Gerar bytes em memória com `python-docx`, sem novo pacote, tabela, fila, arquivo público ou alteração nos contratos de edital/MCP. |

## 3. Estrutura e formatação dos modelos

Leitura estrutural dos DOCX, sem transcrever seus dados preenchidos:

| Modelo | Tabela original | Grade original em twips |
|---|---|---|
| Imóveis | 39 linhas, 9 colunas de grade, com dois blocos de bens na amostra | `1842, 2411, 850, 141, 994, 1124, 435, 849, 1418` |
| Materiais | 19 linhas, 11 colunas de grade | `1842, 2261, 708, 433, 417, 426, 142, 1133, 577, 707, 1418` |
| Veículos | 25 linhas, 10 colunas de grade | `1984, 2553, 709, 140, 992, 286, 1133, 424, 860, 1975` |

As colunas de grade não equivalem ao número de células visíveis: preservar as
mesclagens. Quantidades de linhas são referências das amostras, não limites de saída.
Todos usam página A4 retrato (`11906 × 16838` twips), margens superior `1985`,
inferior/direita `1134`, esquerda `1701`. Tabelas têm layout fixo e recuo negativo:
imóveis/materiais `-734`, veículos `-1168` twips. Preservar essas configurações
nos modelos sanitizados e validar o resultado renderizado, sem redesenho genérico.

A fonte diretamente predominante é Times New Roman, corpo principalmente de 9 pt;
há variações de tamanho/fonte nos modelos. Preservar estilos e formatação por
parágrafo/run, inclusive títulos, cabeçalhos e rodapés, sem uniformizar tudo para
o estilo padrão do Word. Conteúdo longo deve crescer e paginar sem corte, sobreposição
ou altura de linha fixa que esconda texto. Não garantir número de páginas idêntico
quando a quantidade de bens ou o tamanho dos dados mudar.

Ordem: título/categoria → vara/processo/juiz → partes e representação → execução
→ penhora e dados de cada bem → outros dados/recursos → relatório → leilão/edital
e observações → encerramento. Avisos e metadados de exportação são acréscimos
identificados; não substituem nem desorganizam as seções do modelo.

## 4. Mapeamento dos campos

`c` = `Checklist` persistido; `b` = bem da categoria selecionada. Não renomear os
campos da API nem transferir dados entre categorias na exportação.

| Seção do modelo | Origem / preenchimento |
|---|---|
| Vara, nº do processo e juiz | `c.vara`, `c.numero_processo`, `c.juiz`; `tipo_justica` pode aparecer nos dados complementares, sem inferência nova. |
| Exequente e executados | `c.exequente`, todos de `c.executados[]`: nome, `cpf_cnpj`, `representacao`, `procuracao_ref`. Repetir qualificação/representação conforme necessário. |
| Advogados/procuração | Todos os `advogados[]` de cada parte: `nome`, `cpf`, `oab`, `ref`. CPF do advogado permanece separado do documento da parte. |
| Citação | `citado`, `citacao_forma`, `citacao_ref` de cada executado. |
| CDA/título, natureza e classe | `c.execucao.cda`, `titulo_executivo`, `natureza_divida`, `classe`; preservar CDA e título quando ambos informados, sem escolher um silenciosamente. |
| Valor da dívida/data/referência | `valor_divida`, `data_divida`, `valor_divida_ref` de `c.execucao`. |
| Bem(ns)/localização | `b.descricao` integral e `localizacao`; conservar a identificação/posição original do bem no processo. |
| Penhora e depositário | `data_penhora`, `penhora_ref`, `fiel_depositario`. |
| Intimação do executado | `executado_intimado`, `intimacao_forma`, `data_intimacao`, `intimacao_ref`. |
| Avaliação/oficial/data | `valor_avaliacao`, `data_avaliacao`, `oficial_avaliacao`, `avaliacao_ref`. |
| Reavaliação/oficial/data | `valor_reavaliacao`, `data_reavaliacao`, `oficial_reavaliacao`, `reavaliacao_ref`. Não substituir automaticamente a primeira avaliação pela última. |
| Intimação da reavaliação | `intimacao_reavaliacao`, `data_intimacao_reavaliacao`, `intimacao_reavaliacao_ref`, sem presumir destinatário. |
| Imóvel: propriedade/cônjuge | `b.propriedade`, `b.imovel.intimacao_conjuge`. |
| Imóvel: dados da matrícula | `matricula`, `certidao_matricula_ref`, `averbacao_penhora`, `imovel.data_averbacao_penhora`, `hipoteca`, `enfiteuse`, `outras_penhoras`. |
| Material | Campos comuns, sem inventar quantidade, unidade, série, ônus ou dados exclusivos ausentes. |
| Veículo: identificação | `b.veiculo.marca_modelo`, `placa`, `cor`, `ano`, `modelo`, `chassi`, `renavam`; preencher a posição grafada “RENAVAN” no modelo com `renavam`, preservando zeros à esquerda. Manter também a descrição integral. |
| Veículo: DETRAN/SEFA | `proprietario_detran`, `intimacao_detran`, `credor_fiduciario`, `multas_debitos` de `b.veiculo`, além de `b.outras_penhoras`; manter “INT.” textual sem redefinir seu significado. |
| Recursos | `c.recursos`, integral. |
| Relatório | `Relatorio.resumo` e todas as `etapas[]`, com `data`, `descricao` e `ref`, na ordem persistida. Não reconstruir narrativa ausente. |
| Leilão/edital e observações | Todos os itens de `c.observacoes_leilao[]`, preservando ordem, repetições e quebras de linha. Não confundir essa seção narrativa com geração de edital. |
| Campos sem espaço específico no modelo | Inserir junto ao bloco do bem/parte em “Dados complementares”, mantendo rótulo e referência. Inclui intimação da reavaliação de materiais e dados de outra categoria conservados após uma correção. Não converter esses dados em classificação ou descartá-los. |
| Encerramento | Identificar emissão e revisão nos metadados; não copiar cidade/data, nomes ou assinatura preenchidos na amostra. Local e assinatura sem origem persistida ficam como não informados/em branco, sem assinatura automática de pessoa ou empresa. |

Relatório e observações são compartilhados pelo processo: reproduzi-los integralmente
em cada categoria, mesmo quando citarem outros bens. Não filtrá-los ou reescrevê-los
por heurística. Bens de outra categoria não entram nos blocos de penhora selecionados.

### Desconhecidos e aprovação

- `null`, campos opcionais ausentes e strings vazias: exibir “Não informado”.
  Listas vazias: “Nenhum item informado”, sem afirmar inexistência jurídica.
  Booleanos: `true` → “Sim”, `false` → “Não”, `null` → “Não informado”.
- Preservar negativas expressas, referências e identificadores textuais. Não
  completar CPF, RENAVAM, chassi, datas ou valores. Ano/modelo do veículo continuam texto.
- Dinheiro: formatação brasileira com `Decimal`, sem float ou arredondamento
  adicional; zero é valor conhecido. Datas completas em `DD/MM/AAAA`; datetimes
  de emissão/aprovação em `settings.TIMEZONE`, com identificação do fuso.
- Sem relatório persistido: manter a seção com “Relatório não disponível”. Não
  executar análise para preenchê-la. Checklist legado não exige reanálise.
- Consultar `aprovacao_de` para a revisão exportada. Sem aprovação válida, inserir
  **“CHECKLIST NÃO APROVADO — REVISÃO HUMANA PENDENTE”** no início e no cabeçalho
  de todas as páginas. Com aprovação, registrar revisão, `aprovado_por` e data
  persistida, sem atribuir validade jurídica ou aprovação do relatório separado.
- Incluir o aviso existente de conteúdo gerado por IA e necessidade de revisão.
  Aprovação não dispensa o aviso de bens não classificados.
- Havendo desconhecidos: **“Exportação de [categoria]. N bem(ns) não classificados
  não foram incluídos nos blocos desta categoria: [posições]. Classifique-os para
  exportação.”** Exibir também nos arquivos de checklists aprovados.

## 5. Estratégia de geração e sanitização

Manter o domínio `processos`: router valida categoria/permissão; service obtém um
snapshot consistente de checklist, relatório, revisão e aprovação; gerador em
`app/processos/docx.py` preenche e retorna bytes. Reutilizar os padrões de
`BytesIO`, `Response`, MIME, formatação e nomes seguros existentes.

O conversor `editais.docx.markdown_para_docx` produz parágrafos simples e não
reproduz as tabelas dos modelos. Preservá-lo para editais; não adaptá-lo por
condicionais de categoria nem fazer importação entre domínios para esse fim.

Usar três modelos sanitizados versionáveis em
`app/processos/templates/checklist-{imovel,material,veiculo}.docx`, com uma unidade
de repetição identificada por categoria. Prepará-los apenas na implementação:
remover exemplos reais do corpo, células, cabeçalhos, rodapés, caixas de texto,
campos ocultos, comentários, revisões e propriedades; remover vínculos externos
e qualquer assinatura/imagem pessoal. Substituir valores por marcadores neutros,
preservando rótulos, estilos, grades, mesclagens e seções necessárias ao layout.
Não carregar os documentos de `docs/referencias-cliente/` em runtime nem empacotá-los.

Abrir uma cópia nova do modelo sanitizado por requisição. Preencher marcadores
sem destruir a formatação dos runs ou a tabela inteira; marcadores podem estar
divididos entre runs. Repetir o conjunto de linhas do bem, inclusive propriedades
de células/mesclagens, para cada item. Inserir partes, advogados e narrativas com
expansão apropriada. Não deixar exemplos ou marcadores técnicos na saída.

Não persistir DOCX, criar evento de edição/aprovação, alterar revisão ou histórico
no download. Geração por leitura e em memória; nenhuma chamada à LLM, SMTP ou
DETRAN/SEFA. Falha não retorna documento parcial nem registra sucesso fictício.

## 6. Contrato da API e permissões

`GET /api/processos/{processo_id}/checklist/download?categoria=imovel`

`categoria` é obrigatória, enum `imovel`, `material`, `veiculo`; sem body. Mesmo
endpoint para os três modelos. Não aceitar caminho de template ou nome de arquivo
fornecido pelo cliente. Usuários autenticados `admin` e `operador` podem exportar
nos mesmos limites de acesso ao processo já existentes; backend aplica autorização.
GET somente leitura, sem nova exigência de CSRF. Não criar acesso público ou tool MCP.

| Resposta | Contrato |
|---|---|
| `200` | Bytes DOCX; `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`. |
| Cabeçalhos de sucesso | `Content-Disposition: attachment; filename="checklist-{categoria}-{uuid-processo}.docx"`; `Cache-Control: private, no-store`; `X-Content-Type-Options: nosniff`. UUID evita dados pessoais no nome e caracteres inseguros do número processual. |
| `401` | Sem sessão válida, tratamento de autenticação existente. |
| `403` | Caso a política de acesso existente negue consulta ao processo; não inventar restrição exclusiva de admin. |
| `404` | Processo inexistente. |
| `409` | Processo sem checklist; análise em andamento; ou nenhum bem da categoria selecionada. Mensagem específica em `{detail: string}`. |
| `422` | UUID inválido, categoria ausente ou fora do enum, conforme validação existente. |
| `500` | Falha de geração/template; erro genérico pelo mecanismo atual, sem conteúdo processual ou caminho interno. |

Categoria sem bens não produz arquivo vazio. Se houver somente bens não
classificados, retornar `409` com aviso de classificação necessária, e manter o
aviso visível na interface. Não aprovar, classificar nem retornar outra categoria
como fallback. Dados legados sem categoria seguem essa mesma regra.

## 7. Comportamento da interface

No detalhe, reutilizar `DocumentosProcessoCard`, `Botao`, `Alerta`, cliente
`api.baixar`, `useMutation` e `baixarArquivo`. Mostrar ação “Baixar checklist DOCX”
com opções por categoria disponível e quantidade de bens, sem novo fluxo de edição.
Processos mistos oferecem uma ação por categoria presente, todas independentes.

Exibir quantidade e identificação dos bens não classificados e acesso à edição
para classificá-los. Sem checklist ou sem categorias disponíveis, explicar o
motivo da indisponibilidade. Sem aprovação, mostrar aviso antes do download,
sem bloquear a exportação. A decisão final usa o snapshot confirmado pelo backend.

Desabilitar download durante edição do checklist, salvamento e análise em curso;
orientar salvar/cancelar antes de exportar. Durante a requisição, mostrar
“Gerando DOCX…” e bloquear repetição dessa ação. Falhas preservam a tela e exibem
erro/repetição pelo padrão atual; não baixar JSON de erro como se fosse DOCX.
Download não modifica progresso nem invalida aprovação. Manter acesso por teclado
e layout responsivo. Adequar MSW ao contrato usando somente fixtures sintéticas.

## 8. Critérios de aceite

| ID | Evidência esperada na implementação |
|---|---|
| CA01 | Cada categoria gera DOCX válido, abrível por Word/LibreOffice, com as seções, grades, mesclagens e formatação do respectivo modelo sanitizado. |
| CA02 | Um, dois e mais bens da mesma categoria repetem blocos completos, preservam a ordem e não deixam bens da amostra ou marcadores pendentes. |
| CA03 | Em processo misto, cada arquivo contém somente os blocos da categoria pedida e todo o contexto compartilhado. Categoria sem bens retorna `409`. |
| CA04 | Bens não classificados são identificados por quantidade/posição na interface e no DOCX, inclusive com checklist aprovado. Processo somente com bens desconhecidos não gera arquivo vazio nem classificação automática. |
| CA05 | Todos os campos do mapeamento, partes/advogados e referências são preservados, incluindo CPF/RENAVAM com zeros, textos multilinha, listas repetidas e dados complementares de categoria anterior. |
| CA06 | `null`, omissões, strings vazias, `false`, zero e negativas expressas são distinguíveis; não há datas, valores, pessoas, assinaturas ou conclusões jurídicas inventadas. |
| CA07 | Relatório inclui resumo e todas as etapas/referências persistidas; sua ausência aparece explicitamente. Nenhuma LLM é chamada para gerar ou completar o arquivo. |
| CA08 | Documento sem aprovação atual contém identificação ostensiva em todas as páginas; edição/reanálise não reaproveita aprovação obsoleta. Exportação não altera revisão, aprovação, histórico ou dados. |
| CA09 | Admin e operador autorizados baixam; sessão inválida, processo inexistente, categoria inválida e estados indisponíveis produzem os códigos previstos. Não há acesso público ou alteração MCP. |
| CA10 | Download frontend mostra carregamento/erro, respeita edição/análise e funciona por categoria com teclado; arquivos usam nome seguro, MIME e cabeçalhos previstos. |
| CA11 | Testes unitários/integrados futuros usam exclusivamente modelos sanitizados e dados sintéticos; inspecionam conteúdo/estrutura do DOCX, ordenação, avisos, permissões, falhas e ausência de efeitos colaterais. |
| CA12 | Revisão visual futura renderiza saídas sintéticas das três categorias, com poucos/muitos bens e narrativas longas: sem corte, sobreposição, tabelas quebradas ou perda de avisos. Registrar diferenças justificadas de paginação; não afirmar fidelidade apenas por teste textual. |
| CA13 | Pacote dos modelos e arquivos gerados de teste não contém dados reais residuais, comentários, revisões, assinaturas ou propriedades pessoais. Originais permanecem fora do Git. |

Esta etapa cria somente a especificação. Não há exportação implementada ou
fidelidade visual validada. Na implementação, atualizar as specs de backend e
frontend, adicionar os modelos sanitizados e testes próprios, preservando o
gerador de editais e as funcionalidades atuais.
