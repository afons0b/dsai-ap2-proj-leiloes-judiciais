import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { logar } from '@/api/mocks/db'
import { renderComRouter } from '@/test/render'

it('registra a aprovação e pede nova revisão depois de editar o checklist', async () => {
  logar('operador')
  const { user } = renderComRouter('/processos/p-1')

  await user.click(await screen.findByRole('button', { name: 'Aprovar checklist' }))
  expect(await screen.findByText(/Aprovado por operador/)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Editar checklist' }))
  const vara = screen.getByLabelText('Vara')
  await user.clear(vara)
  await user.type(vara, 'Vara revisada')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(await screen.findByRole('button', { name: 'Aprovar checklist' })).toBeInTheDocument()
  expect(screen.queryByText(/Aprovado por operador/)).not.toBeInTheDocument()
})
