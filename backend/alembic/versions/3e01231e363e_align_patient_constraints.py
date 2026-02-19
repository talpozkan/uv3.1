"""align_patient_constraints

Revision ID: 3e01231e363e
Revises: 6263321cc6a6
Create Date: 2026-02-01 20:41:02.086450

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e01231e363e'
down_revision: Union[str, None] = '6263321cc6a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. patient.sharded_patient_demographics refinements
    # Drop old non-unique index
    op.drop_index('ix_patient_sharded_patient_demographics_tc_kimlik', table_name='sharded_patient_demographics', schema='patient')
    # Create unique index
    op.create_index(op.f('ix_patient_sharded_patient_demographics_tc_kimlik'), 'sharded_patient_demographics', ['tc_kimlik'], unique=True, schema='patient')
    
    # Text field alignments (AC #4: KVKK & Long data support)
    op.execute('ALTER TABLE patient.sharded_patient_demographics ALTER COLUMN adres TYPE TEXT')
    op.execute('ALTER TABLE patient.sharded_patient_demographics ALTER COLUMN kimlik_notlar TYPE TEXT')
    op.execute('ALTER TABLE patient.sharded_patient_demographics ALTER COLUMN etiketler TYPE TEXT')
    
    # 2. public.hastalar alignments (ensure sync capability)
    op.execute('ALTER TABLE public.hastalar ALTER COLUMN tc_kimlik SET DATA TYPE VARCHAR(11)')
    # Ensure id stays UUID
    
def downgrade() -> None:
    op.drop_index(op.f('ix_patient_sharded_patient_demographics_tc_kimlik'), table_name='sharded_patient_demographics', schema='patient')
    op.create_index('ix_patient_sharded_patient_demographics_tc_kimlik', 'sharded_patient_demographics', ['tc_kimlik'], unique=False, schema='patient')
