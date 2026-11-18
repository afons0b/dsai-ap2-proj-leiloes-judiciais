import type { Parte } from '@/api/types'
import { CampoChecklist } from './CamposChecklist'
import { ListaChecklist } from './ListaChecklist'

export function ParteChecklist({ parte, caminho, titulo, onChange }: {
  parte: Parte; caminho: string; titulo: string; onChange: (parte: Parte) => void
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoChecklist caminho={`${caminho}.nome`} label={`${titulo} — nome`} valor={parte.nome}
          anulavel={false} onChange={(v) => onChange({ ...parte, nome: v ?? '' })} />
        <CampoChecklist caminho={`${caminho}.cpf_cnpj`} label={`${titulo} — CPF/CNPJ`} valor={parte.cpf_cnpj}
          onChange={(v) => onChange({ ...parte, cpf_cnpj: v })} />
      </div>
      <ListaChecklist valores={parte.advogados} onChange={(advogados) => onChange({ ...parte, advogados })}
        novo={() => ({ nome: '', oab: null, ref: null })} adicionar={`Adicionar advogado — ${titulo}`}
        remover={(i) => `Remover advogado ${i + 1} — ${titulo}`}>
        {(advogado, i, atualizar) => (
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-2 font-medium">{titulo} — advogado {i + 1}</legend>
            <CampoChecklist caminho={`${caminho}.advogados.${i}.nome`} label={`${titulo} — advogado ${i + 1} — nome`}
              valor={advogado.nome} anulavel={false} onChange={(v) => atualizar({ ...advogado, nome: v ?? '' })} />
            <CampoChecklist caminho={`${caminho}.advogados.${i}.oab`} label={`${titulo} — advogado ${i + 1} — OAB`}
              valor={advogado.oab} onChange={(v) => atualizar({ ...advogado, oab: v })} />
            <CampoChecklist caminho={`${caminho}.advogados.${i}.ref`} label={`${titulo} — advogado ${i + 1} — referência`}
              valor={advogado.ref} onChange={(v) => atualizar({ ...advogado, ref: v })} />
          </fieldset>
        )}
      </ListaChecklist>
    </>
  )
}
