import { type HttpHandler, HttpResponse, http } from 'msw'
import { agendaHandlers } from './agenda'
import { authHandlers } from './auth'
import { dashboardHandlers } from './dashboard'
import { editaisHandlers } from './editais'
import { marketingHandlers } from './marketing'
import { processosHandlers } from './processos'
import { usuariosHandlers } from './usuarios'

export const handlers: HttpHandler[] = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),
  ...authHandlers,
  ...dashboardHandlers,
  ...usuariosHandlers,
  ...processosHandlers,
  ...agendaHandlers,
  ...editaisHandlers,
  ...marketingHandlers,
]
