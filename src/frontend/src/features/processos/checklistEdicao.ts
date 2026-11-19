import type { BemPenhorado, Checklist, Executado } from '@/api/types'
import { camposDinheiroInvalidos, PADRAO_DINHEIRO } from './validacao'

export function novoExecutado(): Executado {
  return { nome: '', cpf_cnpj: null, representacao: null, procuracao_ref: null, advogados: [], citado: null, citacao_forma: null, citacao_ref: null }
}

export function novoBem(): BemPenhorado {
  return {
    categoria: null, imovel: null, veiculo: null, intimacao_forma: null, avaliacao_ref: null,
    oficial_reavaliacao: null, reavaliacao_ref: null, intimacao_reavaliacao: null,
    data_intimacao_reavaliacao: null, intimacao_reavaliacao_ref: null,
    descricao: '', matricula: null, localizacao: null, data_penhora: null, penhora_ref: null,
    fiel_depositario: null, executado_intimado: null, data_intimacao: null, intimacao_ref: null,
    propriedade: null, valor_avaliacao: null, data_avaliacao: null, oficial_avaliacao: null,
    valor_reavaliacao: null, data_reavaliacao: null, certidao_matricula_ref: null,
    averbacao_penhora: null, hipoteca: null, enfiteuse: null, outras_penhoras: null,
  }
}

export function valoresIguais(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((valor, i) => valoresIguais(valor, b[i]))
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return false
  const entradas = Object.entries(a)
  return entradas.length === Object.keys(b).length && entradas.every(([chave, valor]) =>
    Object.hasOwn(b, chave) && valoresIguais(valor, Reflect.get(b, chave)),
  )
}

export function errosChecklist(checklist: Checklist): Record<string, string> {
  const erros: Record<string, string> = {}
  for (const caminho of camposDinheiroInvalidos(checklist)) erros[caminho] = 'Use o formato 1234.56'
  function dinheiro(caminho: string, valor: string | null) {
    if (valor !== null && !PADRAO_DINHEIRO.test(valor)) erros[caminho] = 'Use o formato 1234.56'
  }
  function data(caminho: string, valor: string | null | undefined) {
    if (valor == null) return
    const dia = new Date(`${valor}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000') ||
      Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== valor) {
      erros[caminho] = 'Informe uma data válida no formato AAAA-MM-DD'
    }
  }
  dinheiro('execucao.valor_divida', checklist.execucao.valor_divida)
  data('execucao.data_divida', checklist.execucao.data_divida)
  checklist.bens.forEach((bem, i) => {
    for (const campo of ['valor_avaliacao', 'valor_reavaliacao'] as const) {
      dinheiro(`bens.${i}.${campo}`, bem[campo])
    }
    for (const campo of ['data_penhora', 'data_intimacao', 'data_avaliacao', 'data_reavaliacao', 'data_intimacao_reavaliacao'] as const) {
      data(`bens.${i}.${campo}`, bem[campo])
    }
    data(`bens.${i}.imovel.data_averbacao_penhora`, bem.imovel?.data_averbacao_penhora)
    if (bem.categoria != null && !['imovel', 'material', 'veiculo'].includes(bem.categoria)) {
      erros[`bens.${i}.categoria`] = 'Categoria inválida'
    }
  })
  if (checklist.tipo_justica !== null && !['estadual', 'federal'].includes(checklist.tipo_justica)) {
    erros.tipo_justica = 'Tipo de justiça inválido'
  }
  return erros
}
