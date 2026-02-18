stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: []
workflowType: 'architecture'
project_name: 'UroLog_Bmad'
user_name: 'Alp'
date: '2026-01-29'
lastStep: 8
status: 'complete'
completedAt: '2026-01-29'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
9 FRs extracted. Core architectural drivers:

1. **Sharded Data Access:** Parallel retrieval of Demographics/History (FR1).
2. **Transactional Updates:** Soft-delete propagation across shards (FR3).
3. **Resilience:** Partial failure handling for Report Generation (FR7).
4. **Verification:** Mathematical proof of data migration (FR8, FR9).

**Non-Functional Requirements:**

1. **Performance:** <800ms API response, <2s PDF generation.
2. **Reliability:** Zero data loss migration (10k batches).
3. **Maintainability:** Strict typing (mypy) and low complexity (<10).

**Scale & Complexity:**

- Primary domain: Backend/Database
- Complexity level: High (Brownfield Refactor with strict constraints)
- Estimated components: 3 Repositories, 1 Orchestrator, 1 Report Service, 2 Migration Scripts.
- **Key Challenge:** Partial Failure Handling (Circuit Breakers/Fallbacks) for distributed shards.

### Technical Constraints & Dependencies

- **Adapter Pattern:** Must maintain exact legacy JSON response format.
- **Frontend Freeze:** No changes allowed to frontend code/endpoints.
- **Library Standardization:** Must use PyMuPDF.
- **Legacy Schema Fidelity:** The Orchestrator output must match the legacy `patient_blob` structure exactly to ensure zero frontend regressions.

### Cross-Cutting Concerns Identified

- **Audit Logging:** Required in all repositories via `UserContext`.
- **Integrity Verification:** Continuous hashing during migration.
- **Distributed Transaction Consistency:** Critical for KVKK compliance to ensure atomic deletions across all shards.

## Starter Template Evaluation

### Primary Technology Domain

**Full Stack (Brownfield)**: Existing Next.js Frontend + FastAPI Backend.

### Baseline Architecture (Current Stack)

Since this is a refactoring project, we are strictly bound to the existing technology stack to ensure compatibility and minimize regression risk.

### Selected Baseline: Custom UroLog Stack

**Rationale for Selection:**
Strict legacy preservation requirement. Moving to a new starter would violate the "Frontend Freeze" constraint.

**Core Stack Components:**

**Backend (Python):**

- **Framework:** FastAPI (Async)
- **Database:** SQLAlchemy + AsyncPG + Alembic (Migrations)
- **Validation:** Pydantic (Strict)
- **Caching:** Redis + FastAPI-Cache2
- **PDF Generation:** PyMuPDF (Standardized)

**Frontend (TypeScript):**

- **Framework:** Next.js 16 (App Router)
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod
- **Styling:** Tailwind CSS 4

**Architectural Constraints Imposed:**

- **No new frontend dependencies** unless critical.
- **Backend must maintain Pydantic v2 strict mode** for all new models.
- **Alembic** is the sole source of truth for schema changes.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. **Sharding Strategy:** Schema-based Isolation (Enforces strict separation).
2. **Transaction Management:** Logical 2-Phase-Commit (Orchestrator-driven).
3. **Migration Verification:** Row-Hash Comparison (Zero Data Loss Guarantee).

**Important Decisions (Shape Architecture):**

1. **Legacy Fidelity:** Adapters must return exact legacy JSON.
2. **Audit Strategy:** UserContext injection in all Repos.

### Data Architecture

- **Sharding Approach:** Logical Sharding via Postgres Schemas (`finance`, `patient`, `report`).
  - _Rationale:_ Provides clear boundary enforcement without the operational complexity of physical database separation in Phase 1.
- **Migration Strategy:** "Migration-as-Code" with `db_import_sharded.py`.
- **Verification:** Cryptographic SHA-256 Row Hashing.
  - _Constraint:_ Migration fails if a single hash mismatch occurs.

### Authentication & Security

- **Method:** JWT (Legacy Preservation).
- **Internal Auth:** `UserContext` object passed to all internal services.
- **Compliance:** Distributed Soft-Delete enforced by Orchestrator.

### API & Communication Patterns

- **Pattern:** Adapter Pattern (Controller Layer).
- **Internal Comm:** Direct Service-to-Service calls (Monolothic) but strictly typed via Pydantic DTOs.
- **Constraint:** No circular dependencies between Domains.

### Infrastructure & Deployment

- **Baseline:** Existing Docker/Hetzner setup.
- **Changes:** New `Alembic` configuration to handle multi-schema migrations.

