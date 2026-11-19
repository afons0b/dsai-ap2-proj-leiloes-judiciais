import type { BemPenhorado, CategoriaBem } from '@/api/types'
import { Field } from '@/components/Field'
import { BooleanoChecklist, CampoChecklist, idCampoChecklist, INPUT_CHECKLIST } from './CamposChecklist'
import { CAMPOS_IMOVEL, CAMPOS_VEICULO, CATEGORIAS_BEM, temDadosImovel, temDadosVeiculo } from './dadosBem'

type Campo = readonly [Exclude<keyof BemPenhorado, 'executado_intimado' | 'categoria' | 'imovel' | 'veiculo'>, string, ('text' | 'date' | 'textarea')?]
const IDENTIFICACAO: readonly Campo[] = [
  ['descricao', 'descrição', 'textarea'], ['localizacao', 'localização'],
  ['data_penhora', 'data da penhora', 'date'], ['penhora_ref', 'referência da penhora'],
  ['fiel_depositario', 'fiel depositário'], ['propriedade', 'propriedade'],
]
const INTIMACAO: readonly Campo[] = [
  ['intimacao_forma', 'forma da intimação'],
  ['data_intimacao', 'data da intimação', 'date'], ['intimacao_ref', 'referência da intimação'],
]
const AVALIACAO: readonly Campo[] = [
  ['valor_avaliacao', 'avaliação (R$)'], ['data_avaliacao', 'data da avaliação', 'date'],
  ['oficial_avaliacao', 'oficial avaliador'], ['valor_reavaliacao', 'reavaliação (R$)'],
  ['avaliacao_ref', 'referência da avaliação'], ['oficial_reavaliacao', 'oficial da reavaliação'],
  ['reavaliacao_ref', 'referência da reavaliação'],
  ['data_reavaliacao', 'data da reavaliação', 'date'],
  ['intimacao_reavaliacao', 'intimação da reavaliação', 'textarea'],
  ['data_intimacao_reavaliacao', 'data da intimação da reavaliação', 'date'],
  ['intimacao_reavaliacao_ref', 'referência da intimação da reavaliação'],
]
const IMOBILIARIOS: readonly Campo[] = [
  ['matricula', 'matrícula'],
  ['certidao_matricula_ref', 'referência da certidão de matrícula'], ['averbacao_penhora', 'averbação da penhora'],
  ['hipoteca', 'hipoteca'], ['enfiteuse', 'enfiteuse / aforamento'],
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
      <Field label={`Bem ${indice + 1} — categoria`} htmlFor={idCampoChecklist(`${prefixo}.categoria`)}>
        <select id={idCampoChecklist(`${prefixo}.categoria`)} className={INPUT_CHECKLIST}
          aria-invalid={erros[`${prefixo}.categoria`] ? true : undefined}
          aria-describedby={erros[`${prefixo}.categoria`] ? `${idCampoChecklist(`${prefixo}.categoria`)}-erro` : undefined}
          value={bem.categoria ?? ''} onChange={(e) => {
            const categoria = e.target.value
            if (categoria === '' || Object.hasOwn(CATEGORIAS_BEM, categoria)) {
              onChange({ ...bem, categoria: categoria === '' ? null : categoria as CategoriaBem })
            }
          }}>
          <option value="">Não informado</option>
          {Object.entries(CATEGORIAS_BEM).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
        </select>
        {erros[`${prefixo}.categoria`] ? <p id={`${idCampoChecklist(`${prefixo}.categoria`)}-erro`} className="text-sm text-red-600">{erros[`${prefixo}.categoria`]}</p> : null}
      </Field>
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
      {campos([['outras_penhoras', 'outras penhoras', 'textarea']])}
      {bem.categoria == null || bem.categoria === 'imovel' || temDadosImovel(bem) ? (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-medium">{bem.categoria != null && bem.categoria !== 'imovel'
            ? 'Dados preservados de outra categoria — imóvel' : 'Dados do imóvel'}</legend>
          {campos(IMOBILIARIOS)}
          {CAMPOS_IMOVEL.map(([campo, label, tipo]) => (
            <CampoChecklist key={campo} caminho={`${prefixo}.imovel.${campo}`} label={`Bem ${indice + 1} — ${label}`}
              valor={bem.imovel?.[campo]} tipo={tipo} erro={erros[`${prefixo}.imovel.${campo}`]}
              onChange={(v) => onChange({ ...bem, imovel: { ...bem.imovel, [campo]: v } })} />
          ))}
        </fieldset>
      ) : null}
      {bem.categoria === 'veiculo' || temDadosVeiculo(bem) ? (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-medium">{bem.categoria !== 'veiculo'
            ? 'Dados preservados de outra categoria — veículo' : 'Dados do veículo'}</legend>
          {CAMPOS_VEICULO.map(([campo, label, tipo]) => (
            <CampoChecklist key={campo} caminho={`${prefixo}.veiculo.${campo}`} label={`Bem ${indice + 1} — ${label}`}
              valor={bem.veiculo?.[campo]} tipo={tipo}
              onChange={(v) => onChange({ ...bem, veiculo: { ...bem.veiculo, [campo]: v } })} />
          ))}
        </fieldset>
      ) : null}
    </>
  )
}
