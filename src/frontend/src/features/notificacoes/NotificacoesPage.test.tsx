import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { db, logar } from '@/api/mocks/db'
import { renderComRouter } from '@/test/render'

it('lista o processo com falha e oferece acesso ao detalhe', async () => {
  logar('operador')
  const processo = db.processos.find((item) => item.id === 'p-2')
  if (!processo) throw new Error('Processo de teste ausente')
  processo.status = 'erro'
  processo.erro = 'PDF sem camada de texto'

  renderComRouter('/notificacoes')

  expect(await screen.findByText('PDF sem camada de texto')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: processo.nome_arquivo })).toHaveAttribute(
    'href',
    '/processos/p-2',
  )
})
