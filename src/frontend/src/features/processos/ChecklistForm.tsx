import { type FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router'
import type { Checklist } from '@/api/types'
import type { ContextoEdicao } from '@/app/useProtecaoEdicao'
import { Alerta } from '@/components/Alerta'
import { Botao } from '@/components/Botao'
import { Card } from '@/components/Card'
import { ConfirmarDescarte } from '@/components/ConfirmarDescarte'
import { Field } from '@/components/Field'
import { BemChecklist } from './BemChecklist'
import { BooleanoChecklist, CampoChecklist, idCampoChecklist, INPUT_CHECKLIST } from './CamposChecklist'
import { errosChecklist, novoBem, novoExecutado, valoresIguais } from './checklistEdicao'
import { ListaChecklist } from './ListaChecklist'
import { ParteChecklist } from './ParteChecklist'

type Props = {
  inicial: Checklist
  salvando: boolean
  erro: string | null
  onSalvar: (checklist: Checklist) => void
  onCancelar: () => void
}

const SECOES = ['Processo', 'Exequente', 'Executados', 'Execução', 'Bens', 'Recursos', 'Observações']

export function ChecklistForm({ inicial, salvando, erro, onSalvar, onCancelar }: Props) {
  const [original] = useState(() => structuredClone(inicial))
  const [checklist, setChecklist] = useState(() => structuredClone(inicial))
  const [confirmar, setConfirmar] = useState(false)
  const contexto = useOutletContext<ContextoEdicao | null>()
  const registrar = contexto?.registrarEdicao
  const alterado = !valoresIguais(original, checklist)
  const erros = errosChecklist(checklist)

  useEffect(() => { registrar?.({ alterado, salvando }) }, [registrar, alterado, salvando])
  useEffect(() => () => registrar?.({ alterado: false, salvando: false }), [registrar])
  useEffect(() => {
    if (!alterado && !salvando) return
    function proteger(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', proteger)
    return () => window.removeEventListener('beforeunload', proteger)
  }, [alterado, salvando])

  function atualizar(patch: Partial<Checklist>) {
    setChecklist((atual) => ({ ...atual, ...patch }))
  }
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (salvando) return
    const primeiroErro = Object.keys(erros)[0]
    if (primeiroErro) { document.getElementById(idCampoChecklist(primeiroErro))?.focus(); return }
    onSalvar(checklist)
  }
  function cancelar() {
    if (salvando) return
    if (contexto) contexto.solicitarSaida(onCancelar)
    else if (alterado) setConfirmar(true)
    else onCancelar()
  }
  return (
    <Card titulo="Editar checklist">
      <nav aria-label="Seções do checklist" className="mb-4 flex flex-wrap gap-3 text-sm text-blue-700">
        {SECOES.map((titulo, i) => <a key={titulo} href={`#checklist-secao-${i}`}>{titulo}</a>)}
      </nav>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {Object.keys(erros).length > 0 ? (
          <div>
            <Alerta tipo="erro">Corrija os campos indicados:</Alerta>
            <ul className="mt-2 list-inside list-disc text-sm text-red-700">
              {Object.entries(erros).map(([caminho, mensagem]) => (
                <li key={caminho}><a href={`#${idCampoChecklist(caminho)}`}
                  onClick={() => document.getElementById(idCampoChecklist(caminho))?.focus()}>
                  {caminho}: {mensagem}
                </a></li>
              ))}
            </ul>
          </div>
        ) : null}
        <fieldset disabled={salvando} className="flex min-w-0 flex-col gap-5">
          <fieldset id="checklist-secao-0" className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-3 font-semibold">Processo</legend>
            {(['vara', 'numero_processo', 'juiz'] as const).map((campo) => (
              <CampoChecklist key={campo} caminho={campo}
                label={campo === 'vara' ? 'Vara' : campo === 'juiz' ? 'Juiz' : 'Nº do processo'}
                valor={checklist[campo]} onChange={(v) => atualizar({ [campo]: v })} />
            ))}
            <Field label="Tipo de justiça" htmlFor={idCampoChecklist('tipo_justica')}>
              <select id={idCampoChecklist('tipo_justica')} className={INPUT_CHECKLIST}
                value={checklist.tipo_justica ?? ''} onChange={(e) => {
                  const tipo = e.target.value
                  if (tipo === '' || tipo === 'estadual' || tipo === 'federal') {
                    atualizar({ tipo_justica: tipo === '' ? null : tipo })
                  }
                }}>
                <option value="">Não informado</option><option value="estadual">Estadual</option>
                <option value="federal">Federal</option>
              </select>
            </Field>
          </fieldset>
          <fieldset id="checklist-secao-1" className="flex flex-col gap-3">
            <legend className="mb-3 font-semibold">Exequente</legend>
            <ParteChecklist parte={checklist.exequente} caminho="exequente" titulo="Exequente"
              onChange={(exequente) => atualizar({ exequente })} />
          </fieldset>
          <fieldset id="checklist-secao-2">
            <legend className="mb-3 font-semibold">Executados</legend>
            <ListaChecklist valores={checklist.executados} novo={novoExecutado}
              onChange={(executados) => atualizar({ executados })} adicionar="Adicionar executado"
              remover={(i) => `Remover executado ${i + 1}`}>
              {(executado, i, mudar) => (
                <>
                  <h3 className="font-semibold">Executado {i + 1}</h3>
                  <ParteChecklist parte={executado} caminho={`executados.${i}`} titulo={`Executado ${i + 1}`}
                    onChange={(parte) => mudar({ ...executado, ...parte })} />
                  <BooleanoChecklist caminho={`executados.${i}.citado`} label={`Executado ${i + 1} — citado`}
                    valor={executado.citado} onChange={(citado) => mudar({ ...executado, citado })} />
                  <CampoChecklist caminho={`executados.${i}.citacao_forma`} label={`Executado ${i + 1} — forma da citação`}
                    valor={executado.citacao_forma} onChange={(citacao_forma) => mudar({ ...executado, citacao_forma })} />
                  <CampoChecklist caminho={`executados.${i}.citacao_ref`} label={`Executado ${i + 1} — referência da citação`}
                    valor={executado.citacao_ref} onChange={(citacao_ref) => mudar({ ...executado, citacao_ref })} />
                </>
              )}
            </ListaChecklist>
          </fieldset>
          <fieldset id="checklist-secao-3" className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-3 font-semibold">Execução</legend>
            {([
              ['cda', 'CDA'], ['natureza_divida', 'Natureza da dívida'], ['classe', 'Classe'],
              ['valor_divida', 'Valor da dívida (R$)'], ['data_divida', 'Data da dívida'],
            ] as const).map(([campo, label]) => (
              <CampoChecklist key={campo} caminho={`execucao.${campo}`} label={label}
                tipo={campo === 'data_divida' ? 'date' : 'text'} valor={checklist.execucao[campo]}
                erro={erros[`execucao.${campo}`]}
                onChange={(v) => atualizar({ execucao: { ...checklist.execucao, [campo]: v } })} />
            ))}
          </fieldset>
          <fieldset id="checklist-secao-4">
            <legend className="mb-3 font-semibold">Bens</legend>
            <ListaChecklist valores={checklist.bens} novo={novoBem} adicionar="Adicionar bem"
              remover={(i) => `Remover bem ${i + 1}`} onChange={(bens) => atualizar({ bens })}>
              {(bem, i, mudar) => <BemChecklist bem={bem} indice={i} erros={erros} onChange={mudar} />}
            </ListaChecklist>
          </fieldset>
          <fieldset id="checklist-secao-5">
            <legend className="mb-3 font-semibold">Recursos</legend>
            <CampoChecklist caminho="recursos" label="Recursos" tipo="textarea" valor={checklist.recursos}
              onChange={(recursos) => atualizar({ recursos })} />
          </fieldset>
          <fieldset id="checklist-secao-6">
            <legend className="mb-3 font-semibold">Observações</legend>
            <ListaChecklist valores={checklist.observacoes_leilao} novo={() => ''} adicionar="Adicionar observação"
              remover={(i) => `Remover observação ${i + 1}`}
              onChange={(observacoes_leilao) => atualizar({ observacoes_leilao })}>
              {(valor, i, mudar) => <CampoChecklist caminho={`observacoes_leilao.${i}`} label={`Observação ${i + 1}`}
                tipo="textarea" valor={valor} anulavel={false} onChange={(v) => mudar(v ?? '')} />}
            </ListaChecklist>
          </fieldset>
          {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
          <div className="flex gap-2">
            <Botao type="submit">{salvando ? 'Salvando…' : 'Salvar'}</Botao>
            <Botao variante="secundario" onClick={cancelar}>Cancelar</Botao>
          </div>
        </fieldset>
      </form>
      <ConfirmarDescarte aberto={confirmar} onContinuar={() => setConfirmar(false)}
        onDescartar={() => { setConfirmar(false); onCancelar() }} />
    </Card>
  )
}
