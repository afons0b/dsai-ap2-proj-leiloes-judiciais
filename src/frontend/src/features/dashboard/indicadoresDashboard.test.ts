import { expect, it } from 'vitest'
import { csvDashboard } from './indicadoresDashboard'

it('exporta os indicadores e a distribuição em CSV', () => {
  const resultado = csvDashboard({
    referencia_em: '2026-11-18T15:00:00Z',
    timezone: 'America/Belem',
    total_processos: 7,
    total_leiloes_agendados: 5,
    total_editais_gerados: 4,
    total_envios_marketing_sucesso: 3,
    processos_por_status: { recebido: 2, analisando: 1, analisado: 3, erro: 1 },
    processos_recentes: [],
    proximos_leiloes: [],
  })

  expect(resultado).toMatch(/^\uFEFFIndicador;Valor\r\n/)
  expect(resultado).toContain('Total de processos;7\r\n')
  expect(resultado).toContain('Processos com erro;1\r\n')
  expect(resultado).toContain('Data de referência;18/11/2026')
})
