import { useQuery } from '@tanstack/react-query'
import { mensagemErro } from '@/api/client'
import { chavesProcessos, listarHistoricoChecklist } from '@/api/processos'
import type { EventoChecklist } from '@/api/types'
import { Botao } from '@/components/Botao'
import { Card } from '@/components/Card'
import { formatarDataHora } from '@/lib/formatar'

const ROTULOS: Record<EventoChecklist['acao'], string> = {
  analise: 'Checklist gerado',
  reanalise: 'Checklist gerado novamente',
  edicao: 'Checklist editado',
  aprovacao: 'Checklist aprovado',
}

export function HistoricoChecklistCard({ processoId }: { processoId: string }) {
  const consulta = useQuery({
    queryKey: chavesProcessos.historicoChecklist(processoId),
    queryFn: () => listarHistoricoChecklist(processoId),
  })

  return (
    <Card titulo="Histórico do checklist">
      {consulta.isPending ? (
        <p className="text-sm text-slate-600">Carregando histórico…</p>
      ) : consulta.isError ? (
        <div className="space-y-2 text-sm">
          <p role="status">{mensagemErro(consulta.error)}</p>
          <Botao variante="secundario" onClick={() => void consulta.refetch()}>
            Recarregar histórico
          </Botao>
        </div>
      ) : consulta.data.length ? (
        <>
          <p className="mb-2 text-xs text-slate-600">Até 20 eventos mais recentes.</p>
          <ol aria-label="Eventos do checklist" className="divide-y divide-slate-200 text-sm">
            {consulta.data.map((evento) => (
              <li key={evento.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <strong>{ROTULOS[evento.acao]}</strong>
                <span className="text-slate-700">{evento.usuario}</span>
                <time className="text-slate-600" dateTime={evento.criado_em}>
                  {formatarDataHora(evento.criado_em)}
                </time>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="text-sm text-slate-600">Nenhum evento registrado.</p>
      )}
    </Card>
  )
}
