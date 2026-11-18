import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { mensagemErro } from '@/api/client'
import { FILTROS_INICIAIS } from '@/api/filtrosProcessos'
import { chavesProcessos, listarProcessos } from '@/api/processos'
import type { FiltrosProcessos, ProcessoOut } from '@/api/types'
import { Alerta } from '@/components/Alerta'
import { Botao } from '@/components/Botao'
import { Field } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { useUsuario } from '@/features/auth/useUsuario'
import { formatarDataHora, ouTraco } from '@/lib/formatar'
import { ApagarProcessoDialog } from './ApagarProcessoDialog'
import { FiltrosProcessosForm, INPUT_LISTAGEM } from './FiltrosProcessosForm'
import { UploadProcesso } from './UploadProcesso'

export function ProcessosPage() {
  const { ehAdmin } = useUsuario()
  const queryClient = useQueryClient()
  const [filtros, setFiltros] = useState<FiltrosProcessos>(FILTROS_INICIAIS)
  const [apagando, setApagando] = useState<ProcessoOut | null>(null)
  const { data, isFetching, isError, error } = useQuery({
    queryKey: chavesProcessos.pagina(filtros),
    queryFn: () => listarProcessos(filtros),
  })

  useEffect(() => {
    if (!data || isFetching || isError || data.pagina !== filtros.pagina) return
    const ultima = Math.max(1, data.total_paginas)
    if (filtros.pagina > ultima) setFiltros((atual) => ({ ...atual, pagina: ultima }))
  }, [data, isFetching, isError, filtros.pagina])

  function aplicar(proximos: FiltrosProcessos) {
    setFiltros(proximos)
    void queryClient.invalidateQueries({ queryKey: chavesProcessos.pagina(proximos), exact: true })
  }

  const temFiltros = Boolean(filtros.busca || filtros.status || filtros.data_inicio || filtros.data_fim)
  const paginaValida = data && !isError && data.pagina === filtros.pagina
  const navegacaoBloqueada = isFetching || !paginaValida

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Processos</h1>
        <UploadProcesso onEnviado={() => setFiltros((atual) => ({ ...atual, pagina: 1 }))} />
      </div>
      <FiltrosProcessosForm
        onFiltrar={(campos) => aplicar({ ...filtros, ...campos, pagina: 1 })}
        onLimpar={() => aplicar({ ...FILTROS_INICIAIS })}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Ordenação" htmlFor="ordem_processos">
          <select
            id="ordem_processos"
            value={filtros.ordem}
            onChange={(e) => {
              const ordem = e.target.value
              if (ordem === 'asc' || ordem === 'desc') aplicar({ ...filtros, ordem, pagina: 1 })
            }}
            className={INPUT_LISTAGEM}
          >
            <option value="desc">Mais recentes primeiro</option>
            <option value="asc">Mais antigos primeiro</option>
          </select>
        </Field>
        <Field label="Por página" htmlFor="tamanho_pagina_processos">
          <select
            id="tamanho_pagina_processos"
            value={filtros.tamanho_pagina}
            onChange={(e) => {
              const tamanho = Number(e.target.value)
              if ([10, 20, 50, 100].includes(tamanho)) {
                aplicar({ ...filtros, tamanho_pagina: tamanho, pagina: 1 })
              }
            }}
            className={INPUT_LISTAGEM}
          >
            {[10, 20, 50, 100].map((tamanho) => (
              <option key={tamanho} value={tamanho}>
                {tamanho}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {isFetching ? <p className="text-slate-500">Carregando…</p> : null}
      {isError ? <Alerta tipo="erro">{mensagemErro(error)}</Alerta> : null}
      {paginaValida ? (
        <p role="status" className="text-sm text-slate-600">
          {data.total} {data.total === 1 ? 'processo encontrado' : 'processos encontrados'}
        </p>
      ) : null}
      {paginaValida && data.itens.length === 0 ? (
        <p className="text-slate-500">
          {temFiltros ? 'Nenhum processo encontrado.' : 'Nenhum processo enviado ainda.'}
        </p>
      ) : null}
      {paginaValida && data.itens.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Arquivo</th>
                <th className="px-3 py-2">Nº processo</th>
                <th className="px-3 py-2">Vara</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Recebido em</th>
                {ehAdmin ? <th className="px-3 py-2">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.itens.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link to={`/processos/${p.id}`} className="text-blue-700 hover:underline">
                      {p.nome_arquivo}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{ouTraco(p.numero_processo)}</td>
                  <td className="px-3 py-2">{ouTraco(p.vara)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">{formatarDataHora(p.criado_em)}</td>
                  {ehAdmin ? (
                    <td className="px-3 py-2">
                      <Botao variante="perigo" onClick={() => setApagando(p)}>
                        Apagar
                      </Botao>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div aria-live="polite">
          {paginaValida && data.itens.length > 0 ? (
            <span>
              Exibindo {(data.pagina - 1) * data.tamanho_pagina + 1}–
              {(data.pagina - 1) * data.tamanho_pagina + data.itens.length} de {data.total}
            </span>
          ) : null}
          {paginaValida && data.total_paginas > 0 ? (
            <span className="ml-3">Página {data.pagina} de {data.total_paginas}</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Botao
            variante="secundario"
            disabled={navegacaoBloqueada || filtros.pagina <= 1}
            onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina - 1 })}
          >
            Anterior
          </Botao>
          <Botao
            variante="secundario"
            disabled={navegacaoBloqueada || !data || filtros.pagina >= data.total_paginas}
            onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina + 1 })}
          >
            Próxima
          </Botao>
        </div>
      </div>
      <ApagarProcessoDialog processo={apagando} onFechar={() => setApagando(null)} />
    </div>
  )
}
