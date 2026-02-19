import asyncio
import logging
import json
import re
import tempfile
import os
from typing import Dict, Any, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.ai.interfaces import LLMProvider, MultimodalProvider

logger = logging.getLogger(__name__)

class GeminiProvider(LLMProvider, MultimodalProvider):
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(self.model_name)
                logger.info(f"Gemini initialized with model: {self.model_name}")
            except Exception as e:
                logger.error(f"Gemini initialization failed: {e}")
        else:
            logger.warning("Gemini library not found or API key missing.")

    def is_available(self) -> bool:
        return self.model is not None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def analyze_text(self, text: str, template: str, temperature: float = 0.1) -> Dict[str, Any]:
        if not self.model:
            raise ValueError("Gemini model is not initialized.")

        # Logic from _analyze_text_with_gemini
        # Note: We assume 'template' comes in as the full prompt text or we construct it here.
        # For this refactor, we usually expect the caller to build the full prompt, 
        # but the interface says 'template'. Let's assume the caller handles prompt construction for now
        # OR we inject the prompt construction logic here. 
        # Given the original code, the 'prompt' was constructed in the service.
        # Let's keep it simple: 'template' here is the SYSTEM PROMPT, 'text' is the content.
        
        full_content = f"{template}\n\n## HASTA NOTLARI / TRANSKRİPT:\n{text}"
        
        config = genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=temperature
        )
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content,
                full_content,
                generation_config=config
            )
            
            if not response or not response.candidates:
                 raise ValueError("Gemini yanıt üretmedi")
                
            return self._parse_response(response.text)
        except Exception as gen_err:
             logger.error(f"Gemini text generation error: {gen_err}")
             if "blocked" in str(gen_err).lower():
                 raise ValueError("Güvenlik politikaları nedeniyle analiz edilemedi.")
             raise gen_err

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def analyze_audio(self, audio_bytes: bytes, mime_type: str, template: str) -> Dict[str, Any]:
        if not self.model:
            raise ValueError("Gemini model is not initialized.")

        suffix = self._get_file_suffix(mime_type)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
            temp_path = temp_audio.name
            temp_audio.write(audio_bytes)
        
        uploaded_file = None
        try:
            uploaded_file = await asyncio.to_thread(
                genai.upload_file,
                path=temp_path,
                mime_type=mime_type
            )
            
            # Wait for processing
            state = uploaded_file.state.name
            while state == "PROCESSING":
                await asyncio.sleep(2)
                uploaded_file = await asyncio.to_thread(genai.get_file, uploaded_file.name)
                state = uploaded_file.state.name
            
            if state == "FAILED":
                raise ValueError(f"Gemini file processing failed")
            
            config = genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
            
            try:
                response = await asyncio.to_thread(
                    self.model.generate_content,
                    [template, uploaded_file],
                    generation_config=config,
                    safety_settings={
                        genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: genai.types.HarmBlockThreshold.BLOCK_NONE,
                        genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                        genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                        genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                    }
                )
                
                if not response or not response.candidates:
                    raise ValueError("Gemini yanıt üretmedi (Boş yanıt)")
                
                return self._parse_response(response.text)
            except Exception as gen_err:
                logger.error(f"Gemini generation error: {gen_err}")
                if "blocked" in str(gen_err).lower():
                    raise ValueError("Üzgünüz, bu ses kaydı güvenlik politikaları nedeniyle analiz edilemedi.")
                raise gen_err
        finally:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
            if uploaded_file:
                try:
                    await asyncio.to_thread(genai.delete_file, uploaded_file.name)
                except Exception:
                    pass

    def _parse_response(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
            return {}

    def _get_file_suffix(self, mime_type: str) -> str:
        mapping = {
            "audio/wav": ".wav",
            "audio/webm": ".webm",
            "audio/mp4": ".m4a",
            "audio/ogg": ".ogg",
            "audio/mpeg": ".mp3",
        }
        return mapping.get(mime_type, ".webm")
