"""sync finance models v2026

Revision ID: 6263321cc6a6
Revises: a6304343bee4
Create Date: 2026-02-01 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '6263321cc6a6'
down_revision = 'a6304343bee4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- finance.sharded_finance_islemler ---
    op.alter_column('sharded_finance_islemler', 'muayene_id',
               existing_type=sa.INTEGER(),
               type_=postgresql.UUID(as_uuid=True),
               existing_nullable=True,
               schema='finance',
               postgresql_using='muayene_id::text::uuid')
    
    # op.add_column('sharded_finance_islemler', sa.Column('durum', sa.String(length=20), server_default='tamamlandi', nullable=True), schema='finance')
    op.alter_column('sharded_finance_islemler', 'durum', server_default='tamamlandi', schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('kategori_id', sa.Integer(), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('kdv_orani', sa.Integer(), server_default='0', nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('kdv_tutari', sa.Numeric(precision=12, scale=2), server_default='0', nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('kasa_id', sa.Integer(), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('firma_id', sa.Integer(), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('vade_tarihi', sa.Date(), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('notlar', sa.Text(), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('belge_url', sa.Text(), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('iptal_tarihi', sa.DateTime(timezone=True), nullable=True), schema='finance')
    op.add_column('sharded_finance_islemler', sa.Column('iptal_nedeni', sa.Text(), nullable=True), schema='finance')
    
    op.create_index(op.f('ix_finance_sharded_finance_islemler_kasa_id'), 'sharded_finance_islemler', ['kasa_id'], unique=False, schema='finance')
    op.create_index(op.f('ix_finance_sharded_finance_islemler_firma_id'), 'sharded_finance_islemler', ['firma_id'], unique=False, schema='finance')
    op.create_index(op.f('ix_finance_sharded_finance_islemler_kategori_id'), 'sharded_finance_islemler', ['kategori_id'], unique=False, schema='finance')

    # --- finance.kasa_hareketleri ---
    op.add_column('kasa_hareketleri', sa.Column('odeme_id', sa.Integer(), nullable=True), schema='finance')
    op.add_column('kasa_hareketleri', sa.Column('created_by', sa.String(length=100), nullable=True), schema='finance')

    # --- finance.finans_islem_satirlari ---
    op.add_column('finans_islem_satirlari', sa.Column('hizmet_adi', sa.String(length=200), nullable=True), schema='finance')
    op.add_column('finans_islem_satirlari', sa.Column('adet', sa.Numeric(precision=10, scale=2), server_default='1', nullable=True), schema='finance')
    op.add_column('finans_islem_satirlari', sa.Column('toplam', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'), schema='finance')
    op.add_column('finans_islem_satirlari', sa.Column('doktor', sa.String(length=100), nullable=True), schema='finance')
    
    # Drop old column if exists (miktar was replaced by adet)
    # op.drop_column('finans_islem_satirlari', 'miktar', schema='finance')
    # op.drop_column('finans_islem_satirlari', 'kdv_orani', schema='finance') # moved to parent or per line?
    # op.drop_column('finans_islem_satirlari', 'toplam_tutar', schema='finance') # renamed to toplam

    # --- finance.finans_odemeler ---
    op.add_column('finans_odemeler', sa.Column('banka', sa.String(length=100), nullable=True), schema='finance')
    op.add_column('finans_odemeler', sa.Column('kapora', sa.Boolean(), server_default='false', nullable=True), schema='finance')
    op.add_column('finans_odemeler', sa.Column('notlar', sa.Text(), nullable=True), schema='finance')
    op.add_column('finans_odemeler', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True), schema='finance')

    # --- finance.finans_taksitler ---
    op.add_column('finans_taksitler', sa.Column('tahsil_tarihi', sa.Date(), nullable=True), schema='finance')

    # Standard public indexes from autogen
    op.create_index(op.f('ix_hastalar_created_at'), 'hastalar', ['created_at'], unique=False)
    op.create_index(op.f('ix_randevular_is_deleted'), 'randevular', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_randevular_status'), 'randevular', ['status'], unique=False)


def downgrade() -> None:
    pass
