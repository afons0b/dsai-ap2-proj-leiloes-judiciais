import type { BloqueioOut, FeriadoOut, LeilaoOut } from '@/api/types'
import { dataLocal, diasDoMes } from '@/lib/datas'
import { formatarData } from '@/lib/formatar'

type Props = {
  mes: Date
  leiloes: LeilaoOut[]
  bloqueios: BloqueioOut[]
  feriados: FeriadoOut[]
  diaSelecionado: string | null
  onSelecionarDia: (dia: string) => void
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Marcas = { rotulos: string[]; classe: string }
type Celula = { chave: string; dia: Date | null }
type Semana = { chave: string; celulas: Celula[] }

function contarLeiloesPorDia(leiloes: LeilaoOut[]): Map<string, number> {
  const porDia = new Map<string, number>()
  for (const l of leiloes) {
    if (l.status !== 'agendado') continue
    for (const iso of [l.primeiro_leilao_em, l.segundo_leilao_em]) {
      const chave = dataLocal(new Date(iso))
      porDia.set(chave, (porDia.get(chave) ?? 0) + 1)
    }
  }
  return porDia
}

function marcasDoDia(
  dia: Date,
  leiloesPorDia: Map<string, number>,
  bloqueios: BloqueioOut[],
  feriados: FeriadoOut[],
): Marcas {
  const chave = dataLocal(dia)
  const rotulos: string[] = []
  let classe = 'bg-white'
  if (dia.getDay() === 0 || dia.getDay() === 6) {
    rotulos.push('Fim de semana')
    classe = 'bg-slate-100 text-slate-400'
  }
  const feriado = feriados.find((f) => f.data === chave)
  if (feriado) {
    rotulos.push(`Feriado: ${feriado.motivo}`)
    classe = 'bg-rose-50 text-rose-800'
  }
  const bloqueio = bloqueios.find((b) => b.data === chave)
  if (bloqueio) {
    rotulos.push(`Bloqueio: ${bloqueio.motivo}`)
    classe = 'bg-amber-50 text-amber-900'
  }
  const quantidade = leiloesPorDia.get(chave) ?? 0
  if (quantidade > 0) {
    rotulos.push(`Leilão (${quantidade})`)
    classe = 'bg-blue-100 font-semibold text-blue-900'
  }
  return { rotulos, classe }
}

function montarSemanas(mes: Date): Semana[] {
  const dias = diasDoMes(mes)
  const vaziosIniciais = dias[0]?.getDay() ?? 0
  const celulas: Celula[] = []
  for (let i = 0; i < vaziosIniciais; i++) celulas.push({ chave: `vazio-inicio-${i}`, dia: null })
  for (const dia of dias) celulas.push({ chave: dataLocal(dia), dia })
  let vaziosFinais = 0
  while (celulas.length % 7 !== 0) {
    celulas.push({ chave: `vazio-fim-${vaziosFinais}`, dia: null })
    vaziosFinais += 1
  }
  const semanas: Semana[] = []
  for (let i = 0; i < celulas.length; i += 7) {
    const fatia = celulas.slice(i, i + 7)
    semanas.push({ chave: fatia[0]?.chave ?? `semana-${i}`, celulas: fatia })
  }
  return semanas
}

type DiaProps = { dia: Date; marcas: Marcas; selecionado: boolean; onSelecionar: () => void }

function Dia({ dia, marcas, selecionado, onSelecionar }: DiaProps) {
  const data = formatarData(dataLocal(dia))
  const resumo = marcas.rotulos.join('; ')
  const rotulo = resumo === '' ? data : `${data} — ${resumo}`
  return (
    <td
      aria-label={rotulo}
      title={resumo}
      className={`h-12 border border-slate-200 align-top ${marcas.classe}`}
    >
      <button
        type="button"
        aria-label={`Selecionar ${rotulo}`}
        aria-pressed={selecionado}
        className="h-12 w-full p-1 text-left align-top hover:bg-blue-50 aria-pressed:bg-blue-200"
        onClick={onSelecionar}
      >
        {dia.getDate()}
      </button>
    </td>
  )
}

export function Calendario({
  mes,
  leiloes,
  bloqueios,
  feriados,
  diaSelecionado,
  onSelecionarDia,
}: Props) {
  const leiloesPorDia = contarLeiloesPorDia(leiloes)
  const semanas = montarSemanas(mes)

  return (
    <table className="w-full table-fixed border-collapse text-xs" aria-label="Calendário do mês">
      <thead>
        <tr>
          {DIAS_SEMANA.map((d) => (
            <th key={d} className="py-1 text-slate-500">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {semanas.map((semana) => (
          <tr key={semana.chave}>
            {semana.celulas.map((celula) =>
              celula.dia ? (
                <Dia
                  key={celula.chave}
                  dia={celula.dia}
                  selecionado={celula.chave === diaSelecionado}
                  onSelecionar={() => onSelecionarDia(celula.chave)}
                  marcas={marcasDoDia(celula.dia, leiloesPorDia, bloqueios, feriados)}
                />
              ) : (
                <td key={celula.chave} className="h-12 border border-slate-100 bg-slate-50" />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
