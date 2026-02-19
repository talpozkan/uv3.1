"""add iletisim_kisi JSONB column for contact persons

Revision ID: c7a8b9d0e1f2
Revises: 3e01231e363e
Create Date: 2026-02-18 21:36:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision: str = 'c7a8b9d0e1f2'
down_revision: Union[str, None] = '3e01231e363e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'sharded_patient_demographics',
        sa.Column('iletisim_kisi', JSONB, nullable=True,
                  comment='Emergency/alt contact persons [{yakinlik, isim, telefon}]'),
        schema='patient'
    )


def downgrade() -> None:
    op.drop_column('sharded_patient_demographics', 'iletisim_kisi', schema='patient')
