import { type ReactNode, useState } from 'react'
import { Botao } from '@/components/Botao'

type Props<T> = {
  valores: T[]
  onChange: (valores: T[]) => void
  novo: () => T
  adicionar: string
  remover: (indice: number) => string
  children: (valor: T, indice: number, atualizar: (valor: T) => void) => ReactNode
}

export function ListaChecklist<T>({ valores, onChange, novo, adicionar, remover, children }: Props<T>) {
  const [ids, setIds] = useState(() => valores.map(() => crypto.randomUUID()))
  return (
    <div className="flex flex-col gap-3">
      {valores.map((valor, i) => (
        <div key={ids[i]} className="flex flex-col gap-3 rounded border border-slate-200 p-3">
          {children(valor, i, (atualizado) => onChange(valores.map((v, n) => n === i ? atualizado : v)))}
          <div>
            <Botao variante="perigo" onClick={() => {
              setIds((atuais) => atuais.filter((_, n) => n !== i))
              onChange(valores.filter((_, n) => n !== i))
            }}>{remover(i)}</Botao>
          </div>
        </div>
      ))}
      <div>
        <Botao variante="secundario" onClick={() => {
          setIds((atuais) => [...atuais, crypto.randomUUID()])
          onChange([...valores, novo()])
        }}>{adicionar}</Botao>
      </div>
    </div>
  )
}
