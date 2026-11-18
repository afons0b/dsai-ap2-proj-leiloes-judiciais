import type { FiltrosProcessos, ProcessoStatus } from './types'

export const FILTROS_INICIAIS: FiltrosProcessos = {
  busca: '',
  ordem: 'desc',
  pagina: 1,
  tamanho_pagina: 20,
}

const STATUS: readonly string[] = ['recebido', 'analisando', 'analisado', 'erro']

export function parametrosProcessos(filtros: Partial<FiltrosProcessos>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [campo, valor] of Object.entries(filtros)) {
    if (valor !== undefined && (campo !== 'busca' || valor !== '')) {
      params.set(campo, String(valor))
    }
  }
  return params
}

export function lerFiltrosProcessos(params: URLSearchParams): FiltrosProcessos {
  function invalido(campo: string): never {
    throw new Error(`Parâmetro ${campo} inválido`)
  }

  function inteiro(campo: string, padrao: number, maximo = Number.POSITIVE_INFINITY): number {
    const texto = params.get(campo)
    if (texto === null) return padrao
    const valor = Number(texto)
    if (!/^[+-]?[0-9]+$/.test(texto) || !Number.isInteger(valor) || valor < 1 || valor > maximo) {
      return invalido(campo)
    }
    return valor
  }

  function data(campo: string): string | undefined {
    const valor = params.get(campo)
    if (valor === null) return undefined
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor) || valor.startsWith('0000')) {
      return invalido(campo)
    }
    const dia = new Date(`${valor}T00:00:00Z`)
    if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== valor) {
      return invalido(campo)
    }
    return valor
  }

  const busca = (params.get('busca') ?? '').trim()
  if (Array.from(busca).length > 255) invalido('busca')
  const status = params.get('status')
  if (status !== null && !STATUS.includes(status)) invalido('status')
  const ordem = params.get('ordem') ?? 'desc'
  if (ordem !== 'asc' && ordem !== 'desc') return invalido('ordem')
  const inicio = data('data_inicio')
  const fim = data('data_fim')
  if (inicio && fim && inicio > fim) {
    throw new Error('Data inicial deve ser anterior ou igual à data final')
  }
  return {
    busca,
    status: status === null ? undefined : (status as ProcessoStatus),
    data_inicio: inicio,
    data_fim: fim,
    ordem,
    pagina: inteiro('pagina', 1),
    tamanho_pagina: inteiro('tamanho_pagina', 20, 100),
  }
}
