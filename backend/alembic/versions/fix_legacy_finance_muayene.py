"""fix legacy finance table

Revision ID: fix_legacy_finance_muayene
Revises: f1a2b3c4d5e6
Create Date: 2026-01-26 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_legacy_finance_muayene'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add muayene_id to hasta_finans_hareketleri
    op.add_column('hasta_finans_hareketleri', sa.Column('muayene_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_hasta_finans_hareketleri_muayene_id', 'hasta_finans_hareketleri', 'muayeneler', ['muayene_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_hasta_finans_hareketleri_muayene_id', 'hasta_finans_hareketleri', type_='foreignkey')
    op.drop_column('hasta_finans_hareketleri', 'muayene_id')
