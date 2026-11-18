import { act, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, logar, toDetalhe } from '@/api/mocks/db'
import { server } from '@/api/mocks/server'
import { renderComRouter } from '@/test/render'

beforeEach(() => logar('admin'))

function indicador() {
  const card = screen.getByRole('heading', { name: 'Progresso processual' }).closest('section')
  if (!card) throw new Error('Indicador ausente')
  return within(card)
}

async function percentual(valor: number) {
  await waitFor(() => {
    expect(indicador().getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(valor))
  })
}

function prepararEdital(leilaoId = 'l-1', processoId = 'p-1') {
  db.editais.push({
    id: `e-${leilaoId}`, leilao_id: leilaoId, processo_id: processoId,
    conteudo_markdown: 'Edital inicial', criado_em: '2020-01-01T00:00:00Z', atualizado_em: null,
  })
}

function prepararEnvio(leilaoId = 'l-1', status: 'enviado' | 'erro' = 'enviado') {
  db.envios.push({
    id: `envio-${leilaoId}`, leilao_id: leilaoId, status,
    enviado_em: '2020-01-02T00:00:00Z', destinatarios: ['fixture@example.test'], erro: null,
  })
}

describe('indicador de progresso no detalhe', () => {
  it('exibe cinco etapas acessíveis e 20% sem consultas de marketing desnecessárias', async () => {
    let consultas = 0
    server.use(http.get('/api/marketing/envios', () => {
      consultas += 1
      return HttpResponse.json([])
    }))
    renderComRouter('/processos/p-2')
    await percentual(20)
    const lista = indicador().getByRole('list', { name: 'Etapas do processo' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(5)
    expect(indicador().getByText('Análise').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(indicador().getByText('Aguardando análise')).toBeInTheDocument()
    expect(indicador().getAllByText('Pendente')).toHaveLength(3)
    expect(indicador().getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0')
    expect(indicador().getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100')
    expect(consultas).toBe(0)
  })

  it.each(['admin', 'operador'] as const)('mostra os mesmos dados reais para %s', async (perfil) => {
    logar(perfil)
    prepararEdital()
    prepararEnvio()
    renderComRouter('/processos/p-1')
    await percentual(100)
    expect(indicador().getAllByText('Concluída')).toHaveLength(5)
    expect(indicador().queryByText('fixture@example.test')).not.toBeInTheDocument()
  })

  it('mostra carregamento e indisponibilidade sem inventar 80% ou erro de envio', async () => {
    prepararEdital()
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    server.use(http.get('/api/marketing/envios', async () => {
      await espera
      return HttpResponse.json({ detail: 'Detalhe técnico privado' }, { status: 500 })
    }))
    renderComRouter('/processos/p-1')
    await screen.findByText('Consultando progresso…')
    expect(indicador().queryByRole('progressbar')).not.toBeInTheDocument()
    liberar()
    await waitFor(() => expect(indicador().getByRole('alert')).toHaveTextContent('Progresso indisponível'))
    expect(indicador().queryByRole('progressbar')).not.toBeInTheDocument()
    expect(indicador().queryByText('Falha no envio para marketing')).not.toBeInTheDocument()
    expect(indicador().queryByText('Detalhe técnico privado')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar pra marketing' })).toBeEnabled()
  })

  it('atualiza após análise, agendamento e geração sem antecipar conclusões', async () => {
    const { user } = renderComRouter('/processos/p-2')
    await percentual(20)
    await user.click(screen.getByRole('button', { name: 'Analisar', exact: true }))
    await percentual(40)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar', exact: true })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Agendar', exact: true }))
    await percentual(60)
    await user.click(screen.getByRole('button', { name: 'Gerar edital' }))
    await percentual(80)
    await user.click(screen.getByRole('button', { name: 'Enviar pra marketing' }))
    await percentual(100)
  })

  it('reanálise pendente oculta percentual e restaura os artefatos preservados', async () => {
    prepararEdital()
    prepararEnvio()
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    server.use(http.post('/api/processos/p-1/analisar', async () => {
      await espera
      const processo = db.processos.find((p) => p.id === 'p-1')
      if (!processo) throw new Error('Fixture ausente')
      return HttpResponse.json(toDetalhe(processo))
    }))
    const { user } = renderComRouter('/processos/p-1')
    await percentual(100)
    await user.click(screen.getByRole('button', { name: 'Reanalisar' }))
    await screen.findByText('Atualizando progresso…')
    expect(indicador().queryByRole('progressbar')).not.toBeInTheDocument()
    expect(indicador().getByText('Análise em andamento')).toBeInTheDocument()
    expect(indicador().getAllByText('Pendente')).toHaveLength(3)
    liberar()
    await percentual(100)
    expect(db.envios).toHaveLength(1)
    expect(db.editais).toHaveLength(1)
  })

  it('falha de reanálise interrompe a sequência e sucesso posterior a restaura', async () => {
    prepararEdital()
    prepararEnvio()
    const processo = db.processos.find((p) => p.id === 'p-1')
    if (!processo) throw new Error('Fixture ausente')
    processo.nome_arquivo = 'semtexto.pdf'
    const { user } = renderComRouter('/processos/p-1')
    await percentual(100)
    await user.click(screen.getByRole('button', { name: 'Reanalisar' }))
    await percentual(20)
    expect(indicador().getByText('Falha na análise')).toBeInTheDocument()
    expect(indicador().getAllByText('Pendente')).toHaveLength(3)
    processo.nome_arquivo = 'comtexto.pdf'
    await user.click(screen.getByRole('button', { name: 'Reanalisar' }))
    await percentual(100)
  })

  it('falha 502 persistida atualiza histórico e reenvio restaura 100%', async () => {
    prepararEdital()
    prepararEnvio()
    server.use(http.post('/api/marketing/envios', () => {
      db.envios.push({
        id: 'envio-falho', leilao_id: 'l-1', enviado_em: new Date(Date.now() - 1000).toISOString(),
        status: 'erro', destinatarios: [], erro: 'Detalhe SMTP privado',
      })
      return HttpResponse.json({ detail: 'Falha ao enviar e-mail' }, { status: 502 })
    }))
    const { user } = renderComRouter('/processos/p-1')
    await percentual(100)
    await user.click(screen.getByRole('button', { name: 'Enviar pra marketing' }))
    await percentual(80)
    expect(indicador().getByText('Falha no envio para marketing')).toBeInTheDocument()
    expect(indicador().queryByText('Detalhe SMTP privado')).not.toBeInTheDocument()
    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Enviar pra marketing' }))
    await percentual(100)
  })

  it('regenerar e editar edital preserva conclusão de marketing', async () => {
    prepararEdital()
    prepararEnvio()
    const { user } = renderComRouter('/processos/p-1')
    await percentual(100)
    await user.click(screen.getByRole('button', { name: 'Regenerar' }))
    await waitFor(() => expect(db.editais).toHaveLength(2))
    await percentual(100)
    await user.click(screen.getByRole('button', { name: 'Editar', exact: true }))
    await user.type(screen.getByLabelText('Conteúdo do edital em Markdown'), '\nRevisado')
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    await screen.findByText('Revisado', { exact: false })
    await percentual(100)
  })

  it('cancelamento e novo agendamento não reaproveitam envios antigos', async () => {
    prepararEdital()
    prepararEnvio()
    const { user } = renderComRouter('/processos/p-1')
    await percentual(100)
    await user.click(screen.getByRole('button', { name: 'Cancelar leilão' }))
    await percentual(40)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar', exact: true })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Agendar', exact: true }))
    await percentual(60)
    await user.click(screen.getByRole('button', { name: 'Gerar edital' }))
    await percentual(80)
    expect(indicador().getByText('Aguardando envio')).toBeInTheDocument()
  })

  it('envio durante a consulta inicial descarta o histórico anterior à operação', async () => {
    prepararEdital()
    let liberar: () => void = () => undefined
    let terminouAntiga = false
    let consultas = 0
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    server.use(http.get('/api/marketing/envios', async () => {
      const snapshot = db.envios.map((e) => ({ ...e, numero_processo: null }))
      consultas += 1
      if (consultas === 1) {
        await espera
        terminouAntiga = true
      }
      return HttpResponse.json(snapshot)
    }))
    const { user } = renderComRouter('/processos/p-1')
    await waitFor(() => expect(consultas).toBe(1))
    await user.click(screen.getByRole('button', { name: 'Enviar pra marketing' }))
    try {
      await percentual(100)
    } finally {
      liberar()
    }
    await waitFor(() => expect(terminouAntiga).toBe(true))
    await percentual(100)
    expect(consultas).toBe(2)
  })

  it('resposta atrasada de outro processo não substitui o histórico atual', async () => {
    prepararEdital()
    prepararEnvio()
    const primeiro = db.processos[0]
    const segundo = db.processos[1]
    const leilao = db.leiloes[0]
    if (!primeiro || !segundo || !leilao) throw new Error('Fixture ausente')
    Object.assign(segundo, {
      status: 'analisado', checklist: primeiro.checklist, relatorio: primeiro.relatorio,
    })
    db.leiloes.push({ ...leilao, id: 'l-2', processo_id: segundo.id })
    prepararEdital('l-2', segundo.id)
    let liberar: () => void = () => undefined
    let terminouAntiga = false
    let consultas = 0
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    server.use(http.get('/api/marketing/envios', async () => {
      const snapshot = db.envios.map((e) => ({ ...e, numero_processo: null }))
      consultas += 1
      if (consultas === 1) {
        await espera
        terminouAntiga = true
      }
      return HttpResponse.json(snapshot)
    }))
    const { router } = renderComRouter('/processos/p-1')
    await screen.findByText('Consultando progresso…')
    await waitFor(() => expect(consultas).toBe(1))
    prepararEnvio('l-2')
    await act(async () => { await router.navigate('/processos/p-2') })
    await percentual(100)
    liberar()
    await waitFor(() => expect(terminouAntiga).toBe(true))
    await percentual(100)
    expect(consultas).toBe(2)
  })
})
