from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app import mcp_server
from app.processos.models import Processo


async def cadastrar(
    session: AsyncSession,
    quantidade: int = 1,
    *,
    nome: str = "arquivo",
    numero: str | None = None,
    status: str = "recebido",
    criado_em: str = "2026-11-18T12:00:00+00:00",
    inicio_id: int = 1,
) -> list[str]:
    processos = [
        Processo(
            id=UUID(int=inicio_id + i),
            nome_arquivo=f"{nome}-{i}.pdf",
            numero_processo=numero,
            caminho_pdf="/tmp/fixture.pdf",
            status=status,
            criado_em=datetime.fromisoformat(criado_em),
        )
        for i in range(quantidade)
    ]
    session.add_all(processos)
    await session.flush()
    return [str(p.id) for p in processos]


async def test_listagem_nova_pagina_padrao_e_fora_do_intervalo(
    cliente_logado: AsyncClient, session: AsyncSession
) -> None:
    ids = await cadastrar(session, 21)
    resposta = await cliente_logado.get("/api/processos")
    assert resposta.status_code == 200
    pagina = resposta.json()
    assert pagina["total"] == 21
    assert pagina["pagina"] == 1
    assert pagina["tamanho_pagina"] == 20
    assert pagina["total_paginas"] == 2
    assert [p["id"] for p in pagina["itens"]] == ids[::-1][:20]
    segunda = (await cliente_logado.get("/api/processos?pagina=2")).json()
    assert [p["id"] for p in segunda["itens"]] == [ids[0]]
    terceira = (await cliente_logado.get("/api/processos?pagina=3")).json()
    assert terceira == {**segunda, "pagina": 3, "itens": []}
    assert set(pagina["itens"][0]) == {
        "id",
        "nome_arquivo",
        "status",
        "numero_processo",
        "vara",
        "erro",
        "criado_em",
        "analisado_em",
    }


@pytest.mark.parametrize(
    "termo", [" IMOVEL ", "numero-x", "%", "_", "\\", "/", "'", "%_\\/", "' OR 1=1 --"]
)
async def test_listagem_nova_busca_literal_nome_ou_numero(
    cliente_logado: AsyncClient, session: AsyncSession, termo: str
) -> None:
    ids = await cadastrar(session, nome="Imovel %_\\/ ' OR 1=1 --", numero="NUMERO-X")
    await cadastrar(session, nome="outro", inicio_id=2)
    dados = (await cliente_logado.get("/api/processos", params={"busca": termo})).json()
    assert dados["total"] == 1
    assert [p["id"] for p in dados["itens"]] == ids


@pytest.mark.parametrize("status", ["recebido", "analisando", "analisado", "erro"])
async def test_listagem_nova_status_isolado(
    cliente_logado: AsyncClient, session: AsyncSession, status: str
) -> None:
    ids = await cadastrar(session, status=status)
    diferente = "erro" if status != "erro" else "recebido"
    await cadastrar(session, status=diferente, inicio_id=2)
    resposta = await cliente_logado.get("/api/processos", params={"status": status})
    assert resposta.status_code == 200
    assert resposta.json()["total"] == 1
    assert [p["id"] for p in resposta.json()["itens"]] == ids


@pytest.mark.parametrize("termo", ["imóvel", "ausente"])
async def test_listagem_nova_nao_remove_acentos_e_nao_encontra_ausente(
    cliente_logado: AsyncClient, session: AsyncSession, termo: str
) -> None:
    await cadastrar(session, nome="imovel")
    dados = (await cliente_logado.get("/api/processos", params={"busca": termo})).json()
    assert dados["total"] == 0
    assert dados["total_paginas"] == 0
    assert dados["itens"] == []


@pytest.mark.parametrize("status", ["recebido", "analisando", "analisado", "erro"])
async def test_listagem_nova_combina_filtros_e_fuso_inclusivo(
    cliente_logado: AsyncClient, session: AsyncSession, status: str
) -> None:
    dentro = await cadastrar(
        session, nome="alvo", status=status, criado_em="2026-11-18T03:00:00+00:00"
    )
    dentro += await cadastrar(
        session,
        nome="alvo",
        status=status,
        inicio_id=2,
        criado_em="2026-11-19T02:59:59.999999+00:00",
    )
    await cadastrar(
        session,
        nome="alvo",
        status=status,
        inicio_id=3,
        criado_em="2026-11-18T02:59:59+00:00",
    )
    await cadastrar(
        session,
        nome="alvo",
        status=status,
        inicio_id=4,
        criado_em="2026-11-19T03:00:00+00:00",
    )
    await cadastrar(session, nome="outro", status=status, inicio_id=5)
    diferente = "erro" if status != "erro" else "recebido"
    await cadastrar(session, nome="alvo", status=diferente, inicio_id=6)
    resposta = await cliente_logado.get(
        "/api/processos",
        params={
            "busca": "ALVO",
            "status": status,
            "data_inicio": "2026-11-18",
            "data_fim": "2026-11-18",
            "ordem": "asc",
        },
    )
    assert resposta.status_code == 200
    assert [p["id"] for p in resposta.json()["itens"]] == dentro


