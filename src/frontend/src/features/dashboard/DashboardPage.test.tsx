import { act, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, logar } from '@/api/mocks/db'
import { server } from '@/api/mocks/server'
import { renderComRouter } from '@/test/render'

const AGORA = Date.parse('2026-11-18T13:00:00Z')

function card(titulo: string) {
  const elemento = screen.getByRole('heading', { name: titulo }).closest('section')
  if (!elemento) throw new Error(`Card ${titulo} ausente`)
  return within(elemento)
}

beforeEach(() => {
  logar('operador')
  vi.spyOn(Date, 'now').mockReturnValue(AGORA)
  db.processos = Array.from({ length: 24 }, (_, i) => ({
    id: `p-${String(i).padStart(2, '0')}`,
    nome_arquivo: `arquivo-${i}.pdf`,
    numero_processo: i === 0 ? null : `NUM-${i}`,
    status: (['recebido', 'analisando', 'analisado', 'erro'] as const)[i % 4] ?? 'recebido',
    criado_em: new Date(AGORA + i * 1000).toISOString(),
    vara: null, erro: null, analisado_em: null, checklist: null, relatorio: null,
  }))
  db.leiloes = Array.from({ length: 8 }, (_, i) => ({
    id: `l-${i}`, processo_id: `p-${String(i).padStart(2, '0')}`,
    primeiro_leilao_em: new Date(AGORA + (i === 0 || i === 6 ? -1 : i) * 86400000).toISOString(),
    segundo_leilao_em: new Date(AGORA + (i === 0 ? 0 : i === 6 ? -1 : i + 7) * 86400000).toISOString(),
    status: i === 7 ? 'cancelado' : 'agendado', criado_em: new Date(AGORA).toISOString(),
  }))
  db.editais = [1, 2].map((i) => ({
    id: `e-${i}`, leilao_id: 'l-7', processo_id: 'p-07', conteudo_markdown: 'versão',
    criado_em: new Date(AGORA).toISOString(), atualizado_em: null,
  }))
  db.envios = [1, 2, 3].map((i) => ({
    id: `e-${i}`, leilao_id: 'l-0', destinatarios: ['um@example.test', 'dois@example.test'],
    enviado_em: new Date(AGORA).toISOString(), status: i === 3 ? 'erro' : 'enviado', erro: null,
  }))
})

afterEach(() => vi.restoreAllMocks())

describe('dashboard gerencial', () => {
  it.each(['admin', 'operador'] as const)('mostra totais reais do mock e listas para %s', async (perfil) => {
    logar(perfil)
    renderComRouter('/dashboard')
    await screen.findByRole('heading', { name: 'Total de processos' })
    expect(card('Total de processos').getByText('24')).toBeInTheDocument()
    expect(card('Leilões agendados').getByText('7')).toBeInTheDocument()
    expect(card('Editais gerados').getByText('2')).toBeInTheDocument()
    expect(card('Envios bem-sucedidos para marketing').getByText('2')).toBeInTheDocument()
    const barras = screen.getAllByRole('meter')
    expect(barras).toHaveLength(4)
    for (const barra of barras) expect(barra).toHaveAttribute('aria-valuenow', '6')
    expect(card('Processos recentes').getAllByRole('row')).toHaveLength(6)
    expect(card('Processos recentes').getAllByRole('link')[0]).toHaveAttribute('href', '/processos/p-23')
    expect(card('Próximos leilões').getAllByRole('row')).toHaveLength(6)
    expect(card('Próximos leilões').getAllByRole('link')[0]).toHaveAttribute('href', '/processos/p-00')
    expect(card('Próximos leilões').getByText('2º leilão')).toBeInTheDocument()
    expect(card('Próximos leilões').getByText('18/11/2026, 10:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Processos', exact: true })).toHaveAttribute('href', '/')
  })

  it('base vazia apresenta zeros e mensagens sem barras inválidas', async () => {
    db.processos = []
    db.leiloes = []
    db.editais = []
    db.envios = []
    renderComRouter('/dashboard')
    await screen.findByRole('heading', { name: 'Total de processos' })
    expect(card('Total de processos').getByText('0')).toBeInTheDocument()
    expect(screen.getAllByText('Nenhum processo cadastrado.')).toHaveLength(2)
    expect(screen.getByText('Nenhum leilão próximo.')).toBeInTheDocument()
    for (const barra of screen.getAllByRole('meter')) {
      expect(barra).toHaveAttribute('aria-valuenow', '0')
      expect(barra).toHaveAttribute('aria-valuemax', '1')
    }
  })

  it('redireciona visitante e mantém o tratamento de sessão expirada', async () => {
    db.sessao = null
    renderComRouter('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('permite navegar pelo menu usando teclado', async () => {
    const { user } = renderComRouter('/dashboard')
    await screen.findByRole('heading', { name: 'Total de processos' })
    await user.tab()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Processos', exact: true })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Processos', exact: true })).toBeInTheDocument()
  })

  it('apresenta carregamento e erro sem inventar indicadores zerados', async () => {
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    server.use(http.get('/api/dashboard', async () => {
      await espera
      return HttpResponse.json({ detail: 'Erro interno' }, { status: 500 })
    }))
    renderComRouter('/dashboard')
    expect(await screen.findByText('Carregando dashboard…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Total de processos' })).not.toBeInTheDocument()
    liberar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno')
    expect(screen.queryByRole('heading', { name: 'Total de processos' })).not.toBeInTheDocument()
  })

  it('consulta novamente ao retornar e não usa o endpoint de processos para indicadores', async () => {
    let consultas = 0
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/dashboard') consultas += 1
    })
    server.use(http.get('/api/processos', () => HttpResponse.json({ detail: 'Não usar' }, { status: 500 })))
    const { user } = renderComRouter('/dashboard')
    await screen.findByRole('heading', { name: 'Total de processos' })
    await user.click(screen.getByRole('link', { name: 'Marketing', exact: true }))
    await screen.findByRole('heading', { name: 'Marketing' })
    db.processos.pop()
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    await waitFor(() => expect(card('Total de processos').getByText('23')).toBeInTheDocument())
    expect(consultas).toBe(2)
    server.events.removeAllListeners('request:start')
  })

  it('usa timezone da API para datas e mantém links quando o número é nulo', async () => {
    const { router } = renderComRouter('/dashboard')
    await screen.findByRole('heading', { name: 'Total de processos' })
    const link = card('Próximos leilões').getByRole('link', { name: 'arquivo-0.pdf' })
    expect(link).toHaveAttribute('href', '/processos/p-00')
    await act(async () => { await router.navigate('/processos/p-00') })
    expect(await screen.findByRole('heading', { name: 'arquivo-0.pdf' })).toBeInTheDocument()
  })
})
