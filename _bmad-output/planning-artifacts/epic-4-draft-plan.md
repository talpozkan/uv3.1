# Epic 4: Klinik AI Zekası (Clinical AI Intelligence)

**Status**: Draft
**Goal**: Empower doctors with AI-driven tools to reduce documentation burden and uncover clinical insights.

## Overview

This epic introduces the "AI-Native" capabilities requested by the Grandmaster Architect. It focuses on two core pillars:

1. **Automation**: Transcribing and structuring voice/text notes (AI Scribe).
2. **Insight**: Analyzing longitudinal data (Lab Trends) to flag anomalies.

## User Constraints & Compliance

- **KVKK/GDPR**: No PII sent to external AI providers. All data must be anonymized before processing.
- **Latency**: Voice-to-text must feel real-time (<2s latency).
- **Accuracy**: Medical terminology must be recognized correctly.

## Story Breakdown

### Story 4.1: AI Katip Çekirdek Servisi (AI Scribe Core)

**Goal**: Create a backend service that accepts raw text/audio and returns structured clinical JSON (Symptoms, Diagnosis, Plan).

- **Tech**: Open Source or Local LLM (if privacy requires), Pydantic Models for structured output.
- **Architecture**: New `AIService` in `backend/app/services/ai/`.

### Story 4.2: Akıllı Laboratuvar Analizi (Intelligent Lab Analysis)

**Goal**: Analyze a patient's historical lab results to detect trends (e.g., "PSA rising over 6 months").

- **Tech**: Pandas/NumPy for trend analysis, integration with `sharded_clinical_lab_results`.
- **Output**: "Insight Cards" on the patient dashboard.

### Story 4.3: Sesli Komut Arayüzü (Voice Interface)

**Goal**: Add a "Microphone" button to the frontend `ExaminationForm` that captures audio, sends it to the backend, and auto-fills the form fields.

- **Tech**: Web Audio API, WebSocket (legacy adapter compatible).

## Implementation Roadmap

1. **Foundation**: Setup `AIService` and API keys (Story 4.1).
2. **Intelligence**: Implement Trend Analysis Logic (Story 4.2).
3. **Interaction**: Build Frontend Voice UI (Story 4.3).
