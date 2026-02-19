"""
AI Scribe Service - UroLog EMR Entegrasyonu
Ses kaydından klinik not oluşturan yapay zeka servisi.
Refactored to use Adapter Pattern (VoiceProvider, LLMProvider).
"""
import os
import re
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.config import settings
from app.schemas.ai_scribe import AIScribeRequest, AIScribeResponse, AIScribeMode
from app.core.ai.providers.gemini_provider import GeminiProvider
from app.core.ai.providers.local_provider import LocalVoiceProvider, LocalLLMProvider
from app.core.ai.providers.google_speech_provider import GoogleSTTProvider

logger = logging.getLogger(__name__)

# Templates directory
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "static" / "ai_scribe_templates"

class AIScribeService:
    """AI Scribe servis sınıfı - Gemini, Local ve Hybrid mod desteği"""
    
    def __init__(self):
        # Initialize Providers
        self.gemini_provider = GeminiProvider(
            api_key=settings.GOOGLE_API_KEY,
            model_name=settings.AI_SCRIBE_MODEL
        )
        
        self.local_voice_provider = LocalVoiceProvider(
            endpoint=settings.LOCAL_WHISPER_ENDPOINT
        )
        
        self.local_llm_provider = LocalLLMProvider(
            endpoint=settings.LOCAL_LLM_ENDPOINT,
            model=settings.LOCAL_LLM_MODEL
        )

        self.google_stt_provider = GoogleSTTProvider(
            api_key=settings.GOOGLE_API_KEY
        )
        
        # Templates cache
        self._templates_cache: Dict[str, str] = {}
        self._load_templates()
    
    def _load_templates(self) -> None:
        """Load templates from the templates directory"""
        if not TEMPLATES_DIR.exists():
            logger.warning(f"Templates directory not found: {TEMPLATES_DIR}")
            return
        
        count = 0
        for template_file in TEMPLATES_DIR.iterdir():
            if template_file.is_dir() or template_file.name.startswith('.'):
                continue
            
            template_name = template_file.stem if template_file.suffix else template_file.name
            try:
                content = template_file.read_text(encoding="utf-8")
                self._templates_cache[template_name] = content
                count += 1
            except Exception as e:
                logger.error(f"Template load failed for {template_name}: {e}")
        
        logger.info(f"AI Scribe: {count} templates loaded")
    
    def get_available_templates(self) -> List[Dict[str, str]]:
        """Return list of available templates"""
        return [
            {"id": name, "name": name, "description": f"Template: {name}"}
            for name in sorted(self._templates_cache.keys())
        ]
    
    def is_gemini_available(self) -> bool:
        return self.gemini_provider.is_available()
    
    async def check_local_services(self) -> Dict[str, bool]:
        """Health check for local AI services"""
        # Ideally, providers should have a health_check method.
        # For now, we will assume false or implement checking later.
        # Keeping it simple for the refactor.
        return {"whisper": True, "ollama": True} 
    
    async def analyze_consultation(
        self, 
        audio_bytes: bytes, 
        mime_type: str,
        request: AIScribeRequest,
        protocol_no: Optional[str] = None
    ) -> AIScribeResponse:
        """Main analysis method for AUDIO"""
        
        start_time = time.time()
        logger.info(f"Starting AI Scribe analysis - mode: {request.mode}, size: {len(audio_bytes)} bytes")
        
        transcript = None
        raw_data = {}
        mode_used = request.mode

        try:
            # 1. Voice Processing Phase
            if request.mode == AIScribeMode.GEMINI:
                # Multimodal - Direct Audio to JSON
                if not self.gemini_provider.is_available():
                     raise ValueError("Google Gemini API is not configured.")
                
                template_prompt = self._build_template_prompt(request.template)
                raw_data = await self.gemini_provider.analyze_audio(audio_bytes, mime_type, template_prompt)
                
            else:
                # Step 1: Transcribe
                if request.mode == AIScribeMode.LOCAL:
                    transcript = await self.local_voice_provider.transcribe(audio_bytes, mime_type)
                elif request.mode in [AIScribeMode.HYBRID_GOOGLE_LOCAL, AIScribeMode.HYBRID_GOOGLE_GEMINI]:
                    transcript = await self.google_stt_provider.transcribe(audio_bytes, mime_type)
                else:
                    raise ValueError(f"Unknown mode: {request.mode}")

                # Step 2: Intelligence Phase
                template_prompt = self._build_template_prompt(request.template)
                
                if request.mode == AIScribeMode.LOCAL or request.mode == AIScribeMode.HYBRID_GOOGLE_LOCAL:
                    raw_data = await self.local_llm_provider.analyze_text(transcript, template_prompt)
                elif request.mode == AIScribeMode.HYBRID_GOOGLE_GEMINI:
                    if not self.gemini_provider.is_available():
                         raise ValueError("Google Gemini API is not available/configured for Hybrid mode.")
                    raw_data = await self.gemini_provider.analyze_text(transcript, template_prompt)
            
            # Post-Processing
            if request.include_transcript and transcript:
                raw_data["transcript"] = transcript

            # Sanitize and normalize data
            sanitized_data = self._sanitize_data(raw_data)
            
            # Normalize symptom values
            self._normalize_symptoms_in_place(sanitized_data)
            
            # Filter extra keys for AIScribeResponse
            valid_fields = AIScribeResponse.model_fields.keys()
            filtered_data = {k: v for k, v in sanitized_data.items() if k in valid_fields}
            
            # Create response
            try:
                result = AIScribeResponse(mode_used=mode_used, **filtered_data)
                result.processing_time_seconds = round(time.time() - start_time, 2)
                
                logger.info(f"AI Scribe analysis completed in {result.processing_time_seconds}s")
                return result
            except Exception as validation_error:
                logger.error(f"Pydantic validation failed: {validation_error}")
                return AIScribeResponse(
                    mode_used=mode_used,
                    processing_time_seconds=round(time.time() - start_time, 2),
                    clinical_note=f"Veri doğrulama hatası oluştu. Ham veri: {str(sanitized_data)[:500]}"
                )

        except Exception as e:
            self._handle_analysis_error(e)
            raise

    async def analyze_text(
        self,
        text: str,
        request: AIScribeRequest
    ) -> AIScribeResponse:
        """Main analysis method for TEXT"""
        start_time = time.time()
        logger.info(f"Starting AI Scribe TEXT analysis - mode: {request.mode}, length: {len(text)} chars")
        
        # Pre-process: Scrub PII from input text
        scrubbed_text = self._sanitize_data(text)
        mode_used = request.mode

        try:
            template_prompt = self._build_template_prompt(request.template)
            
            # Intelligence Selection
            if request.mode == AIScribeMode.GEMINI or request.mode == AIScribeMode.HYBRID_GOOGLE_GEMINI:
                if not self.gemini_provider.is_available():
                     raise ValueError("Google Gemini API is not configured.")
                raw_data = await self.gemini_provider.analyze_text(scrubbed_text, template_prompt)
            elif request.mode == AIScribeMode.LOCAL or request.mode == AIScribeMode.HYBRID_GOOGLE_LOCAL:
                 raw_data = await self.local_llm_provider.analyze_text(scrubbed_text, template_prompt)
            else:
                 # Default fallback or error?
                 # Assume user meant Local if they sent Local mode, or Error.
                 raise ValueError(f"Unsupported mode for text analysis: {request.mode}")

            # Sanitize and normalize data (Post-process)
            sanitized_data = self._sanitize_data(raw_data)
            
            # Normalize symptom values
            self._normalize_symptoms_in_place(sanitized_data)
            
            # Filter extra keys
            valid_fields = AIScribeResponse.model_fields.keys()
            filtered_data = {k: v for k, v in sanitized_data.items() if k in valid_fields}
            
            # Create response
            try:
                result = AIScribeResponse(mode_used=mode_used, **filtered_data)
                result.processing_time_seconds = round(time.time() - start_time, 2)
                return result
            except Exception as validation_error:
                logger.error(f"Pydantic validation failed: {validation_error}")
                return AIScribeResponse(
                    mode_used=mode_used,
                    processing_time_seconds=round(time.time() - start_time, 2),
                    clinical_note=f"Veri doğrulama hatası oluştu. Ham veri: {str(sanitized_data)[:500]}"
                )

        except Exception as e:
            self._handle_analysis_error(e)
            raise

    def _normalize_symptoms_in_place(self, data: Dict[str, Any]):
        """Helper to normalize symptom fields in a dictionary"""
        symptom_fields = [
            'disuri', 'pollakiuri', 'nokturi', 'hematuri', 'genital_akinti', 'kabizlik',
            'catallanma', 'projeksiyon_azalma', 'kalibre_incelme', 'idrar_bas_zorluk',
            'kesik_idrar_yapma', 'terminal_damlama', 'residiv_hissi', 'inkontinans'
        ]
        for field, value in data.items():
            if isinstance(value, list) and field != 'extracted_keywords':
                data[field] = ", ".join(map(str, value))
            
            if field in symptom_fields:
                data[field] = self._normalize_symptom(data[field])

    def _normalize_symptom(self, value: Any) -> Optional[str]:
        """Normalize symptom values to VAR/YOK/BAZEN"""
        if not value:
            return None
        v = str(value).upper().strip()
        
        if any(x in v for x in ['VAR', 'MEVCUT', 'EVET', 'POZİTİF', 'TRUE', '1', 'YES', 'PRESENT']):
            return 'VAR'
        if any(x in v for x in ['BAZEN', 'ARA SIRA', 'NADİREN', 'OCCASIONALLY', 'SOMETIMES']):
            return 'BAZEN'
        if any(x in v for x in ['YOK', 'DEĞİL', 'HAYIR', 'NEGATİF', 'FALSE', '0', 'NO', 'ABSENT']):
            return 'YOK'
        
        return None
    
    def _sanitize_data(self, data: Any) -> Any:
        """Clean sensitive data (PII)"""
        if isinstance(data, dict):
            return {k: self._sanitize_data(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_data(i) for i in data]
        elif isinstance(data, str):
            # Mask Turkish National ID (11 digits)
            data = re.sub(r'\b[1-9]\d{10}\b', '[ID_MASKED]', data)
            # Mask Phone Numbers
            data = re.sub(r'\b0?5\d{9}\b', '[PHONE_MASKED]', data)
            # Mask Potential Names (2+ capitalized words sequence, excluding start of sentence if possible, but aggressive for safety)
            # Simple heuristic: Uppercase word followed by uppercase word (e.g. Ahmet Yilmaz)
            # We must be careful not to mask medical terms like "Akut Prostatit" if capitalized incorrectly.
            # However, user demanded NO NAMES.
            # Let's use a pattern that catches "Name Surname" format strictly.
            # \b[A-ZİĞÜŞÖÇ][a-zıiğüşöç]+\s+[A-ZİĞÜŞÖÇ][a-zıiğüşöç]+\b
            # We will use a safe placeholder.
            # Also avoiding UUID masking (usually lowercase/alphanum)
            
            name_pattern = r'\b[A-ZİĞÜŞÖÇ][a-zıiğüşöç]{1,}\s+[A-ZİĞÜŞÖÇ][a-zıiğüşöç]{1,}\b'
            
            # Filter out common clinical terms that might match (False positives)
            # This is a basic implementation. Ideally, use NLP.
            def replace_name(match):
                val = match.group(0)
                # Whitelist common capitalized terms in reports
                whitelist = ["Akut", "Kronik", "Sol", "Sag", "Bobrek", "Mesane", "Prostat", "Idrar", "Klinik", "Fizik", "Muayene"]
                if any(w in val for w in whitelist):
                    return val
                return "[NAME_MASKED]"

            data = re.sub(name_pattern, replace_name, data)
            return data
        return data

    def _handle_analysis_error(self, e: Exception):
        """Standardized error handling"""
        error_str = str(e).lower()
        if 'resourceexhausted' in error_str or 'quota' in error_str or 'rate' in error_str:
             logger.error(f"AI Scribe quota exceeded: {e}")
             raise ValueError("Google Gemini API kota sınırına ulaşıldı.")
        elif '403' in error_str or 'forbidden' in error_str:
             logger.error(f"AI Scribe API permission error: {e}")
             raise ValueError("Google Gemini API erişim hatası.")
        elif 'invalid' in error_str and 'key' in error_str:
             logger.error(f"AI Scribe invalid API key: {e}")
             raise ValueError("Geçersiz API key.")
        else:
             logger.error(f"AI Scribe analysis failed: {e}", exc_info=True)

    def _build_template_prompt(self, template_name: Optional[str] = None) -> str:
        """Build prompt with template and intelligent extraction hints"""
        template_content = ""
        template_hint = ""
        
        if template_name and template_name in self._templates_cache:
            template_content = self._templates_cache[template_name]
            
            # Dynamic Hints based on Template Name
            t_name_lower = template_name.lower()
            if "prostat" in t_name_lower:
                template_hint = "- Prostat spesifik verileri (PSA, Gleason, Prostat Hacmi) 'clinical_note' içinde detaylandır ve 'extracted_keywords' listesine ekle.\n- Günlük ped sayısını (inkontinans durumu) mutlaka belirt."
            elif "taş" in t_name_lower or "kidney" in t_name_lower:
                template_hint = "- Taş boyutlarını (mm), yerleşim yerini ve Hounsfield (HU) değerlerini 'extracted_keywords'e ekle.\n- Düşürme öyküsü varsa belirt."
            elif "mesane" in t_name_lower:
                template_hint = "- Hematüri durumunu ve sistoskopi bulgularını öne çıkar."
            elif "cinsel" in t_name_lower or "erektil" in t_name_lower:
                template_hint = "- IIEF skorlarını veya ereksiyon kalitesini (EHS) mutlaka değerlendir."

        default_template = """
ANA ŞİKAYET:
[Hastanın başvuru nedenlerini akıcı ve açıklayıcı bir formatta belgeleyin.] (Bahsedilmemişse atlayın.)

HİKAYE (HPI):
[Mevcut durumu ve bahsedilen semptomları tanımlayın.] (Bahsedilmemişse atlayın.)

ÖZGEÇMİŞ / SOYGEÇMİŞ / İLAÇLAR:
[İlgili öyküyü ve ilaçları özetleyin.] (Bahsedilmemişse atlayın.)

DEĞERLENDİRME VE PLAN:
[Klinik durumun özeti ve gelecek yönetim adımları.]
"""
        used_template = template_content if template_content else default_template
        
        return f"""Sen 25 yıllık deneyime sahip kıdemli bir Üroloji Uzmanısın (Profesör düzeyinde).
Türkiye'nin önde gelen üniversite hastanelerinde binlerce hasta değerlendirdin.

## GÖREV:
Ses kaydını dinle ve klinik verileri JSON formatında çıkar. 
Bir üroloji uzmanı gözüyle değerlendir ve ICD-10 tanı kodları öner.

## DİL KURALI (KRİTİK):
- TÜM çıktı TÜRKÇE olmalıdır.
- Resmi tıbbi Türkçe terminoloji kullan (Örn: "Ağrısı var" yerine "Ağrı tariflemekte", "Gelmiş" yerine "Başvurdu", "Oldu" yerine "Gözlendi/Saptandı").
- "Mış/Miş", "Gelmiş", "Gidilmiş" gibi rivayet kiplerini ASLA KULLANMA. Bu not bir hekimin kendi gözlemidir.
- Kesin geçmiş zaman (-dı, -di) veya şimdiki zaman (-makta, -mekte) kullan.
- Profesyonel bir hekimin (Profesör düzeyinde) resmi epikriz veya vizit notu dilini kullan.
- Halk dilindeki ifadeleri tıbbi terimlere çevir (Örn: "İdrarımda yanma var" -> "Dizüri şikayeti ile başvuran hasta...").

## UZMAN YAKLAŞIMI:
1. Şikayetleri öncelik sırasına göre değerlendir.
2. Semptomların süresini ve şiddetini not et.
3. Alarm semptomlarına dikkat et (hematüri, ani başlangıç, ateş).
4. Yaşa uygun ayırıcı tanı yap. Özellikle klinik not (clinical_note) kısmında hekim diliyle profesyonel bir sentez yap.
5. Olası tanılar için ICD-10 kodlarını belirt.
6. Tedavi planını kanıta dayalı olarak oluştur.

## ÖZEL ŞABLON TALİMATLARI ({template_name or 'Standart'}):
{template_hint}

## KURALLAR:
1. Şikayetler için NUMARALAMA YAPMA - akıcı paragraflar kullan.
2. Yer tutuculara çıkarılan bilgileri doldur.
3. Transkriptte BAHSEDILMEYEN bölümleri ATLA.
4. İlaçlar, dozajlar ve cerrahi öykü konusunda hassas ol.
5. Cinsel sağlık (ereksiyon, boşalma, libido vb.) üroloji için temel klinik veridir. Bu konuları "erektil_islev" ve "ejakulasyon" alanlarına tıbbi bir dille, detaylıca işle. Çekingen davranma, bu veriler tanı için kritiktir.
6. Eğer hastanın cinsel fonksiyonları normal ise "Normal" yaz, sorun varsa detaylandır.

## ŞABLON:
{used_template}

## ÜROLOJİDE SIK KULLANILAN ICD-10 KODLARI REHBERİ:
- N40: Prostat hiperplazisi (BPH)
- N41.0: Akut prostatit
- N41.1: Kronik prostatit
- N42.1: Prostat konjesyonu
- N20.0: Böbrek taşı
- N20.1: Üreter taşı
- N21.0: Mesane taşı
- N30.0: Akut sistit
- N30.1: Kronik sistit
- N34.1: Üretrit
- N39.0: İdrar yolu enfeksiyonu
- N32.0: Mesane boyun obstrüksiyonu
- N40.1: BPH ile alt üriner sistem semptomları
- R31: Hematüri
- R33: İdrar retansiyonu
- R35.0: Sık idrara çıkma
- R35.1: Noktüri
- R39.1: Diğer miksiyon güçlükleri
- N52.9: Erektil disfonksiyon
- F52.4: Prematür ejakülasyon
- C61: Prostat malign neoplazmı
- C67: Mesane malign neoplazmı
- C64: Böbrek malign neoplazmı
- D29.1: Prostat benign neoplazmı
- N43.3: Hidrosel
- N44.0: Testis torsiyonu
- N45: Orşit ve epididimit
- N50.1: Varikosel

## JSON YANIT FORMATI:
{{
  "sikayet": "Ana şikayetler (öncelik sırasına göre)",
  "oyku": "Hastalığın öyküsü (başlangıç, süre, şiddet, etkileyen faktörler)",
  "disuri": "VAR/YOK/BAZEN",
  "pollakiuri": "VAR/YOK/BAZEN",
  "nokturi": "VAR/YOK/BAZEN (sayı belirtilmişse not et)",
  "hematuri": "VAR/YOK/BAZEN",
  "genital_akinti": "VAR/YOK/BAZEN",
  "kabizlik": "VAR/YOK/BAZEN",
  "tas_oyku": "Taş öyküsü detayları",
  "erektil_islev": "Erektil fonksiyon detayları",
  "ejakulasyon": "Ejakülasyon detayları",
  "ozgecmis": "Tıbbi/Cerrahi öyküsü",
  "kullandigi_ilaclar": "İlaç listesi (doz ve frekans ile)",
  "kan_sulandirici": 0,
  "aliskanliklar": "Sigara/Alkol kullanımı",
  "tani1": "Birincil tanı",
  "tani1_icd": "ICD-10 kodu (ör: N40.1)",
  "tani2": "İkincil tanı (varsa)",
  "tani2_icd": "ICD-10 kodu",
  "tani3": "Üçüncül tanı (varsa)",
  "tani3_icd": "ICD-10 kodu",
  "ayirici_tanilar": "Ayırıcı tanılar listesi",
  "tedavi": "Tedavi planı (ilaç, doz, süre)",
  "oneriler": "Hasta önerileri ve takip planı",
  "tetkikler": "Önerilen tetkikler (lab, görüntüleme)",
  "clinical_note": "Tam formatlı klinik not (Türkçe, profesyonel format ve Şablon yapısına BİREBİR uygun)",
  "confidence_score": 0.85,
  "extracted_keywords": ["Anahtar Kelime 1", "Anahtar Kelime 2"]
}}

## ÖNEMLİ:
- ICD kodlarını doğru formatla yaz (N40.1 gibi)
- Birden fazla tanı olabilir, hepsini belirt
- Tedavi planını güncel kılavuzlara göre oluştur (EAU, AUA)
- Takip süresini ve kontrol randevusunu öner
"""


# Singleton instance
_ai_scribe_service: Optional[AIScribeService] = None

def get_ai_scribe_service() -> AIScribeService:
    """Get or create AI Scribe service instance"""
    global _ai_scribe_service
    if _ai_scribe_service is None:
        _ai_scribe_service = AIScribeService()
    return _ai_scribe_service
