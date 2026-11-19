from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from app.config import Settings
from app.db import Base
from app.editais.service import total_avaliacao
from app.llm.fake import FakeLLMClient
from app.processos import service
from app.processos.models import ChecklistDB, EventoChecklistDB, Processo
from app.processos.prompts import SYSTEM_CHECKLIST
from app.processos.schemas import BemPenhorado, Checklist, DadosImovel, DadosVeiculo


@pytest.fixture(scope="session")
async def engine(settings_teste: Settings) -> AsyncIterator[AsyncEngine]:
    url = make_url(settings_teste.DATABASE_URL)
    assert url.database is not None and url.database.endswith("_test")
    assert url.host in {"postgres", "localhost", "127.0.0.1"}
    schema = f"ap2_especializados_{uuid4().hex}"
    eng = create_async_engine(
        url, connect_args={"server_settings": {"search_path": schema}}
    )
    async with eng.begin() as conn:
        await conn.execute(CreateSchema(schema))
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield eng
    finally:
        async with eng.begin() as conn:
            await conn.execute(DropSchema(schema, cascade=True))
        await eng.dispose()


def misto() -> Checklist:
    return Checklist(
        exequente={"nome": "Parte Exemplo", "advogados": [{"nome": "Advogado Exemplo", "cpf": "00000000001"}]},
        bens=[
            BemPenhorado(descricao="Terreno sintético", categoria="imovel", imovel=DadosImovel(intimacao_conjuge="Não informado nos autos"), valor_avaliacao="100.00"),
            BemPenhorado(descricao="Cadeira sintética", categoria="material", valor_avaliacao="20.00"),
            BemPenhorado(descricao="Veículo sintético RENAVAN 00012345678", categoria="veiculo", veiculo=DadosVeiculo(renavam="00012345678", multas_debitos="Não há débitos informados"), valor_avaliacao="30.00"),
            BemPenhorado(descricao="Bem não classificado"),
        ],
    )


def test_misto_preserva_identificadores_e_desconhecidos() -> None:
    checklist = misto()
    confirmado = Checklist.model_validate_json(checklist.model_dump_json())
    assert [b.categoria for b in confirmado.bens] == ["imovel", "material", "veiculo", None]
    assert confirmado.bens[2].veiculo.renavam == "00012345678"
    assert confirmado.exequente.advogados[0].cpf == "00000000001"
    assert confirmado.bens[2].veiculo.multas_debitos == "Não há débitos informados"
    assert confirmado.bens[3].veiculo is None
    assert total_avaliacao(confirmado.bens) == Decimal("150.00")


@pytest.mark.parametrize("bloco", [{}, {"cpf": None}, {"cpf": "00000000001"}])
def test_cpf_opcional_nao_altera_documento_da_parte(bloco: dict[str, str | None]) -> None:
    checklist = Checklist(exequente={"nome": "Parte", "cpf_cnpj": "DOC-SINTETICO", "advogados": [{"nome": "Advogado", **bloco}]})
    assert checklist.exequente.cpf_cnpj == "DOC-SINTETICO"
    assert checklist.exequente.advogados[0].cpf == bloco.get("cpf")


@pytest.mark.parametrize("bloco", [{}, {"renavam": None}, {"renavam": "00012345678"}])
def test_renavam_opcional(bloco: dict[str, str | None]) -> None:
    assert DadosVeiculo.model_validate(bloco).renavam == bloco.get("renavam")


