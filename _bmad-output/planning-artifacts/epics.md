---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - prd.md
  - architecture.md
---

# UroLog_Bmad - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for UroLog_Bmad, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Backend System can retrieve full patient profile (Demographics + History) via ID.
FR2: Backend System can update patient demographic info without affecting clinical history.
FR3: Admin can soft-delete a patient (transactionally across all shards).
FR4: System can calculate IPSS/IIEF scores using standard formulas (Legacy Logic Preserved).
FR5: System can log every read-access to clinical data (Audit).
FR6: Users can generate a PDF report combining Demographics, History, and Labs.
FR7: Report generation must fail gracefully and block output if any required shard (e.g., Finance) is unavailable.
FR8: Admin can run a "Dry Run" migration with checksum validation.
FR9: Admin can view a "Diff Report" of data discrepancies between Legacy vs Sharded DB.

### NonFunctional Requirements

NFR1: Performance - API `get_patient` must complete within 800ms (Relaxed constraint for Phase 1).
NFR2: Performance - PDF generation must complete within 2 seconds.
NFR3: Security - Backend must decode and respect existing JWT tokens without requiring frontend auth changes.
NFR4: Security - No PII (Patient Identifiable Information) in application logs.
NFR5: Reliability - The migration script must handle batches of 10k records without memory leaks.
NFR6: Maintainability - All new Python code must pass `mypy --strict`.
NFR7: Maintainability - Cyclomatic Complexity must be < 10 for all new methods.

### Additional Requirements

- **Sharding Approach:** Logical Sharding via Postgres Schemas (`finance`, `patient`, `report`).
- **Migration Strategy:** "Migration-as-Code" with `db_import_sharded.py`.
- **Verification:** Cryptographic SHA-256 Row Hashing (Zero Data Loss Guarantee).
- **Authentication:** `UserContext` object injected into every Repository method for Audit Continuity.
- **Architecture Pattern:** Adapter Pattern (Controller Layer) to maintain exact legacy JSON response format.
- **Distributed Transaction Consistency:** Logical 2-Phase-Commit (Orchestrator-driven) for atomic deletions and updates.
- **Library Standardization:** Must use PyMuPDF for all PDF report generation.

### FR Coverage Map

| Requirement | Epic | Description |
| :--- | :--- | :--- |
| **FR1** | Epic 2 | Patient Profile retrieval from shards. |
| **FR2** | Epic 2 | Isolated Demographic updates. |
| **FR3** | Epic 2 | Atomic soft-delete across all shards. |
| **FR4** | N/A | Preserved legacy scoring logic. |
| **FR5** | Epic 2 | Audit logging for all record access. |
| **FR6** | Epic 3 | PDF report generation using PyMuPDF. |
| **FR7** | Epic 3 | Partial failure handling in reporting. |
| **FR8** | Epic 1 | Pre-migration "Dry Run" simulation. |
| **FR9** | Epic 1 | Mathematical Diff Report (Hash based). |

## Epic List

### Epic 1: Güvenli Veri Göçü ve Bütünlük Doğrulaması (Safe Migration)

- **Goal:** Enable the administrator to migrate legacy data to sharded schemas with zero loss guarantee and mathematical proof of integrity.
- **Deals with:** Migration scripts, checksums, dry-run logic.

#### Story 1.1: Bütünlük Doğrulama Motoru (Integrity Engine)

As a System Administrator,
I want a SHA-256 based "Integrity Hash" calculated for every data row,
So that I can prove the data is identical before and after migration.

**Acceptance Criteria:**

- **Given** a table in the legacy database.
- **When** the validation script runs.
- **Then** it must generate a unified hash for all non-volatile fields.
- **And** store these hashes in a verification table for comparison.

#### Story 1.2: Shard'lanmış Veri Aktarım Betiği (Migration Script)

As a System Administrator,
I want to transfer legacy data into sharded schemas based on Patient ID rules,
So that I can populate the new architecture database.

**Acceptance Criteria:**

- **Given** clean and empty `patient`, `clinical`, and `finance` schemas.
- **When** the `db_import_sharded.py` script is executed.
- **Then** data must be distributed into schemas while preserving relational integrity.
- **And** memory usage must be monitored to handle 10k batches without leaks (NFR5).

#### Story 1.3: "Dry Run" Simülasyonu ve Fark Raporu (Diff Report)

As a System Administrator,
I want to simulate the migration process without any real writes and see potential mismatches,
So that I can minimize errors in the live system.

**Acceptance Criteria:**

- **Given** legacy and sharded databases.
- **When** the migration is triggered with a `--dry-run` flag.
- **Then** data must only be matched in memory or temp tables.
- **And** a "Diff Report" (FR9) must be generated showing rows with non-matching hashes.

### Epic 2: Shard'lanmış Hasta Verisi Erişimi (Sharded Data Access)

