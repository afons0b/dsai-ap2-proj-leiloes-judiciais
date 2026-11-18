import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, logar } from '@/api/mocks/db'
import { server } from '@/api/mocks/server'
import type { ProcessoOut } from '@/api/types'
import { renderComRouter } from '@/test/render'

const consultas: URL[] = []

function observar({ request }: { request: Request }) {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname === '/api/processos') consultas.push(url)
}

beforeEach(() => {
  logar('operador')
  consultas.length = 0
  server.events.on('request:start', observar)
  db.leiloes = []
  db.processos = Array.from({ length: 21 }, (_, i) => ({
    id: `novo-${i}`,
    nome_arquivo: `alvo_${i}.pdf`,
    numero_processo: i === 0 ? 'NUM-ABC' : null,
    status: i < 11 ? 'recebido' : 'analisado',
    criado_em: new Date(Date.UTC(2026, 10, i + 1, 12)).toISOString(),
    vara: null,
    erro: null,
    analisado_em: null,
    checklist: null,
    relatorio: null,
  }))
})

afterEach(() => server.events.removeListener('request:start', observar))

async function pronta() {
  const app = renderComRouter('/')
  await screen.findByText('21 processos encontrados')
  return app
}

function ultimaConsulta(): URLSearchParams {
  const url = consultas.at(-1)
  if (!url) throw new Error('Consulta não encontrada')
  return url.searchParams
}

