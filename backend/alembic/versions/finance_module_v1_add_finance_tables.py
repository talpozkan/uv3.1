"""add finance module tables

Revision ID: finance_module_v1
Revises: 73893917c4c2
Create Date: 2026-01-01 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'finance_module_v1'
down_revision: Union[str, None] = '73893917c4c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================================================
    # 1. FINANS KATEGORILERI
    # ==========================================================================
    op.create_table(
        'finans_kategoriler',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ad', sa.String(100), nullable=False),
        sa.Column('tip', sa.String(20), nullable=False),  # 'gelir', 'gider'
        sa.Column('ust_kategori_id', sa.Integer(), nullable=True),
        sa.Column('renk', sa.String(7), nullable=True),
        sa.Column('ikon', sa.String(50), nullable=True),
        sa.Column('aktif', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['ust_kategori_id'], ['finans_kategoriler.id'], ondelete='SET NULL')
    )
    op.create_index('ix_finans_kategoriler_id', 'finans_kategoriler', ['id'])
    op.create_index('ix_finans_kategoriler_tip', 'finans_kategoriler', ['tip'])

    # ==========================================================================
    # 2. FINANS HIZMETLER
    # ==========================================================================
    op.create_table(
        'finans_hizmetler',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ad', sa.String(200), nullable=False),
        sa.Column('kod', sa.String(20), nullable=True),
        sa.Column('kategori', sa.String(100), nullable=True),
        sa.Column('varsayilan_fiyat', sa.Numeric(12, 2), nullable=True),
        sa.Column('kdv_orani', sa.Integer(), default=0),
        sa.Column('aktif', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_finans_hizmetler_id', 'finans_hizmetler', ['id'])

    # ==========================================================================
    # 3. KASALAR
    # ==========================================================================
    op.create_table(
        'kasalar',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ad', sa.String(100), nullable=False),
        sa.Column('tip', sa.String(20), nullable=False),  # 'nakit', 'banka', 'pos'
        sa.Column('bakiye', sa.Numeric(12, 2), default=0),
        sa.Column('para_birimi', sa.String(3), default='TRY'),
        sa.Column('banka_adi', sa.String(100), nullable=True),
        sa.Column('iban', sa.String(34), nullable=True),
        sa.Column('aktif', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_kasalar_id', 'kasalar', ['id'])

    # ==========================================================================
    # 4. FIRMALAR
    # ==========================================================================
    op.create_table(
        'firmalar',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ad', sa.String(200), nullable=False),
        sa.Column('vergi_no', sa.String(20), nullable=True),
        sa.Column('telefon', sa.String(20), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('adres', sa.Text(), nullable=True),
        sa.Column('notlar', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_firmalar_id', 'firmalar', ['id'])

    # ==========================================================================
    # 5. FINANS ISLEMLER (Ana tablo)
    # ==========================================================================
    op.create_table(
        'finans_islemler',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('referans_kodu', sa.String(20), nullable=False, unique=True),
        sa.Column('hasta_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('muayene_id', sa.Integer(), nullable=True),  # Integer - muayeneler.id ile uyumlu
        sa.Column('tarih', sa.Date(), nullable=False),
        sa.Column('islem_tipi', sa.String(20), nullable=False),  # 'gelir', 'gider', 'transfer'
        sa.Column('durum', sa.String(20), default='tamamlandi'),
        sa.Column('kategori_id', sa.Integer(), nullable=True),
        sa.Column('aciklama', sa.Text(), nullable=True),
        # Tutar bilgileri
        sa.Column('tutar', sa.Numeric(12, 2), nullable=False),
        sa.Column('kdv_orani', sa.Integer(), default=0),
        sa.Column('kdv_tutari', sa.Numeric(12, 2), default=0),
        sa.Column('net_tutar', sa.Numeric(12, 2), nullable=False),
        sa.Column('para_birimi', sa.String(3), default='TRY'),
        # İlişkiler
        sa.Column('kasa_id', sa.Integer(), nullable=True),
        sa.Column('firma_id', sa.Integer(), nullable=True),
        sa.Column('doktor', sa.String(100), nullable=True),
        # Vade ve notlar
        sa.Column('vade_tarihi', sa.Date(), nullable=True),
        sa.Column('notlar', sa.Text(), nullable=True),
        sa.Column('belge_url', sa.Text(), nullable=True),
        # İptal bilgileri
        sa.Column('iptal_tarihi', sa.DateTime(timezone=True), nullable=True),
        sa.Column('iptal_nedeni', sa.Text(), nullable=True),
        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['hasta_id'], ['hastalar.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['muayene_id'], ['muayeneler.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['kategori_id'], ['finans_kategoriler.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['kasa_id'], ['kasalar.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['firma_id'], ['firmalar.id'], ondelete='SET NULL')
    )
    op.create_index('ix_finans_islemler_id', 'finans_islemler', ['id'])
    op.create_index('ix_finans_islemler_referans_kodu', 'finans_islemler', ['referans_kodu'])
    op.create_index('ix_finans_islemler_hasta_id', 'finans_islemler', ['hasta_id'])
    op.create_index('ix_finans_islemler_tarih', 'finans_islemler', ['tarih'])
    op.create_index('ix_finans_islemler_islem_tipi', 'finans_islemler', ['islem_tipi'])

    # ==========================================================================
    # 6. FINANS ISLEM SATIRLARI
    # ==========================================================================
    op.create_table(
        'finans_islem_satirlari',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('islem_id', sa.Integer(), nullable=False),
        sa.Column('hizmet_id', sa.Integer(), nullable=True),
        sa.Column('hizmet_adi', sa.String(200), nullable=False),
        sa.Column('adet', sa.Integer(), default=1),
        sa.Column('birim_fiyat', sa.Numeric(12, 2), nullable=False),
        sa.Column('toplam', sa.Numeric(12, 2), nullable=False),
        sa.Column('doktor', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['islem_id'], ['finans_islemler.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['hizmet_id'], ['finans_hizmetler.id'], ondelete='SET NULL')
    )
    op.create_index('ix_finans_islem_satirlari_id', 'finans_islem_satirlari', ['id'])
    op.create_index('ix_finans_islem_satirlari_islem_id', 'finans_islem_satirlari', ['islem_id'])

    # ==========================================================================
    # 7. FINANS ODEMELER
    # ==========================================================================
    op.create_table(
        'finans_odemeler',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('islem_id', sa.Integer(), nullable=False),
        sa.Column('kasa_id', sa.Integer(), nullable=True),
        sa.Column('odeme_tarihi', sa.Date(), nullable=False),
        sa.Column('tutar', sa.Numeric(12, 2), nullable=False),
        sa.Column('odeme_yontemi', sa.String(30), nullable=False),
        sa.Column('banka', sa.String(100), nullable=True),
        sa.Column('taksit_sayisi', sa.Integer(), default=1),
        sa.Column('kapora', sa.Boolean(), default=False),
        sa.Column('notlar', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['islem_id'], ['finans_islemler.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['kasa_id'], ['kasalar.id'], ondelete='SET NULL')
    )
    op.create_index('ix_finans_odemeler_id', 'finans_odemeler', ['id'])
    op.create_index('ix_finans_odemeler_islem_id', 'finans_odemeler', ['islem_id'])

    # ==========================================================================
    # 8. FINANS TAKSITLER
    # ==========================================================================
    op.create_table(
        'finans_taksitler',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('odeme_id', sa.Integer(), nullable=False),
        sa.Column('taksit_no', sa.Integer(), nullable=False),
        sa.Column('tutar', sa.Numeric(12, 2), nullable=False),
        sa.Column('vade_tarihi', sa.Date(), nullable=False),
        sa.Column('tahsil_tarihi', sa.Date(), nullable=True),
        sa.Column('durum', sa.String(20), default='bekliyor'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['odeme_id'], ['finans_odemeler.id'], ondelete='CASCADE')
    )
    op.create_index('ix_finans_taksitler_id', 'finans_taksitler', ['id'])
    op.create_index('ix_finans_taksitler_odeme_id', 'finans_taksitler', ['odeme_id'])

    # ==========================================================================
    # 9. KASA HAREKETLER
    # ==========================================================================
    op.create_table(
        'kasa_hareketler',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('kasa_id', sa.Integer(), nullable=False),
        sa.Column('islem_id', sa.Integer(), nullable=True),
        sa.Column('odeme_id', sa.Integer(), nullable=True),
        sa.Column('tarih', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('hareket_tipi', sa.String(10), nullable=False),  # 'giris', 'cikis'
        sa.Column('tutar', sa.Numeric(12, 2), nullable=False),
        sa.Column('onceki_bakiye', sa.Numeric(12, 2), nullable=True),
        sa.Column('sonraki_bakiye', sa.Numeric(12, 2), nullable=True),
        sa.Column('aciklama', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['kasa_id'], ['kasalar.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['islem_id'], ['finans_islemler.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['odeme_id'], ['finans_odemeler.id'], ondelete='SET NULL')
    )
    op.create_index('ix_kasa_hareketler_id', 'kasa_hareketler', ['id'])
    op.create_index('ix_kasa_hareketler_kasa_id', 'kasa_hareketler', ['kasa_id'])
    op.create_index('ix_kasa_hareketler_tarih', 'kasa_hareketler', ['tarih'])

    # ==========================================================================
    # 10. VARSAYILAN KATEGORİLER (Seed Data)
    # ==========================================================================
    
    # Gelir Kategorileri
    op.execute("""
        INSERT INTO finans_kategoriler (ad, tip, renk, ikon, aktif) VALUES
        ('Muayene Ücreti', 'gelir', '#10B981', 'stethoscope', true),
        ('Ameliyat Ücreti', 'gelir', '#059669', 'cut', true),
        ('İşlem Ücreti', 'gelir', '#34D399', 'activity', true),
        ('Laboratuvar', 'gelir', '#6EE7B7', 'flask', true),
        ('Görüntüleme', 'gelir', '#A7F3D0', 'image', true),
        ('Diğer Gelir', 'gelir', '#D1FAE5', 'plus-circle', true)
    """)
    
    # Gider Kategorileri
    op.execute("""
        INSERT INTO finans_kategoriler (ad, tip, renk, ikon, aktif) VALUES
        ('Personel Giderleri', 'gider', '#EF4444', 'users', true),
        ('Kira ve Aidat', 'gider', '#DC2626', 'home', true),
        ('Faturalar', 'gider', '#F87171', 'file-text', true),
        ('Medikal Malzeme', 'gider', '#FCA5A5', 'package', true),
        ('Ofis Malzemeleri', 'gider', '#FECACA', 'briefcase', true),
        ('Bakım Onarım', 'gider', '#FEE2E2', 'tool', true),
        ('Vergi Ödemeleri', 'gider', '#B91C1C', 'file-minus', true),
        ('Diğer Giderler', 'gider', '#991B1B', 'minus-circle', true)
    """)
    
    # Varsayılan Kasalar
    op.execute("""
        INSERT INTO kasalar (ad, tip, bakiye, para_birimi, aktif) VALUES
        ('Ana Kasa (Nakit)', 'nakit', 0, 'TRY', true),
        ('Banka Hesabı', 'banka', 0, 'TRY', true),
        ('POS Cihazı', 'pos', 0, 'TRY', true)
    """)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('kasa_hareketler')
    op.drop_table('finans_taksitler')
    op.drop_table('finans_odemeler')
    op.drop_table('finans_islem_satirlari')
    op.drop_table('finans_islemler')
    op.drop_table('firmalar')
    op.drop_table('kasalar')
    op.drop_table('finans_hizmetler')
    op.drop_table('finans_kategoriler')
