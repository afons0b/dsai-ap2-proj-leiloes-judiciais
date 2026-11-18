import { describe, expect, it } from 'vitest'
import { db, toDetalhe } from '@/api/mocks/db'
import type { EnvioOut, ProcessoDetalheOut } from '@/api/types'
import { calcularProgresso } from './progressoProcessual'

function processo(patch: Partial<ProcessoDetalheOut> = {}): ProcessoDetalheOut {
  const registro = db.processos[0]
  if (!registro) throw new Error('Fixture ausente')
  const detalhe = toDetalhe(registro)
  if (!detalhe.leilao) throw new Error('Fixture de leilão ausente')
  return { ...detalhe, leilao: { ...detalhe.leilao, edital_id: 'e-1' }, ...patch }
}

function envio(patch: Partial<EnvioOut> = {}): EnvioOut {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    leilao_id: 'l-1', numero_processo: null, destinatarios: [],
    enviado_em: '2026-11-18T13:00:00Z', status: 'enviado', erro: null,
    ...patch,
  }
}

describe('cálculo de progresso processual', () => {
  it.each([20, 40, 60, 80, 100])('calcula a sequência contínua em %i%%', (percentual) => {
    const dados = processo()
    if (percentual === 20) dados.status = 'recebido'
    if (percentual === 40) dados.leilao = null
    if (percentual === 60 && dados.leilao) dados.leilao.edital_id = null
    const resultado = calcularProgresso(dados, percentual === 100 ? [envio()] : [])
    expect(resultado.percentual).toBe(percentual)
    expect(resultado.etapas.map((e) => e.nome)).toEqual([
      'Recebimento', 'Análise', 'Leilão', 'Edital', 'Marketing',
    ])
    expect(resultado.etapas.filter((e) => e.estado === 'concluida')).toHaveLength(percentual / 20)
    expect(resultado.etapas.filter((e) => e.estado === 'atual')).toHaveLength(percentual === 100 ? 0 : 1)
  })

  it.each(['analisando', 'erro'] as const)('reanálise %s ignora artefatos antigos', (status) => {
    const resultado = calcularProgresso(processo({ status }), [envio()])
    expect(resultado.percentual).toBe(20)
    expect(resultado.etapas[1]?.estado).toBe(status === 'erro' ? 'erro' : 'atual')
    expect(resultado.etapas.slice(2).every((e) => e.estado === 'pendente')).toBe(true)
    if (status === 'erro') expect(resultado.etapas.some((e) => e.estado === 'atual')).toBe(false)
  })

  it.each(['checklist', 'relatorio'] as const)('análise sem %s não é concluída', (campo) => {
    const resultado = calcularProgresso(processo({ [campo]: null }), [envio()])
    expect(resultado.percentual).toBe(20)
    expect(resultado.etapas[1]?.descricao).toBe('Dados da análise incompletos')
    expect(resultado.etapas[1]?.estado).toBe('atual')
  })

  it('cancelamento e novo leilão não aproveitam histórico anterior', () => {
    expect(calcularProgresso(processo({ leilao: null }), [envio()]).percentual).toBe(40)
    const dados = processo()
    if (!dados.leilao) throw new Error('Leilão ausente')
    dados.leilao.status = 'cancelado'
    expect(calcularProgresso(dados, [envio()]).percentual).toBe(40)
    dados.leilao = { ...dados.leilao, id: 'l-novo', status: 'agendado', edital_id: null }
    expect(calcularProgresso(dados, [envio()]).percentual).toBe(60)
    dados.leilao.edital_id = 'e-novo'
    expect(calcularProgresso(dados, [envio()]).percentual).toBe(80)
  })

  it('considera o último resultado por instante, incluindo offsets e reenvio', () => {
    const sucesso = envio({ enviado_em: '2026-11-18T10:00:00-03:00' })
    const erro = envio({ id: '2', status: 'erro', enviado_em: '2026-11-18T13:00:01Z' })
    const resultado = calcularProgresso(processo({ numero_processo: null }), [erro, sucesso])
    expect(resultado.percentual).toBe(80)
    expect(resultado.etapas[4]?.estado).toBe('erro')
    expect(resultado.etapas.some((e) => e.estado === 'atual')).toBe(false)
    const reenvio = envio({ enviado_em: '2026-11-18T13:00:02Z' })
    expect(calcularProgresso(processo(), [reenvio, erro, sucesso]).percentual).toBe(100)
  })

  it('desempata por UUID e não mistura outro leilão com o mesmo número', () => {
    const maior = envio({ id: '00000000-0000-0000-0000-000000000002', status: 'erro' })
    const estrangeiro = envio({ leilao_id: 'l-outro', enviado_em: '2099-01-01T00:00:00Z' })
    for (const lista of [[envio(), maior, estrangeiro], [estrangeiro, maior, envio()]]) {
      expect(calcularProgresso(processo(), lista).percentual).toBe(80)
    }
  })

  it('restaura artefatos preservados e mantém marketing após regenerar edital', () => {
    const dados = processo()
    const antes = structuredClone(dados)
    const historico = [envio()]
    const copia = structuredClone(historico)
    expect(calcularProgresso(dados, historico).percentual).toBe(100)
    expect(dados).toEqual(antes)
    expect(historico).toEqual(copia)
    if (dados.leilao) dados.leilao.edital_id = 'e-regenerado'
    expect(calcularProgresso(dados, historico).percentual).toBe(100)
  })

  it('marca operação pendente sem concluir etapas antecipadamente', () => {
    const resultado = calcularProgresso(processo(), [envio()], 'analise')
    expect(resultado.etapas[1]?.estado).toBe('atual')
    expect(resultado.etapas[1]?.descricao).toBe('Análise em andamento')
    expect(resultado.etapas.slice(2).every((e) => e.estado === 'pendente')).toBe(true)
  })
})
