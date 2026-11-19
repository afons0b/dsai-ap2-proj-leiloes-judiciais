# Edição completa do checklist processual

Data: 2026-11-18. Status: implementada; incluída na entrega da edição completa.

As seções 1–6 registram a edição do contrato original. A seção 7 acrescenta o
contrato proposto em 19/11/2026, ainda não implementado; não constitui nova evidência
de testes ou aprovação definitiva.

## 1. Objetivo e escopo

Completar a edição disponível em `/processos/:id`, utilizando integralmente o
schema `Checklist` atual e `PUT /api/processos/{id}/checklist`. Disponível para
admin e operador, preservando autenticação, CSRF e permissões existentes.

Evolução no domínio frontend `features/processos/`, sem alterações necessárias
no backend, banco ou contratos HTTP/MCP. Não incluir edição do relatório da IA,
novas regras jurídicas, geração automática de documentos ou novas dependências.

## 2. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Disponibilizar edição de todos os campos do schema, conforme inventário abaixo. |
| RF02 | Adicionar, editar e remover bens, executados e advogados do exequente e de cada executado. |
| RF03 | Editar citações, intimações, avaliações, referências documentais, propriedade, ônus, recursos e observações. |
| RF04 | Organizar o formulário em seções identificadas, com navegação por âncoras e funcionamento por teclado. |
| RF05 | Validar tipos, nulabilidade, enums, datas e valores monetários conforme os schemas existentes. |
| RF06 | Confirmar o descarte de alterações não salvas e preservar o rascunho quando o usuário decidir continuar editando. |
| RF07 | Preservar dados não alterados, inclusive campos aninhados, valores nulos, listas vazias, ordem e entradas repetidas. |
| RF08 | Salvar o objeto completo pelo endpoint existente e atualizar a visualização e consultas afetadas após sucesso. |

### Inventário de campos e seções

| Seção | Campos editáveis do schema |
|---|---|
| Processo | `vara`, `numero_processo`, `juiz`, `tipo_justica`. |
| Exequente | `nome`, `cpf_cnpj`, `advogados[]`. |
| Advogados de cada parte | `nome`, `oab`, `ref`. Cada lista pertence exclusivamente ao seu exequente/executado. |
| Executados | `nome`, `cpf_cnpj`, `advogados[]`, `citado`, `citacao_forma`, `citacao_ref`. |
| Execução | `cda`, `natureza_divida`, `classe`, `valor_divida`, `data_divida`. |
| Bens — identificação e penhora | `descricao`, `matricula`, `localizacao`, `data_penhora`, `penhora_ref`, `fiel_depositario`, `propriedade`. |
| Bens — intimação | `executado_intimado`, `data_intimacao`, `intimacao_ref`. |
| Bens — avaliação | `valor_avaliacao`, `data_avaliacao`, `oficial_avaliacao`, `valor_reavaliacao`, `data_reavaliacao`. |
| Bens — referências e ônus | `certidao_matricula_ref`, `averbacao_penhora`, `hipoteca`, `enfiteuse`, `outras_penhoras`. |
| Recursos | `recursos`, com texto multilinha. |
| Observações para leilão | `observacoes_leilao[]`, com adição, edição e remoção individual de strings. |

O exequente continua sendo um único objeto obrigatório. Bens, executados,
advogados e observações podem ficar vazios, pois o schema não exige quantidade
mínima. Não criar duplicação/remoção do próprio exequente.

## 3. Comportamento da interface

- Preservar entrada “Editar checklist”, `AvisoIA`, layout e componentes existentes
  (`Card`, `Field`, `Botao`, `Alerta`, `Dialog`), cores e espaçamentos. Campos
  devem ter rótulos únicos com identificação da parte/bem e índice visível.
- Seções: Processo, Exequente, Executados, Execução, Bens, Recursos e Observações.
  Subdividir cada bem nas categorias do inventário. Navegar entre seções não
  apaga valores; em telas estreitas, reorganizar campos sem transbordar a página.
