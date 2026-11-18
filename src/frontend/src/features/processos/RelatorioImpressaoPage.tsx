import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { mensagemErro } from '@/api/client'
import { chavesProcessos, obterProcesso } from '@/api/processos'
import { Alerta } from '@/components/Alerta'
import { AvisoIA } from '@/components/AvisoIA'
import { Botao } from '@/components/Botao'
import { RelatorioView } from './RelatorioView'

export function RelatorioImpressaoPage() {
  const { id = '' } = useParams()
  const consulta = useQuery({
    queryKey: chavesProcessos.detalhe(id),
    queryFn: () => obterProcesso(id),
  })
  const processo = consulta.data

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <Link to={`/processos/${id}`} className="text-blue-700 hover:underline">
          Voltar ao processo
        </Link>
        {processo?.relatorio && !consulta.isError ? (
          <>
            <Botao onClick={() => window.print()}>Imprimir ou salvar em PDF</Botao>
            <p className="text-sm text-slate-600">Escolha “Salvar como PDF” no diálogo do navegador.</p>
          </>
        ) : null}
      </div>
      {consulta.isPending ? (
        <p>Carregando relatório…</p>
      ) : consulta.isError ? (
        <Alerta tipo="erro">{mensagemErro(consulta.error)}</Alerta>
      ) : processo?.relatorio ? (
        <>
          <h1 className="break-words text-xl font-semibold">{processo.nome_arquivo}</h1>
          {processo.numero_processo ? <p>Processo nº {processo.numero_processo}</p> : null}
          <AvisoIA />
          <RelatorioView relatorio={processo.relatorio} />
        </>
      ) : (
        <p>Analise o processo para gerar o relatório.</p>
      )}
    </article>
  )
}
