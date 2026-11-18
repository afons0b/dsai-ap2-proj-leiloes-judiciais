import { screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { logar } from '@/api/mocks/db'
import { renderComRouter } from '@/test/render'

it('mostra o evento de análise e sua autoria no histórico do checklist', async () => {
  logar('operador')
  const { user } = renderComRouter('/processos/p-2')

  expect(await screen.findByText('Nenhum evento registrado.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Analisar' }))

  const lista = await screen.findByRole('list', { name: 'Eventos do checklist' })
  const evento = within(lista).getByRole('listitem')
  expect(evento).toHaveTextContent('Checklist gerado')
  expect(evento).toHaveTextContent('operador')
})
