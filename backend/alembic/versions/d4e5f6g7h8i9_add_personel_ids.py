"""add_personel_ids_to_sharded_demographics

Revision ID: d4e5f6g7h8i9
Revises: c7a8b9d0e1f2
Create Date: 2026-02-19 11:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, None] = 'c7a8b9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use if_not_exists logic if possible, or just catch error
    op.add_column(
        'sharded_patient_demographics',
        sa.Column('personel_ids', sa.String(length=255), nullable=True),
        schema='patient'
    )


def downgrade() -> None:
    op.drop_column('sharded_patient_demographics', 'personel_ids', schema='patient')
