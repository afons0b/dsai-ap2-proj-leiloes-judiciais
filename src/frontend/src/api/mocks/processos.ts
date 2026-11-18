import { delay, type HttpHandler, HttpResponse, http } from 'msw'
import { lerFiltrosProcessos } from '@/api/filtrosProcessos'
import type { Checklist, EventoChecklist } from '@/api/types'
import {
  db,
  leilaoAtivo,
  novoId,
  type ProcessoMock,
  toDetalhe,
  toProcessoOut,
  usuarioLogado,
} from './db'
import { CHECKLIST_EXEMPLO, RELATORIO_EXEMPLO } from './fixtures'
import { erro, exigirAdmin, exigirSessao } from './http'
import { calcularPendenciasMock } from './regrasPendencias'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const ATRASO_ANALISE_MS = import.meta.env.MODE === 'test' ? 0 : 800

function diaCadastro(valor: string): string {
  const partes = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Belem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(valor))
  const obter = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value
  return `${obter('year')}-${obter('month')}-${obter('day')}`
}

export function buscarProcesso(id: string | readonly string[] | undefined): ProcessoMock | null {
  return db.processos.find((p) => p.id === String(id)) ?? null
}

function substituirChecklist(processo: ProcessoMock, checklist: Checklist) {
  processo.checklist = checklist
  processo.revisaoChecklist = novoId('revisao')
  delete processo.aprovacaoChecklist
}

function registrarEvento(
  processo: ProcessoMock,
  acao: EventoChecklist['acao'],
  usuario: string,
) {
  const evento = { id: novoId('evento'), acao, usuario, criado_em: new Date().toISOString() }
  processo.historicoChecklist = [evento, ...(processo.historicoChecklist ?? [])]
}

export const processosHandlers: HttpHandler[] = [
  http.get('/api/processos', ({ request }) => {
    const bloqueado = exigirSessao()
    if (bloqueado) return bloqueado
    try {
      const filtros = lerFiltrosProcessos(new URL(request.url).searchParams)
      const busca = filtros.busca.toLowerCase()
      const resultados = db.processos
        .filter((p) => {
          const dia = diaCadastro(p.criado_em)
          return (
            (!busca ||
              p.nome_arquivo.toLowerCase().includes(busca) ||
              p.numero_processo?.toLowerCase().includes(busca)) &&
            (!filtros.status || p.status === filtros.status) &&
            (!filtros.data_inicio || dia >= filtros.data_inicio) &&
            (!filtros.data_fim || dia <= filtros.data_fim)
          )
        })
        .sort((a, b) => {
          const comparacao =
            Date.parse(a.criado_em) - Date.parse(b.criado_em) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
          return filtros.ordem === 'asc' ? comparacao : -comparacao
        })
      const inicio = (filtros.pagina - 1) * filtros.tamanho_pagina
      return HttpResponse.json({
        itens: resultados.slice(inicio, inicio + filtros.tamanho_pagina).map(toProcessoOut),
        total: resultados.length,
        pagina: filtros.pagina,
        tamanho_pagina: filtros.tamanho_pagina,
        total_paginas: Math.ceil(resultados.length / filtros.tamanho_pagina),
      })
    } catch (e) {
      return erro(422, e instanceof Error ? e.message : 'Filtros inválidos')
    }
  }),

  http.post('/api/processos', async ({ request }) => {
    const bloqueado = exigirSessao()
    if (bloqueado) return bloqueado
    const form = await request.formData()
    const arquivo = form.get('arquivo')
    if (!(arquivo instanceof File) || arquivo.type !== 'application/pdf') {
      return erro(415, 'Arquivo deve ser PDF')
    }
    if (arquivo.size > MAX_UPLOAD_BYTES) return erro(413, 'Arquivo excede 50 MB')
    const processo: ProcessoMock = {
      id: novoId('p'),
      nome_arquivo: arquivo.name,
      status: 'recebido',
      numero_processo: null,
      vara: null,
      erro: null,
      criado_em: new Date().toISOString(),
      analisado_em: null,
      checklist: null,
      relatorio: null,
    }
    db.processos.push(processo)
    return HttpResponse.json(toProcessoOut(processo), { status: 201 })
  }),

  http.get('/api/processos/:id', ({ params }) => {
    const bloqueado = exigirSessao()
    if (bloqueado) return bloqueado
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    return HttpResponse.json(toDetalhe(processo))
  }),

  http.get('/api/processos/:id/pendencias', ({ params }) => {
    const bloqueado = exigirSessao()
    if (bloqueado) return bloqueado
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    return HttpResponse.json(calcularPendenciasMock(processo.checklist))
  }),

  http.get('/api/processos/:id/checklist/historico', ({ params }) => {
    const bloqueado = exigirSessao()
    if (bloqueado) return bloqueado
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    return HttpResponse.json((processo.historicoChecklist ?? []).slice(0, 20))
  }),

  http.post('/api/processos/:id/analisar', async ({ params }) => {
    const usuario = usuarioLogado()
    if (!usuario) return erro(401, 'Não autenticado')
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    processo.status = 'analisando'
    await delay(ATRASO_ANALISE_MS)
    if (processo.nome_arquivo.includes('semtexto')) {
      processo.status = 'erro'
      processo.erro = 'PDF sem camada de texto'
      return erro(422, 'PDF sem camada de texto')
    }
    const checklist = structuredClone(CHECKLIST_EXEMPLO)
    registrarEvento(processo, processo.checklist ? 'reanalise' : 'analise', usuario.username)
    substituirChecklist(processo, checklist)
    processo.relatorio = structuredClone(RELATORIO_EXEMPLO)
    processo.numero_processo = checklist.numero_processo
    processo.vara = checklist.vara
    processo.status = 'analisado'
    processo.erro = null
    processo.analisado_em = new Date().toISOString()
    return HttpResponse.json(toDetalhe(processo))
  }),

  http.post('/api/processos/:id/checklist/aprovacao', async ({ params, request }) => {
    const usuario = usuarioLogado()
    if (!usuario) return erro(401, 'Não autenticado')
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    const entrada = (await request.json()) as { revisao: string }
    const atual = toDetalhe(processo).aprovacao_checklist
    if (!atual?.revisao || atual.revisao !== entrada.revisao) {
      return erro(409, 'O checklist mudou ou está indisponível para aprovação')
    }
    if (!atual.aprovado_em) {
      registrarEvento(processo, 'aprovacao', usuario.username)
      processo.aprovacaoChecklist = {
        revisao: atual.revisao,
        aprovado_por: usuario.username,
        aprovado_em: new Date().toISOString(),
      }
    }
    return HttpResponse.json(processo.aprovacaoChecklist ?? atual)
  }),

  http.put('/api/processos/:id/checklist', async ({ params, request }) => {
    const usuario = usuarioLogado()
    if (!usuario) return erro(401, 'Não autenticado')
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    const checklist = (await request.json()) as Checklist
    substituirChecklist(processo, checklist)
    registrarEvento(processo, 'edicao', usuario.username)
    processo.numero_processo = checklist.numero_processo
    processo.vara = checklist.vara
    return HttpResponse.json(checklist)
  }),

  http.delete('/api/processos/:id', ({ params }) => {
    const bloqueado = exigirAdmin()
    if (bloqueado) return bloqueado
    const processo = buscarProcesso(params.id)
    if (!processo) return erro(404, 'Processo não encontrado')
    if (leilaoAtivo(processo.id)) return erro(409, 'Processo tem leilão agendado')
    db.leiloes = db.leiloes.filter((l) => l.processo_id !== processo.id)
    db.processos = db.processos.filter((p) => p.id !== processo.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
