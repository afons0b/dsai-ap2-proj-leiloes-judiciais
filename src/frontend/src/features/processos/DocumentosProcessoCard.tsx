import { useMutation } from '@tanstack/react-query'
import { mensagemErro } from '@/api/client'
import { baixarPdfOriginal } from '@/api/processos'
import { Alerta } from '@/components/Alerta'
import { Botao } from '@/components/Botao'
import { Card } from '@/components/Card'
import { baixarArquivo } from '@/lib/baixarArquivo'

type Props = { processoId: string; nomeArquivo: string }

export function DocumentosProcessoCard({ processoId, nomeArquivo }: Props) {
  const download = useMutation({
    mutationFn: async () => baixarArquivo(await baixarPdfOriginal(processoId), nomeArquivo),
  })

  return (
    <Card titulo="Documentos do processo">
      <Botao variante="secundario" disabled={download.isPending} onClick={() => download.mutate()}>
        {download.isPending ? 'Baixando PDF…' : 'Baixar PDF original'}
      </Botao>
      {download.isError ? <Alerta tipo="erro">{mensagemErro(download.error)}</Alerta> : null}
    </Card>
  )
}
