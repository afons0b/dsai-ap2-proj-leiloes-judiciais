import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db, logar } from '@/api/mocks/db'
import { obterProcesso, salvarChecklist } from '@/api/processos'
import type { Checklist, DadosVeiculo } from '@/api/types'
import { renderComApp, renderComRouter } from '@/test/render'
import { ChecklistForm } from './ChecklistForm'
import { ChecklistView } from './ChecklistView'
import { errosChecklist, novoBem } from './checklistEdicao'

function misto(): Checklist {
  return {
    vara: null, numero_processo: null, juiz: null, tipo_justica: null,
    exequente: { nome: 'Parte Exemplo', cpf_cnpj: 'DOC-SINTETICO', advogados: [{ nome: 'Advogado Exemplo', cpf: '00000000001', oab: null, ref: null }], representacao: 'Representação sintética', procuracao_ref: 'Doc A' },
    executados: [{ nome: 'Executado Exemplo', cpf_cnpj: null, advogados: [{ nome: 'Advogado Outro', cpf: '00000000002', oab: null, ref: null }], citado: null, citacao_forma: null, citacao_ref: null }],
    execucao: { cda: null, natureza_divida: null, classe: null, valor_divida: null, data_divida: null, titulo_executivo: 'Título sintético', valor_divida_ref: 'Doc B' },
    bens: [
      { ...novoBem(), descricao: 'Terreno sintético', categoria: 'imovel', matricula: 'MAT-EXEMPLO', imovel: { intimacao_conjuge: 'Sem informação', data_averbacao_penhora: '2026-11-01' } },
      { ...novoBem(), descricao: 'Cadeira sintética', categoria: 'material' },
      { ...novoBem(), descricao: 'Veículo sintético', categoria: 'veiculo', veiculo: { renavam: '00012345678', placa: 'EXEMPLO', multas_debitos: 'Não há' } },
      { ...novoBem(), descricao: 'Bem legado' },
    ], recursos: null, observacoes_leilao: [],
  }
}

function montar(inicial = misto()) {
  const salvar = vi.fn<(checklist: Checklist) => void>()
  return { ...renderComApp(<ChecklistForm inicial={inicial} salvando={false} erro={null} onSalvar={salvar} onCancelar={vi.fn()} />), salvar }
}

