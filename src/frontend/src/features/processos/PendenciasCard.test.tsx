import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { logar } from '@/api/mocks/db'
import { server } from '@/api/mocks/server'
import { renderComRouter } from '@/test/render'

describe('Pendências pré-leilão', () => {
  it('atualiza as pendências depois de analisar o processo', async () => {
    logar('operador')
    const { user } = renderComRouter('/processos/p-2')
    const impedimentos = await screen.findByRole('list', { name: 'Impedimentos apontados' })
    expect(within(impedimentos).getByText('Processo ainda não analisado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Analisar' }))
    await screen.findByRole('button', { name: 'Reanalisar' })
    expect(await screen.findByRole('list', { name: 'Pontos de atenção' })).toBeInTheDocument()
    expect(screen.queryByText('Processo ainda não analisado')).not.toBeInTheDocument()
  })

  it('permite repetir a consulta após uma falha', async () => {
    logar('operador')
    server.use(
      http.get('/api/processos/p-1/pendencias', () => HttpResponse.json([], { status: 503 }), {
        once: true,
      }),
      http.get('/api/processos/p-1/pendencias', () => HttpResponse.json([])),
    )
    const { user } = renderComRouter('/processos/p-1')
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhuma pendência identificada no checklist.')).toBeInTheDocument()
  })
})
