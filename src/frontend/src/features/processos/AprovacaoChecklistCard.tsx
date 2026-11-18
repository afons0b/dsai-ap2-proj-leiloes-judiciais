import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mensagemErro } from '@/api/client'
import { aprovarChecklist, chavesProcessos } from '@/api/processos'
import type { AprovacaoChecklist, ProcessoDetalheOut } from '@/api/types'
import { Alerta } from '@/components/Alerta'
import { Botao } from '@/components/Botao'
import { Card } from '@/components/Card'
import { formatarDataHora } from '@/lib/formatar'

type Props = {
  processoId: string
  aprovacao: AprovacaoChecklist
  desabilitada: boolean
}

export function AprovacaoChecklistCard({ processoId, aprovacao, desabilitada }: Props) {
  const queryClient = useQueryClient()
  const chave = chavesProcessos.detalhe(processoId)
  const aprovar = useMutation({
    mutationFn: (revisao: string) => aprovarChecklist(processoId, revisao),
    onSuccess: (confirmada, revisao) => {
      queryClient.setQueryData<ProcessoDetalheOut>(chave, (atual) =>
        atual?.aprovacao_checklist?.revisao === revisao
          ? { ...atual, aprovacao_checklist: confirmada }
          : atual,
      )
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: chave }),
  })

  return (
    <Card titulo="Aprovação do checklist">
      {aprovacao.aprovado_em ? (
        <p className="text-sm text-slate-700">
          Aprovado por {aprovacao.aprovado_por} em {formatarDataHora(aprovacao.aprovado_em)}.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">Revise o checklist salvo antes de aprová-lo.</p>
          {aprovar.isError ? <Alerta tipo="erro">{mensagemErro(aprovar.error)}</Alerta> : null}
          <Botao
            disabled={desabilitada || aprovar.isPending || !aprovacao.revisao}
            onClick={() => {
              if (aprovacao.revisao) aprovar.mutate(aprovacao.revisao)
            }}
          >
            {aprovar.isPending ? 'Aprovando…' : 'Aprovar checklist'}
          </Botao>
        </div>
      )}
    </Card>
  )
}
