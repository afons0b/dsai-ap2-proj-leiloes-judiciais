import type { EnvioOut, ProcessoDetalheOut } from '@/api/types'

const ETAPAS = [
  { id: 'recebimento', nome: 'Recebimento' },
  { id: 'analise', nome: 'Análise' },
  { id: 'leilao', nome: 'Leilão' },
  { id: 'edital', nome: 'Edital' },
  { id: 'marketing', nome: 'Marketing' },
] as const

export type EtapaProgresso = (typeof ETAPAS)[number]['id']
export type EstadoProgresso = 'concluida' | 'atual' | 'pendente' | 'erro'

export type Progresso = {
  percentual: number
  etapas: {
    id: EtapaProgresso
    nome: string
    estado: EstadoProgresso
    descricao: string
  }[]
}

export function calcularProgresso(
  processo: ProcessoDetalheOut,
  envios: readonly EnvioOut[],
  operacao?: EtapaProgresso,
): Progresso {
  const leilao = processo.leilao?.status === 'agendado' ? processo.leilao : null
  const ultimo = envios.reduce<EnvioOut | undefined>((atual, envio) => {
    if (!leilao || envio.leilao_id !== leilao.id) return atual
    if (!atual) return envio
    const diferenca = Date.parse(envio.enviado_em) - Date.parse(atual.enviado_em)
    return diferenca > 0 || (diferenca === 0 && envio.id > atual.id) ? envio : atual
  }, undefined)
  const evidencias = [
    true,
    processo.status === 'analisado' && processo.checklist !== null && processo.relatorio !== null,
    leilao !== null,
    leilao !== null && leilao.edital_id !== null,
    ultimo?.status === 'enviado',
  ]
  let concluidas = 0
  for (const evidencia of evidencias) {
    if (!evidencia) break
    concluidas += 1
  }
  const indiceOperacao = ETAPAS.findIndex((e) => e.id === operacao)
  if (indiceOperacao >= 1) concluidas = Math.min(concluidas, indiceOperacao)

  const descricoes: Record<EtapaProgresso, string> = {
    recebimento: 'Processo recebido',
    analise: processo.status === 'analisando' || operacao === 'analise'
      ? 'Análise em andamento'
      : processo.status === 'analisado'
        ? 'Dados da análise incompletos'
        : 'Aguardando análise',
    leilao: operacao === 'leilao' ? 'Atualizando agendamento' : 'Aguardando agendamento',
    edital: operacao === 'edital' ? 'Atualizando edital' : 'Aguardando edital',
    marketing: operacao === 'marketing' ? 'Envio em andamento' : 'Aguardando envio',
  }

  return {
    percentual: concluidas * 20,
    etapas: ETAPAS.map((etapa, i) => {
      let estado: EstadoProgresso = i < concluidas ? 'concluida' : 'pendente'
      let descricao = estado === 'concluida' ? 'Concluída' : 'Pendente'
      if (i === concluidas) {
        const erro = operacao !== etapa.id && (
          (etapa.id === 'analise' && processo.status === 'erro') ||
          (etapa.id === 'marketing' && ultimo?.status === 'erro')
        )
        estado = erro ? 'erro' : 'atual'
        descricao = erro
          ? etapa.id === 'analise' ? 'Falha na análise' : 'Falha no envio para marketing'
          : descricoes[etapa.id]
      }
      return { ...etapa, estado, descricao }
    }),
  }
}
