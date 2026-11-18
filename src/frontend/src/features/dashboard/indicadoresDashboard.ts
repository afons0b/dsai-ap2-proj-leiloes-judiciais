import type { DashboardOut } from '@/api/types'
import { formatarDataHora } from '@/lib/formatar'

export function indicadoresDashboard(dados: DashboardOut): ReadonlyArray<readonly [string, number]> {
  return [
    ['Total de processos', dados.total_processos],
    ['Leilões agendados', dados.total_leiloes_agendados],
    ['Editais gerados', dados.total_editais_gerados],
    ['Envios bem-sucedidos para marketing', dados.total_envios_marketing_sucesso],
  ]
}

export function csvDashboard(dados: DashboardOut): string {
  const status = dados.processos_por_status
  const linhas = [
    ['Indicador', 'Valor'],
    ...indicadoresDashboard(dados),
    ['Processos recebidos', status.recebido],
    ['Processos em análise', status.analisando],
    ['Processos analisados', status.analisado],
    ['Processos com erro', status.erro],
    ['Data de referência', formatarDataHora(dados.referencia_em, dados.timezone)],
  ]
  return `\uFEFF${linhas.map((linha) => linha.join(';')).join('\r\n')}\r\n`
}
