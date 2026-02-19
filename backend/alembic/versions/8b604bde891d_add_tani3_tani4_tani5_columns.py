"""Add tani3 tani4 tani5 columns

Revision ID: 8b604bde891d
Revises: 4bec85e3d165
Create Date: 2026-01-31 19:21:26.814297

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b604bde891d'
down_revision: Union[str, None] = '4bec85e3d165'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add to public.muayeneler
    op.add_column('muayeneler', sa.Column('tani3', sa.String(255), nullable=True))
    op.add_column('muayeneler', sa.Column('tani3_kodu', sa.String(50), nullable=True))
    op.add_column('muayeneler', sa.Column('tani4', sa.String(255), nullable=True))
    op.add_column('muayeneler', sa.Column('tani4_kodu', sa.String(50), nullable=True))
    op.add_column('muayeneler', sa.Column('tani5', sa.String(255), nullable=True))
    op.add_column('muayeneler', sa.Column('tani5_kodu', sa.String(50), nullable=True))
    
    # Note: These columns are already present in clinical.sharded_clinical_muayeneler 
    # via migration 4bec85e3d165. No need to add them here.


def downgrade() -> None:
    # Remove from clinical.sharded_clinical_muayeneler
    op.drop_column('sharded_clinical_muayeneler', 'tani5_kodu', schema='clinical')
    op.drop_column('sharded_clinical_muayeneler', 'tani5', schema='clinical')
    op.drop_column('sharded_clinical_muayeneler', 'tani4_kodu', schema='clinical')
    op.drop_column('sharded_clinical_muayeneler', 'tani4', schema='clinical')
    op.drop_column('sharded_clinical_muayeneler', 'tani3_kodu', schema='clinical')
    op.drop_column('sharded_clinical_muayeneler', 'tani3', schema='clinical')

    # Remove from public.muayeneler
    op.drop_column('muayeneler', 'tani5_kodu')
    op.drop_column('muayeneler', 'tani5')
    op.drop_column('muayeneler', 'tani4_kodu')
    op.drop_column('muayeneler', 'tani4')
    op.drop_column('muayeneler', 'tani3_kodu')
    op.drop_column('muayeneler', 'tani3')