### Decision Impact Analysis

**Implementation Sequence:**

1. **Verification Tooling:** `verify_integrity.py` (Must be trusted first).
2. **Schema Definition:** Create empty schemas.
3. **Migration Script:** `db_import_sharded.py`.
4. **Repositories:** Implement `PatientRepo`, `FinanceRepo`.
5. **Adpaters:** Wire up Controllers.

**Cross-Component Dependencies:**

- The **Orchestrator** depends on all **Repositories**.
- **ReportService** depends on **Read-Only** access to all schemas.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
3 key areas (Legacy Fidelity, Domain Isolation, Safety) where strict adherence is required to prevent regression in this brownfield refactor.

### Naming Patterns

**Database Naming Conventions:**

- **Tables:** `sharded_{domain}_{entity}` (e.g., `sharded_patient_demographics`).
  - _Rationale:_ Distinguishes new clean tables from legacy `patient_blob` or other existing tables.
- **Columns:** `snake_case` (standard Postgres).

**API Naming Conventions:**

- **Endpoints:** `/api/v2/{domain}/{resource}` (e.g., `/api/v2/patient/profile`).
  - _Rationale:_ explicit versioning to avoid conflict with legacy controllers during strangler fig rollout.

**Code Naming Conventions:**

- **JSON Fields:** MUST use `snake_case` exclusively.
  - _Rationale:_ Matches existing Python legacy dictionaries. No camelCase conversion allowed in the Adapter layer.

### Structure Patterns

**Project Organization:**

- **Repositories:** `app/repositories/{domain}/` (Isolated by Domain).
- **DTOs:** `app/schemas/{domain}/`.
- **Legacy Adapters:** `app/controllers/legacy_adapters/`.

**File Structure Patterns:**

- Service classes must be thin. Logic resides in Independent Domain Services or Repositories, not the Orchestrator.

### Format Patterns

**Data Exchange Formats:**

- **DTOs:** Must extend `pydantic.BaseModel`.
- **Config:** `model_config = ConfigDict(extra='forbid', strict=True)`.
  - _Rationale:_ Prevents "magic fields" from slipping through validation.

### Communication Patterns

**State Management Patterns:**

- **Orchestrator:** Acts as the Transaction Manager for logical 2PC.
- **Communication:** Direct async method calls between Orchestrator and Repositories. No direct Repo-to-Repo calls.

### Process Patterns

**Error Handling Patterns:**

- **Orchestrator Errors:** Return `HTTP 500` by default to alarm on system failure.
- **Domain Exceptions:** Only known business logic failures (e.g., `PatientNotFound`) map to `4xx`.

**Safety Patterns:**

- **Migration:** All schema changes must be generated via `alembic revision --autogenerate`.
- **Verification:** `verify_integrity.py` validation is a mandatory pre-merge check.

### Enforcement Guidelines

**All AI Agents MUST:**

- Use Pydantic `strict=True`.
- Never bypass the Orchestrator for cross-domain data access.
- Maintain legacy JSON field names exactly.

**Pattern Enforcement:**

- Verification Script checks for data fidelity.
- Mypy checks for type safety.

### Pattern Examples

**Good Example (DTO):**

```python
class PatientProfileDTO(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    hasta_adi: str  # Matches legacy key "hasta_adi"
    dogum_tarihi: date
```

**Anti-Pattern (Bad):**

```python
class PatientProfile(BaseModel):
    firstName: str  # WRONG: camelCase breaks legacy contract
    alias = "hasta_adi" # WRONG: excessive mapping complexity
```

## Project Structure & Boundaries

### Complete Project Directory Structure

**Backend (FastAPI):**

```
backend/
├── alembic.ini                  # Configured for multi-schema migrations
├── maintenance/                 # [NEW] Migration Engine (Epic 1)
│   ├── db_import_sharded.py     # Story 1.2
│   └── verify_integrity.py      # Story 1.3
├── app/
│   ├── main.py                  # Routing & App Entry
│   ├── core/
│   │   └── user_context.py      # [NEW] Audit Context Injection
│   ├── schemas/                 # [SHARED] Pure Pydantic DTOs (No DB Deps)
│   │   ├── patient/
│   │   ├── finance/
│   │   └── report/
│   ├── services/
│   │   └── orchestrators/       # [NEW] Business Process Logic (2PC)
│   │       └── patient_orchestrator.py
│   ├── repositories/            # [ISOLATED] Domain Shards
│   │   ├── patient/
│   │   │   ├── repository.py
│   │   │   └── models.py        # SQLAlchemy Tables
│   │   ├── finance/
│   │   └── report/
│   └── controllers/
│       └── legacy_adapters/     # [RESTRICTED] Adapters -> Orchestrators ONLY
```

