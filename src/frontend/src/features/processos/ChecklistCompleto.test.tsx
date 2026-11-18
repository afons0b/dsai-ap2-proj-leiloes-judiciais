import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { db, logar } from '@/api/mocks/db'
import { CHECKLIST_EXEMPLO } from '@/api/mocks/fixtures'
import { server } from '@/api/mocks/server'
import type { Checklist } from '@/api/types'
import { renderComApp, renderComRouter } from '@/test/render'
import { ChecklistForm } from './ChecklistForm'
import { idCampoChecklist } from './CamposChecklist'

function montar(inicial = structuredClone(CHECKLIST_EXEMPLO)) {
  const salvar = vi.fn()
  const cancelar = vi.fn()
  return { ...renderComApp(
    <ChecklistForm inicial={inicial} salvando={false} erro={null} onSalvar={salvar} onCancelar={cancelar} />,
  ), salvar, cancelar }
}

async function editar() {
  const app = renderComRouter('/processos/p-1')
  await app.user.click(await screen.findByRole('button', { name: 'Editar checklist' }))
  return app
}

describe('checklist completo', () => {
  it('edita cada campo do schema e envia o objeto completo', async () => {
    const inicial = structuredClone(CHECKLIST_EXEMPLO)
    inicial.exequente.advogados = [{ nome: '', oab: null, ref: null }]
    if (!inicial.executados[0]) throw new Error('Fixture ausente')
    inicial.executados[0].advogados = [{ nome: '', oab: null, ref: null }]
    inicial.observacoes_leilao = ['observação\nrepetida', 'observação\nrepetida']
    const { user, salvar } = montar(inicial)
    function preencher(valor: unknown, caminho = ''): unknown {
      if (Array.isArray(valor)) return valor.map((item, i) => preencher(item, `${caminho}.${i}`))
      if (valor !== null && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [
          chave, preencher(item, caminho ? `${caminho}.${chave}` : chave),
        ]))
      }
      const campo = document.getElementById(idCampoChecklist(caminho))
      expect(campo, caminho).not.toBeNull()
      if (campo instanceof HTMLSelectElement) {
        const opcao = caminho === 'tipo_justica' ? 'estadual' : 'false'
        fireEvent.change(campo, { target: { value: opcao } })
        return opcao === 'estadual' ? opcao : false
      }
      const texto = campo instanceof HTMLInputElement && campo.type === 'date' ? '2026-11-18'
        : /valor_(divida|avaliacao|reavaliacao)$/.test(caminho) ? '0.00' : `editado ${caminho}`
      if (!campo) throw new Error(caminho)
      fireEvent.change(campo, { target: { value: texto } })
      return texto
    }
    const esperado = preencher(inicial)
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar).toHaveBeenCalledWith(esperado)
  })

  it('preserva campos intactos inclusive espaços, strings vazias e observações repetidas', async () => {
    const inicial = structuredClone(CHECKLIST_EXEMPLO)
    inicial.exequente.cpf_cnpj = ''
    inicial.recursos = '  texto intacto  '
    inicial.observacoes_leilao = ['linha 1\nlinha 2', 'linha 1\nlinha 2']
    const antes = structuredClone(inicial)
    const { user, salvar } = montar(inicial)
    await user.click(screen.getByLabelText('Recursos'))
    await user.tab()
    fireEvent.change(screen.getByLabelText('Juiz'), { target: { value: 'Corrigido' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar).toHaveBeenCalledWith({ ...antes, juiz: 'Corrigido' })
    expect(inicial).toEqual(antes)
  })

  it('preserva foco e identidade de itens repetidos ao editar e remover', async () => {
    const inicial = structuredClone(CHECKLIST_EXEMPLO)
    const bem = inicial.bens[0]
    if (!bem) throw new Error('Fixture ausente')
    inicial.bens = [structuredClone(bem), structuredClone(bem)]
    const { user } = montar(inicial)
    const segundo = screen.getByLabelText('Bem 2 — descrição')
    await user.type(segundo, ' corrigido')
    expect(segundo).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Remover bem 1' }))
    expect(screen.getByLabelText('Bem 1 — descrição')).toBe(segundo)
    expect(segundo).toHaveValue(`${bem.descricao} corrigido`)
  })

  it('mantém três estados booleanos e normaliza somente opcionais editados', async () => {
    const { user, salvar } = montar()
    const citado = screen.getByLabelText('Executado 1 — citado')
    for (const valor of ['false', 'true', '']) {
      await user.selectOptions(citado, valor)
      await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
      expect(salvar.mock.calls.at(-1)?.[0].executados[0].citado).toBe(valor === '' ? null : valor === 'true')
    }
    await user.clear(screen.getByLabelText('Vara'))
    await user.clear(screen.getByLabelText('Exequente — nome'))
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar.mock.calls.at(-1)?.[0]).toMatchObject({ vara: null, exequente: { nome: '' } })
  })

  it('valida dinheiro com resumo navegável e mantém dados digitados', async () => {
    const { user, salvar } = montar()
    const campo = screen.getByLabelText('Valor da dívida (R$)')
    fireEvent.change(campo, { target: { value: '1,00' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar).not.toHaveBeenCalled()
    expect(campo).toHaveFocus()
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('link', { name: /execucao.valor_divida/ })).toBeInTheDocument()
    fireEvent.change(campo, { target: { value: '0.00' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar.mock.calls[0]?.[0].execucao.valor_divida).toBe('0.00')
  })

  it('cancelar com alterações confirma, continuar conserva valores e reverter não confirma', async () => {
    const { user, cancelar } = montar()
    const juiz = screen.getByLabelText('Juiz')
    const original = (juiz as HTMLInputElement).value
    fireEvent.change(juiz, { target: { value: 'Rascunho' } })
    await user.click(screen.getByRole('button', { name: 'Cancelar', exact: true }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('Descartar alterações não salvas?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(juiz).toHaveValue('Rascunho')
    expect(cancelar).not.toHaveBeenCalled()
    fireEvent.change(juiz, { target: { value: original } })
    await user.click(screen.getByRole('button', { name: 'Cancelar', exact: true }))
    expect(cancelar).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('registra beforeunload apenas durante alterações e remove ao desmontar', () => {
    const { unmount } = montar()
    const evento = () => new Event('beforeunload', { cancelable: true })
    const limpo = evento(); window.dispatchEvent(limpo)
    expect(limpo.defaultPrevented).toBe(false)
    fireEvent.change(screen.getByLabelText('Juiz'), { target: { value: 'Alterado' } })
    const alterado = evento(); window.dispatchEvent(alterado)
    expect(alterado.defaultPrevented).toBe(true)
    unmount()
    const depois = evento(); window.dispatchEvent(depois)
    expect(depois.defaultPrevented).toBe(false)
  })

  it.each(['admin', 'operador'] as const)('salva pelo PUT e atualiza a visualização para %s', async (perfil) => {
    logar(perfil)
    const { user } = await editar()
    fireEvent.change(screen.getByLabelText('Nº do processo'), { target: { value: 'NUM-NOVO' } })
    fireEvent.change(screen.getByLabelText('Vara'), { target: { value: 'Vara nova' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    await screen.findByRole('button', { name: 'Editar checklist' })
    expect(screen.getByText('Processo nº NUM-NOVO · Vara nova')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar checklist' }))
    expect(screen.getByLabelText('Vara')).toHaveValue('Vara nova')
  })

  it('falha de salvamento e refetch não substituem o rascunho', async () => {
    logar('admin')
    server.use(http.put('/api/processos/:id/checklist', () => HttpResponse.json({ detail: 'Falha controlada' }, { status: 500 })))
    const { user, queryClient } = await editar()
    fireEvent.change(screen.getByLabelText('Vara'), { target: { value: 'Rascunho local' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    await screen.findByText('Falha controlada')
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['processos', 'p-1'] }) })
    expect(screen.getByLabelText('Vara')).toHaveValue('Rascunho local')
    expect(screen.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled()
  })

  it('protege menu e histórico e permite descartar para o destino solicitado', async () => {
    logar('admin')
    const { user, router } = await editar()
    fireEvent.change(screen.getByLabelText('Juiz'), { target: { value: 'Rascunho' } })
    await user.click(screen.getByRole('link', { name: 'Dashboard', exact: true }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByLabelText('Juiz')).toHaveValue('Rascunho')
    await user.click(screen.getByRole('link', { name: 'Dashboard', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    await screen.findByRole('heading', { name: 'Dashboard', exact: true })
    await act(async () => { await router.navigate(-1) })
    await user.click(await screen.findByRole('button', { name: 'Editar checklist' }))
    expect(screen.getByLabelText('Juiz')).not.toHaveValue('Rascunho')
    fireEvent.change(screen.getByLabelText('Juiz'), { target: { value: 'Outro' } })
    await act(async () => { await router.navigate(1) })
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    await screen.findByRole('heading', { name: 'Dashboard', exact: true })
  })

  it('logout só é efetivado depois da confirmação de descarte', async () => {
    logar('admin')
    const { user } = await editar()
    fireEvent.change(screen.getByLabelText('Juiz'), { target: { value: 'Rascunho' } })
    await user.click(screen.getByRole('button', { name: 'Sair', exact: true }))
    await screen.findByRole('dialog')
    expect(db.sessao).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(db.sessao).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sair', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(db.sessao).toBeNull()
  })

  it('aguarda salvamento antes de navegar e bloqueia edição e duplo envio', async () => {
    logar('admin')
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    let chamadas = 0
    server.use(http.put('/api/processos/:id/checklist', async ({ request }) => {
      chamadas += 1
      const checklist = await request.json() as Checklist
      await espera
      const processo = db.processos.find((p) => p.id === 'p-1')
      if (!processo) throw new Error('Fixture ausente')
      processo.checklist = checklist
      return HttpResponse.json(checklist)
    }))
    const { user } = await editar()
    fireEvent.change(screen.getByLabelText('Vara'), { target: { value: 'Confirmada' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(screen.getByLabelText('Vara')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled()
    await user.click(screen.getByRole('link', { name: 'Dashboard', exact: true }))
    await screen.findByText('Aguarde o salvamento para sair.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    liberar()
    await screen.findByRole('heading', { name: 'Dashboard', exact: true })
    expect(chamadas).toBe(1)
  })

  it('sessão expirada permite redirecionamento obrigatório sem bloquear a segurança', async () => {
    logar('admin')
    const { user } = await editar()
    fireEvent.change(screen.getByLabelText('Vara'), { target: { value: 'Rascunho' } })
    server.use(http.put('/api/processos/:id/checklist', () => HttpResponse.json({ detail: 'Não autenticado' }, { status: 401 })))
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adiciona e remove bens, executados, advogados e observações sem IDs no payload', async () => {
    const inicial = structuredClone(CHECKLIST_EXEMPLO)
    inicial.bens = []; inicial.executados = []; inicial.exequente.advogados = []; inicial.observacoes_leilao = []
    const { user, salvar } = montar(inicial)
    await user.click(screen.getByRole('button', { name: 'Adicionar bem', exact: true }))
    await user.type(screen.getByLabelText('Bem 1 — descrição'), 'Bem novo')
    await user.click(screen.getByRole('button', { name: 'Adicionar executado', exact: true }))
    await user.type(screen.getByLabelText('Executado 1 — nome'), 'Executado novo')
    await user.click(screen.getByRole('button', { name: 'Adicionar advogado — Exequente' }))
    await user.type(screen.getByLabelText('Exequente — advogado 1 — nome'), 'Advogado A')
    await user.click(screen.getByRole('button', { name: 'Adicionar advogado — Executado 1' }))
    await user.type(screen.getByLabelText('Executado 1 — advogado 1 — nome'), 'Advogado B')
    await user.click(screen.getByRole('button', { name: 'Adicionar observação' }))
    await user.type(screen.getByLabelText('Observação 1'), 'Linha 1{Enter}Linha 2')
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    const payload: Checklist = salvar.mock.calls[0]?.[0]
    expect(payload.bens[0]?.descricao).toBe('Bem novo')
    expect(payload.executados[0]?.advogados[0]?.nome).toBe('Advogado B')
    expect(payload.exequente.advogados[0]?.nome).toBe('Advogado A')
    expect(payload.observacoes_leilao).toEqual(['Linha 1\nLinha 2'])
    expect(payload.bens[0]).not.toHaveProperty('id')
    expect(payload.executados[0]).not.toHaveProperty('id')
    await user.click(screen.getByRole('button', { name: 'Remover bem 1' }))
    await user.click(screen.getByRole('button', { name: 'Remover executado 1' }))
    await user.click(screen.getByRole('button', { name: 'Remover advogado 1 — Exequente' }))
    await user.click(screen.getByRole('button', { name: 'Remover observação 1' }))
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar.mock.calls.at(-1)?.[0]).toMatchObject({
      bens: [], executados: [], observacoes_leilao: [], exequente: { advogados: [] },
    })
  })
})
