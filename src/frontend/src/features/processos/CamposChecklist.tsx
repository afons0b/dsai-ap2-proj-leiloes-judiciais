import type { ChangeEvent } from 'react'
import { Field } from '@/components/Field'
import { normalizarVazio } from './validacao'

export const INPUT_CHECKLIST = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm'
export const idCampoChecklist = (caminho: string) => `checklist-${caminho}`

type Props = {
  caminho: string
  label: string
  valor: string | null
  onChange: (valor: string | null) => void
  erro?: string
  tipo?: 'text' | 'date' | 'textarea'
  anulavel?: boolean
}

export function CampoChecklist({ caminho, label, valor, onChange, erro, tipo = 'text', anulavel = true }: Props) {
  const id = idCampoChecklist(caminho)
  const props = {
    id, value: valor ?? '', className: INPUT_CHECKLIST,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': erro ? `${id}-erro` : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const texto = e.target.value
      onChange(anulavel && normalizarVazio(texto) === null ? null : texto)
    },
  }
  return (
    <Field label={label} htmlFor={id}>
      {tipo === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={tipo} />}
      {erro ? <p id={`${id}-erro`} className="text-sm text-red-600">{erro}</p> : null}
    </Field>
  )
}

export function BooleanoChecklist({ caminho, label, valor, onChange }: {
  caminho: string; label: string; valor: boolean | null; onChange: (valor: boolean | null) => void
}) {
  const id = idCampoChecklist(caminho)
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} value={valor === null ? '' : String(valor)} className={INPUT_CHECKLIST}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
        <option value="">Não informado</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    </Field>
  )
}
