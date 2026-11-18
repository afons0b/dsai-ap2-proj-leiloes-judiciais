import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { logar } from '@/api/mocks/db'
import { renderComRouter } from '@/test/render'

it('informa quando o PDF original está indisponível', async () => {
  logar('operador')
  const { user } = renderComRouter('/processos/p-1')

  await user.click(await screen.findByRole('button', { name: 'Baixar PDF original' }))

  expect(await screen.findByText('PDF original indisponível')).toBeInTheDocument()
})
