from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("checklists", sa.Column("revisao", sa.Uuid()))
    op.add_column("checklists", sa.Column("revisao_aprovada", sa.Uuid()))
    op.add_column("checklists", sa.Column("aprovado_por", sa.Text()))
    op.add_column("checklists", sa.Column("aprovado_em", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("checklists", "aprovado_em")
    op.drop_column("checklists", "aprovado_por")
    op.drop_column("checklists", "revisao_aprovada")
    op.drop_column("checklists", "revisao")
