from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "historico_checklist",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "processo_id",
            sa.Uuid(),
            sa.ForeignKey("processos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("acao", sa.String(20), nullable=False),
        sa.Column("usuario", sa.String(100), nullable=False),
    )
    op.create_index(
        "ix_historico_checklist_processo_data", "historico_checklist", ["processo_id", "criado_em"]
    )
    op.execute("ALTER TABLE historico_checklist ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY acesso_app ON historico_checklist "
        "FOR ALL TO leiloes_app USING (true) WITH CHECK (true)"
    )
    op.execute("REVOKE UPDATE, DELETE, TRUNCATE ON historico_checklist FROM leiloes_app")
    op.execute("GRANT SELECT, INSERT ON historico_checklist TO leiloes_app")


def downgrade() -> None:
    op.drop_table("historico_checklist")
