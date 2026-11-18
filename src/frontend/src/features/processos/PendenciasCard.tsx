import { useQuery } from '@tanstack/react-query'
import { mensagemErro } from '@/api/client'
import { chavesProcessos, listarPendencias } from '@/api/processos'
import type { Pendencia } from '@/api/types'
import { Botao } from '@/components/Botao'
import { Card } from '@/components/Card'

const GRUPOS: { gravidade: Pendencia['gravidade']; titulo: string; classe: string }[] = [
  { gravidade: 'bloqueia', titulo: 'Impedimentos apontados', classe: 'text-red-800' },
  { gravidade: 'atencao', titulo: 'Pontos de atenção', classe: 'text-amber-800' },
]

export function PendenciasCard({ processoId }: { processoId: string }) {
  const consulta = useQuery({
    queryKey: chavesProcessos.pendencias(processoId),
    queryFn: () => listarPendencias(processoId),
  })

  return (
    <Card titulo="Pendências pré-leilão">
      {consulta.isPending ? (
        <p role="status" className="text-sm text-slate-600">Carregando pendências…</p>
      ) : consulta.isError ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">Não foi possível consultar as pendências. {mensagemErro(consulta.error)}</p>
          <Botao variante="secundario" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </Botao>
        </div>
      ) : (
        <div className="space-y-3">
          {consulta.data.length === 0 ? (
            <p className="text-sm text-slate-700">Nenhuma pendência identificada no checklist.</p>
          ) : (
            GRUPOS.map(({ gravidade, titulo, classe }) => {
              const itens = consulta.data.filter((item) => item.gravidade === gravidade)
              if (!itens.length) return null
              return (
                <div key={gravidade}>
                  <h3 className={`text-sm font-semibold ${classe}`}>{titulo}</h3>
                  <ul aria-label={titulo} className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {itens.map((item) => (
                      <li key={item.campo} className="break-words">
                        {item.mensagem}
                        {item.ref ? <span className="block text-slate-600">Referência {item.ref}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
          <p className="text-xs text-slate-600">Confira as informações nos autos antes do leilão.</p>
        </div>
      )}
    </Card>
  )
}