- Botões “Adicionar bem”, “Adicionar executado”, “Adicionar advogado” e
  “Adicionar observação” criam itens apenas no rascunho. Remoção identifica o
  item e altera somente esse rascunho até salvar. Usar identidades locais estáveis
  para evitar perda de foco ou troca de dados ao editar/remover itens repetidos;
  essas identidades não entram no payload.
- Novo item respeita a estrutura do schema: strings não nulas iniciam em `""`,
  opcionais em `null`, listas em `[]` e booleanos anuláveis em `null`. Não inserir
  nomes, valores, referências ou respostas jurídicas fictícias.
- `tipo_justica`: “Não informado”, “Estadual”, “Federal”. Booleanos anuláveis
  (`citado`, `executado_intimado`): “Não informado”, “Sim”, “Não”, mapeados para
  `null`, `true`, `false`. Mudar um booleano não apaga suas datas/referências.
- Observações são itens independentes, inclusive quando contêm quebras de linha
  ou texto repetido; não converter a lista para texto separado por linhas.
- Inicializar o rascunho com cópia profunda do checklist carregado. Refetches não
  sobrescrevem uma edição em andamento. Modificar um item não altera outros
  itens, o objeto original nem o cache antes da confirmação do salvamento.
- Reutilizar estado local e TanStack Query. Separar componentes de seções e
  funções de validação/transformação quando necessário, sem formulário genérico,
  novo gerenciador global de estado ou importações indevidas entre domínios.

### Alterações não salvas

- Comparar os valores do rascunho com a cópia inicial, incluindo listas aninhadas;
  ignorar IDs locais e ordem de chaves dos objetos. Editar e restaurar os valores
  originais elimina o estado de alteração. Foco/blur isolados não contam como edição.
- Cancelar ou sair voluntariamente do detalhe por links/menu, voltar/avançar do
  navegador ou logout deve pedir confirmação antes de descartar dados. Reutilizar
  o mecanismo de navegação do router existente; não substituir a arquitetura.
- Dentro da aplicação, usar `Dialog`: “Descartar alterações não salvas?”, com
  “Continuar editando” e “Descartar alterações”. Continuar mantém valores e foco;
  descartar efetiva a ação originalmente solicitada, sem chamar o PUT.
- Recarregar/fechar a aba utiliza o aviso nativo `beforeunload`, sujeito às
  restrições do navegador. Registrar proteções somente enquanto houver alterações
  e removê-las ao salvar, descartar ou desmontar. Não persistir rascunhos com dados
  processuais em armazenamento do navegador.
- Sem alterações, cancelar/sair não exige confirmação. Expiração de sessão e
  redirecionamentos obrigatórios de segurança preservam o tratamento atual de
  `401`; a proteção do rascunho não impede a autenticação.

## 4. Validação e preservação

- O schema Pydantic continua sendo a autoridade. Reutilizar os tipos de
  `api/types.ts` e helpers de `validacao.ts`, ampliando apenas o necessário.
- Strings não anuláveis: `exequente.nome`, nomes de executados/advogados e
  `bens[].descricao`. Não enviar `null` nesses campos. O schema não define tamanho
  mínimo: não acrescentar proibição de string vazia nem obrigatoriedades jurídicas.
- Campos anuláveis efetivamente editados e esvaziados são enviados como `null`;
  normalização não deve reescrever campos intactos. Preservar conteúdo interno de
  textos, pontuação, referências e strings não modificadas, inclusive `""`.
- Valores monetários continuam strings no padrão `^\d+\.\d{2}$` ou `null`.
  Aceitar zero (`"0.00"`); rejeitar negativos, vírgula e precisão diferente de duas
  casas. Não converter para float nem arredondar silenciosamente.
- Datas: `YYYY-MM-DD`, válidas no calendário ou `null`, sem deslocamento de fuso.
  Não impor ordem cronológica, limites de período ou validação jurídica adicional.
- Referências, CPF/CNPJ, OAB e número de processo permanecem texto; não adicionar
  máscaras obrigatórias, unicidade ou verificações ausentes no schema.
