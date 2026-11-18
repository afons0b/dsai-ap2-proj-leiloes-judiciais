import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, logar, toDetalhe } from '@/api/mocks/db'
import { AgendarLeilaoCard } from '@/features/agenda/AgendarLeilaoCard'
import { EditalCard } from '@/features/editais/EditalCard'
import { EnviarMarketingCard } from '@/features/marketing/EnviarMarketingCard'
import { ApagarProcessoDialog } from '@/features/processos/ApagarProcessoDialog'
import { ProcessoDetalhePage } from '@/features/processos/ProcessoDetalhePage'
import { UploadProcesso } from '@/features/processos/UploadProcesso'
import { renderComApp } from '@/test/render'
import { DashboardPage } from './DashboardPage'

beforeEach(() => logar('admin'))

async function total(titulo: string, valor: number) {
  await waitFor(() => {
    const card = screen.getByRole('heading', { name: titulo }).closest('section')
    if (!card) throw new Error('Indicador ausente')
    expect(within(card).getByText(String(valor))).toBeInTheDocument()
  })
}

function processo(id = 'p-1') {
  const registro = db.processos.find((p) => p.id === id)
  if (!registro) throw new Error('Fixture ausente')
  return toDetalhe(registro)
}

describe('atualização do dashboard após mutações', () => {
  it('upload invalida os indicadores e os processos recentes', async () => {
    const { user } = renderComApp(<><DashboardPage /><UploadProcesso /></>)
    await total('Total de processos', 2)
    await user.upload(
      screen.getByLabelText('Arquivo PDF do processo'),
      new File(['%PDF-1.4'], 'novo-dashboard.pdf', { type: 'application/pdf' }),
    )
    await total('Total de processos', 3)
    expect(screen.getByRole('link', { name: 'novo-dashboard.pdf' })).toBeInTheDocument()
  })

  it('exclusão atualiza total e remove processo da lista recente', async () => {
    const { user } = renderComApp(
      <><DashboardPage /><ApagarProcessoDialog processo={processo('p-2')} onFechar={vi.fn()} /></>,
    )
    await total('Total de processos', 2)
    await user.click(screen.getByRole('button', { name: 'Apagar', exact: true }))
    await total('Total de processos', 1)
    expect(screen.queryByRole('link', { name: 'execucao-fiscal-2024.pdf' })).not.toBeInTheDocument()
  })

  it.each([false, true])('análise atualiza a distribuição inclusive quando falha (%s)', async (falha) => {
    const registro = db.processos.find((p) => p.id === 'p-2')
    if (!registro) throw new Error('Fixture ausente')
    if (falha) registro.nome_arquivo = 'semtexto.pdf'
    const { user } = renderComApp(
      <Routes>
        <Route path="/processos/:id" element={<><DashboardPage /><ProcessoDetalhePage /></>} />
      </Routes>,
      { rota: '/processos/p-2' },
    )
    await screen.findByRole('heading', { name: registro.nome_arquivo })
    await user.click(screen.getByRole('button', { name: 'Analisar', exact: true }))
    await waitFor(() => {
      expect(screen.getByRole('meter', { name: falha ? 'erro' : 'analisado' }))
        .toHaveAttribute('aria-valuenow', falha ? '1' : '2')
    })
    expect(screen.getByRole('meter', { name: 'recebido' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('agendamento e cancelamento invalidam os indicadores', async () => {
    db.leiloes = []
    const { user, unmount } = renderComApp(
      <><DashboardPage /><AgendarLeilaoCard processo={processo()} /></>,
    )
    await total('Leilões agendados', 0)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar', exact: true })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Agendar', exact: true }))
    await total('Leilões agendados', 1)
    unmount()
    const segundo = renderComApp(<><DashboardPage /><AgendarLeilaoCard processo={processo()} /></>)
    await total('Leilões agendados', 1)
    await segundo.user.click(screen.getByRole('button', { name: 'Cancelar leilão' }))
    await total('Leilões agendados', 0)
  })

  it('edição do número no checklist atualiza os processos recentes', async () => {
    const { user } = renderComApp(
      <Routes>
        <Route path="/processos/:id" element={<><DashboardPage /><ProcessoDetalhePage /></>} />
      </Routes>,
      { rota: '/processos/p-1' },
    )
    await screen.findByRole('button', { name: 'Editar checklist' })
    await user.click(screen.getByRole('button', { name: 'Editar checklist' }))
    await user.clear(screen.getByLabelText('Nº do processo'))
    await user.type(screen.getByLabelText('Nº do processo'), 'NUM-DASHBOARD')
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    await waitFor(() => {
      const card = screen.getByRole('heading', { name: 'Processos recentes' }).closest('section')
      if (!card) throw new Error('Lista ausente')
      expect(within(card).getByRole('cell', { name: 'NUM-DASHBOARD' })).toBeInTheDocument()
    })
  })

  it('cada geração de edital atualiza o contador', async () => {
    const { user } = renderComApp(<><DashboardPage /><EditalCard processo={processo()} /></>)
    await total('Editais gerados', 0)
    await user.click(screen.getByRole('button', { name: 'Gerar edital' }))
    await total('Editais gerados', 1)
    await user.click(screen.getByRole('button', { name: 'Gerar edital' }))
    await total('Editais gerados', 2)
  })

  it('envio e reenvio bem-sucedidos atualizam o contador', async () => {
    db.editais.push({
      id: 'edital-dashboard', leilao_id: 'l-1', processo_id: 'p-1',
      conteudo_markdown: 'Edital', criado_em: new Date().toISOString(), atualizado_em: null,
    })
    const { user } = renderComApp(
      <><DashboardPage /><EnviarMarketingCard processo={processo()} /></>,
    )
    await total('Envios bem-sucedidos para marketing', 0)
    await user.click(screen.getByRole('button', { name: 'Enviar pra marketing' }))
    await total('Envios bem-sucedidos para marketing', 1)
    await user.click(screen.getByRole('button', { name: 'Enviar pra marketing' }))
    await total('Envios bem-sucedidos para marketing', 2)
  })
})
