import { beforeEach, describe, expect, it } from 'vitest'
import { lerFiltrosProcessos, parametrosProcessos } from './filtrosProcessos'
import { db, logar } from './mocks/db'
import { chavesProcessos, listarProcessos } from './processos'

beforeEach(() => {
  logar('operador')
  db.processos = ([
    ['a', '2026-11-18T02:59:59Z', 'recebido'],
    ['b', '2026-11-18T03:00:00Z', 'analisado'],
    ['c', '2026-11-19T02:59:59Z', 'analisado'],
    ['d', '2026-11-19T03:00:00Z', 'analisado'],
  ] as const).map(([id, criado_em, status]) => ({
    id,
    criado_em,
    status,
    nome_arquivo: 'Imovel %_\\/ arquivo.pdf',
    numero_processo: id === 'c' ? 'NUM-ABC' : null,
    vara: null,
    erro: null,
    analisado_em: null,
    checklist: null,
    relatorio: null,
  }))
})

describe('contrato paginado do cliente e MSW', () => {
  it('recebe envelope padrão e mantém a página solicitada fora do intervalo', async () => {
    const padrao = await listarProcessos()
    expect(padrao).toMatchObject({ total: 4, pagina: 1, tamanho_pagina: 20, total_paginas: 1 })
    expect(padrao.itens.map((p) => p.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(await listarProcessos({ pagina: 3, tamanho_pagina: 2 })).toEqual({
      itens: [], total: 4, pagina: 3, tamanho_pagina: 2, total_paginas: 2,
    })
  })

  it('combina busca literal, status, dia de Belém, ordem e paginação', async () => {
    const pagina = await listarProcessos({
      busca: ' %_\\/ ', status: 'analisado', data_inicio: '2026-11-18',
      data_fim: '2026-11-18', ordem: 'asc', pagina: 2, tamanho_pagina: 1,
    })
    expect(pagina.total).toBe(2)
    expect(pagina.total_paginas).toBe(2)
    expect(pagina.itens.map((p) => p.id)).toEqual(['c'])
    expect((await listarProcessos({ busca: 'num-abc' })).itens.map((p) => p.id)).toEqual(['c'])
    expect((await listarProcessos({ busca: 'ausente' })).total_paginas).toBe(0)
    expect((await listarProcessos({ busca: 'imóvel' })).total).toBe(0)
  })

  it('desempata datas por id nas duas direções', async () => {
    db.processos = db.processos.map((p) => ({ ...p, criado_em: '2026-11-18T12:00:00Z' }))
    for (const ordem of ['asc', 'desc'] as const) {
      const primeira = await listarProcessos({ ordem, tamanho_pagina: 2 })
      const segunda = await listarProcessos({ ordem, tamanho_pagina: 2, pagina: 2 })
      const ids = [...primeira.itens, ...segunda.itens].map((p) => p.id)
      expect(ids).toEqual(ordem === 'asc' ? ['a', 'b', 'c', 'd'] : ['d', 'c', 'b', 'a'])
    }
  })

  it.each([
    ['status', ''], ['status', 'invalido'], ['ordem', ''], ['ordem', 'invalida'],
    ['data_inicio', '2026-02-30'], ['data_fim', ''], ['data_fim', '2026-11-18T00:00:00Z'],
    ['pagina', '0'], ['pagina', '-1'], ['pagina', '1.5'], ['pagina', '1.0'], ['pagina', ''],
    ['tamanho_pagina', '0'], ['tamanho_pagina', '101'], ['tamanho_pagina', ''],
    ['busca', 'x'.repeat(256)],
  ])('devolve validação textual para %s inválido (%s)', async (campo, valor) => {
    const params = new URLSearchParams({ [campo]: valor })
    const resposta = await fetch(`${window.location.origin}/api/processos?${params}`)
    expect(resposta.status).toBe(422)
    expect(await resposta.json()).toEqual({ detail: `Parâmetro ${campo} inválido` })
  })

  it('valida período invertido e aceita 255 caracteres Unicode após trim', async () => {
    await expect(listarProcessos({
      data_inicio: '2026-11-19', data_fim: '2026-11-18',
    })).rejects.toMatchObject({
      status: 422, detail: 'Data inicial deve ser anterior ou igual à data final',
    })
    const filtros = lerFiltrosProcessos(new URLSearchParams({ busca: ` ${'😀'.repeat(255)} ` }))
    expect(Array.from(filtros.busca)).toHaveLength(255)
    expect((await listarProcessos({ busca: filtros.busca })).total).toBe(0)
  })

  it('preserva datas vazias enviadas pelo consumidor para validação no servidor', async () => {
    await expect(listarProcessos({ data_inicio: '' })).rejects.toMatchObject({
      status: 422, detail: 'Parâmetro data_inicio inválido',
    })
  })

  it('codifica caracteres especiais e distingue todos os parâmetros no cache', () => {
    const filtros = lerFiltrosProcessos(new URLSearchParams({ busca: " '%_\\/ &? " }))
    const params = parametrosProcessos(filtros)
    expect(new URLSearchParams(params.toString()).get('busca')).toBe("'%_\\/ &?")
    expect(params.has('status')).toBe(false)
    expect(params.has('data_inicio')).toBe(false)
    for (const mudanca of [
      { busca: 'outra' }, { status: 'erro' as const }, { data_inicio: '2026-11-18' },
      { data_fim: '2026-11-18' }, { ordem: 'asc' as const }, { pagina: 2 }, { tamanho_pagina: 10 },
    ]) {
      expect(chavesProcessos.pagina({ ...filtros, ...mudanca })).not.toEqual(
        chavesProcessos.pagina(filtros),
      )
    }
    expect(chavesProcessos.pagina(filtros).slice(0, 1)).toEqual(chavesProcessos.lista)
  })
})
