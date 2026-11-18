# Passagem de desenvolvimento — AP2

Registro de 18/11/2026. **Portão 2: 19/11/2026**, conforme informação da equipe.
Não contém credenciais, dados de clientes ou certificação de produção.

## Objetivo e contexto acadêmico

Projeto da disciplina Desenvolvimento de Software com IA (DSAI), UFPA. Na AP2,
a dupla atua como Forward Deployed Engineers: assumir o sistema herdado, entender
as necessidades dos clientes e evoluí-lo com evidências técnicas e uso rastreável
de agentes de IA. Produto: apoio ao fluxo PDF → checklist/relatório → agendamento
→ edital → planilha e envio para marketing.

Orientações indicadas pela equipe:
[aula 09](https://gustavopinto.org/assets/slides/dsai-2026/aula09.html).
Seu conteúdo não foi revalidado nesta sessão. Confirmar critérios oficiais e
formato do Portão 2 antes de entregar; não assumir nota, aprovação ou evidência
acadêmica apenas pela existência de código. A equipe relatou exploração manual e
publicação de uma issue de primeiras impressões; recuperar seu link para a entrega.

## Arquitetura e tecnologias

- `src/backend/app/<dominio>/`: Python 3.12, FastAPI, schemas Pydantic, services
  e SQLAlchemy async; PostgreSQL 16 e migrations Alembic. `uv` gerencia dependências.
  Routers validam entrada/saída; services aplicam regras e acessam o banco.
- `src/frontend/src/`: React 19, TypeScript, Vite, React Router com data router,
  TanStack Query, Tailwind. Tipos/clientes em `api/`; telas em `features/`;
  componentes comuns em `components/`. Vitest/Testing Library/MSW para testes.
- `src/worker/`: Worker Cloudflare, arquivos estáticos e encaminhamento da API/MCP
  ao container Python. Compose + nginx para desenvolvimento; GitHub Actions para
  CI e deploys manuais. A opção original de produção e suas limitações estão no README.
- LLM desacoplada por interface, drivers `fake` e `anthropic`; e-mail `file`/SMTP.
  Desenvolvimento e testes usam **fake/file**, sem serviços de produção.
- Autenticação por sessão em cookie e CSRF nas mutações. Perfis admin/operador;
  backend controla autorização. MCP somente leitura, com contrato próprio preservado.

## Estado funcional

### Herdado da AP1

Upload/armazenamento de PDF, extração de texto, análise por LLM, checklist e
relatório; edição parcial do checklist; agenda com duas etapas, bloqueios e
feriados; geração/edição/download de edital em Markdown e DOCX; planilha XLSX e
marketing; autenticação, gestão de usuários e operações administrativas; MCP com
caderno processual e identificação de pendências pré-leilão. Não confundir a
capacidade já existente no MCP com uma nova interface de pendências ainda no backlog.

### Implementado na AP2

| Funcionalidade | Estado / referência |
|---|---|
| Pesquisa, filtros, ordenação e paginação de processos no backend | Implementada, `88da89e`; HTTP usa envelope paginado, MCP continua lista completa. |
| Dashboard | Implementado, `5dcc7de`; agregações SQL reais, distribuição por status, recentes/próximos e links. |
| Indicador de progresso | Implementado, `d29a49b`; cálculo frontend em etapas de 20%, reanálise, cancelamento e falhas/reenvios. |
| Edição completa do checklist | Implementada nesta entrega; todos os campos, listas dinâmicas, validação e proteção de alterações não salvas. Backend/contratos preservados. |

A quarta funcionalidade separa campos, partes, bens, listas e validação em
`features/processos/`. O formulário mantém cópia profunda local; somente o PUT
confirma alterações. `Layout` usa o router existente para proteger navegação e
confirmar logout antes de executá-lo; `beforeunload` protege recarga/fechamento
quando permitido pelo navegador. Não há autosave nem rascunho em localStorage.
Salvar atualiza o detalhe confirmado, listagem e dashboard. Falhas mantêm o rascunho.

## Especificações e Git

Todas em `SPEC/`, datadas de 18/11/2026:

- `2026-11-18-listagem-processos.md`: implementada.
- `2026-11-18-dashboard.md`: implementada; cenário E2E criado, não executado na AP2.
- `2026-11-18-progresso-processual.md`: implementada.
- `2026-11-18-edicao-checklist.md`: implementada localmente nesta entrega.
- `2026-11-18-integracao-continua.md`: **somente especificada**; implementação
  adiada por orientação da equipe, para priorizar funcionalidades.

Referência herdada: `19a25f36f7f515eb30e069327fc4f119ee9aff03`.
Refs locais observadas: branch `main`, acompanhando `origin/main`, em `310ea7c`;
nenhuma outra branch local observada. Não houve fetch para certificar o remoto.

| Commit conhecido | Conteúdo |
|---|---|
| `a20a9a8` | Spec da listagem e baseline AP1. |
| `88da89e` | Implementação da listagem. |
| `1dd12ac` / `5dcc7de` | Spec / implementação do dashboard. |
| `2586c0f` / `d29a49b` | Spec / implementação do progresso processual. |
| `310ea7c` | Spec de integração contínua. |

Este handoff, a spec e a implementação da edição completa integram o commit
`feat(processos): completa edição do checklist e adiciona handoff da AP2`,
autorizado pela equipe após a implementação. Conferir seu hash e a sincronização
com o remoto em `git log` e `git status`. Antes de trabalhar, revisar mudanças
locais e combinar a branch da próxima funcionalidade; não sobrescrever trabalho
do outro integrante.

## Evidências de testes — não confundir épocas

[Baseline AP1](baseline-ap1.md), coletada em `19a25f3`: backend **181**, frontend
**102**, Worker **12**, E2E **1** aprovados; **296 casos distintos**, sem falhas,
erros ou ignorados na coleta final. Não foi reexecutada nesta entrega.

Execuções pontuais da AP2, registradas nas sessões anteriores e nesta entrega:

| Escopo | Resultado final registrado |
|---|---|
| Listagem | 48 testes novos backend + 36 frontend aprovados. |
| Dashboard | 10 testes novos backend + 16 frontend aprovados. |
| Progresso | 14 testes novos de cálculo + 12 de UI aprovados. |
| Edição completa | 11 testes novos de helpers + 15 de UI aprovados nesta sessão. |

Os testes da edição cobrem todos os campos/payload, valores intactos, listas e
itens repetidos, triestado, validação, descarte, menu/histórico/logout,
beforeunload, salvamento pendente, erros, refetch e sessão expirada. Execução via
Vitest no container frontend, com MSW; não acessa PostgreSQL nem serviços externos.
Arquivos: `checklistEdicao.test.ts` e `ChecklistCompleto.test.tsx`.

Esses resultados não equivalem a uma suíte completa atualizada nem devem ser
somados às 296 provas históricas como uma nova medição global. Repetições de
testes não são novos casos. Nenhum teste preexistente, E2E, build, lint ou auditoria
foi executado nesta sessão; sem instalação de dependências. Validação manual de
layout e comportamento nativo do navegador segue pendente.

Para reproduzir **somente os testes novos desta funcionalidade**, de `src/`:

```bash
docker compose -p leiloes-ap2-local exec frontend pnpm exec vitest run src/features/processos/checklistEdicao.test.ts src/features/processos/ChecklistCompleto.test.tsx
```

## Executar localmente em outra máquina

Requisitos: Git, Docker com Compose v2, Docker ativo e acesso às imagens/registries
para a primeira construção. Python/Node no host não são necessários para o fluxo
Compose. Usar o repositório AP2 da dupla; o README também contém referências AP1.

1. Obter o código e as alterações locais desta entrega. Entrar em `src/`.
2. **Somente se `.env` ainda não existir**, copiar `.env.example` para `.env`.
   Configurar localmente senhas próprias e URLs coerentes com as roles existentes:
   app para uso normal, owner para migrations, banco exclusivo `leiloes_test` para
   testes. Host interno do banco: `postgres`. Não copiar valores para chat/Git.
3. Garantir `LLM_PROVIDER=fake`, `EMAIL_BACKEND=file`, `VITE_API_MOCK=false`,
   banco local e MCP desativado caso não seja necessário. Revisar campos de
   identificação do `.env.example` para usar somente dados de demonstração.
4. Verificar portas **80** (nginx) e **5432** (PostgreSQL), previstas no Compose
   versionado. Resolver conflitos por override local ignorado, sem parar/remover
   serviços alheios. A máquina anterior usava 18080/55432 por configuração local,
   não distribuída como padrão do projeto.
5. Em uma configuração local nova, executar:

```bash
docker compose -p leiloes-ap2-local up -d --build --wait
docker compose -p leiloes-ap2-local exec backend uv run alembic upgrade head
docker compose -p leiloes-ap2-local exec backend uv run python -m app.cli criar-usuario SEU_USUARIO_LOCAL --nome "Conta local" --perfil admin
curl -fsS http://localhost/api/health
```

Substituir `SEU_USUARIO_LOCAL`; a senha é solicitada interativamente e não deve
ser documentada. A criação inicial das roles/banco de testes depende dos scripts
de inicialização do PostgreSQL, aplicados somente em volume novo. Não apagar um
volume existente para tentar reaplicá-los.

Acessos padrão: aplicação `http://localhost`, dashboard `/dashboard`, API em
`/api`, documentação de desenvolvimento `/api/docs`. Health esperado: `200`
com `status: ok`. Conferir `docker compose ... ps` e logs em caso de erro.
Os comandos acima são instruções para outra máquina; não foram executados agora.

Testes backend recriam tabelas no banco indicado por `DATABASE_URL_TEST`;
antes de qualquer suíte, provar isolamento. E2E/migrations devem usar recursos
temporários próprios. Não apontar testes para banco de desenvolvimento/produção,
nem remover volumes existentes. Não usar os comandos de produção do README para
validar funcionalidades locais.

## Pendências técnicas e de entrega

1. **CI adiada:** implementar a spec dedicada, preservando pipeline e isolamento.
   Gitleaks, jscpd (máximo 5%), cobertura e diff coverage (mínimo 70% por domínio,
   acumulada desde `19a25f3`) ainda não foram configurados/medidos. Publicar
   artefatos sanitizados e impedir falhas/skip indevidos aprovados como sucesso.
   E2E herdado permanece não bloqueante na configuração registrada; corrigir na CI.
2. **Vulnerabilidades da baseline:** Python, 64 registros brutos/63 pares pacote-ID
   em `certifi`, `opentelemetry-api`, Pillow e `pypdf`; frontend, 5 altas, 8 moderadas
   e 1 baixa, com Vite/`undici` entre achados altos. Triagem/correção e auditorias
   atuais pendentes. Não dispensar achados herdados nem desabilitar verificações.
3. **Validação integrada:** regressão completa e E2E das mudanças AP2 ainda não
   executados conjuntamente; lint/typecheck/build atuais não certificados pelas
   execuções pontuais. Vitest emitiu aviso de configuração Vite/native loader.
   Baseline já registrava aviso de bundle frontend acima de 500 kB.
4. **Deploy público AP2:** não realizado/validado nestas sessões. URL AP1 no README
   não prova publicação da AP2. Validar hospedagem preservando stack, banco e
   persistência dos PDFs; a infraestrutura original documenta containers com disco
   efêmero e exigência de plano pago. Não há alternativa gratuita homologada aqui.
5. **Sessões e consumo de IA:** existe hook de exportação do Claude Code em
   `.claude/`, não um coletor Codex validado. Registrar sessões da AP2 com finalidade,
   modelo/ferramenta, revisão, arquivos, comandos e resultados, após sanitização.
   Tokens e custos não foram medidos; usar dados reais disponíveis, distinguir
   driver fake da aplicação do consumo do agente e não inventar estimativas.
6. **Revisão de código:** produzir relatório formal do diff acumulado com outro
   integrante/revisor, cobrindo regras, testes, preservação de contratos, segurança,
   navegação e riscos conhecidos. Não existe aprovação independente registrada
   nesta entrega. Revisar também as alterações locais antes de publicá-las.
7. **Limites preservados:** PUT do checklist completo sem controle de versão/merge
   concorrente; correção não regenera documentos nem reenvia marketing. Rascunho
   só em memória; confirmação de recarga/fechamento depende do navegador.

## Próximo backlog — ordem solicitada

Especificar e obter alinhamento com clientes antes de implementar; nada abaixo
foi implementado nesta sessão:

1. Identificação de pendências processuais — aproveitar a lógica já existente
   no backend/MCP; definir apresentação e limites sem inventar exigências jurídicas.
2. Aprovação humana do checklist — definir responsável, estados e efeito nas ações.
3. Histórico de alterações — definir eventos, autoria e retenção.
4. Exportação de relatórios em PDF.
5. Central de notificações.
6. Gerenciamento de documentos.
7. Gerenciamento de bens — diferenciar o domínio próprio da edição de bens já
   presente no checklist, sem duplicar entidades sem necessidade.
8. Calendário interativo de leilões — evoluir a agenda existente.
9. Gerenciamento de tarefas.
10. Relatórios gerenciais avançados — evoluir o dashboard existente.

Antes de ampliar escopo para o Portão 2, priorizar comprovação das quatro
funcionalidades, revisão, CI pendente e evidências acadêmicas, conforme decisão da dupla.

## Trabalhar com agentes de IA

Ler `CLAUDE.md`, o arquivo da área e a spec da tarefa. Limitar leituras aos arquivos
afetados, planejar alterações, reutilizar o código existente e separar cálculo,
interface e persistência. Não instalar dependências, mudar contratos, rodar suítes
amplas ou publicar alterações sem a autorização correspondente. A restrição desta
sessão permitiu somente testes novos, sem E2E; futuras execuções exigem novo escopo.

Exigir relatório curto de arquivos alterados, testes realmente executados e
limitações. Desconhecido não significa zero/aprovado. Não copiar `.env`, dados
processuais ou credenciais para prompts, logs, issues e handoffs. Não reconstruir
sessões/tokens retroativamente por suposição. Agentes não substituem revisão humana
nem validação com clientes. Commit/push só quando explicitamente solicitado.
