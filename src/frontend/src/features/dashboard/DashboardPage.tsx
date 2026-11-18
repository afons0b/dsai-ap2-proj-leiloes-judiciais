import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { mensagemErro } from '@/api/client'
import { chavesDashboard, obterDashboard } from '@/api/dashboard'
import { Alerta } from '@/components/Alerta'
import { Botao } from '@/components/Botao'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { baixarArquivo } from '@/lib/baixarArquivo'
import { formatarDataHora, ouTraco } from '@/lib/formatar'
import { DistribuicaoProcessos } from './DistribuicaoProcessos'
import { csvDashboard, indicadoresDashboard } from './indicadoresDashboard'

export function DashboardPage() {
  const consulta = useQuery({
    queryKey: chavesDashboard.resumo,
    queryFn: obterDashboard,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const dados = consulta.data

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {dados && !consulta.isError ? (
          <Botao
            variante="secundario"
            onClick={() =>
              baixarArquivo(
                new Blob([csvDashboard(dados)], { type: 'text/csv;charset=utf-8' }),
                `indicadores-${dados.referencia_em.slice(0, 10)}.csv`,
              )
            }
          >
            Exportar indicadores em CSV
          </Botao>
        ) : null}
      </div>
      {consulta.isFetching ? <p className="text-slate-500">Carregando dashboard…</p> : null}
      {consulta.isError ? <Alerta tipo="erro">{mensagemErro(consulta.error)}</Alerta> : null}
      {dados && !consulta.isError ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {indicadoresDashboard(dados).map(([titulo, valor]) => (
              <Card key={titulo} titulo={titulo}>
                <p className="text-3xl font-semibold text-blue-700">{valor}</p>
              </Card>
            ))}
          </div>
          <DistribuicaoProcessos contagem={dados.processos_por_status} />
          <Card titulo="Processos recentes">
            {dados.processos_recentes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum processo cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Arquivo</th>
                      <th className="px-3 py-2">Nº processo</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Cadastrado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.processos_recentes.map((processo) => (
                      <tr key={processo.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link
                            to={`/processos/${processo.id}`}
                            className="text-blue-700 hover:underline"
                          >
                            {processo.nome_arquivo}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{ouTraco(processo.numero_processo)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={processo.status} />
                        </td>
                        <td className="px-3 py-2">
                          {formatarDataHora(processo.criado_em, dados.timezone)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card titulo="Próximos leilões">
            {dados.proximos_leiloes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum leilão próximo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Processo</th>
                      <th className="px-3 py-2">Próxima etapa</th>
                      <th className="px-3 py-2">Data e hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.proximos_leiloes.map((leilao) => (
                      <tr key={leilao.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link
                            to={`/processos/${leilao.processo_id}`}
                            className="text-blue-700 hover:underline"
                          >
                            {leilao.numero_processo ?? leilao.nome_arquivo}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {leilao.etapa === 'primeiro' ? '1º leilão' : '2º leilão'}
                        </td>
                        <td className="px-3 py-2">
                          {formatarDataHora(leilao.proximo_leilao_em, dados.timezone)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
