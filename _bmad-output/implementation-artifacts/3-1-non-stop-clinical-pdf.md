# Story 3.1: Kesintisiz Klinik Rapor Üretimi (Non-Stop Clinical PDF)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Doctor,
I want to generate a patient report even if the Finance system is temporarily down,
so that I can provide the patient with their medical treatment document without delay.

## Acceptance Criteria

1. **Graceful Data Fetching**: `ReportOrchestrator` must aggregate data from Patient, Clinical, and Finance shards in parallel. If Finance (non-critical) fails, it must return demographics + clinical data with a "Finance data unavailable" warning. (AC: #1)
2. **Clinical Criticality**: If Patient (Demographics) shard is down, the report cannot be generated as identity is missing. (AC: #2)
3. **PDF Generation (PyMuPDF)**: Create a PDF document that combines available data. If any shard failed, a clear "Warning: [Data] unavailable" section must be included in the PDF. (AC: #3)
4. **Resilience Test**: Verify that a report is successfully produced even when the Finance repository throws an exception. (AC: #4)

## Tasks / Subtasks

- [x] Task 1: Fix & Enhance `ReportOrchestrator` (AC: #1, #2)
  - [x] Fix the missing `_fetch_finance_summary` method signature in `ReportOrchestrator`.
  - [x] Ensure `PatientReportDTO` correctly identifies if the report is "clinically valid" (Demographics present).
- [x] Task 2: Implement `PDFReportService` (AC: #3)
  - [x] Create `backend/app/services/pdf_report_service.py` using PyMuPDF (fitz).
  - [x] Implement a template that handles missing sections (Finance) gracefully.
  - [x] Add a "Warnings" footer/header to the PDF if data is partial.
- [x] Task 3: API Endpoint for PDF (AC: #3)
  - [x] Add `GET /api/v1/patient-report/{patient_id}/pdf` endpoint.
  - [x] Return the PDF as a `StreamingResponse` or `FileResponse`.
- [x] Task 4: Integration & Resilience Tests (AC: #4)
  - [x] Mock a Finance shard failure and verify PDF generation still succeeds.
  - [x] Verify PDF content contains the "Warning" message.

## Dev Notes

- **Library:** Use `fitz` (PyMuPDF) as specified in requirements.
- **Orchestration:** `asyncio.gather(..., return_exceptions=True)` is the key for parallel fetching in `ReportOrchestrator`.

### Project Structure Notes

- Orchestrator: `backend/app/services/orchestrators/report_orchestrator.py`
- Endpoints: `backend/app/api/v1/endpoints/patient_report.py`
- New Service: `backend/app/services/pdf_report_service.py`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List
- Fixed a bug in `ReportOrchestrator` where `_fetch_finance_summary` signature was missing.
- Implemented `PDFReportService` using PyMuPDF (fitz) with a resilient design that continues generation even if sub-sections (like Finance) are empty.
- Added ASCII-safeguard in PDF generation to ensure compatibility with environment-specific font loading behaviors.
- Created `GET /api/v1/patient-report/{patient_id}/pdf` endpoint for on-demand PDF generation.
- Validated implementation with `backend/tests/services/test_report_resilience.py`, confirming orchestrator and PDF engine survive shard failures.

### File List
- backend/app/services/orchestrators/report_orchestrator.py
- backend/app/services/pdf_report_service.py
- backend/app/api/v1/endpoints/patient_report.py
- backend/tests/services/test_report_resilience.py
