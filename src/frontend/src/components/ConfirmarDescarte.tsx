import { useEffect, useRef } from 'react'
import { Botao } from './Botao'
import { Dialog } from './Dialog'

export function ConfirmarDescarte({ aberto, onContinuar, onDescartar }: {
  aberto: boolean; onContinuar: () => void; onDescartar: () => void
}) {
  const continuar = useRef<HTMLButtonElement>(null)
  const botoes = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement
    continuar.current?.focus()
    function teclado(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const controles = botoes.current?.querySelectorAll('button')
      const primeiro = controles?.[0]
      const ultimo = controles?.[1]
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault(); ultimo?.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primeiro?.focus()
      }
    }
    document.addEventListener('keydown', teclado)
    return () => {
      document.removeEventListener('keydown', teclado)
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus()
    }
  }, [aberto])
  return (
    <Dialog aberto={aberto} titulo="Descartar alterações não salvas?" onFechar={onContinuar}>
      <p className="mb-4 text-sm text-slate-600">As alterações do checklist ainda não foram salvas.</p>
      <div ref={botoes} className="flex flex-wrap gap-2">
        <button ref={continuar} type="button" onClick={onContinuar}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm">Continuar editando</button>
        <Botao variante="perigo" onClick={onDescartar}>Descartar alterações</Botao>
      </div>
    </Dialog>
  )
}
