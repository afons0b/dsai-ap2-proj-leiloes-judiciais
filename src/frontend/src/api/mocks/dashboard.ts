import { type HttpHandler, HttpResponse, http } from 'msw'
import type { DashboardOut, ProcessosPorStatus, ProximoLeilaoOut } from '@/api/types'
import { db, toProcessoOut } from './db'
import { exigirSessao } from './http'

export const dashboardHandlers: HttpHandler[] = [
  http.get('/api/dashboard', () => {
    const bloqueado = exigirSessao()
    if (bloqueado) return bloqueado
    const agora = Date.now()
    const contagem: ProcessosPorStatus = { recebido: 0, analisando: 0, analisado: 0, erro: 0 }
    for (const processo of db.processos) contagem[processo.status] += 1
    const proximos: ProximoLeilaoOut[] = []
    for (const leilao of db.leiloes) {
      if (leilao.status !== 'agendado') continue
      const primeira = Date.parse(leilao.primeiro_leilao_em) >= agora
      const data = primeira ? leilao.primeiro_leilao_em : leilao.segundo_leilao_em
      if (Date.parse(data) < agora) continue
      const processo = db.processos.find((p) => p.id === leilao.processo_id)
      if (!processo) continue
      proximos.push({
        id: leilao.id,
        processo_id: processo.id,
        nome_arquivo: processo.nome_arquivo,
        numero_processo: processo.numero_processo,
        primeiro_leilao_em: new Date(leilao.primeiro_leilao_em).toISOString(),
        segundo_leilao_em: new Date(leilao.segundo_leilao_em).toISOString(),
        proximo_leilao_em: new Date(data).toISOString(),
        etapa: primeira ? 'primeiro' : 'segundo',
      })
    }
    const compararId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
    const dados: DashboardOut = {
      referencia_em: new Date(agora).toISOString(),
      timezone: 'America/Belem',
      total_processos: db.processos.length,
      processos_por_status: contagem,
      total_leiloes_agendados: db.leiloes.filter((l) => l.status === 'agendado').length,
      total_editais_gerados: db.editais.length,
      total_envios_marketing_sucesso: db.envios.filter((e) => e.status === 'enviado').length,
      processos_recentes: [...db.processos]
        .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em) || compararId(b.id, a.id))
        .slice(0, 5)
        .map((p) => ({
          ...toProcessoOut(p),
          criado_em: new Date(p.criado_em).toISOString(),
          analisado_em: p.analisado_em ? new Date(p.analisado_em).toISOString() : null,
        })),
      proximos_leiloes: proximos
        .sort((a, b) =>
          Date.parse(a.proximo_leilao_em) - Date.parse(b.proximo_leilao_em) || compararId(a.id, b.id),
        )
        .slice(0, 5),
    }
    return HttpResponse.json(dados)
  }),
]