@pytest.mark.parametrize(
    "params,total",
    [
        ({"data_inicio": "2026-11-19"}, 1),
        ({"data_fim": "2026-11-18"}, 1),
        ({"data_inicio": "2099-01-01"}, 0),
        ({"data_fim": "9999-12-31"}, 2),
        ({"busca": "  "}, 2),
    ],
)
async def test_listagem_nova_limites_abertos_e_busca_vazia(
    cliente_logado: AsyncClient, session: AsyncSession, params: dict[str, str], total: int
) -> None:
    await cadastrar(session)
    await cadastrar(session, inicio_id=2, criado_em="2026-11-19T12:00:00+00:00")
    resposta = await cliente_logado.get("/api/processos", params=params)
    assert resposta.status_code == 200
    assert resposta.json()["total"] == total


async def test_listagem_nova_ordem_e_desempate_sem_repeticao(
    cliente_logado: AsyncClient, session: AsyncSession
) -> None:
    ids = await cadastrar(session, 3)
    ids += await cadastrar(session, inicio_id=4, criado_em="2026-11-19T12:00:00+00:00")
    for ordem, esperado in [("asc", ids), ("desc", ids[::-1])]:
        encontrados = []
        for pagina in [1, 2]:
            resposta = await cliente_logado.get(
                "/api/processos",
                params={"ordem": ordem, "pagina": pagina, "tamanho_pagina": 2},
            )
            dados = resposta.json()
            encontrados.extend(p["id"] for p in dados["itens"])
            assert dados["total"] == 4
        assert encontrados == esperado


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("status", "invalido"),
        ("status", ""),
        ("ordem", "criado_em"),
        ("ordem", ""),
        ("data_inicio", "2026-02-30"),
        ("data_fim", "18/11/2026"),
        ("data_inicio", "123456"),
        ("data_fim", ""),
        ("data_inicio", ""),
        ("busca", "x" * 256),
        ("pagina", "0"),
        ("pagina", "-1"),
        ("pagina", "1.5"),
        ("pagina", "1.0"),
        ("pagina", ""),
        ("tamanho_pagina", "0"),
        ("tamanho_pagina", "101"),
        ("tamanho_pagina", "1.5"),
        ("tamanho_pagina", ""),
    ],
)
async def test_listagem_nova_validacao_local_textual(
    cliente_logado: AsyncClient, campo: str, valor: str
) -> None:
    resposta = await cliente_logado.get("/api/processos", params={campo: valor})
    assert resposta.status_code == 422
    assert resposta.json() == {"detail": f"Parâmetro {campo} inválido"}


async def test_listagem_nova_periodo_invertido_e_limites_validos(
    cliente_logado: AsyncClient
) -> None:
    resposta = await cliente_logado.get(
        "/api/processos", params={"data_inicio": "2026-11-19", "data_fim": "2026-11-18"}
    )
    assert resposta.status_code == 422
    assert resposta.json() == {"detail": "Data inicial deve ser anterior ou igual à data final"}
    for tamanho in [1, 37, 100]:
        resposta = await cliente_logado.get(
            "/api/processos", params={"tamanho_pagina": tamanho, "busca": " " + "😀" * 255 + " "}
        )
        assert resposta.status_code == 200
        assert resposta.json()["total_paginas"] == 0


async def test_listagem_nova_autorizacao_e_validacao_sem_efeito_global(
    cliente: AsyncClient, cliente_operador: AsyncClient
) -> None:
    assert (await cliente.get("/api/processos")).status_code == 401
    assert (await cliente_operador.get("/api/processos")).status_code == 200
    resposta = await cliente_operador.get("/api/processos/uuid-invalido")
    assert resposta.status_code == 422
    assert isinstance(resposta.json()["detail"], list)


async def test_listagem_nova_preserva_lista_completa_mcp(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await cadastrar(session, 25)

    @asynccontextmanager
    async def abrir_sessao() -> AsyncIterator[AsyncSession]:
        yield session

    monkeypatch.setattr(mcp_server, "abrir_sessao", abrir_sessao)
    dados = await mcp_server.listar_processos()
    assert isinstance(dados, list)
    assert len(dados) == 25
    assert await mcp_server.listar_processos(status="erro") == []
    assert all(p.criado_em.tzinfo == UTC for p in dados)
