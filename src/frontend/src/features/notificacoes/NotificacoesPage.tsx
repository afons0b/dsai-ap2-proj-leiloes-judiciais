import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { mensagemErro } from '@/api/client'
import { chavesDashboard, obterDashboard } from '@/api/dashboard'
import { chavesProcessos, listarProcessos } from '@/api/processos'
import { Alerta } from '@/components/Alerta'
import { Card } from '@/components/Card'
import { formatarDataHora } from '@/lib/formatar'

export function NotificacoesPage() {
  const filtros = {
    busca: '',
    status: 'erro',
    ordem: 'desc',
    pagina: 1,
    tamanho_pagina: 5,
  } as const
  const falhas = useQuery({
    queryKey: chavesProcessos.pagina(filtros),
    queryFn: () => listarProcessos(filtros),
  })
  const agenda = useQuery({ queryKey: chavesDashboard.resumo, queryFn: obterDashboard })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Notificações</h1>
      <Card titulo="Processos com falha na análise">
        {falhas.isPending ? <p>Consultando processos…</p> : null}
        {falhas.isError ? <Alerta tipo="erro">{mensagemErro(falhas.error)}</Alerta> : null}
        {falhas.isSuccess && falhas.data.total === 0 ? <p>Nenhuma falha na análise.</p> : null}
        {falhas.isSuccess && falhas.data.total > 0 ? (
          <>
            <p className="mb-2 text-sm text-slate-600">
              Mostrando {falhas.data.itens.length} de {falhas.data.total} processos com falha.
            </p>
            <ul className="space-y-2 text-sm">
              {falhas.data.itens.map((processo) => (
                <li key={processo.id}>
                  <Link className="text-blue-700 hover:underline" to={`/processos/${processo.id}`}>
                    {processo.nome_arquivo}
                  </Link>
                  {processo.erro ? <p>{processo.erro}</p> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
      <Card titulo="Próximos leilões">
        {agenda.isPending ? <p>Consultando agenda…</p> : null}
        {agenda.isError ? <Alerta tipo="erro">{mensagemErro(agenda.error)}</Alerta> : null}
        {agenda.isSuccess && agenda.data.proximos_leiloes.length === 0 ? (
          <p>Nenhum leilão próximo.</p>
        ) : null}
        {agenda.isSuccess && agenda.data.proximos_leiloes.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {agenda.data.proximos_leiloes.map((leilao) => (
              <li key={leilao.id}>
                <Link className="text-blue-700 hover:underline" to={`/processos/${leilao.processo_id}`}>
                  {leilao.numero_processo ?? leilao.nome_arquivo}
                </Link>
                <p>
                  {leilao.etapa === 'primeiro' ? '1º leilão' : '2º leilão'} ·{' '}
                  {formatarDataHora(leilao.proximo_leilao_em, agenda.data.timezone)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}
