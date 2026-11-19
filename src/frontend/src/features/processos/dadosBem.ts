import type { BemPenhorado, CategoriaBem, DadosImovel, DadosVeiculo } from '@/api/types'

export const CATEGORIAS_BEM: Record<CategoriaBem, string> = {
  imovel: 'Imóvel', material: 'Material', veiculo: 'Veículo',
}

type Campo<T> = readonly [keyof T, string, ('date' | 'textarea')?]

export const CAMPOS_IMOVEL: readonly Campo<DadosImovel>[] = [
  ['intimacao_conjuge', 'intimação do cônjuge', 'textarea'],
  ['data_averbacao_penhora', 'data da averbação da penhora', 'date'],
]

export const CAMPOS_VEICULO: readonly Campo<DadosVeiculo>[] = [
  ['marca_modelo', 'marca / modelo'], ['placa', 'placa'], ['cor', 'cor'],
  ['ano', 'ano (texto dos autos)'], ['modelo', 'modelo (texto dos autos)'],
  ['chassi', 'chassi'], ['renavam', 'RENAVAM'], ['proprietario_detran', 'proprietário no DETRAN'],
  ['intimacao_detran', 'intimação — dados DETRAN', 'textarea'],
  ['credor_fiduciario', 'credor fiduciário', 'textarea'], ['multas_debitos', 'multas e débitos', 'textarea'],
]

export function temDadosImovel(bem: BemPenhorado): boolean {
  return [bem.matricula, bem.certidao_matricula_ref, bem.averbacao_penhora, bem.hipoteca,
    bem.enfiteuse, ...Object.values(bem.imovel ?? {})].some((valor) => valor != null && valor !== '')
}

export function temDadosVeiculo(bem: BemPenhorado): boolean {
  return Object.values(bem.veiculo ?? {}).some((valor) => valor != null && valor !== '')
}
