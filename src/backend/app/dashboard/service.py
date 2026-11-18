from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agenda.models import Leilao
from app.config import Settings
from app.dashboard.schemas import DashboardOut, ProcessosPorStatus, ProximoLeilaoOut
from app.editais.models import Edital
from app.marketing.models import EnvioMarketing
from app.processos.models import Processo
from app.processos.schemas import ProcessoOut


async def obter(session: AsyncSession, settings: Settings, referencia: datetime) -> DashboardOut:
    contadores = (
        await session.execute(
            select(
                func.count().label("total_processos"),
                *[
                    func.count().filter(Processo.status == status).label(status)
                    for status in ProcessosPorStatus.model_fields
                ],
                select(func.count())
                .select_from(Leilao)
                .where(Leilao.status == "agendado")
                .scalar_subquery()
                .label("total_leiloes_agendados"),
                select(func.count())
                .select_from(Edital)
                .scalar_subquery()
                .label("total_editais_gerados"),
                select(func.count())
                .select_from(EnvioMarketing)
                .where(EnvioMarketing.status == "enviado")
                .scalar_subquery()
                .label("total_envios_marketing_sucesso"),
            ).select_from(Processo)
        )
    ).mappings().one()
    recentes = (
        await session.execute(
            select(*[getattr(Processo, campo) for campo in ProcessoOut.model_fields])
            .order_by(Processo.criado_em.desc(), Processo.id.desc())
            .limit(5)
        )
    ).mappings().all()
    primeira_futura = Leilao.primeiro_leilao_em >= referencia
    proxima = case((primeira_futura, Leilao.primeiro_leilao_em), else_=Leilao.segundo_leilao_em)
    proximos = (
        await session.execute(
            select(
                Leilao.id,
                Leilao.processo_id,
                Processo.nome_arquivo,
                Processo.numero_processo,
                Leilao.primeiro_leilao_em,
                Leilao.segundo_leilao_em,
                proxima.label("proximo_leilao_em"),
                case((primeira_futura, "primeiro"), else_="segundo").label("etapa"),
            )
            .join(Processo, Processo.id == Leilao.processo_id)
            .where(Leilao.status == "agendado", proxima >= referencia)
            .order_by(proxima.asc(), Leilao.id.asc())
            .limit(5)
        )
    ).mappings().all()
    return DashboardOut(
        referencia_em=referencia,
        timezone=settings.TIMEZONE,
        total_processos=contadores["total_processos"],
        total_leiloes_agendados=contadores["total_leiloes_agendados"],
        total_editais_gerados=contadores["total_editais_gerados"],
        total_envios_marketing_sucesso=contadores["total_envios_marketing_sucesso"],
        processos_por_status=ProcessosPorStatus.model_validate(contadores),
        processos_recentes=[ProcessoOut.model_validate(p) for p in recentes],
        proximos_leiloes=[ProximoLeilaoOut.model_validate(l) for l in proximos],
    )