describe('checklists especializados', () => {
  it('mostra categorias por bem e seções dinâmicas no processo misto', () => {
    montar()
    expect(screen.getAllByRole('combobox', { name: /categoria/ })).toHaveLength(4)
    expect(screen.getByLabelText('Bem 3 — RENAVAM')).toHaveValue('00012345678')
    expect(screen.queryByLabelText('Bem 2 — matrícula')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Bem 1 — intimação do cônjuge')).toBeInTheDocument()
    expect(screen.getByLabelText('Bem 4 — categoria')).toHaveValue('')
  })

  it('troca categoria sem apagar dados e mantém detalhes de outra categoria acessíveis', async () => {
    const { user, salvar } = montar()
    await user.selectOptions(screen.getByLabelText('Bem 3 — categoria'), 'material')
    expect(screen.getByText('Dados preservados de outra categoria — veículo')).toBeInTheDocument()
    expect(screen.getByLabelText('Bem 3 — RENAVAM')).toHaveValue('00012345678')
    await user.selectOptions(screen.getByLabelText('Bem 3 — categoria'), 'imovel')
    fireEvent.change(screen.getByLabelText('Bem 3 — matrícula'), { target: { value: 'MAT-NOVA' } })
    await user.selectOptions(screen.getByLabelText('Bem 3 — categoria'), 'veiculo')
    expect(screen.getByLabelText('Bem 3 — matrícula')).toHaveValue('MAT-NOVA')
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar.mock.calls[0]?.[0].bens[2]).toMatchObject({ categoria: 'veiculo', matricula: 'MAT-NOVA', veiculo: { renavam: '00012345678' } })
  })

  it('edita campos comuns novos e todos os detalhes do veículo sem perder zeros', async () => {
    const { user, salvar } = montar()
    const campos: [string, string][] = [
      ['Título executivo', 'Título corrigido'], ['Referência do valor da dívida', 'Doc C'],
      ['Bem 3 — forma da intimação', 'Texto informado'], ['Bem 3 — referência da avaliação', 'Doc D'],
      ['Bem 3 — oficial da reavaliação', 'Oficial Exemplo'], ['Bem 3 — referência da reavaliação', 'Doc E'],
      ['Bem 3 — intimação da reavaliação', 'Informação textual'], ['Bem 3 — referência da intimação da reavaliação', 'Doc F'],
      ['Bem 3 — data da intimação da reavaliação', '2026-11-02'],
    ]
    for (const [label, value] of campos) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    const dados: Required<DadosVeiculo> = {
      marca_modelo: 'Fabricante Exemplo / Modelo Exemplo', placa: 'PLACA-SINTETICA', cor: 'Azul', ano: 'Informado como 2020', modelo: 'Informado como 2021', chassi: 'CHASSI-SINTETICO', renavam: '00098765432', proprietario_detran: 'Parte Exemplo', intimacao_detran: 'Sem definição de destinatário', credor_fiduciario: 'Não há', multas_debitos: 'Não informado',
    }
    const labels = ['marca / modelo', 'placa', 'cor', 'ano (texto dos autos)', 'modelo (texto dos autos)', 'chassi', 'RENAVAM', 'proprietário no DETRAN', 'intimação — dados DETRAN', 'credor fiduciário', 'multas e débitos']
    Object.entries(dados).forEach(([, value], i) => fireEvent.change(screen.getByLabelText(`Bem 3 — ${labels[i]}`), { target: { value } }))
    fireEvent.change(screen.getByLabelText('Exequente — advogado 1 — CPF'), { target: { value: '00000000003' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    const enviado = salvar.mock.calls[0]?.[0]
    expect(enviado?.bens[2]?.veiculo).toEqual(dados)
    expect(enviado?.bens[2]?.data_intimacao_reavaliacao).toBe('2026-11-02')
    expect(enviado?.exequente.advogados[0]?.cpf).toBe('00000000003')
    expect(enviado?.executados[0]?.advogados[0]?.cpf).toBe('00000000002')
    expect(enviado?.exequente.cpf_cnpj).toBe('DOC-SINTETICO')
  })

  it('lê e salva legado sem modificar campos intactos nem inventar categoria', async () => {
    const inicial = misto()
    inicial.bens = [{ ...novoBem(), descricao: 'Bem legado', matricula: 'LEGADO' }]
    const antes = structuredClone(inicial)
    const { user, salvar } = montar(inicial)
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar).toHaveBeenCalledWith(antes)
    expect(inicial).toEqual(antes)
    expect(salvar.mock.calls[0]?.[0].bens[0]?.categoria).toBeNull()
  })

  it('limpa identificadores opcionais como null e aceita categorias não informadas', async () => {
    const { user, salvar } = montar()
    await user.clear(screen.getByLabelText('Bem 3 — RENAVAM'))
    await user.clear(screen.getByLabelText('Exequente — advogado 1 — CPF'))
    await user.selectOptions(screen.getByLabelText('Bem 3 — categoria'), '')
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar.mock.calls[0]?.[0].bens[2]).toMatchObject({ categoria: null, veiculo: { renavam: null } })
    expect(salvar.mock.calls[0]?.[0].exequente.advogados[0]?.cpf).toBeNull()
  })

  it('valida novas datas inclusive em detalhes preservados de outra categoria', () => {
    const inicial = misto()
    inicial.bens[0] = { ...inicial.bens[0]!, categoria: 'material', data_intimacao_reavaliacao: '2026-02-30', imovel: { data_averbacao_penhora: '2026-02-30' } }
    expect(errosChecklist(inicial)['bens.0.data_intimacao_reavaliacao']).toBeDefined()
    expect(errosChecklist(inicial)['bens.0.imovel.data_averbacao_penhora']).toBeDefined()
  })

  it('visualiza categorias, CPF, detalhes e campos desconhecidos sem interpretação', () => {
    renderComApp(<ChecklistView checklist={misto()} onEditar={vi.fn()} />)
    for (const texto of ['Imóvel', 'Material', 'Veículo', 'Não informado', '00012345678', 'Representação sintética', 'Título sintético']) expect(screen.getAllByText(texto).length).toBeGreaterThan(0)
    expect(screen.getByText(/CPF: 00000000001/)).toBeInTheDocument()
  })

  it('mantém campos opcionais ausentes no legado sem erro de validação', () => {
    const inicial = misto()
    inicial.bens = [{ descricao: 'Legado', matricula: null, localizacao: null, data_penhora: null, penhora_ref: null, fiel_depositario: null, executado_intimado: null, data_intimacao: null, intimacao_ref: null, propriedade: null, valor_avaliacao: null, data_avaliacao: null, oficial_avaliacao: null, valor_reavaliacao: null, data_reavaliacao: null, certidao_matricula_ref: null, averbacao_penhora: null, hipoteca: null, enfiteuse: null, outras_penhoras: null }]
    expect(errosChecklist(inicial)).toEqual({})
  })

  it('bloqueia salvamento de data especializada inválida recebida', async () => {
    const inicial = misto()
    inicial.bens[0]!.imovel!.data_averbacao_penhora = '2026-02-30'
    const { user, salvar } = montar(inicial)
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    expect(salvar).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Bem 1 — data da averbação da penhora')).toHaveFocus()
    expect(screen.getByLabelText('Bem 1 — data da averbação da penhora')).toHaveAttribute('aria-invalid', 'true')
  })

  it.each(['cpf', 'renavam', 'data'] as const)('mock rejeita %s inválido sem persistir alterações', async (campo) => {
    logar('operador')
    const processo = db.processos[0]!
    processo.checklist = misto()
    const invalido = structuredClone(processo.checklist)
    if (campo === 'cpf') Reflect.set(invalido.exequente.advogados[0]!, 'cpf', 123)
    if (campo === 'renavam') Reflect.set(invalido.bens[2]!.veiculo!, 'renavam', 123)
    if (campo === 'data') invalido.bens[0]!.imovel!.data_averbacao_penhora = '2026-02-30'
    await expect(salvarChecklist(processo.id, invalido)).rejects.toThrow()
    expect(processo.checklist).toEqual(misto())
  })

  it('salva pelo MSW e preserva revisão humana e eventos anteriores', async () => {
    logar('operador')
    const inicial = misto()
    db.processos = [{ id: 'p-sintetico', nome_arquivo: 'sintetico.pdf', status: 'analisado', numero_processo: null, vara: null, erro: null, criado_em: '2026-11-19T12:00:00Z', analisado_em: '2026-11-19T12:00:00Z', checklist: inicial, relatorio: { resumo: 'Síntese sintética', etapas: [] }, revisaoChecklist: 'revisao-sintetica', aprovacaoChecklist: { revisao: 'revisao-sintetica', aprovado_por: 'operador', aprovado_em: '2026-11-19T12:00:00Z' }, historicoChecklist: [{ id: 'evento-sintetico', acao: 'aprovacao', usuario: 'operador', criado_em: '2026-11-19T12:00:00Z' }] }]
    db.leiloes = []
    const { user } = renderComRouter('/processos/p-sintetico')
    await user.click(await screen.findByRole('button', { name: 'Editar checklist' }))
    fireEvent.change(screen.getByLabelText('Bem 3 — RENAVAM'), { target: { value: '00098765432' } })
    await user.click(screen.getByRole('button', { name: 'Salvar', exact: true }))
    await screen.findByRole('button', { name: 'Editar checklist' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar checklist' })).toBeEnabled())
    expect(screen.getByText('00098765432')).toBeInTheDocument()
    const historico = screen.getByRole('list', { name: 'Eventos do checklist' })
    expect(within(historico).getByText('Checklist aprovado')).toBeInTheDocument()
    expect(within(historico).getByText('Checklist editado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar checklist' }))
    expect(screen.getByLabelText('Bem 3 — RENAVAM')).toHaveValue('00098765432')
  })

  it('recusa categoria inválida no mock sem registrar edição', async () => {
    logar('operador')
    const inicial = misto()
    const processo = db.processos[0]!
    processo.checklist = inicial
    const eventos = processo.historicoChecklist?.length ?? 0
    const invalido = structuredClone(inicial)
    Reflect.set(invalido.bens[0]!, 'categoria', 'invalida')
    await expect(salvarChecklist(processo.id, invalido)).rejects.toThrow()
    expect(processo.historicoChecklist?.length ?? 0).toBe(eventos)
    expect((await obterProcesso(processo.id)).checklist).toEqual(inicial)
  })
})
