import type { BemPenhorado } from '@/api/types'
import { BooleanoChecklist, CampoChecklist } from './CamposChecklist'

type Campo = readonly [Exclude<keyof BemPenhorado, 'executado_intimado'>, string, ('text' | 'date' | 'textarea')?]
const IDENTIFICACAO: readonly Campo[] = [
  ['descricao', 'descrição', 'textarea'], ['matricula', 'matrícula'], ['localizacao', 'localização'],
  ['data_penhora', 'data da penhora', 'date'], ['penhora_ref', 'referência da penhora'],
  ['fiel_depositario', 'fiel depositário'], ['propriedade', 'propriedade'],
]
const INTIMACAO: readonly Campo[] = [
  ['data_intimacao', 'data da intimação', 'date'], ['intimacao_ref', 'referência da intimação'],
]
const AVALIACAO: readonly Campo[] = [
  ['valor_avaliacao', 'avaliação (R$)'], ['data_avaliacao', 'data da avaliação', 'date'],
  ['oficial_avaliacao', 'oficial avaliador'], ['valor_reavaliacao', 'reavaliação (R$)'],
  ['data_reavaliacao', 'data da reavaliação', 'date'],
]
const ONUS: readonly Campo[] = [
  ['certidao_matricula_ref', 'referência da certidão de matrícula'], ['averbacao_penhora', 'averbação da penhora'],
  ['hipoteca', 'hipoteca'], ['enfiteuse', 'enfiteuse / aforamento'], ['outras_penhoras', 'outras penhoras'],
]

export function BemChecklist({ bem, indice, erros, onChange }: {
  bem: BemPenhorado; indice: number; erros: Record<string, string>; onChange: (bem: BemPenhorado) => void
}) {
  const prefixo = `bens.${indice}`
  const campos = (lista: readonly Campo[]) => lista.map(([campo, label, tipo]) => (
    <CampoChecklist key={campo} caminho={`${prefixo}.${campo}`} label={`Bem ${indice + 1} — ${label}`}
      valor={bem[campo]} tipo={tipo} erro={erros[`${prefixo}.${campo}`]} anulavel={campo !== 'descricao'}
      onChange={(v) => onChange({ ...bem, [campo]: campo === 'descricao' ? v ?? '' : v })} />
  ))
  return (
    <>
      <h3 className="font-semibold">Bem {indice + 1}</h3>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Identificação e penhora</legend>{campos(IDENTIFICACAO)}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Intimação</legend>
        <BooleanoChecklist caminho={`${prefixo}.executado_intimado`} label={`Bem ${indice + 1} — executado intimado`}
          valor={bem.executado_intimado} onChange={(v) => onChange({ ...bem, executado_intimado: v })} />
        {campos(INTIMACAO)}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Avaliação</legend>{campos(AVALIACAO)}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Referências e ônus</legend>{campos(ONUS)}
      </fieldset>
    </>
  )
}
