from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.agenda.models import Leilao
from app.config import Settings
from app.editais.models import Edital
from app.marketing.models import EnvioMarketing
from app.processos.models import Processo

AGORA = datetime(2026, 11, 18, 13, tzinfo=UTC)


async def processos(session: AsyncSession, quantidade: int = 1) -> list[Processo]:
    registros = [
        Processo(
            id=UUID(int=i + 1),
            nome_arquivo=f"arquivo-{i}.pdf",
            numero_processo=None if i == 0 else f"NUM-{i}",
            caminho_pdf="/privado/fixture.pdf",
            texto_extraido="conteudo-privado",
            status=["recebido", "analisando", "analisado", "erro"][i % 4],
            criado_em=AGORA,
        )
        for i in range(quantidade)
    ]
    session.add_all(registros)
    await session.flush()
    return registros


async def leilao(
    session: AsyncSession, processo: Processo, indice: int,
    primeiro: datetime, segundo: datetime, status: str = "agendado",
) -> Leilao:
    registro = Leilao(
        id=UUID(int=100 + indice), processo_id=processo.id, status=status,
        primeiro_leilao_em=primeiro, segundo_leilao_em=segundo,
    )
    session.add(registro)
    await session.flush()
    return registro


@pytest.fixture(autouse=True)
def relogio(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.dashboard import router

    class Relogio(datetime):
        @classmethod
        def now(cls, tz: object = None) -> datetime:
            return AGORA

    monkeypatch.setattr(router, "datetime", Relogio)


async def test_dashboard_vazio_e_acesso_dos_dois_perfis(
    cliente: AsyncClient, cliente_logado: AsyncClient, cliente_operador: AsyncClient,
) -> None:
    resposta = await cliente_operador.get("/api/dashboard")
    assert resposta.status_code == 200
    dados = resposta.json()
    assert dados["processos_por_status"] == dict.fromkeys(
        ["recebido", "analisando", "analisado", "erro"], 0
    )
    for campo in [
        "total_processos", "total_leiloes_agendados", "total_editais_gerados",
        "total_envios_marketing_sucesso",
    ]:
        assert dados[campo] == 0
    assert dados["processos_recentes"] == dados["proximos_leiloes"] == []
    assert dados["timezone"] == "America/Belem"
    assert datetime.fromisoformat(dados["referencia_em"]) == AGORA
    assert (await cliente_logado.get("/api/dashboard")).status_code == 200
    cliente.cookies.clear()
    assert (await cliente.get("/api/dashboard")).status_code == 401


async def test_dashboard_total_global_e_recentes_limitados_sem_dados_privados(
    cliente_logado: AsyncClient, session: AsyncSession,
) -> None:
    registros = await processos(session, 25)
    registros[0].criado_em = AGORA + timedelta(seconds=1)
    await session.flush()
    pagina = (await cliente_logado.get("/api/processos?status=erro&tamanho_pagina=1")).json()
    assert len(pagina["itens"]) == 1
    resposta = await cliente_logado.get("/api/dashboard")
    assert resposta.status_code == 200
    dados = resposta.json()
    assert dados["total_processos"] == 25
    assert dados["processos_por_status"] == {
        "recebido": 7, "analisando": 6, "analisado": 6, "erro": 6,
    }
    assert sum(dados["processos_por_status"].values()) == dados["total_processos"]
    assert [p["id"] for p in dados["processos_recentes"]] == [
        str(registros[i].id) for i in [0, 24, 23, 22, 21]
    ]
    assert "conteudo-privado" not in resposta.text
    assert "caminho_pdf" not in resposta.text
    assert "checklist" not in resposta.text


@pytest.mark.parametrize(
    "primeiro,segundo,etapa",
    [(0, 7, "primeiro"), (-1, 0, "segundo"), (-1, 1, "segundo"), (-8, -1, None)],
)
async def test_dashboard_limites_temporais_e_status_agendado(
    cliente_logado: AsyncClient, session: AsyncSession,
    primeiro: int, segundo: int, etapa: str | None,
) -> None:
    registros = await processos(session, 2)
    ativo = await leilao(
        session, registros[0], 1, AGORA + timedelta(days=primeiro),
        AGORA + timedelta(days=segundo),
    )
    await leilao(session, registros[1], 2, AGORA, AGORA + timedelta(days=7), "cancelado")
    dados = (await cliente_logado.get("/api/dashboard")).json()
    assert dados["total_leiloes_agendados"] == 1
    if etapa is None:
        assert dados["proximos_leiloes"] == []
    else:
        proximo = dados["proximos_leiloes"]
        assert len(proximo) == 1
        assert proximo[0]["id"] == str(ativo.id)
        assert proximo[0]["processo_id"] == str(registros[0].id)
        assert proximo[0]["numero_processo"] is None
        assert proximo[0]["etapa"] == etapa
        instante = ativo.primeiro_leilao_em if etapa == "primeiro" else ativo.segundo_leilao_em
        assert datetime.fromisoformat(proximo[0]["proximo_leilao_em"]) == instante


async def test_dashboard_proximos_ordenados_por_proxima_etapa_e_uuid(
    cliente_logado: AsyncClient, session: AsyncSession,
) -> None:
    registros = await processos(session, 7)
    for i, processo in enumerate(registros):
        primeiro = AGORA - timedelta(days=1) if i == 0 else AGORA + timedelta(days=2)
        segundo = AGORA + timedelta(days=1 if i == 0 else 9)
        await leilao(session, processo, i, primeiro, segundo)
    dados = (await cliente_logado.get("/api/dashboard")).json()
    assert dados["total_leiloes_agendados"] == 7
    assert [p["id"] for p in dados["proximos_leiloes"]] == [
        str(UUID(int=100 + i)) for i in range(5)
    ]
    assert dados["proximos_leiloes"][0]["etapa"] == "segundo"


async def test_dashboard_versoes_reenvios_atualizacao_e_exclusao_em_cascata(
    cliente_logado: AsyncClient, session: AsyncSession,
) -> None:
    processo = (await processos(session))[0]
    cancelado = await leilao(session, processo, 1, AGORA, AGORA, "cancelado")
    edital = Edital(leilao_id=cancelado.id, conteudo_markdown="versao 1")
    session.add_all([
        edital, Edital(leilao_id=cancelado.id, conteudo_markdown="versao 2"),
        *[
            EnvioMarketing(
                leilao_id=cancelado.id, enviado_em=AGORA, status=status,
                destinatarios=["um@example.test", "dois@example.test"],
            )
            for status in ["enviado", "erro", "enviado"]
        ],
    ])
    await session.flush()
    dados = (await cliente_logado.get("/api/dashboard")).json()
    assert dados["total_editais_gerados"] == 2
    assert dados["total_envios_marketing_sucesso"] == 2
    edital.conteudo_markdown = "editado"
    processo.status = "analisado"
    await session.flush()
    atualizado = (await cliente_logado.get("/api/dashboard")).json()
    assert atualizado["total_editais_gerados"] == 2
    assert atualizado["processos_por_status"]["analisado"] == 1
    await session.execute(delete(Processo).where(Processo.id == processo.id))
    vazio = (await cliente_logado.get("/api/dashboard")).json()
    assert vazio["total_processos"] == vazio["total_editais_gerados"] == 0
    assert vazio["total_envios_marketing_sucesso"] == 0


async def test_dashboard_falha_usa_tratamento_existente(
    cliente_logado: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.dashboard import service

    async def falhar(*args: object, **kwargs: object) -> None:
        raise RuntimeError("detalhe-privado")

    monkeypatch.setattr(service, "obter", falhar)
    resposta = await cliente_logado.get("/api/dashboard")
    assert resposta.status_code == 500
    assert resposta.json() == {"detail": "Erro interno"}


async def test_dashboard_consultas_limitadas_sem_n_mais_um_e_timezone_configuravel(
    session: AsyncSession, engine: AsyncEngine, settings_teste: Settings,
) -> None:
    from app.dashboard import service

    registros = await processos(session, 12)
    for i, processo in enumerate(registros):
        await leilao(session, processo, i, AGORA, AGORA + timedelta(days=7))
    consultas: list[str] = []

    def observar(
        conn: Connection, cursor: object, statement: str,
        parameters: object, context: object, executemany: bool,
    ) -> None:
        consultas.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", observar)
    try:
        dados = await service.obter(
            session, settings_teste.model_copy(update={"TIMEZONE": "Asia/Tokyo"}), AGORA
        )
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", observar)
    assert dados.timezone == "Asia/Tokyo"
    assert len(dados.processos_recentes) == len(dados.proximos_leiloes) == 5
    assert len(consultas) == 3
    assert sum("LIMIT" in sql for sql in consultas) == 2
    assert all("texto_extraido" not in sql and "conteudo_markdown" not in sql for sql in consultas)
