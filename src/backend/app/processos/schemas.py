import re
from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.agenda.schemas import LeilaoOut

_PADRAO_DINHEIRO = re.compile(r"^\d+\.\d{2}$")


def _validar_dinheiro(valor: str) -> str:
    if not _PADRAO_DINHEIRO.match(valor):
        raise ValueError("use decimal com ponto e duas casas, ex: 1234.56")
    return valor


Dinheiro = Annotated[
    str,
    AfterValidator(_validar_dinheiro),
    Field(description="Valor em reais como string decimal com ponto e duas casas, ex: 150000.00"),
]
ProcessoStatus = Literal["recebido", "analisando", "analisado", "erro"]
TipoJustica = Literal["estadual", "federal"]
CategoriaBem = Literal["imovel", "material", "veiculo"]
Gravidade = Literal["bloqueia", "atencao"]
Ref = Annotated[
    str | None,
    Field(
        default=None,
        description="Identificador do documento nos autos, ex: 'Id 1308225768' ou 'fl. 284'",
    ),
]


class FiltrosProcessos(BaseModel):
    busca: str = Field(default="", max_length=255)
    status: ProcessoStatus | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    ordem: Literal["asc", "desc"] = "desc"
    pagina: int = Field(default=1, ge=1)
    tamanho_pagina: int = Field(default=20, ge=1, le=100)

    @field_validator("busca", mode="before")
    @classmethod
    def normalizar_busca(cls, valor: str) -> str:
        return valor.strip()

    @field_validator("data_inicio", "data_fim", mode="before")
    @classmethod
    def validar_data(cls, valor: str | date | None) -> str | date | None:
        if isinstance(valor, str) and not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", valor):
            raise ValueError("data inválida")
        return valor

    @field_validator("pagina", "tamanho_pagina", mode="before")
    @classmethod
    def validar_inteiro(cls, valor: str | int) -> str | int:
        if isinstance(valor, str) and not re.fullmatch(r"[+-]?[0-9]+", valor):
            raise ValueError("inteiro inválido")
        return valor


class Advogado(BaseModel):
    nome: str
    cpf: str | None = None
    oab: str | None = None
    ref: Ref


class Parte(BaseModel):
    nome: str
    cpf_cnpj: str | None = None
    representacao: str | None = None
    procuracao_ref: Ref
    advogados: list[Advogado] = Field(default_factory=list)


class Executado(Parte):
    citado: bool | None = None
    citacao_forma: str | None = None
    citacao_ref: Ref


class Execucao(BaseModel):
    cda: str | None = None
    titulo_executivo: str | None = None
    valor_divida_ref: Ref
    natureza_divida: str | None = None
    classe: str | None = None
    valor_divida: Dinheiro | None = None
    data_divida: date | None = None


class DadosImovel(BaseModel):
    intimacao_conjuge: str | None = None
    data_averbacao_penhora: date | None = None


class DadosVeiculo(BaseModel):
    marca_modelo: str | None = None
    placa: str | None = None
    cor: str | None = None
    ano: str | None = None
    modelo: str | None = None
    chassi: str | None = None
    renavam: str | None = None
    proprietario_detran: str | None = None
    intimacao_detran: str | None = None
    credor_fiduciario: str | None = None
    multas_debitos: str | None = None


class BemPenhorado(BaseModel):
    descricao: str
    categoria: CategoriaBem | None = None
    imovel: DadosImovel | None = None
    veiculo: DadosVeiculo | None = None
    matricula: str | None = None
    localizacao: str | None = None
    data_penhora: date | None = None
    penhora_ref: Ref
    fiel_depositario: str | None = None
    executado_intimado: bool | None = None
    data_intimacao: date | None = None
    intimacao_ref: Ref
    intimacao_forma: str | None = None
    propriedade: str | None = None
    valor_avaliacao: Dinheiro | None = None
    data_avaliacao: date | None = None
    oficial_avaliacao: str | None = None
    avaliacao_ref: Ref
    valor_reavaliacao: Dinheiro | None = None
    data_reavaliacao: date | None = None
    oficial_reavaliacao: str | None = None
    reavaliacao_ref: Ref
    intimacao_reavaliacao: str | None = None
    data_intimacao_reavaliacao: date | None = None
    intimacao_reavaliacao_ref: Ref
    certidao_matricula_ref: Ref
    averbacao_penhora: str | None = None
    hipoteca: str | None = None
    enfiteuse: str | None = None
    outras_penhoras: str | None = None


class Checklist(BaseModel):
    vara: str | None = None
    numero_processo: str | None = None
    juiz: str | None = None
    tipo_justica: TipoJustica | None = None
    exequente: Parte
    executados: list[Executado] = Field(default_factory=list)
    execucao: Execucao = Field(default_factory=Execucao)
    bens: list[BemPenhorado] = Field(default_factory=list)
    recursos: str | None = None
    observacoes_leilao: list[str] = Field(default_factory=list)


class Etapa(BaseModel):
    data: date | None = None
    descricao: str
    ref: Ref


class Relatorio(BaseModel):
    resumo: str
    etapas: list[Etapa] = Field(default_factory=list)


AcaoChecklist = Literal["analise", "reanalise", "edicao", "aprovacao"]


class EventoChecklistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    acao: AcaoChecklist
    usuario: str
    criado_em: datetime


class AprovarChecklistIn(BaseModel):
    revisao: UUID


class AprovacaoChecklistOut(BaseModel):
    revisao: UUID | None
    aprovado_por: str | None = None
    aprovado_em: datetime | None = None


class Pendencia(BaseModel):
    gravidade: Gravidade
    campo: str
    mensagem: str
    ref: str | None = None


class ProcessoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome_arquivo: str
    status: ProcessoStatus
    numero_processo: str | None
    vara: str | None
    erro: str | None
    criado_em: datetime
    analisado_em: datetime | None


class ProcessoDetalheOut(ProcessoOut):
    checklist: Checklist | None
    relatorio: Relatorio | None
    leilao: LeilaoOut | None = None


class ProcessoDetalheHttpOut(ProcessoDetalheOut):
    aprovacao_checklist: AprovacaoChecklistOut


class ProcessosPaginaOut(BaseModel):
    itens: list[ProcessoOut]
    total: int
    pagina: int
    tamanho_pagina: int
    total_paginas: int