- Identificar erros por caminho completo, inclusive índices de listas, próximo
  ao campo e em resumo acessível. Impedir submissão inválida e permitir localizar
  o primeiro erro pela navegação/foco; não perder o restante do rascunho.
- Não excluir automaticamente itens vazios, deduplicar listas, reordenar itens
  ou limpar campos por dependências presumidas. Nenhuma validação global ou
  mudança de formato de exceções será introduzida.

## 5. Salvamento e atualização

`PUT /api/processos/{id}/checklist`: body `Checklist` completo; resposta `200 Checklist`.
Reutilizar `salvarChecklist`, sessão e CSRF do cliente existente.
Não criar PATCH, campos adicionais, persistência parcial ou novo endpoint.

- “Salvar” envia o rascunho validado completo, preservando todos os campos não
  modificados. Durante a requisição, indicar “Salvando…”, bloquear duplo envio,
  edição e descarte; navegação voluntária deve aguardar o término.
- Sucesso: utilizar a resposta confirmada, encerrar edição, remover estado de
  alterações e atualizar o detalhe, listagem e dashboard pelas chaves existentes.
  A visualização deve refletir inclusive número/vara e listas modificados.
- Falha de validação, rede ou servidor: manter edição e valores, exibir erro pelo
  padrão existente e liberar correção/tentativa. Respostas de outro processo não
  podem substituir seu rascunho; preservar o fluxo de sessão inválida.
- Não reanalisar, regenerar relatório/edital, reagendar leilão ou reenviar marketing
  automaticamente. O indicador de progresso mantém as regras já especificadas.
- O endpoint atual substitui o checklist completo e não oferece controle de
  concorrência por versão; não prometer mesclagem de edições simultâneas nem
  alterar o backend para introduzi-la nesta funcionalidade.

## 6. Critérios de aceite

| ID | Evidência esperada |
|---|---|
| CA01 | Todos os campos do inventário são editáveis e voltam com os valores confirmados após salvar/reabrir. Admin e operador têm a mesma capacidade de edição. |
| CA02 | É possível adicionar/remover todos os bens e executados; advogados são editáveis no exequente e em cada executado, sem afetar outra parte. |
| CA03 | Itens repetidos e alterações em nomes/descrições não perdem foco, não trocam valores e não removem o item errado. Nenhum ID local é enviado à API. |
| CA04 | Citação/intimação preservam `null`, `true` e `false`; tipo de justiça mantém os três valores previstos. Limpar opcionais editados envia `null`, sem alterar campos intactos. |
| CA05 | Dinheiro e datas válidos são aceitos; inválidos recebem indicação no campo/caminho correto e não geram PUT. Não há novas validações jurídicas ou máscaras obrigatórias. |
| CA06 | Editar um campo preserva exatamente os demais, inclusive arrays aninhados, observações multilinha/repetidas, zeros e referências. Listas vazias podem ser salvas. |
| CA07 | Editar e reverter elimina o aviso de descarte; cancelar sem mudanças não pergunta. Com mudanças, continuar preserva o rascunho e descartar executa a saída sem PUT. |
| CA08 | Links, histórico e logout voluntários protegem alterações; recarregar/fechar usa aviso nativo quando permitido. Sessão expirada conserva o comportamento de segurança. |
| CA09 | Sucesso fecha edição e atualiza checklist, número/vara e consultas afetadas; falha mantém o rascunho. Refetch durante edição não apaga valores digitados. |
| CA10 | Salvamento bloqueia alterações/duplo envio/descarte enquanto pendente. Trocar processo não mistura respostas ou rascunhos. |
| CA11 | Seções, âncoras, listas e erros funcionam por teclado e em tela estreita, preservando componentes e identidade visual. |
| CA12 | Somente o PUT existente persiste a edição; backend, contratos HTTP/MCP, regras de negócio e documentos já gerados permanecem preservados. |

Validação implementada: testes unitários dos helpers e testes de UI com MSW
cobrindo payload completo, campos intactos, listas dinâmicas, descarte e falhas.
Ver resultados e limites de validação em [HANDOFF-AP2](../docs/HANDOFF-AP2.md).

