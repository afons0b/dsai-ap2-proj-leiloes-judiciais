# Baseline AP1 — sistema herdado

Coleta: 18/11/2026. Commit avaliado:
`19a25f36f7f515eb30e069327fc4f119ee9aff03`.

Este documento resume a validação já realizada antes das funcionalidades da AP2;
não representa nova execução nem certifica o estado da apresentação original da
AP1. Evidências locais, ignoradas pelo Git:
`src/media/quality-baseline-20261118/RELATORIO.md`, `baseline.json` e `results/`.

## Testes executados

| Suíte | Aprovados | Falhos | Erros | Ignorados |
|---|---:|---:|---:|---:|
| Backend | 181 | 0 | 0 | 0 |
| Frontend | 102 | 0 | 0 | 0 |
| Worker | 12 | 0 | 0 | 0 |
| E2E | 1 | 0 | 0 | 0 |
| **Total de casos distintos** | **296** | **0** | **0** | **0** |

O E2E final utilizou a configuração original, Playwright 1.63.0 e Chromium
153.0.8010.12 (revisão 1243), sem instabilidade registrada. Repetições operacionais
não foram somadas. LLM e e-mail usaram `fake`/`file`; frontend com mock desativado.

## Verificações de qualidade

- Aprovados: Ruff lint e formatação, frontend TypeScript/Biome/build, imagem Docker
  backend `prod`, Worker typecheck/dry-run e actionlint nos três workflows.
- Aviso do build frontend: JavaScript de 512,63 kB (156,08 kB gzip), acima do aviso
  de 500 kB do Vite.
- Auditoria Python reprovada: 64 registros brutos em quatro pacotes (`certifi`,
  `opentelemetry-api`, Pillow e `pypdf`). Há repetição de `certifi`: 63 pares
  pacote/ID distintos; aliases e aplicabilidade ainda exigem triagem.
- Auditoria frontend reprovada: 5 ocorrências altas, 8 moderadas, 1 baixa e nenhuma
  crítica. Os advisories altos apresentados envolvem Vite e `undici`.
- Sem typechecker Python dedicado ou script próprio de lint do Worker configurados.
- Cobertura, diff coverage e duplicação não foram medidos. Gitleaks/jscpd não
  estavam configurados nem foram executados. Tokens/custos do Codex não foram
  medidos; desconhecido não significa zero.

## Condições e limites da coleta

Backend: Python 3.12.12, pytest 9.1.1 e Ruff 0.16.10. Frontend e testes Worker:
Node 22.23.5 e pnpm 12.8.1. Typecheck/dry-run Worker e E2E usaram Node 25.9.0 no
host; equivalência integral ao Node 22 da CI não foi confirmada.

Dois clusters PostgreSQL temporários, em redes separadas, isolaram testes de
backend/migrations e E2E. Contagens e hashes dos dados de desenvolvimento foram
idênticos antes/depois. Nenhum arquivo versionado foi alterado; Git terminou limpo
no commit acima. Containers/volumes existentes foram preservados, QA temporário
foi parado e o health final do desenvolvimento retornou `200`.

As suítes não demonstram a qualidade de um LLM real ou entrega SMTP. As auditorias
refletem as bases de advisories consultadas naquela data, sem comprovar
explorabilidade. A CI mantinha E2E não bloqueante (`continue-on-error: true`) e
auditoria npm limitada ao frontend; sua configuração estática passou no actionlint.
