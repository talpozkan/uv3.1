---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - Frontend düzenleme.md
  - Backend düzenleme.md
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 2
classification:
  projectType: Web Application (Healthcare / EMR)
  domain: Healthcare
  complexity: High
  projectContext: Brownfield
workflowType: 'prd'
---

# Product Requirements Document - UroLog_Bmad

**Author:** Alp
**Date:** 2026-01-29

## 1. Success Criteria

### User Success

* **Reliability:** System performs critical tasks (patient saving, report generation) with zero data loss or unhandled errors.
* **Consistency:** Report generation is standardized (PyMuPDF) and error-free.
* **Performance:** No perceived degradation in response times despite architectural refactoring.

### Business Success

* **Risk Reduction:** Critical system failure risk minimized through decoupling God classes and enforcing strict type safety.
* **Compliance:** Data access logic is strictly structured, aiding in KVKK/HIPAA compliance audits.
* **Velocity:** Reduced technical debt enables faster, safer feature development in future sprints.

### Technical Success

* **Modularity:** No repository/service file > 300 lines. Root directory < 15 files.
* **Complexity:** Cyclomatic Complexity < 10 for core logic.
* **Quality:** Zero `any` types. 100% Pass Rate on Critical Regression Suite.
* **Stability:** Zero Data Integrity Incidents during migration/execution using standard Alembic migration path.

### Measurable Outcomes

* `zero_data_incidents`: true
* `build_clean`: true
* `test_pass_rate`: 100%

## 2. Product Scope & Roadmap

### MVP Strategy: Infrastructure-First (Safety Net)

**Philosophy:** "We do not refactor a single line of business logic until we can mathematically prove we won't lose data."
**Resource Requirements:** 1 Senior Backend Dev (Architecture/Scripts) + 1 QA Automation Engineer (Validation Tooling).

### Phased Roadmap

#### Phase 1: Migration Engine & Verification Tooling

* **Goal:** Successful "Dry Run" migration in Staging with 100% Checksum Match.
* **Deliverables:**
  * Empty Sharded Schemas (`finance`, `patient`, `report`).
  * `Maintenance/db_import_sharded.py` (The logic to move data).
  * `Maintenance/verify_integrity.py` (The logic to define success).

#### Phase 2: Repository Sharding & Adapters (The "Refactor")

* **Goal:** Production deployment with zero API contract changes.
* **Deliverables:**
  * Implementation of `PatientRepository`, `FinanceRepository` etc.
  * Legacy `API Controller` adaptation to use new Repositories.
  * Injection of `UserContext` for audit logging.

#### Phase 3: Cleanup & Optimization (The "Polish")

* **Goal:** Codebase hygiene and performance tuning.
* **Deliverables:**
  * Purging the Root Directory (moving files to `/maintenance`, `/legacy`).
  * Thinning Service Layers.
  * Standardizing `PyMuPDF` for reports.

### Future Vision (Post-MVP)

* **Growth:** Query performance optimization (`get_patient` < 500ms).
* **Vision:** Fully modularized backend capable of microservices migration.

## 3. User Journeys

### Journey 1: The Transactional Read (Patient Data Access)

**Actor:** Backend System (API Service)
**Scenario:** A doctor opens a patient file to view demographics and medical history simultaneously.
**New Flow:**

1. API Service receives `GET /patients/{id}`.
2. **Orchestrator** calls `DemographicsRepository.get(id)` and `MedicalHistoryRepository.get(id)` in parallel.
3. Each repository executes a focused, optimized query on its specific domain tables.
4. Orchestrator aggregates the results into a strongly-typed `PatientProfileDTO`.

### Journey 2: The Aggregated Write (Report Generation)

**Actor:** Dr. Urolog (End User) / Report Service
**Scenario:** Generating a PDF report for a patient's latest visit, including labs and diagnosis.
**New Flow:**

1. Doctor clicks "Generate Report".
2. **ReportService** acts as a facade, requesting data from `LabService` and `DiagnosisService` via defined interfaces.
3. Data is passed to the **PDF Engine** (PyMuPDF) containing a standardized template.
4. The final artifact is stored via `StorageService`.

### Journey 3: The Safe Passage (Migration Execution)

**Actor:** Lead Developer (during deployment)
**Scenario:** Deploying the new sharded architecture to Production.
**New Flow:**

1. Developer merges PR to `main`.
2. CI Pipeline runs `Alembic` migrations for each shard.
3. **Pre-flight Checks:** Validate reference integrity.
4. Data Migration Script runs, moving data from legacy `patient_blob` to structured tables.
5. **Validation:** Script compares record counts and hashes to ensure 100% data fidelity.

## 4. Functional Requirements

### Patient Data Management

* **FR1:** Backend System can retrieve full patient profile (Demographics + History) via ID.

* **FR2:** Backend System can update patient demographic info without affecting clinical history.
* **FR3:** Admin can soft-delete a patient (transactionally across all shards).

### Clinical Documentation

* **FR4:** System can calculate IPSS/IIEF scores using standard formulas (Legacy Logic Preserved).

* **FR5:** System can log every read-access to clinical data (Audit).

### Report Generation

* **FR6:** Users can generate a PDF report combining Demographics, History, and Labs.

* **FR7:** Report generation must fail gracefully and block output if any required shard (e.g., Finance) is unavailable.

### Migration & Maintenance

* **FR8:** Admin can run a "Dry Run" migration with checksum validation.

* **FR9:** Admin can view a "Diff Report" of data discrepancies between Legacy vs Sharded DB.

## 5. Non-Functional Requirements

### Performance

* **Response Time:** API `get_patient` must complete within **800ms** (Relaxed constraint for Phase 1).

* **Report Generation:** PDF generation must complete within **2 seconds** under normal load.

### Security

* **Legacy Compatibility:** Backend must decode and respect existing JWT tokens without requiring frontend auth changes.

* **Data Protection:** No PII (Patient Identifiable Information) in application logs.

### Reliability

* **Migration Resilience:** The migration script must handle batches of 10k records without memory leaks.

### Maintainability

* **Type Safety:** All new Python code must pass `mypy --strict`.

* **Code Quality:** Cyclomatic Complexity must be < 10 for all new methods.

## 6. Technical Strategy

### Domain & Compliance

* **KVKK 'Right to be Forgotten':** System must support **Transactional Deletion** across all shards.
* **Data Isolation:** Financial data must be logically separated from Clinical data.
* **Audit Continuity:** **Zero-Gap Logging** required; `LogRepository` must capture all new sharded access patterns.

### Architecture Guidelines

* **API Stability:** Existing `API Controllers` act as an **Adapter Layer**, mapping new DTOs to legacy JSON. No frontend endpoints will change.
* **Authentication:** `UserContext` object injected into every Repository method.
* **Internal Data Models:** Strict Pydantic Models for all inter-service communication.

### Innovation: Process Safety

* **Automated Migration Validation:** "Migration-as-Code" pipeline. A specialized script will perform hashed comparisons (`md5(legacy) == md5(sharded)`), providing cryptographic proof of data integrity.
