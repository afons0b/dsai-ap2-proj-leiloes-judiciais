import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router'

export type EstadoEdicao = { alterado: boolean; salvando: boolean }
export type ContextoEdicao = {
  registrarEdicao: (estado: EstadoEdicao) => void
  solicitarSaida: (acao: () => void) => void
}

const SEM_EDICAO: EstadoEdicao = { alterado: false, salvando: false }

export function useProtecaoEdicao() {
  const [estado, registrarEdicao] = useState(SEM_EDICAO)
  const [acao, setAcao] = useState<(() => void) | null>(null)
  const aguardouSalvar = useRef(false)
  const bloqueio = useBlocker(({ currentLocation, nextLocation }) =>
    (estado.alterado || estado.salvando) && nextLocation.pathname !== '/login' &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  )
  useEffect(() => {
    if (bloqueio.state !== 'blocked') return
    if (estado.salvando) aguardouSalvar.current = true
    if (aguardouSalvar.current && !estado.alterado && !estado.salvando) {
      aguardouSalvar.current = false
      bloqueio.proceed()
    }
  }, [bloqueio, estado.alterado, estado.salvando])
  const solicitarSaida = useCallback((proxima: () => void) => {
    if (estado.salvando) return
    if (estado.alterado) setAcao(() => proxima)
    else proxima()
  }, [estado.alterado, estado.salvando])
  const contexto = useMemo<ContextoEdicao>(() => ({ registrarEdicao, solicitarSaida }), [solicitarSaida])

  function continuar() {
    aguardouSalvar.current = false
    setAcao(null)
    if (bloqueio.state === 'blocked') bloqueio.reset()
  }
  function descartar() {
    if (estado.salvando) return
    aguardouSalvar.current = false
    registrarEdicao(SEM_EDICAO)
    setAcao(null)
    if (bloqueio.state === 'blocked') bloqueio.proceed()
    else acao?.()
  }
  return {
    contexto, continuar, descartar,
    salvando: estado.salvando,
    confirmar: !estado.salvando && (acao !== null || bloqueio.state === 'blocked'),
    aguardando: estado.salvando && bloqueio.state === 'blocked',
    solicitarSaida,
  }
}
