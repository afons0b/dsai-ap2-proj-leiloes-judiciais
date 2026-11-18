import { describe, expect, it } from 'vitest'
import { CHECKLIST_EXEMPLO } from '@/api/mocks/fixtures'
import { errosChecklist, novoBem, novoExecutado, valoresIguais } from './checklistEdicao'

describe('edição completa do checklist', () => {
  it('cria itens vazios sem dados fictícios e com nulabilidade correta', () => {
    expect(novoExecutado()).toEqual({
      nome: '', cpf_cnpj: null, advogados: [], citado: null, citacao_forma: null, citacao_ref: null,
    })
    const bem = novoBem()
    expect(bem.descricao).toBe('')
    expect(Object.keys(bem)).toHaveLength(20)
    expect(Object.entries(bem).filter(([chave]) => chave !== 'descricao').every(([, v]) => v === null))
      .toBe(true)
  })

  it('compara valores aninhados sem depender da ordem de chaves', () => {
    expect(valoresIguais({ a: 1, b: [null, false] }, { b: [null, false], a: 1 })).toBe(true)
    expect(valoresIguais([1, 2], [2, 1])).toBe(false)
    expect(valoresIguais(null, '')).toBe(false)
    expect(valoresIguais([], {})).toBe(false)
    expect(valoresIguais({ a: undefined }, { b: undefined })).toBe(false)
    const copia = structuredClone(CHECKLIST_EXEMPLO)
    copia.exequente.nome = 'alterado'
    expect(valoresIguais(copia, CHECKLIST_EXEMPLO)).toBe(false)
  })

  it.each(['-1.00', '1,00', '1.0', '1.000', ''])('rejeita valor monetário %s', (valor) => {
    const checklist = structuredClone(CHECKLIST_EXEMPLO)
    checklist.execucao.valor_divida = valor
    expect(errosChecklist(checklist)['execucao.valor_divida']).toBe('Use o formato 1234.56')
  })

  it.each(['2026-02-30', '0000-01-01', '18/11/2026'])('rejeita data %s no caminho do bem', (data) => {
    const checklist = structuredClone(CHECKLIST_EXEMPLO)
    checklist.bens = [{ ...novoBem(), data_intimacao: data }]
    expect(errosChecklist(checklist)['bens.0.data_intimacao']).toContain('data válida')
  })

  it('aceita zero, datas válidas sem regra cronológica e listas vazias', () => {
    const checklist = structuredClone(CHECKLIST_EXEMPLO)
    checklist.execucao.valor_divida = '0.00'
    checklist.execucao.data_divida = '2099-12-31'
    checklist.bens = [{ ...novoBem(), data_penhora: '2024-02-29', data_intimacao: '2020-01-01' }]
    checklist.executados = []
    checklist.exequente.nome = ''
    expect(errosChecklist(checklist)).toEqual({})
    checklist.bens = []
    expect(errosChecklist(checklist)).toEqual({})
  })
})