**Frontend (Next.js):**

- **Strict Freeze:** No new directories allowed in `frontend/` except specific UI fixes driven by backend changes.

### Architectural Boundaries

**API Boundaries:**

- **External:** `/api/v1/*` (Legacy Contracts - Preserved).
- **Internal:** `/api/v2/*` (New Sharded Endpoints - _Hidden from Frontend_).

**Component Boundaries:**

- **Orchestrators:** The only component allowed to import multiple Repositories. Handles logic 2PC.
- **Repositories:** Strictly isolated. `PatientRepository` CANNOT import `FinanceRepository`.
- **Legacy Adapters:** Can ONLY import Orchestrators (not Repositories directly).

### Requirements to Structure Mapping

**Epic 1: Safe Migration**

- **Scripts:** `backend/maintenance/`
- **Verification:** `backend/maintenance/verify_integrity.py`

**Epic 2: Sharded Access**

- **Repositories:** `backend/app/repositories/*`
- **Orchestrator:** `backend/app/services/orchestrators/patient_orchestrator.py`

**Epic 3: Reports**

- **Service:** `backend/app/services/report_service.py` (Facade)

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All architectural decisions are compatible. The choice of **Schema-based Sharding** aligns effectively with the **Logical 2PC** transaction management managed by the **Orchestrator**. The **Row-Hash Verification** provides the necessary safety net for this structure.

**Pattern Consistency:**
Implementation patterns directly support the architectural constraints. **Strict Pydantic models** enforce the **Legacy Fidelity** requirement, preventing unintended schema drift. **Domain Isolation** patterns in the file structure reinforce the logical sharding strategy.

**Structure Alignment:**
The project structure with a dedicated `services/orchestrators/` directory provides a clear home for the cross-domain logic, preventing "God Classes". The `legacy_adapters` package correctly isolates the bridge code.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**

- **Epic 1 (Migration):** Fully covered by `maintenance/` tools and verification scripts.
- **Epic 2 (Sharded Access):** Fully covered by `repositories/` and `orchestrators/`.
- **Epic 3 (Reports):** Supported by the `ReportService` accessing read-only schemas.

**Functional Requirements Coverage:**

- **FR1 (Sharded Read):** Architected via parallel calls in `PatientOrchestrator`.
- **FR8/FR9 (Verification):** Explicitly handled by the hashing strategy.
- **FR3 (Transactional Updates):** Managed via the Orchestrator's 2PC logic.

**Non-Functional Requirements Coverage:**

- **Performance:** Parallelism in Orchestrator addresses the 800ms SLA.
- **Maintainability:** Strict separate of concerns and typing (mypy) directly address complexity limits.
- **Compliance:** Distributed atomic deletions ensure KVKK compliance.

### Implementation Readiness Validation ✅

**Decision Completeness:**
All critical decisions (Sharding, Transactions, Verification) are made and documented. Technology stack is locked (FastAPI/Nexjs/Postgres).

**Structure Completeness:**
Directory structure is fully defined down to key files (`repository.py`, `models.py`, `user_context.py`).

**Pattern Completeness:**
Naming, structure, and communication patterns are explicitly defined with examples.

### Gap Analysis Results

**Critical Gaps:**
None identified.

**Important Gaps:**

- **Deployment Pipeline Details:** Specific `alembic` configuration for multi-schema support needs to be implemented (handled in Implementation Plan).

### Validation Issues Addressed

**Orchestrator Placement:**
Moved `patient_orchestrator.py` from generic `services/` to `services/orchestrators/` to prevent mixing business logic with coordination logic.

**Adapter Isolation:**
Strictly restricted `legacy_adapters` imports to ensure they don't bypass the Orchestrator.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**

- **Zero Risk Migration:** The "Migration-as-Code" + "Hash Verification" approach removes data loss risk.
- **Legacy Compatibility:** "Adapter Pattern" ensures frontend continues working without changes.
- **Strict Boundaries:** Schema-based sharding enforces modularity effectively.

**Areas for Future Enhancement:**

- **Physical Sharding:** Moving schemas to separate DB instances (Post-MVP).
- **Event-Driven Saga:** Replacing Logical 2PC with async events if improved scale is needed later.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
Initialize the verification tooling (`maintenance/verify_integrity.py`).
