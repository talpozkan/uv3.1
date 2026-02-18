# Story 2.2: Otomatik Denetim ve PII Koruması (Automated Audit & PII Shield)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a System Administrator,
I want access logs to be recorded automatically without PII (Patient Identifiable Information),
so that we remain KVKK compliant and have a full audit trail.

## Acceptance Criteria

1. **Automatic Logging Trigger**: A decorator or middleware must automatically trigger `AuditService.log` whenever a data access method in the Repository is executed. (AC: #1)
2. **PII Strict Exclusion**: Logs must contain ONLY UUIDs and action types. Strictly forbid the inclusion of "Ad", "Soyad", or "TC Kimlik" numbers in the log details. (AC: #2, NFR4)
3. **Contextual Auditing**: The audit log must correctly capture the `user_id` and `username` from the `UserContext` injected into the repository/orchestrator. (AC: #3)
4. **Resilient Logging**: Audit failures must not crash the primary data retrieval operation (Soft-failure mode). (AC: #4)

## Tasks / Subtasks

- [x] Task 1: Create Audit Decorator (AC: #1, #2)
  - [x] Implement `@audited` decorator in `backend/app/core/audit.py` (or appropriate core location).
  - [x] Decorator should extract resource ID (UUID) and action type from method arguments/metadata.
  - [x] Ensure `UserContext` is used to identify the actor.
- [x] Task 2: Apply Decorator to Repositories (AC: #1)
  - [x] Review `DemographicsRepository`, `ClinicalRepository`, and `IncomeRepository`.
  - [x] Apply `@audited` to read/write/delete methods.
- [x] Task 3: Secure AuditService (AC: #2)
  - [x] Add a "Guard" in `AuditService.log` that strips/redacts restricted keys from the `details` dict if they accidentally slip through.
- [x] Task 4: Verification & Performance (AC: #1, #4)
  - [x] Add unit tests verifying that calling a repository method creates a PII-free entry in the `audit` table.
  - [x] Verify that audit logging overhead does not push response time over 800ms.

### Review Follow-ups (AI)
- [x] [AI-Review] [H] Isolation Fix: Remove `db.commit()` and `db.rollback()` from `AuditService.log` to prevent interference with main transactions.
- [x] [AI-Review] [M] Deterministic ID Extraction: Update `@audited` decorator to support explicit ID argument selection instead of fragile string scanning.
- [x] [AI-Review] [M] Robust PII Redaction: Expand `REDACTED_KEYS` and improve regex-based or prefix-based redaction in `serialize_for_json`.

## Dev Notes

- **Pattern:** Use Python decorators for repository-level auditing.
- **KVKK Compliance:** This is a high-priority legal requirement. Any PII in logs is a critical finding.
- **Architectural Guardrails:** Refer to `_bmad-output/planning-artifacts/architecture.md` (Security section).
- **Previous Learning:** Story 2.1 identified manual PII logging in `patients.py` which was fixed. This story automates it to prevent future human error.

### Project Structure Notes

- New code should reside in `backend/app/core/audit.py` or `backend/app/services/audit_service.py`.
- Repositories are located in `backend/app/repositories/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List
- Created `@audited` decorator in `backend/app/core/audit.py` for automated repository access logging.
- Secured `AuditService.log` with a recursive PII redaction mechanism (guards keys like `ad`, `soyad`, `tc_kimlik`, etc.).
- Applied automated auditing to `DemographicsRepository`, `ClinicalRepository`, and `IncomeRepository`.
- Implemented soft-failure mode for auditing to ensure clinical operations are never blocked by logging errors.
- Verified PII redaction and automated logging with new unit and integration tests.

### File List
- backend/app/core/audit.py
- backend/app/services/audit_service.py
- backend/app/repositories/patient/demographics_repository.py
- backend/app/repositories/clinical/repository.py
- backend/app/repositories/finance/income_repository.py
- backend/tests/services/test_audit_pii.py
- backend/tests/core/test_audit_decorator.py

## Senior Developer Review (AI)

**Review Date:** 2026-01-31
**Outcome:** Changes Requested

### Action Items
- [x] [H] `AuditService.log` isolation: Remove `commit`/`rollback`. Use `flush` or background tasks.
- [x] [M] Deterministic ID Extraction: Update `@audited` for better UUID detection.
- [x] [M] Robust PII Redaction: Expand sensitive key list.
