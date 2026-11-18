import { type FormEvent, useState } from 'react'
import { lerFiltrosProcessos } from '@/api/filtrosProcessos'
import type { FiltrosProcessos } from '@/api/types'
import { Alerta } from '@/components/Alerta'
import { Botao } from '@/components/Botao'
import { Field } from '@/components/Field'

export const INPUT_LISTAGEM = 'rounded border border-slate-300 px-2 py-1.5 text-sm'

type Props = {
  onFiltrar: (filtros: Pick<FiltrosProcessos, 'busca' | 'status' | 'data_inicio' | 'data_fim'>) => void
  onLimpar: () => void
}

const VAZIOS = { busca: '', status: '', data_inicio: '', data_fim: '' }

export function FiltrosProcessosForm({ onFiltrar, onLimpar }: Props) {
  const [campos, setCampos] = useState(VAZIOS)
  const [erro, setErro] = useState<string | null>(null)

  function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const params = new URLSearchParams()
      for (const [campo, valor] of Object.entries(campos)) {
        if (valor) params.set(campo, valor)
      }
      const { busca, status, data_inicio, data_fim } = lerFiltrosProcessos(params)
      setErro(null)
      onFiltrar({ busca, status, data_inicio, data_fim })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Filtros inválidos')
    }
  }

  return (
    <form
      onSubmit={aplicar}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Pesquisar por arquivo ou número" htmlFor="busca_processos">
          <input
            id="busca_processos"
            value={campos.busca}
            onChange={(e) => setCampos({ ...campos, busca: e.target.value })}
            className={INPUT_LISTAGEM}
          />
        </Field>
        <Field label="Status do processo" htmlFor="status_processos">
          <select
            id="status_processos"
            value={campos.status}
            onChange={(e) => setCampos({ ...campos, status: e.target.value })}
            className={INPUT_LISTAGEM}
          >
            <option value="">Todos</option>
            <option value="recebido">Recebido</option>
            <option value="analisando">Analisando</option>
            <option value="analisado">Analisado</option>
            <option value="erro">Erro</option>
          </select>
        </Field>
        <Field label="Cadastrado de" htmlFor="cadastro_inicio">
          <input
            id="cadastro_inicio"
            type="date"
            value={campos.data_inicio}
            onChange={(e) => setCampos({ ...campos, data_inicio: e.target.value })}
            className={INPUT_LISTAGEM}
          />
        </Field>
        <Field label="Até" htmlFor="cadastro_fim">
          <input
            id="cadastro_fim"
            type="date"
            value={campos.data_fim}
            onChange={(e) => setCampos({ ...campos, data_fim: e.target.value })}
            className={INPUT_LISTAGEM}
          />
        </Field>
      </div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <div className="flex gap-2">
        <Botao type="submit">Filtrar</Botao>
        <Botao
          variante="secundario"
          onClick={() => {
            setCampos(VAZIOS)
            setErro(null)
            onLimpar()
          }}
        >
          Limpar filtros
        </Botao>
      </div>
    </form>
  )
}
