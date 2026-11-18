import { expect, test } from '@playwright/test'
import type { DashboardOut } from '../../frontend/src/api/types'

test('dashboard mostra indicadores do backend e links para processos', async ({ page }) => {
  const usuario = process.env.E2E_USUARIO
  const senha = process.env.E2E_SENHA
  test.skip(!usuario || !senha, 'Defina as credenciais do ambiente E2E isolado')
  test.skip(
    process.env.LLM_PROVIDER !== 'fake' || process.env.EMAIL_BACKEND !== 'file',
    'Execute somente com fake/file e banco E2E isolado',
  )
  await page.goto('/login')
  await page.getByLabel('Usuário').fill(usuario ?? '')
  await page.getByLabel('Senha').fill(senha ?? '')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Processos', exact: true })).toBeVisible()
  const resposta = page.waitForResponse((r) =>
    new URL(r.url()).pathname === '/api/dashboard' && r.request().method() === 'GET',
  )
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const api = await resposta
  expect(api.status()).toBe(200)
  const dados: DashboardOut = await api.json()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  for (const [titulo, valor] of [
    ['Total de processos', dados.total_processos],
    ['Leilões agendados', dados.total_leiloes_agendados],
    ['Editais gerados', dados.total_editais_gerados],
    ['Envios bem-sucedidos para marketing', dados.total_envios_marketing_sucesso],
  ] as const) {
    const card = page.locator('section').filter({
      has: page.getByRole('heading', { name: titulo, exact: true }),
    })
    await expect(card.getByText(String(valor), { exact: true })).toBeVisible()
  }
  for (const [status, valor] of Object.entries(dados.processos_por_status)) {
    await expect(page.getByRole('meter', { name: status, exact: true }))
      .toHaveAttribute('aria-valuenow', String(valor))
  }
  expect(dados.processos_recentes.length).toBeLessThanOrEqual(5)
  expect(dados.proximos_leiloes.length).toBeLessThanOrEqual(5)
  for (const processo of dados.processos_recentes) {
    await expect(page.getByRole('link', { name: processo.nome_arquivo, exact: true }).first())
      .toHaveAttribute('href', `/processos/${processo.id}`)
  }
  const primeiro = dados.processos_recentes[0]
  if (primeiro) {
    await page.getByRole('link', { name: primeiro.nome_arquivo, exact: true }).first().click()
    await expect(page.getByRole('heading', { name: primeiro.nome_arquivo, exact: true })).toBeVisible()
  }
})
