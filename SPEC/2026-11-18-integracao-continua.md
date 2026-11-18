# Integração contínua — qualidade da AP2

Data: 2026-11-18. Status: proposta para revisão; não implementada.

## 1. Objetivo e referência

Evoluir `.github/workflows/ci.yml`, preservando os gatilhos de PR/push na `main`,
permissões mínimas e jobs existentes: backend, frontend, Worker, segurança e E2E.
Manter lint/formatação, typechecks, testes, builds, dry-run e auditorias. Deploys
preview/produção continuam manuais, sem publicação automática pela CI.

Referência fixa da evolução acumulada:
`19a25f36f7f515eb30e069327fc4f119ee9aff03` (`19a25f3`).
Usar a [baseline AP1](../docs/baseline-ap1.md) já coletada; não recalcular métricas
históricas nem preencher valores desconhecidos com zero.

## 2. Requisitos de qualidade

| ID | Requisito / aprovação |
|---|---|
| RF01 | Preservar as verificações existentes e seus códigos de saída. Remover o caráter não bloqueante do E2E (`continue-on-error: true`). |
| RF02 | Executar Gitleaks sobre o histórico Git completo disponível até a revisão testada; achados herdados também bloqueiam. Publicar relatório com segredos integralmente mascarados. |
| RF03 | Executar jscpd sobre todo o código de aplicação atual dos três domínios, não apenas alterações AP2. Aprovar duplicação **menor ou igual a 5%**; acima disso, falhar. |
| RF04 | Medir cobertura de linhas de backend, frontend e Worker em suas suítes existentes, incluindo fontes não exercitadas no denominador. Publicar cobertura global de cada domínio. |
| RF05 | Exigir **diff coverage de linhas maior ou igual a 70%**, por domínio com linhas executáveis alteradas, desde o commit herdado. Uma área bem coberta não compensa outra abaixo do mínimo. |
| RF06 | Publicar relatórios e metadados como artefatos, inclusive após falhas, sem transformar falha em sucesso. |
| RF07 | Preservar ambientes isolados, serviços locais e ausência de credenciais de produção. |
| RF08 | Documentar vulnerabilidades herdadas e manter auditorias bloqueantes segundo os critérios definidos abaixo. |

## 3. Cobertura e comparação acumulada

- Backend: adicionar `pytest-cov` como dependência de desenvolvimento e configurar
  coverage.py para o código de `src/backend/app`, incluindo arquivos não importados.
  Gerar resumo, HTML e XML Cobertura a partir da execução real dos testes.
- Frontend e Worker: adicionar `@vitest/coverage-v8` em versão compatível com o
  Vitest de cada lockfile. Configurar inclusão explícita das fontes de aplicação
  e relatórios de texto, HTML, LCOV e Cobertura XML.
- Dependências de ferramentas e respectivos lockfiles serão atualizados somente
  na implementação, com versões fixadas/reprodutíveis. Não instalar ferramentas
  implicitamente durante a execução de testes nem usar versões flutuantes na CI.
- Excluir de cobertura testes, fixtures exclusivamente de teste, mocks MSW,
  dependências, builds, arquivos gerados e declarações TypeScript. Manter arquivos
  de negócio, inclusive sem testes. Registrar padrões de inclusão/exclusão em
  configuração versionada; não ampliar exclusões para alcançar os limites.
- Cobertura global será informativa, sem novo limiar arbitrário nesta etapa;
  a exigência bloqueante adicional será a diff coverage de 70%.

### Diff coverage

1. Disponibilizar histórico completo no checkout e verificar que o SHA herdado
   existe e é ancestral da revisão efetivamente testada. Ausência/incompatibilidade
   deve falhar, sem trocar a referência automaticamente.
2. Comparar diretamente **commit herdado → revisão testada**, usando o equivalente
   a `git diff BASE HEAD`. Não usar apenas o último commit, a base do PR ou uma
   referência móvel como `origin/main`.
3. Em PR, registrar também o SHA do head e eventual merge virtual, mantendo
   cobertura e diff associados à mesma revisão efetivamente executada.
4. Usar `diff-cover` com os XMLs Cobertura e o diff acumulado. Normalizar caminhos
   para a raiz Git, distinguindo backend, frontend e Worker; arquivos com nomes
   relativos iguais não podem compartilhar resultados por engano.