## 7. Extensão proposta em 19/11/2026 — checklists especializados

Seguir [checklists especializados](2026-11-19-checklists-especializados.md) e o
[contrato backend §2.1](2026-10-01-backend.md#21-extensão-proposta-em-19112026--não-implementada).
Esta extensão permite os campos adicionais abaixo no mesmo PUT completo; o escopo
original sem alterações de schema não se aplica a essa evolução proposta.

| Seção | Novos campos editáveis |
|---|---|
| Advogados de cada parte | `cpf`, string opcional/anulável, sem confundir com `Parte.cpf_cnpj`. |
| Exequente e executados | `representacao`, `procuracao_ref`. |
| Execução | `titulo_executivo`, `valor_divida_ref`. |
| Cada bem | `categoria`, `intimacao_forma`, `avaliacao_ref`, `oficial_reavaliacao`, `reavaliacao_ref`, `intimacao_reavaliacao`, `data_intimacao_reavaliacao`, `intimacao_reavaliacao_ref`. |
| Imóvel | `imovel.intimacao_conjuge`, `imovel.data_averbacao_penhora`; campos imobiliários legados permanecem nos caminhos originais. |
| Veículo | `veiculo.marca_modelo`, `placa`, `cor`, `ano`, `modelo`, `chassi`, `renavam`, `proprietario_detran`, `intimacao_detran`, `credor_fiduciario`, `multas_debitos`. Todos pertencem ao bloco `veiculo`. |
| Material | Campos comuns; nenhum campo exclusivo presumido. |

- Categoria por bem: “Não informado”, “Imóvel”, “Material”, “Veículo”. Permitir
  categorias diferentes no mesmo processo e formulário dinâmico por item.
- Campos novos são opcionais/anuláveis, default `null`; omissão em legado é
  aceita. `cpf` e `renavam` usam entrada textual, preservando zeros à esquerda e
  conteúdo informado, sem conversão numérica ou validação jurídica adicional.
- O rótulo de interface é “RENAVAM”; o modelo fonte usa “RENAVAN”. A extração
  mapeia esse rótulo para `veiculo.renavam` sem alterar a descrição original.
- Trocar categoria não apaga campos comuns ou especializados; dados de outra
  categoria continuam acessíveis em seção identificada. Não sobrescrever rascunhos,
  referências ou campos não editados. Preservar confirmações e fluxo de salvamento.
- Manter a aprovação humana por revisão e o histórico existentes; salvar/reanalisar
  segue sua invalidação atual, sem aprovar automaticamente. Não presumir significado
  de “INT.” ou dos rótulos ano/modelo além do texto informado.

Critérios adicionais para a implementação futura:

| ID | Evidência esperada |
|---|---|
| CA13 | Formulário misto permite editar e reabrir campos comuns/especializados de cada categoria, preservando dados ao trocar categoria e lendo JSON legado sem obrigar preenchimento. |
| CA14 | RENAVAM sintético com zeros à esquerda mantém exatamente a string após edição/PUT/GET; ausência e `null` são aceitos. “RENAVAN” no texto é extraído como `veiculo.renavam`. |
| CA15 | CPF sintético de cada advogado mantém zeros à esquerda e associação ao item correto no exequente/executado; não altera CPF/CNPJ das partes. Ausência e `null` são aceitos. |
| CA16 | Aprovação e eventos existentes são preservados; campos opcionais/ambíguos não introduzem regras jurídicas nem dados inventados. Os novos comportamentos recebem testes próprios na implementação, sem alegar execução nesta revisão documental. |

Referências: [CLAUDE.md](../CLAUDE.md), [frontend](../src/frontend/CLAUDE.md),
[contrato backend](2026-10-01-backend.md),
`src/backend/app/processos/schemas.py`,
`src/frontend/src/features/processos/{ChecklistForm,ChecklistView,ProcessoDetalhePage}.tsx`,
`src/frontend/src/features/processos/validacao.ts` e `src/frontend/src/api/types.ts`.
