import { api } from './client'
import { parametrosProcessos } from './filtrosProcessos'
import type {
  Checklist,
  FiltrosProcessos,
  Pendencia,
  ProcessoDetalheOut,
  ProcessoOut,
  ProcessosPaginaOut,
} from './types'

export const chavesProcessos = {
  lista: ['processos'] as const,
  pagina: (filtros: FiltrosProcessos) => ['processos', 'lista', filtros] as const,
  detalhe: (id: string) => ['processos', id] as const,
  pendencias: (id: string) => ['processos', id, 'pendencias'] as const,
  operacoes: (id: string) => ['processos', id, 'operacoes'] as const,
  operacao: (id: string, etapa: 'analise' | 'leilao' | 'edital' | 'marketing') =>
    ['processos', id, 'operacoes', etapa] as const,
}

export function listarProcessos(filtros: Partial<FiltrosProcessos> = {}): Promise<ProcessosPaginaOut> {
  const params = parametrosProcessos(filtros).toString()
  return api.get<ProcessosPaginaOut>(`/processos${params ? `?${params}` : ''}`)
}

export function obterProcesso(id: string): Promise<ProcessoDetalheOut> {
  return api.get<ProcessoDetalheOut>(`/processos/${id}`)
}

export function listarPendencias(id: string): Promise<Pendencia[]> {
  return api.get<Pendencia[]>(`/processos/${id}/pendencias`)
}

export function enviarProcesso(arquivo: File): Promise<ProcessoOut> {
  const form = new FormData()
  form.append('arquivo', arquivo)
  return api.post<ProcessoOut>('/processos', form)
}

export function analisarProcesso(id: string): Promise<ProcessoDetalheOut> {
  return api.post<ProcessoDetalheOut>(`/processos/${id}/analisar`)
}

export function salvarChecklist(id: string, checklist: Checklist): Promise<Checklist> {
  return api.put<Checklist>(`/processos/${id}/checklist`, checklist)
}

export function excluirProcesso(id: string): Promise<void> {
  return api.del(`/processos/${id}`)
}