5. Considerar linhas executáveis adicionadas/modificadas no código atual. Linhas
   removidas não entram no denominador. Arquivo fonte alterado sem registro de
   cobertura deve bloquear a validação, não desaparecer silenciosamente do cálculo.
6. Aplicar 70% a cada domínio aplicável, sem arredondar um resultado inferior
   para aprová-lo. Domínio comprovadamente sem linhas executáveis alteradas recebe
   “não aplicável”, nunca cobertura fictícia de 100%.

Arquivos novos entram na comparação; alterações apenas documentais/configurações
não criam linhas executáveis cobráveis. Relatórios devem identificar arquivos,
linhas descobertas, numerador/denominador e exclusões aplicadas. Relatório ausente,
inválido ou com caminhos incompatíveis é erro; não equivale a “não aplicável”.

## 4. Gitleaks e duplicação

- Executar Gitleaks como verificação independente dos testes, com versão fixada,
  histórico completo e redação dos valores sensíveis em logs/artefatos. Não usar
  uma baseline de achados para ignorar automaticamente segredos herdados.
- Eventuais falsos positivos exigem justificativa verificável e exceção mínima,
  versionada e revisada. Não ignorar diretórios inteiros de aplicação, workflows
  ou sessões de agentes para evitar achados. Segredos reais exigem tratamento e
  rotação pelo responsável, sem registrar seus valores na documentação.
- Configurar jscpd e seu limite em arquivo versionado. Escopo: código fonte
  mantido de backend, frontend e Worker; excluir dependências, builds, arquivos
  gerados, testes/fixtures/mocks e lockfiles. Enumerar os padrões concretos na
  implementação, usando os diretórios existentes.
- Medir duplicação por linhas segundo o relatório do jscpd, com configuração
  estável de tamanho mínimo de bloco/tokens registrada. Gerar JSON e HTML;
  relatório ausente ou execução interrompida falha. Não adicionar comentários de
  exclusão ou ajustar sensibilidade para mascarar duplicações.

## 5. Segurança e vulnerabilidades herdadas

Resultados **já coletados em 18/11/2026**, sem nova auditoria nesta especificação:

| Origem | Evidência da baseline |
|---|---|
| Python | Auditoria reprovada: 64 registros brutos em `certifi`, `opentelemetry-api`, Pillow e `pypdf`; 63 pares pacote/ID distintos, com repetição de `certifi`. |
| Frontend | Auditoria reprovada: 5 ocorrências altas, 8 moderadas, 1 baixa e nenhuma crítica; os advisories altos apresentados envolvem Vite e `undici`. |
| Worker/E2E | A CI herdada não tinha auditoria npm dedicada desses domínios; não há contagem histórica disponível para afirmar ausência de vulnerabilidades. |

- Manter `pip-audit` e auditoria pnpm do frontend, incluindo dependências de
  desenvolvimento; estender auditoria aos lockfiles de Worker e E2E.
- Python: achado de vulnerabilidade mantém reprovação. JavaScript: preservar
  bloqueio para severidade alta/crítica, publicando também moderadas/baixas.
  Não reduzir níveis de bloqueio, omitir dependências ou suprimir IDs herdados.
- Na implementação, criar registro versionado, referenciando a baseline e as
  evidências sanitizadas disponíveis: pacote, versão afetada, ID/aliases,
  severidade quando disponível, origem, correção indicada pela ferramenta,
  avaliação de aplicabilidade e situação. Informação ausente fica “não coletada”.
- Não inventar IDs, versões corrigidas ou explorabilidade. Deduplicação precisa
  conservar rastreabilidade; achados brutos não representam necessariamente CVEs
  únicos. Documentação não substitui correção nem libera a CI.
- Falha de rede/ferramenta não aprova auditoria. Atualizações corretivas de
  dependências serão trabalho separado, sem desabilitar as verificações.

## 6. Isolamento e integridade dos resultados

- Testes backend usam exclusivamente PostgreSQL temporário do job, com URLs de
  teste locais explícitas. Testes de migrations que recriam bancos ficam nesse
  ambiente descartável; não reutilizar banco/volume de desenvolvimento.
- E2E usa seu próprio projeto Compose, rede e armazenamento temporários, migrations
  e usuário sintético; `LLM_PROVIDER=fake`, `EMAIL_BACKEND=file`,
  `VITE_API_MOCK=false`. Propagar ao runner as variáveis exigidas pelos cenários,
  impedindo que testes obrigatórios sejam ignorados por configuração ausente.
