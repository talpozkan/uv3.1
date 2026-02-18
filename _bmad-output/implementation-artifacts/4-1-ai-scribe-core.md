# Story 4.1: AI Katip Çekirdek Servisi (AI Scribe Core)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Doctor,
I want to dictate my examination notes and have them automatically structured into the system,
So that I can focus on the patient instead of typing.

## Acceptance Criteria

### BDD Scenarios

#### Scenario 1: Structured Data from Unstructured Input

- **Given** an audio stream or raw text input of a patient examination.
- **When** processed by the `AIService`.
- **Then** it must return a valid JSON object matching the `ExaminationSchema`.
- **And** the JSON must include fields like `chief_complaint`, `history_of_present_illness`, `physical_exam`, `assessment`, `plan`.

#### Scenario 2: PII Anonymization

- **Given** input text containing patient names or ID numbers.
- **When** the data is sent to the AI processing layer (especially if external).
- **Then** PII must be stripped or replaced with placeholders before transmission.
- **And** the final structured output must be re-associated with the correct patient context if necessary, or stored purely as clinical data.

#### Scenario 3: Service Reliability

- **Given** the AI service is unavailable or times out.
- **When** a request is made.
- **Then** the system should return a graceful error message, allowing the doctor to manually enter notes without losing source data (if text was provided).

## Tasks / Subtasks

- [x] Task 1: Define Examination Schema
  - [x] Create Pydantic models for `ExaminationSchema` covering standard soap note sections.
  - [x] Ensure schema compatibility with existing database structures if applicable.

- [x] Task 2: Implement AIService Wrapper
  - [x] Create `app/services/ai/scribe_service.py`.
  - [x] Implement method `analyze_text(text: str) -> ExaminationSchema`.
  - [x] Integrate with configured LLM provider (e.g., OpenAI, Anthropic, or Local).

- [x] Task 3: Implement PII Scrubbing
  - [x] Add a pre-processing step to detect and redact sensitive patterns (TR ID, Names) using Regex or lightweight NLP models (e.g., Presidio) before sending to LLM.

- [x] Task 4: API Endpoint
  - [x] Create `POST /api/v1/ai-scribe/analyze`.
  - [x] Accept text/audio input (audio to text handled via Whisper or similar if MVP includes voice). *Note: Story 4.3 covers Voice Interface UI, this task covers backend support.*

- [x] Task 5: Unit & Integration Tests
  - [x] Test `analyze_text` with mock LLM responses.
  - [x] Test PII redaction logic.
  - [x] Verify Schema validation.

## Dev Notes

### Architecture Compliance

- **Service Layer:** `AIService` should be a standalone service, potentially utilizing an Adapter for different LLM providers.
- **Security:** Strict handling of patient data. No PII in logs or external API calls.

### Technical Requirements

- **Libraries:** `pydantic`, `openai` (or equivalent SDK).
- **Performance:** Analysis should wait for response, but timeout after reasonable limit (e.g., 30s).

### References

- **Epics:** `_bmad-output/planning-artifacts/epics.md` (Story 4.1)
