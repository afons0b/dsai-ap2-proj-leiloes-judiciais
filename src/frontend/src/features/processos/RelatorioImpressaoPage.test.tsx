import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { logar } from '@/api/mocks/db'
import { renderComRouter } from '@/test/render'

it('abre o relatório do processo na página de impressão', async () => {
  logar('operador')
  const { user } = renderComRouter('/processos/p-1')

  await user.click(await screen.findByRole('link', { name: 'Exportar relatório' }))

  expect(await screen.findByRole('button', { name: 'Imprimir ou salvar em PDF' })).toBeEnabled()
  expect(screen.getByRole('list', { name: 'Etapas do processo' })).toBeInTheDocument()
})