@pytest.mark.parametrize("dados", [
    {"categoria": "outro"},
    {"data_intimacao_reavaliacao": "2026-02-30"},
    {"imovel": {"data_averbacao_penhora": "2026-02-30"}},
    {"veiculo": {"renavam": 123}},
])
def test_rejeita_tipos_categoria_e_datas_invalidos(dados: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        BemPenhorado.model_validate({"descricao": "Sintético", **dados})


def test_legado_nao_exige_classificacao_nem_campos_novos() -> None:
    dados = {"exequente": {"nome": "Parte", "advogados": [{"nome": "Advogado"}]}, "bens": [{"descricao": "Bem legado", "matricula": "MAT-SINTETICA"}]}
    checklist = Checklist.model_validate(dados)
    assert checklist.bens[0].categoria is None
    assert checklist.bens[0].matricula == "MAT-SINTETICA"
    assert checklist.exequente.advogados[0].cpf is None


async def test_fake_retorna_misto_sintetico_sem_inferencias() -> None:
    checklist = await FakeLLMClient().structured(system=SYSTEM_CHECKLIST, user="Texto sintético", schema=Checklist)
    assert {b.categoria for b in checklist.bens} == {"imovel", "material", "veiculo"}
    assert any(b.veiculo and b.veiculo.renavam.startswith("00") for b in checklist.bens)


async def test_http_preserva_legado_aprovacao_historico_e_campos_especializados(
    cliente_operador: AsyncClient, session: AsyncSession
) -> None:
    legado = {"exequente": {"nome": "Parte Exemplo"}, "bens": [{"descricao": "Bem legado", "matricula": "MAT-EXEMPLO"}]}
    processo = Processo(nome_arquivo="sintetico.pdf", caminho_pdf="sintetico.pdf", status="analisado", relatorio=None, checklist=None)
    processo.checklist = ChecklistDB(dados=legado, revisao=uuid4())
    session.add(processo)
    await session.commit()
    url = f"/api/processos/{processo.id}"
    resposta = await cliente_operador.get(url)
    assert resposta.status_code == 200, resposta.text
    detalhe = resposta.json()
    revisao = detalhe["aprovacao_checklist"]["revisao"]
    assert detalhe["checklist"]["bens"][0]["categoria"] is None
    aprovado = await cliente_operador.post(f"{url}/checklist/aprovacao", json={"revisao": revisao})
    assert aprovado.status_code == 200
    await cliente_operador.get(url)
    await session.refresh(processo.checklist)
    assert processo.checklist.dados == legado
    assert (await cliente_operador.get(url)).json()["aprovacao_checklist"]["aprovado_em"]
    resposta = await cliente_operador.put(f"{url}/checklist", json=misto().model_dump(mode="json"))
    assert resposta.status_code == 200
    assert resposta.json()["bens"][2]["veiculo"]["renavam"] == "00012345678"
    atual = (await cliente_operador.get(url)).json()
    assert atual["aprovacao_checklist"]["aprovado_em"] is None
    assert (await cliente_operador.post(f"{url}/checklist/aprovacao", json={"revisao": revisao})).status_code == 409
    eventos = (await cliente_operador.get(f"{url}/checklist/historico")).json()
    assert [e["acao"] for e in eventos] == ["edicao", "aprovacao"]
    assert all(e["usuario"] == "operador" for e in eventos)
    antes = atual["checklist"]
    antes["bens"][2]["categoria"] = "material"
    resposta = await cliente_operador.put(f"{url}/checklist", json=antes)
    assert resposta.json()["bens"][2]["veiculo"]["renavam"] == "00012345678"
    invalido = {**antes, "bens": [{"descricao": "Teste", "categoria": "invalida"}]}
    assert (await cliente_operador.put(f"{url}/checklist", json=invalido)).status_code == 422
    assert len((await cliente_operador.get(f"{url}/checklist/historico")).json()) == 3
    assert await session.scalar(select(func.count()).select_from(EventoChecklistDB)) == 3


async def test_mcp_e_analise_preservam_regras_e_revisoes(
    session: AsyncSession, settings_teste: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app import mcp_server
    from tests.fixtures import make_pdf

    @asynccontextmanager
    async def abrir_sessao() -> AsyncIterator[AsyncSession]:
        yield session

    monkeypatch.setattr(mcp_server, "abrir_sessao", abrir_sessao)

    processo = await service.salvar_upload(session, settings_teste, "sintetico.pdf", "application/pdf", make_pdf("Processo sintético com bens para demonstração."))
    await service.analisar(session, settings_teste, FakeLLMClient(), processo.id, usuario="operador")
    revisao = service.aprovacao_de(processo).revisao
    assert revisao is not None
    await service.aprovar_checklist(session, processo.id, revisao, "operador")
    caderno = await mcp_server.obter_caderno(processo.id)
    assert {b.categoria for b in caderno.checklist.bens} == {"imovel", "material", "veiculo"}
    await service.analisar(session, settings_teste, FakeLLMClient(), processo.id, usuario="operador")
    assert service.aprovacao_de(processo).aprovado_em is None
    assert service.aprovacao_de(processo).revisao != revisao
    assert [e.acao for e in await service.historico_checklist(session, processo.id)] == ["reanalise", "aprovacao", "analise"]


async def test_consumidores_existentes_aceitam_misto_sem_matricula(
    session: AsyncSession, settings_teste: Settings
) -> None:
    from io import BytesIO

    from openpyxl import load_workbook

    from app.agenda import service as agenda_service
    from app.agenda.schemas import LeilaoCreate
    from app.editais.service import renderizar_edital
    from app.marketing.service import gerar_planilha

    processo = Processo(nome_arquivo="sintetico.pdf", caminho_pdf="sintetico.pdf", status="analisado", relatorio=None, checklist=None)
    session.add(processo)
    await session.commit()
    await service.editar_checklist(session, processo.id, misto(), "operador")
    hoje = agenda_service.hoje_local(settings_teste)
    leilao = await agenda_service.criar_leilao(session, settings_teste, LeilaoCreate(processo_id=processo.id), hoje)
    edital = renderizar_edital(misto(), leilao, settings_teste, hoje)
    assert "Cadeira sintética" in edital and "Veículo sintético" in edital
    planilha = load_workbook(BytesIO(await gerar_planilha(session, settings_teste)))
    assert planilha.active.max_row == 5
