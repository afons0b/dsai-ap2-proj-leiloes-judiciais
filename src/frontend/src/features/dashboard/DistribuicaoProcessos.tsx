import type { ProcessosPorStatus, ProcessoStatus } from '@/api/types'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'

const CORES: Record<ProcessoStatus, string> = {
  recebido: 'bg-slate-400',
  analisando: 'bg-amber-400',
  analisado: 'bg-green-500',
  erro: 'bg-red-500',
}

export function DistribuicaoProcessos({ contagem }: { contagem: ProcessosPorStatus }) {
  const maior = Math.max(1, ...Object.values(contagem))
  return (
    <Card titulo="Processos por status">
      <ul aria-label="Distribuição de processos por status" className="flex flex-col gap-3">
        {(Object.keys(CORES) as ProcessoStatus[]).map((status) => (
          <li key={status} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <StatusBadge status={status} />
              <span>{contagem[status]}</span>
            </div>
            <div
              role="meter"
              aria-label={status}
              aria-valuemin={0}
              aria-valuemax={maior}
              aria-valuenow={contagem[status]}
              className="h-3 overflow-hidden rounded bg-slate-100"
            >
              <div
                className={`h-full rounded ${CORES[status]}`}
                style={{ width: `${(contagem[status] / maior) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {Object.values(contagem).every((total) => total === 0) ? (
        <p className="mt-3 text-sm text-slate-500">Nenhum processo cadastrado.</p>
      ) : null}
    </Card>
  )
}