- **Goal:** Provide doctors with a performant, sharded, and audited access layer for reading, updating, and deleting patient clinical and demographic data.
- **Deals with:** Repository pattern, Orchestrator, soft-delete, automated audit logging.

#### Story 2.1: Birleşik Hasta Profili ve Legacy API Uyumu (Unified Profile & Legacy Compliance)

As a Doctor,
I want to see the complete patient history in the exact same format as before,
So that I don't need to change my workflow and the frontend components continue to work.

**Acceptance Criteria:**

- **Given** patient data spread across `patient` and `clinical` shards.
- **When** calling the `/api/v1/patients/{id}` endpoint.
- **Then** the Orchestrator must aggregate data and the Adapter must return a JSON matching the Legacy V1 structure.
- **And** API response time must be < 800ms (NFR1) through optimized shard indexing.

#### Story 2.2: Otomatik Denetim ve PII Koruması (Automated Audit & PII Shield)

As a System Administrator,
I want access logs to be recorded automatically without PII (Patient Identifiable Information),
So that we remain KVKK compliant and have a full audit trail.

**Acceptance Criteria:**

- **Given** a data access method in the Repository.
- **When** the method is executed.
- **Then** a Decorator or Middleware must automatically trigger `AuditService.log`.
- **And** logs must contain only UUIDs and action types, strictly forbidding Ad/Soyad or TC Kimlik (NFR4).

#### Story 2.3: Dayanıklı Atomik Silme (Resilient Atomic Soft-Delete)

As a System Administrator,
I want to perform atomic soft-deletes across all shards with a safety net,
So that a partial failure doesn't leave orphan records behind.

**Acceptance Criteria:**

- **Given** a multi-shard delete request.
- **When** the transaction starts via the Orchestrator.
- **Then** a logical 2-Phase Commit (2PC) must be used.
- **And** if any shard fails, a Circuit Breaker pattern must prevent partial state and trigger an immediate Rollback.

### Epic 3: Dayanıklı Rapor Oluşturma (Resilient Reporting)

- **Goal:** Ensure clinical reports can be generated even if non-critical shards are offline, providing continuous clinical output.
- **Deals with:** PDF generation, partial failure orchestration.

#### Story 3.1: Kesintisiz Klinik Rapor Üretimi (Non-Stop Clinical PDF)

As a Doctor,
I want to generate a patient report even if the Finance system is temporarily down,
So that I can provide the patient with their medical treatment document without delay.

**Acceptance Criteria:**

- **Given** an offline `finance` shard and an online `clinical` shard.
- **When** a "Durum Bildirir Raporu" is requested.
- **Then** the Orchestrator must provide the report with a "Finance data unavailable" warning placeholder.
- **And** the PDF must follow the standard PyMuPDF template (FR6).

#### Story 3.2: Standartlaştırılmış PyMuPDF Rapor Motoru (Unified PDF Engine)

As a Doctor,
I want my reports to have a consistent brand image (Font, Logo, Layout) across the system,
So that I can provide professional and readable medical documents.

**Acceptance Criteria:**

- **Given** template data and the PyMuPDF library.
- **When** the report engine is fed with a dataset.
- **Then** it must produce a standard-compliant PDF within 2 seconds (NFR2).

### Epic 4: Klinik AI Zekası (Clinical AI Intelligence)

- **Goal**: Transform the clinical workflow with AI-driven documentation assistance and data insights.
- **Deals with**: AI Integration, Voice Processing, Data Analytics.

#### Story 4.1: AI Katip Çekirdek Servisi (AI Scribe Core)

As a Doctor,
I want to dictate my examination notes and have them automatically structured into the system,
So that I can focus on the patient instead of typing.

**Acceptance Criteria:**

- **Given** an audio stream or raw text input.
- **When** processed by the `AIService`.
- **Then** it must return a valid JSON object matching the `ExaminationSchema`.
- **And** PII must be stripped or anonymized before external processing (if cloud AI is used).

#### Story 4.2: Akıllı Laboratuvar Analizi (Intelligent Lab Analysis)

As a Doctor,
I want to see trend analysis graphs for critical lab values (e.g., PSA, Creatinine),
So that I can detect progression or anomalies at a glance.

**Acceptance Criteria:**

- **Given** historical lab data in `sharded_clinical_lab_results`.
- **When** viewing the patient dashboard.
- **Then** a "Trend Analysis" widget must display sparklines for key metrics.
- **And** abnormal slopes (sudden increase) must be highlighted.

#### Story 4.3: Sesli Komut Arayüzü (Voice Interface)

As a Doctor,
I want a microphone button on the examination form,
So that I can trigger the AI Scribe directly from the UI.

**Acceptance Criteria:**

- **Given** the examination page.
- **When** the "Start Recording" button is clicked.
- **Then** browser audio must be captured and streamed to the backend.
- **And** the returned structured text must auto-fill the correct form fields.
