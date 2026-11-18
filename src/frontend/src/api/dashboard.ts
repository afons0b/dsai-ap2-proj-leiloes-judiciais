import { api } from './client'
import type { DashboardOut } from './types'

export const chavesDashboard = { resumo: ['dashboard'] as const }

export function obterDashboard(): Promise<DashboardOut> {
  return api.get<DashboardOut>('/dashboard')
}
