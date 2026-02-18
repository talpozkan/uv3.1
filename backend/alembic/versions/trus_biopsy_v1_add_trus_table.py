"""add trus biopsy table

Revision ID: trus_biopsy_v1
Revises: fix_legacy_finance_muayene
Create Date: 2026-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'trus_biopsy_v1'
down_revision: Union[str, None] = 'fix_legacy_finance_muayene'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trus_biyopsileri',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hasta_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tarih', sa.Date(), nullable=True),
        sa.Column('psa_total', sa.String(), nullable=True),
        sa.Column('rektal_tuse', sa.Text(), nullable=True),
        sa.Column('mri_var', sa.Boolean(), default=False),
        sa.Column('mri_tarih', sa.Date(), nullable=True),
        sa.Column('mri_ozet', sa.Text(), nullable=True),
        sa.Column('lokasyonlar', sa.Text(), nullable=True),
        sa.Column('prosedur_notu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['hasta_id'], ['hastalar.id'], ondelete='CASCADE')
    )
    op.create_index('ix_trus_biyopsileri_id', 'trus_biyopsileri', ['id'])
    op.create_index('ix_trus_biyopsileri_hasta_id', 'trus_biyopsileri', ['hasta_id'])
    op.create_index('ix_trus_biyopsileri_tarih', 'trus_biyopsileri', ['tarih'])


def downgrade() -> None:
    op.drop_table('trus_biyopsileri')
