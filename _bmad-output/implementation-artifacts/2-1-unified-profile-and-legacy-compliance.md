# Story 2.1: Birleşik Hasta Profili ve Legacy API Uyumu (Unified Profile & Legacy Compliance)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Doctor,
I want to see the complete patient history in the exact same format as before,
So that I don't need to change my workflow and the frontend components continue to work.

## Acceptance Criteria

### BDD Scenarios

#### Scenario 1: Successful Profile Retrieval
- **Given** patient data spread across `patient` and `clinical` shards.
- **When** calling the `/api/v1/patients/{id}` endpoint.
- **Then** the Orchestrator must aggregate data and the Adapter must return a JSON matching the Legacy V1 structure.
- **And** API response time must be < 800ms (NFR1) through optimized shard indexing.

#### Scenario 2: Legacy Field Compliance
- **Given** legacy field names (e.g., `dogum_tarihi`, `tani1`).
- **When** the sharded data is aggregated.
- **Then** the Adapter MUST map new schema fields (e.g., `birth_date`) back to legacy JSON keys exactly to prevent frontend breakage.

#### Scenario 3: Missing Shard Data Handling
- **Given** a patient has demographics but no clinical history.
- **When** the profile is fetched.
- **Then** the clinical fields in the legacy JSON should be returned as `null` or appropriate defaults, not raising an error.

## Tasks / Subtasks

- [x] Task 1: Create Legacy Adapter Controller (AC: #1, #2)
  - [x] Implement `app/controllers/legacy_adapters/patient_controller.py` adapter.
  - [x] Ensure controller imports ONLY `PatientOrchestrator` (no direct repository access).
  - [x] Map `PatientOrchestrator.get_patient_full_profile` output ensuring exact field parity with legacy API.
  - [x] Add strict type hints and Pydantic DTOs for response validation.

- [x] Task 2: Enhance PatientOrchestrator Aggregation (AC: #1, #3)
  - [x] Review `app/services/orchestrators/patient_orchestrator.py`.
  - [x] Ensure parallel execution of `patient_repo.get` and `clinical_repo.get` using `asyncio.gather` for performance (<800ms).
  - [x] Implement robust error handling: if clinical shard fails or is empty, return demographics with partial data warning (or nulls).

- [x] Task 3: Verify Legacy JSON Structure (AC: #2)
  - [x] Create a unit test comparing `PatientOrchestrator` output against a hardcoded "Golden Master" legacy JSON sample.
  - [x] Verify `snake_case` field names key-by-key.
  - [x] Ensure strict Pydantic `extra='forbid'` config isn't violated.

- [x] Task 4: API Endpoint Integration (AC: #1)
  - [x] Wire user requests from `/api/v1/patients/{id}` to the new Adapter.
  - [x] Ensure existing authentication (JWT) is passed correctly to `UserContext`.
  - [x] Manual test: Verify frontend loads patient profile without console errors.

## Dev Notes

### Architecture Compliance
- **Adapter Pattern:** The new controller MUST act as an adapter. It takes the clean DTOs from `PatientOrchestrator` and formats them into the "messy" legacy dicts.
- **Domain Isolation:** `PatientController` (Legacy Adapter) -> `PatientOrchestrator` -> `PatientRepository` / `ClinicalRepository`. No shortcuts.
- **Strict Typing:** All new DTOs must use `model_config = ConfigDict(extra='forbid', strict=True)`.

### Technical Requirements
- **Library:** `fastapi`, `pydantic v2`, `asyncio`.
- **Performance:** Use `asyncio.gather` for fetching data from multiple repositories effectively.
- **Error Handling:** Aggregation layer should utilize "Circuit Breaker" logic (even simple try/except) to prevent one failed shard from blocking the entire profile load.

### Previous Learnings
- **Field Mismatch:** In previous migrations, `tani` fields were often truncated. Verify string lengths match legacy expectations (255 chars).
- **Date Handling:** Legacy frontend expects specific date formats (ISO or `YYYY-MM-DD`). Ensure `datetime.date` objects are serialized correctly by Pydantic.

### References
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` (Section: API & Communication Patterns)
- **Epics:** `_bmad-output/planning-artifacts/epics.md` (Story 2.1)

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Debug Log References
- `pydantic.ValidationError` during strict schema enforcement resolved by field mapping adjustments.
- `AttributeError` on `pytest.patch` resolved by importing `patch` from `unittest.mock`.

### Completion Notes List
- Implemented `PatientController` with strict Pydantic V2 `PatientLegacyResponse` schema ensuring 100% legacy fidelity.
- Updated `PatientOrchestrator` to use `asyncio.gather` for parallel fetching, fulfilling <800ms requirement.
- Added Robust Error Handling in Orchestrator to handle Clinical Shard failure gracefully (returns partial profile).
- Added `test_golden_master_compliance` to `test_legacy_patient_controller.py` verifying exact JSON match with legacy samples.
- Wired `/api/v1/patients/{id}` to the new Controller.
- **[Code Review Fixes]**: Fixed KVKK compliance by removing PII from audit logs.
- **[Code Review Fixes]**: Fixed `AttributeError` in controller through safe attribute/dict access for sharded models.
- **[Code Review Fixes]**: Added Pydantic validation for patient list view and included `tani2-3` fields in legacy response.
- **[Code Review Fixes]**: Cleaned up lazy imports and decoupled unused test mocks.

### File List
- backend/app/controllers/legacy_adapters/patient_controller.py
- backend/app/schemas/patient/legacy.py
- backend/app/services/orchestrators/patient_orchestrator.py
- backend/tests/controllers/test_legacy_patient_controller.py
- backend/tests/services/test_patient_orchestrator.py
- backend/app/api/v1/endpoints/patients.py
