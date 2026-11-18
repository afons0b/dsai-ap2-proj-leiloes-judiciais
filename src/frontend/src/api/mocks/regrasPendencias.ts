import type { Checklist, Pendencia } from '@/api/types'

const ONUS = [
  ['hipoteca', 'hipoteca'],
  ['enfiteuse', 'enfiteuse'],
  ['outras_penhoras', 'outras penhoras'],
] as const

export function calcularPendenciasMock(checklist: Checklist | null): Pendencia[] {
  const itens: Pendencia[] = []
  function adicionar(
    gravidade: Pendencia['gravidade'],
    campo: string,
    mensagem: string,
    ref: string | null = null,
  ) {
    itens.push({ gravidade, campo, mensagem, ref })
  }

  if (!checklist) {
    adicionar('bloqueia', 'checklist', 'Processo ainda não analisado')
    return itens
  }

  if (!checklist.executados.length) {
    adicionar('bloqueia', 'executados', 'Nenhum executado identificado')
  }
  checklist.executados.forEach((executado, i) => {
    if (executado.citado !== true) {
      adicionar(
        'bloqueia',
        `executados[${i}].citado`,
        `Citação de ${executado.nome} não comprovada`,
        executado.citacao_ref,
      )
    }
  })

  if (!checklist.bens.length) adicionar('bloqueia', 'bens', 'Nenhum bem penhorado')
  checklist.bens.forEach((bem, i) => {
    const numero = i + 1
    const campo = `bens[${i}]`
    if (bem.executado_intimado !== true) {
      adicionar(
        'bloqueia',
        `${campo}.executado_intimado`,
        `Intimação da penhora do bem ${numero} não comprovada`,
        bem.intimacao_ref,
      )
    }
    if (bem.valor_avaliacao === null && bem.valor_reavaliacao === null) {
      adicionar('bloqueia', `${campo}.valor_avaliacao`, `Bem ${numero} sem avaliação`)
    }
    if (bem.certidao_matricula_ref === null) {
      adicionar(
        'atencao',
        `${campo}.certidao_matricula_ref`,
        `Certidão de matrícula do bem ${numero} sem referência nos autos`,
      )
    }
    for (const [atributo, rotulo] of ONUS) {
      const valor = bem[atributo]
      if (valor) {
        adicionar(
          'atencao',
          `${campo}.${atributo}`,
          `Bem ${numero}, ${rotulo}: ${valor} — conferir ônus`,
        )
      }
    }
  })
  checklist.observacoes_leilao.forEach((observacao, i) => {
    adicionar('atencao', `observacoes_leilao[${i}]`, observacao)
  })
  return itens
}