describe('listagem AP2', () => {
  it('apresenta total global, intervalo e navegação do servidor', async () => {
    await pronta()
    expect(screen.getByText('Exibindo 1–20 de 21')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(21)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Apagar' })).not.toBeInTheDocument()
  })

  it('aplica busca, status e período somente ao submeter por Enter', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), ' alvo_1 ')
    await user.selectOptions(screen.getByLabelText('Status do processo'), 'analisado')
    fireEvent.change(screen.getByLabelText('Cadastrado de'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-18' } })
    expect(consultas).toHaveLength(1)
    await user.click(screen.getByLabelText('Pesquisar por arquivo ou número'))
    await user.keyboard('{Enter}')
    expect(await screen.findByText('4 processos encontrados')).toBeInTheDocument()
    expect(ultimaConsulta().get('busca')).toBe('alvo_1')
    expect(ultimaConsulta().get('status')).toBe('analisado')
    expect(ultimaConsulta().get('data_inicio')).toBe('2026-11-15')
    expect(ultimaConsulta().get('data_fim')).toBe('2026-11-18')
  })

  it('navega mantendo filtros e troca ordem voltando à primeira página', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'alvo')
    await user.selectOptions(screen.getByLabelText('Status do processo'), 'recebido')
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    await screen.findByText('11 processos encontrados')
    await user.selectOptions(screen.getByLabelText('Por página'), '10')
    await screen.findByText('Página 1 de 2')
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Exibindo 11–11 de 11')
    expect(ultimaConsulta().get('pagina')).toBe('2')
    expect(ultimaConsulta().get('status')).toBe('recebido')
    expect(ultimaConsulta().get('busca')).toBe('alvo')
    await user.selectOptions(screen.getByLabelText('Ordenação'), 'asc')
    await screen.findByText('Página 1 de 2')
    expect(ultimaConsulta().get('pagina')).toBe('1')
    expect(ultimaConsulta().get('ordem')).toBe('asc')
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('alvo_0.pdf')
  })

  it('limpa filtros aplicados, rascunho, ordenação e tamanho', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'ausente')
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    await screen.findByText('Nenhum processo encontrado.')
    await user.selectOptions(screen.getByLabelText('Ordenação'), 'asc')
    await user.selectOptions(screen.getByLabelText('Por página'), '10')
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'rascunho')
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await screen.findByText('21 processos encontrados')
    expect(screen.getByLabelText('Pesquisar por arquivo ou número')).toHaveValue('')
    expect(screen.getByLabelText('Status do processo')).toHaveValue('')
    expect(screen.getByLabelText('Cadastrado de')).toHaveValue('')
    expect(screen.getByLabelText('Até')).toHaveValue('')
    expect(screen.getByLabelText('Ordenação')).toHaveValue('desc')
    expect(screen.getByLabelText('Por página')).toHaveValue('20')
    expect(ultimaConsulta().get('pagina')).toBe('1')
  })

  it('limpar refaz a consulta mesmo no estado inicial', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'rascunho')
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(consultas).toHaveLength(2))
  })

  it('trocar tamanho na última página volta à página 1', async () => {
    const { user } = await pronta()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Página 2 de 2')
    await user.selectOptions(screen.getByLabelText('Por página'), '10')
    await screen.findByText('Página 1 de 3')
    expect(screen.getByText('Exibindo 1–10 de 21')).toBeInTheDocument()
  })

  it('ordenação e tamanho usam filtros aplicados sem submeter o rascunho', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'ausente')
    await user.selectOptions(screen.getByLabelText('Status do processo'), 'erro')
    await user.selectOptions(screen.getByLabelText('Ordenação'), 'asc')
    await waitFor(() => expect(ultimaConsulta().get('ordem')).toBe('asc'))
    await user.selectOptions(screen.getByLabelText('Por página'), '10')
    await screen.findByText('Exibindo 1–10 de 21')
    expect(ultimaConsulta().has('busca')).toBe(false)
    expect(ultimaConsulta().has('status')).toBe(false)
    expect(screen.getByLabelText('Pesquisar por arquivo ou número')).toHaveValue('ausente')
  })

  it('mostra singular e busca pelo número', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'num-abc')
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    expect(await screen.findByText('1 processo encontrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'alvo_0.pdf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('distingue base vazia e desabilita navegação', async () => {
    db.processos = []
    renderComRouter('/')
    await screen.findByText('Nenhum processo enviado ainda.')
    expect(screen.getByText('0 processos encontrados')).toBeInTheDocument()
    expect(screen.queryByText(/Página 1 de 0/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('mostra erro da API sem apresentar zero resultados', async () => {
    server.use(
      http.get('/api/processos', () =>
        HttpResponse.json({ detail: 'Consulta indisponível' }, { status: 500 }),
      ),
    )
    renderComRouter('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulta indisponível')
    expect(screen.queryByText('0 processos encontrados')).not.toBeInTheDocument()
  })

  it('valida busca longa e período invertido sem consultar a API', async () => {
    const { user } = await pronta()
    fireEvent.change(screen.getByLabelText('Pesquisar por arquivo ou número'), {
      target: { value: 'x'.repeat(256) },
    })
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Parâmetro busca inválido')
    await user.clear(screen.getByLabelText('Pesquisar por arquivo ou número'))
    fireEvent.change(screen.getByLabelText('Cadastrado de'), { target: { value: '2026-11-19' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-18' } })
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Data inicial deve ser anterior ou igual à data final',
    )
    expect(consultas).toHaveLength(1)
  })

  it('upload volta à página 1 preservando a pesquisa', async () => {
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'alvo')
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    await waitFor(() => expect(ultimaConsulta().get('busca')).toBe('alvo'))
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Página 2 de 2')
    await user.upload(
      screen.getByLabelText('Arquivo PDF do processo'),
      new File(['%PDF-1.4'], 'alvo-novo.pdf', { type: 'application/pdf' }),
    )
    await screen.findByText('22 processos encontrados')
    await screen.findByText('Página 1 de 2')
    expect(ultimaConsulta().get('busca')).toBe('alvo')
    expect(ultimaConsulta().get('pagina')).toBe('1')
  })

  it('exclusão do único item da última página corrige a página sem loop', async () => {
    logar('admin')
    const { user } = await pronta()
    await user.type(screen.getByLabelText('Pesquisar por arquivo ou número'), 'alvo')
    await user.click(screen.getByRole('button', { name: 'Filtrar', exact: true }))
    await waitFor(() => expect(ultimaConsulta().get('busca')).toBe('alvo'))
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Página 2 de 2')
    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar' }))
    await screen.findByText('20 processos encontrados')
    await screen.findByText('Página 1 de 1')
    expect(screen.getAllByRole('row')).toHaveLength(21)
    expect(ultimaConsulta().get('busca')).toBe('alvo')
    expect(consultas.length).toBeLessThanOrEqual(5)
  })

  it('ignora resposta atrasada e mantém navegação desabilitada enquanto carrega', async () => {
    const { user } = await pronta()
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((resolve) => {
      liberar = resolve
    })
    const processo = db.processos[0]
    if (!processo) throw new Error('Fixture de processo ausente')
    const item: ProcessoOut = { ...processo, nome_arquivo: 'nova.pdf' }
    let terminouAntiga = false
    server.use(
      http.get('/api/processos', async ({ request }) => {
        const busca = new URL(request.url).searchParams.get('busca')
        if (busca === 'antiga') {
          await espera
          terminouAntiga = true
        }
        return HttpResponse.json({
          itens: [{ ...item, nome_arquivo: busca === 'antiga' ? 'antiga.pdf' : 'nova.pdf' }],
          total: 1,
          pagina: 1,
          tamanho_pagina: 20,
          total_paginas: 1,
        })
      }),
    )
    const campo = screen.getByLabelText('Pesquisar por arquivo ou número')
    await user.type(campo, 'antiga{Enter}')
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.clear(campo)
    await user.type(campo, 'nova{Enter}')
    await screen.findByRole('link', { name: 'nova.pdf' })
    liberar()
    await waitFor(() => expect(terminouAntiga).toBe(true))
    expect(screen.queryByRole('link', { name: 'antiga.pdf' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'nova.pdf' })).toBeInTheDocument()
  })
})
