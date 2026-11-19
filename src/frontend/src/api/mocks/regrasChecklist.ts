import type { Checklist } from '@/api/types'

function dataValida(valor: string | null | undefined): boolean {
  if (valor == null) return true
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false
  const data = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
}

export function camposEspecializadosValidos(checklist: Checklist): boolean {
  const textos: unknown[] = [checklist.execucao.titulo_executivo, checklist.execucao.valor_divida_ref]
  for (const parte of [checklist.exequente, ...checklist.executados]) {
    textos.push(parte.representacao, parte.procuracao_ref, ...parte.advogados.map((advogado) => advogado.cpf))
  }
  for (const bem of checklist.bens) {
    if (bem.categoria != null && !['imovel', 'material', 'veiculo'].includes(bem.categoria)) return false
    if (!dataValida(bem.data_intimacao_reavaliacao) || !dataValida(bem.imovel?.data_averbacao_penhora)) return false
    if (bem.imovel != null && (typeof bem.imovel !== 'object' || Array.isArray(bem.imovel))) return false
    if (bem.veiculo != null && (typeof bem.veiculo !== 'object' || Array.isArray(bem.veiculo))) return false
    textos.push(bem.intimacao_forma, bem.avaliacao_ref, bem.oficial_reavaliacao,
      bem.reavaliacao_ref, bem.intimacao_reavaliacao, bem.intimacao_reavaliacao_ref,
      bem.imovel?.intimacao_conjuge, ...Object.values(bem.veiculo ?? {}))
  }
  return textos.every((valor) => valor == null || typeof valor === 'string')
}
