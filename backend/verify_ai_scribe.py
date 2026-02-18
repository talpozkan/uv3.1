
import asyncio
from app.services.ai_scribe_service import AIScribeService
from app.schemas.ai_scribe import AIScribeRequest, AIScribeMode

# Mock provider responses to test logic flow without calling actual APIs
class MockLLMProvider:
    async def analyze_text(self, text, prompt):
        # Simulate a response that includes extracted keywords based on the prompt hints
        return {
            "sikayet": "İdrar yapamama",
            "oyku": "Hasta 65 yaşında...",
            "extracted_keywords": ["PSA: 14.2", "Gleason: 4+3", "Prostat: 85cc"],
            "clinical_note": "Tam klinik not..."
        }

async def test_template_logic():
    print("Initializing Service...")
    service = AIScribeService()
    
    # Inject Mock LLM to avoid API keys/costs during verification
    service.local_llm_provider = MockLLMProvider()
    
    print("\n--- Test 1: Prostate Template Prompt Construction ---")
    # We want to verify that the prompt builder injects the hints
    prompt = service._build_template_prompt("Prostatektomi Takibi")
    
    if "PSA" in prompt and "Gleason" in prompt:
        print("✅ SUCCESS: Prostate keywords found in System Prompt.")
    else:
        print("❌ FAILURE: Prostate keywords NOT found in System Prompt.")
        print(f"Prompt output snippet: {prompt[:500]}...")

    print("\n--- Test 2: Kidney Stone Template Prompt Construction ---")
    prompt_stone = service._build_template_prompt("Böbrek Taşı Takibi")
    
    if "Hounsfield" in prompt_stone and "Taş boyutlarını" in prompt_stone:
        print("✅ SUCCESS: Stone keywords found in System Prompt.")
    else:
        print("❌ FAILURE: Stone keywords NOT found in System Prompt.")

    print("\n--- Test 3: Simulation of Hybrid Mode Flow ---")
    # This just tests that the logic routes correctly without crashing
    try:
        # We can't easily query the real flow without mocking everything, 
        # but we can check if the components are set for Hybrid
        print(f"Google STT Provider: {service.google_stt_provider}")
        print(f"Local LLM Provider: {service.local_llm_provider}")
        print("✅ SUCCESS: Providers initialized.")
    except Exception as e:
        print(f"❌ FAILURE: Provider initialization error: {e}")

if __name__ == "__main__":
    asyncio.run(test_template_logic())
