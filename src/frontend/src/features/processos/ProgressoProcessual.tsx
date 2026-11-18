import { useMutationState, useQuery } from '@tanstack/react-query'
import { chavesMarketing, listarEnvios } from '@/api/marketing'
import { chavesProcessos } from '@/api/processos'
import type { ProcessoDetalheOut } from '@/api/types'
import { Alerta } from '@/components/Alerta'
import { Card } from '@/components/Card'
import { calcularProgresso, type EstadoProgresso } from './progressoProcessual'

const ESTILOS: Record<EstadoProgresso, string> = {
  concluida: 'border-green-200 bg-green-50 text-green-800',
  atual: 'border-blue-200 bg-blue-50 text-blue-800',
  pendente: 'border-slate-200 bg-slate-50 text-slate-600',
  erro: 'border-red-200 bg-red-50 text-red-800',
}

const ROTULOS: Record<EstadoProgresso, string> = {
  concluida: 'Concluída', atual: 'Atual', pendente: 'Pendente', erro: 'Erro',
}

type Props = { processo: ProcessoDetalheOut; consultandoDetalhe?: boolean }

export function ProgressoProcessual({ processo, consultandoDetalhe = false }: Props) {
  const operacoes = useMutationState({
    filters: { mutationKey: chavesProcessos.operacoes(processo.id), status: 'pending' },
    select: (mutacao) => mutacao.options.mutationKey?.[3],
  })
  const operacao = (['analise', 'leilao', 'edital', 'marketing'] as const)
    .find((etapa) => operacoes.includes(etapa))
  const precisaHistorico = calcularProgresso(processo, [], operacao).percentual === 80
  const historico = useQuery({
    queryKey: chavesMarketing.progresso(processo.id, processo.leilao?.id ?? ''),
    queryFn: listarEnvios,
    enabled: precisaHistorico,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const progresso = calcularProgresso(processo, historico.data ?? [], operacao)
  const consultando = consultandoDetalhe ||
    (precisaHistorico && (historico.isPending || historico.isFetching))
  const indisponivel = precisaHistorico && historico.isError
  const mostrarEtapas = Boolean(operacao) || (!consultando && !indisponivel)

  return (
    <Card titulo="Progresso processual">
      {operacao ? (
        <p role="status" className="mb-3 text-sm text-slate-500">Atualizando progresso…</p>
      ) : consultando ? (
        <p role="status" className="text-sm text-slate-500">Consultando progresso…</p>
      ) : indisponivel ? (
        <Alerta tipo="erro">Progresso indisponível</Alerta>
      ) : null}
      {mostrarEtapas ? (
        <>
          <div className="overflow-x-auto">
            <ol aria-label="Etapas do processo" className="flex min-w-max gap-3 pb-2">
              {progresso.etapas.map((etapa) => (
                <li
                  key={etapa.id}
                  aria-current={etapa.estado === 'atual' ? 'step' : undefined}
                  className={`min-w-32 flex-1 rounded border p-3 text-sm ${ESTILOS[etapa.estado]}`}
                >
                  <p className="font-semibold">{etapa.nome}</p>
                  <p className="text-xs">{ROTULOS[etapa.estado]}</p>
                  {etapa.descricao !== ROTULOS[etapa.estado] ? (
                    <p className="mt-1 text-xs">{etapa.descricao}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          {!operacao ? (
            <div className="mt-3">
              <p className="mb-1 text-sm font-medium">{progresso.percentual}% concluído</p>
              <div
                role="progressbar"
                aria-label="Conclusão das etapas do sistema"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progresso.percentual}
                className="h-2 overflow-hidden rounded bg-slate-100"
              >
                <div className="h-full bg-blue-700" style={{ width: `${progresso.percentual}%` }} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}
