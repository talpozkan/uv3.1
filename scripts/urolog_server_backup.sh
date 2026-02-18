#!/bin/bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME="/home/alp"

set -o pipefail

# --- AYARLAR ---

CONTAINER_NAME="urolog_db"
DB_USER="emr_admin"
DB_NAME="urolog_db"
DOCUMENTS_DIR="/opt/urolog/backend/static/documents"
BACKUP_DIR="/home/alp/temp_backup"
LOG_FILE="/home/alp/urolog_backup.log"
GDRIVE_REMOTE="gdrive:UroLog_Yedekleri"
GDRIVE_DOCS_FOLDER="gdrive:UroLog_Yedekleri/Documents_Sync"
EMAIL_ADDRESS="alpozkan@gmail.com"
# !!! YENİ EKLENEN SATIR: Ayar dosyasının tam yerini belirtiyoruz !!!
RCLONE_CONF="/home/alp/.config/rclone/rclone.conf"

# Tarih ve Dosya Isimleri
DATE=$(date +"%Y-%m-%d_%H-%M")
PRETTY_DATE=$(date +"%d.%m.%Y %H:%M:%S")
SQL_FILE="db_$DATE.sql.gz"
SERVER_NAME=$(hostname)

# Hata Bayragi
ERROR_FLAG=0
ERROR_MESSAGE=""

# --- FONKSIYON: Loglama ---
log_print() {
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# --- FONKSIYON: Email Gonderme (GELISTIRILMIS) ---
send_email() {
    local STATUS="$1"   # "SUCCESS" veya "ERROR"
    local DETAIL="$2"   # Mesaj icerigi

    if [ "$STATUS" == "ERROR" ]; then
        SUBJECT="[DIKKAT] UroLog Yedekleme HATASI - $PRETTY_DATE"
        BODY="Sevgili Alp,\n\nDebian sunucunuzda yedekleme işlemi sırasında bir hata oluştu.\n\nSUNUCU: $SERVER_NAME\nZAMAN: $PRETTY_DATE\n\nHATA DETAYI:\n$DETAIL\n\nLütfen sunucuya bağlanıp logları kontrol ediniz: $LOG_FILE"
    else
        SUBJECT="[BAŞARILI] UroLog Yedekleme Raporu - $PRETTY_DATE"
        BODY="Sevgili Alp,\n\nYedekleme işlemi başarıyla tamamlandı.\n\nSUNUCU: $SERVER_NAME\nZAMAN: $PRETTY_DATE\n\nDETAYLAR:\n$DETAIL\n\nSistem sorunsuz çalışıyor."
    fi

    # E-postayi olustur ve gonder
    echo -e "Subject: $SUBJECT\nTo: $EMAIL_ADDRESS\nFrom: UroLog Server <$EMAIL_ADDRESS>\n\n$BODY" | msmtp --logfile=/dev/null "$EMAIL_ADDRESS"
}

# --- ISLEM BASLIYOR ---
mkdir -p "$BACKUP_DIR"
log_print "======================================================"
log_print "BAŞLATILIYOR: Yedekleme işlemi start aldı."

# ---------------------------------------------------------
# ADIM 1: SQL YEDEGI
# ---------------------------------------------------------
log_print "ADIM 1/3: Veritabanı Dump alınıyor ve Yükleniyor..."

if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$SQL_FILE"; then
    BLOCK_SIZE=$(du -h "$BACKUP_DIR/$SQL_FILE" | cut -f1)
    log_print "-> SQL Dump Başarılı ($BLOCK_SIZE). Drive'a gönderiliyor..."
    
    if rclone copy -P "$BACKUP_DIR/$SQL_FILE" "$GDRIVE_REMOTE" 2>&1 | tee -a "$LOG_FILE"; then
        log_print "-> BAŞARILI: SQL Yedeği Drive'a yüklendi."
    else
        log_print "-> HATA: SQL Drive'a yüklenemedi!"
        ERROR_FLAG=1
        ERROR_MESSAGE="SQL dosyası oluşturuldu ($BLOCK_SIZE) ancak Google Drive'a yüklenemedi. İnternet bağlantısını veya Rclone ayarlarını kontrol edin."
    fi
else
    log_print "-> KRİTİK HATA: SQL Dump alınamadı!"
    ERROR_FLAG=1
    ERROR_MESSAGE="PostgreSQL Dump komutu başarısız oldu. Docker konteyner ($CONTAINER_NAME) çalışıyor mu?"
fi

# Hata varsa hemen bildir ve cik (SQL kritik oldugu icin)
if [ "$ERROR_FLAG" -eq 1 ]; then
    send_email "ERROR" "$ERROR_MESSAGE"
    exit 1
fi

# ---------------------------------------------------------
# ADIM 2: DOKUMANLAR
# ---------------------------------------------------------
log_print "ADIM 2/3: Dokümanlar Artımsal Senkronize Ediliyor..."

if [ -d "$DOCUMENTS_DIR" ]; then
    rclone sync -P "$DOCUMENTS_DIR" "$GDRIVE_DOCS_FOLDER" --create-empty-src-dirs 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_print "-> BAŞARILI: Doküman senkronizasyonu tamamlandı."
    else
        log_print "-> HATA: Doküman senkronizasyonunda sorun oluştu."
        # Dokuman hatasi kritik degil, SQL yuklendi nasilsa. ERROR_FLAG=1 yapalim ama exit yapmayalim.
        ERROR_FLAG=1
        ERROR_MESSAGE="SQL yüklendi ancak Doküman senkronizasyonu (rclone sync) başarısız oldu."
    fi
else
    log_print "UYARI: Doküman klasörü bulunamadı."
fi

# ---------------------------------------------------------
# ADIM 3: RAPORLAMA VE TEMIZLIK
# ---------------------------------------------------------
log_print "ADIM 3/3: Bitiş İşlemleri..."

if [ "$ERROR_FLAG" -eq "0" ]; then
    # --- BASARI DURUMU ---
    log_print "Temizlik yapılıyor..."
    find "$BACKUP_DIR" -type f -mtime +7 -name "*.sql.gz" -print -delete | while read -r file; do
        log_print "SİLİNDİ: $file"
    done
    
    # Başarı maili gönder
    SUCCESS_MSG="- SQL Yedeği: $BLOCK_SIZE (Yüklendi)\n- Dokümanlar: Senkronize Edildi\n- Yerel Temizlik: Yapıldı"
    send_email "SUCCESS" "$SUCCESS_MSG"

else
    # --- HATA DURUMU (Sadece Dokuman asamasinda hata olduysa buraya duser) ---
    log_print "DİKKAT: Hata oluştuğu için yerel temizlik yapılmadı."
    send_email "ERROR" "$ERROR_MESSAGE"
fi

log_print "İŞLEM BİTTİ."
log_print "======================================================"
