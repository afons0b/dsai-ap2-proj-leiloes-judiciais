from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.processos.schemas import ProcessoOut

Contagem = Annotated[int, Field(ge=0)]


class ProcessosPorStatus(BaseModel):
    recebido: Contagem
    analisando: Contagem
    analisado: Contagem
    erro: Contagem


class ProximoLeilaoOut(BaseModel):
    id: UUID
    processo_id: UUID
    nome_arquivo: str
    numero_processo: str | None
    primeiro_leilao_em: datetime
    segundo_leilao_em: datetime
    proximo_leilao_em: datetime
    etapa: Literal["primeiro", "segundo"]


class DashboardOut(BaseModel):
    referencia_em: datetime
    timezone: str
    total_processos: Contagem
    processos_por_status: ProcessosPorStatus
    total_leiloes_agendados: Contagem
    total_editais_gerados: Contagem
    total_envios_marketing_sucesso: Contagem
    processos_recentes: list[ProcessoOut] = Field(max_length=5)
    proximos_leiloes: list[ProximoLeilaoOut] = Field(max_length=5)