- Usar diretórios temporários para mídia, e-mails e relatórios; sem SMTP, LLM ou
  banco de produção. Limpeza roda sempre e alcança somente recursos do job.
- Não usar `continue-on-error`, `|| true`, `exit 0` em falhas ou ignorar códigos de
  saída para obter aprovação. Pipelines com `tee` devem preservar a falha da
  ferramenta. Publicação de artefatos não altera o resultado das verificações.
- Executar auditorias/verificações independentes mesmo quando outra falhar,
  preservando os resultados individuais. Produzir resumo final bloqueante que
  detecte jobs falhos, cancelados, indevidamente ignorados e artefatos obrigatórios
  ausentes. Upload bem-sucedido não substitui execução bem-sucedida.
- Disponibilizar esse status como check obrigatório nas regras de proteção da
  branch. A configuração no GitHub é uma ação administrativa complementar;
  editar YAML isoladamente não impede merges manuais que ignorem a CI.

## 7. Artefatos e documentação

Publicar com condição de execução após sucesso/falha e retenção de 14 dias:

| Artefato | Conteúdo mínimo |
|---|---|
| Testes por domínio | Resultado JUnit com aprovados, falhos e ignorados. |
| Cobertura por domínio | Resumo, HTML, XML e LCOV quando aplicável. |
| Diff coverage | Resumo/HTML por domínio, linhas descobertas e diff acumulado. |
| Gitleaks | Relatório sanitizado, sem valores de segredos. |
| jscpd | Relatórios JSON/HTML e percentual apurado. |
| Auditorias | Relatórios estruturados das quatro áreas e códigos de saída. |
| E2E | Relatório Playwright e evidências de falha, sanitizadas. |

Cada execução identifica SHA herdado, SHA testado, versões das ferramentas,
limites, escopos e exclusões. Não publicar `.env`, credenciais, PDFs, e-mails ou
dados pessoais. Falhas anteriores à geração do relatório devem ser explicitadas,
sem fabricar arquivos de resultados aprovados. O resumo pode ir também para o
GitHub Actions Job Summary, sem depender de comentários automáticos no PR.

Na implementação, atualizar a documentação de CI em `SPEC/2026-10-01-infra.md`
e instruções de reprodução das mesmas verificações. Preservar a baseline AP1
como evidência histórica, acrescentando registros de evolução separados.

## 8. Critérios de aceite

| ID | Evidência esperada |
|---|---|
| CA01 | PR e push na `main` mantêm todos os checks herdados; E2E falho reprova a execução. Deploys continuam manuais. |
| CA02 | Caso sintético de segredo faz Gitleaks falhar sem revelar seu valor; configuração não ignora o histórico herdado. |
| CA03 | jscpd aprova 5% e reprova acima de 5%, com escopo e parâmetros versionados e relatórios publicados. |
| CA04 | Os três domínios geram cobertura a partir dos testes reais, incluindo fontes não exercitadas. Falha de teste permanece bloqueante. |
| CA05 | Alteração AP2 de commit anterior ainda entra no diff; referência é sempre o SHA completo herdado. 70% aprova e resultado inferior reprova no domínio afetado. |
| CA06 | Arquivo novo sem cobertura, SHA indisponível e XML/caminho inválido não resultam em aprovação indevida; ausência comprovada de linhas alteradas é “não aplicável”. |
| CA07 | Artefatos e resumo preservam resultados e metadados também em falhas; nenhuma métrica desconhecida é apresentada como zero. |
| CA08 | Vulnerabilidades herdadas estão documentadas com os números conhecidos e limitações; auditorias permanecem habilitadas e seus achados bloqueantes não são dispensados. |
| CA09 | Backend/migrations e E2E usam recursos descartáveis próprios, sem alterar dados/volumes externos; cenários obrigatórios não são ignorados por falta de variáveis. |
| CA10 | Falhas, cancelamentos e skips indevidos impedem sucesso do check final; proteção da branch exige esse status, com sua configuração administrativa registrada. |

Esta entrega cria somente a especificação; nenhuma ferramenta, auditoria, teste
ou alteração de pipeline é executada nesta etapa.

Referências: [CLAUDE.md](../CLAUDE.md), [baseline AP1](../docs/baseline-ap1.md),
[CI herdada](../.github/workflows/ci.yml), [infraestrutura](2026-10-01-infra.md),
`src/backend/pyproject.toml`, `src/frontend/vitest.config.ts` e os manifestos
`package.json` de frontend e Worker.
