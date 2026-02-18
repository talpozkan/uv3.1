---
title: 'Examination Page Refactoring & Logic Enhancements'
slug: 'examination-page-refactoring'
created: '2026-01-29'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js', 'React', 'Tailwind CSS', 'Zustand', 'Lucide React', 'Radix UI', 'date-fns']
files_to_modify: ['frontend/app/(dashboard)/patients/[id]/examination/page.tsx', 'frontend/stores/patient-store.ts']
code_patterns: ['Inline component definitions (Anti-pattern)', 'Monolithic State Store (Zustand)', 'Direct Store Mutation', 'Heavy use of useEffect for synchronization']
test_patterns: ['No existing unit tests found for examination logic', 'Vitest for Units', 'Playwright for E2E']
---

# Technical Specification: Examination Page Refactoring & Logic Enhancements

## 1. Overview

### Problem Statement

The `examination/page.tsx` file has grown into a "God Component" (~4000 lines), containing multiple inline component definitions (`IPSSQuestion`, `IIEFQuestion`, etc.) and complex, tightly coupled state logic. This makes the file difficult to read, maintain, and test.

### Proposed Solution

Decompose the monolithic page into self-contained feature modules using a **Co-location Strategy**.
Instead of scattering files, structure them by feature:
`frontend/components/examination/forms/[feature]/` containing:

- `[Feature]Form.tsx`: The Pure UI Component.
- `schema.ts`: Zod schema and inferred types.
- `logic.ts`: Narrative generation, scoring logic.
- `hooks.ts`: Controller hook.
- `constants.ts`: UI strings/labels.
- `handlers.ts`: MSW Mock Handlers.
- `index.ts`: Barrel export.

### Scope

**In Scope:**

- Extract features: `IPSS`, `IIEF`, `EDDrugs`, `EDC`, `SystemQuery` (if applicable), `QuickSelect` (if applicable).
- Refactor to **Pure Components** (props-driven) wrapped in `React.memo` and **Error Boundaries**.
- Implement **Zod Schemas** (AI-Ready) and **Logic Modules**.
- Implement **Custom Hooks** with **Telemetry**, **Crash Recovery**, **FSM**, **Offline Sync**, and **In-App DevTools**.
- Target Directory: `frontend/components/examination/forms/`.

**Out of Scope:**

- Backend API structure changes (unless strictly required for frontend logic).
- Global store structure changes (focus on consumption, not definition).

## 2. Context for Development

### Codebase Patterns (Investigated)

- **Monolithic Component:** `ExaminationPage` in `page.tsx` handles all UI and Logic.
- **Inline Sub-components:** `IPSSQuestion`, `IIEFQuestion`, `SystemQueryCombobox`, `DiagnosisICDCombobox` are defined within the same file.
- **State Management:** `usePatientStore` is the central source of truth. It exposes a monolithic `patient` object and a `setPatient` method.
- **Styling:** Extensive usage of Tailwind CSS utility classes.
- **UI Components:** Imports from `@/components/ui/...` suggest a Shadcn/Radix-based design system.
- **Icons:** `lucide-react` is the standard icon set.

### Files to Reference

| File | Purpose |
|Data Source| `frontend/stores/patient-store.ts` | The global Zustand store managing patient data |
|Target| `frontend/app/(dashboard)/patients/[id]/examination/page.tsx` | The monolithic file to be refactored |
|UI Lib| `frontend/components/ui/` | Reusable atom components (Input, Button, etc.) |

### Technical Decisions

- **Architecture:** Co-located Feature Modules.
  - Each form/feature must be a directory containing its UI, Logic, Schema, Hook, Constants, Handlers, and Index.
  - **No Circular Dependencies:** Feature folders must NOT import from each other via the parent barrel.
  - **Automated Enforcement:** Configure **Dependency Cruiser** or **ESLint** to strictly ban circular dependencies.
- **Developer Experience:**
  - **Barrel Files:** Use `index.ts` to expose clean imports.
  - **Content Extraction:** All UI strings in `constants.ts`.
  - **Documentation:** Mandatory **TSDoc** for all exports.
  - **DevTools:** Implement a **Hidden Debug Overlay** (hotkey triggered) to visualize FSM state, Sync Queue status, and Error Logs in production.
  - **Visual Testing:** Storybook stories for `Default`, `Filled`, `Error`, `ReadOnly` states.
- **Data Modeling (AI-Ready & Provenance):**
  - Define schemas in `schema.ts`. Use `.describe("...")` on Zod fields.
  - **Provenance:** Intrinsic audit metadata (modifiedAt, modifiedBy) per field.
  - Export inferred types: `export type [Feature]Data = z.infer<typeof [Feature]Schema>;`
- **Contract Integrity:**
  - **MSW Handlers:** Define `handlers.ts` in the feature folder.
  - **Contract Tests:** CI check generating OpenAPI from Zod and diffing against Backend Swagger.
- **Interface Standard:**
  - Use the inferred type for the Props interface:

    ```typescript
    interface Ops {
      value: [Feature]Data;
      onChange: (val: [Feature]Data) => void;
      readOnly?: boolean;
    }
    ```

- **Integration Pattern:**
  - Use Custom Hooks (`use[Feature]Controller`) to wrap store connections.
  - **Logic:** Hooks must implement **Finite State Machines (FSM)**.
  - **Data Safety:** Hooks must implement **Debounced Auto-save** with **Optimistic UI**.
  - **Crash Recovery:** Hooks must fallback to `sessionStorage` (keyed by `patientId` with TTL).
  - **Offline Resilience:** Implement **Offline Mutation Queue** (IndexedDB) with **Last-Write-Wins**.
  - **Telemetry:** Hooks must fire analytics events (e.g., `form_completed`) scrubbed of PII.
- **Release Strategy:**
  - **Feature Flagging:** Feature flags must support **Multi-Variant A/B Testing**.
- **Scalability & Performance:**
  - **Lazy Loading:** `next/dynamic` with **Intent-Based Pre-fetching**.
  - **Performance Budgets:** CI Check: Bundle < 150KB, Render < 16ms.
- **Resilience & Observability:**
  - **Granular Error Boundaries** with **Structured Logging**.
  - **Self-Healing Safe Mode:** In the event of a crash, the Error Boundary MUST render a **Native HTML Fallback Form**. This form maps inputs directly to the `Zod` schema keys, bypassing React state/logic to ensure data entry can continue. If structure cannot be preserved, fallback to a 'Crash Note' textarea appended to the narrative.
  - **Data Integrity:** `hooks.ts` MUST include a **Legacy Adapter Layer** with mandatory **Bidirectional Unit Tests** (`Legacy -> New -> Legacy`) to ensure zero data loss during transformation.
- **Ethics & Safety:**
  - **Sensitivity Scanning:** Real-time client-side heuristic scan of AI narratives.
- **UX & Ergonomics:**
  - **Touch Targets:** Minimum **44x44px**.
  - **Keyboard Nav:** Logical `Tab` order is mandatory.
- **Accessibility:**
  - Mandatory `aria-label` or `sr-only` labels for all inputs.
- **Security:**
  - Strict `readOnly` enforcement: Must disable all interactivity and `onChange` callbacks.
- **Governance & Maintainability:**
  - **ADR:** Commit `docs/adr/001-examination-feature-architecture.md` documenting decisions and rejected alternatives.
  - **CODEOWNERS:** Update `.github/CODEOWNERS` to assign ownership of the new directories.
- **Testing:**
  - **Unit Tests** (Vitest) required for logic, components, and hooks.
  - **Test Factories:** Use `createMock[Feature]Data()` factories.
  - **Chaos E2E Tests:** Mandatory Playwright test for crash recovery and offline sync.
- **Styling:** Maintain existing Tailwind CSS styling. Ensure visual fidelity is preserved.

## 3. Implementation Plan

### Phase 1: Foundation & Shared Components

- [ ] Task 1: Initialize Feature Architecture & Shared Utilities
  - File: `frontend/components/examination/forms/` (Create Directory)
  - File: `frontend/components/examination/shared/` (Create Directory)
  - File: `docs/adr/001-examination-feature-architecture.md` (Create ADR)
  - Action: Create directory structure. Implement base types for `Ops` interface. Setup `FormattedError` and `Telemetry` utility skeletons.
  - Notes: Setup eslint rules for no-circular-dependencies.

- [ ] Task 2: Extract Reusable UI Components
  - File: `frontend/components/examination/shared/SystemQueryCombobox.tsx`
  - File: `frontend/components/examination/shared/DiagnosisICDCombobox.tsx`
  - Action: Extract `SystemQueryCombobox` and `DiagnosisICDCombobox` from `page.tsx`. Refactor to be pure, controlled components (`value`, `onChange`).
  - Notes: Wrap in `React.memo`. Ensure Accessibility (`aria-label`).

### Phase 2: Feature Module Implementation (Isolated)

- [ ] Task 3: Implement IPSS Feature Module
  - Directory: `frontend/components/examination/forms/ipss/`
  - Files: `schema.ts`, `constants.ts`, `logic.ts`, `IPSSForm.tsx`
  - Action: Create Zod schema with `.describe()`. Move static strings to constants. Create Pure UI component. Write unit tests for logic.
  - Notes: Ensure 44px touch targets.

- [ ] Task 4: Implement IPSS Controller & Integration
  - File: `frontend/components/examination/forms/ipss/hooks.ts`
  - File: `frontend/components/examination/forms/ipss/index.ts`
  - Action: Implement `useIPSSController`. Add FSM logic (idle/saving). Add Legacy Adapter to map `patientStore` -> `IPSSData`. Implement Offline Queue interaction (mocked initially).
  - Notes: Add Debounce/Auto-save logic.

- [ ] Task 5: Implement IIEF Feature Module
  - Directory: `frontend/components/examination/forms/iief/`
  - Files: `schema.ts`, `constants.ts`, `logic.ts`, `IIEFForm.tsx`, `hooks.ts`, `index.ts`
  - Action: Replicate IPSS pattern for IIEF. Handle "Compact" mode prop if used in page.
  - Notes: `useIIEFController` must handle score calculation logic in `logic.ts`.

- [ ] Task 6: Implement ED Drugs Feature Module (Lazy Loaded)
  - Directory: `frontend/components/examination/forms/ed-drugs/`
  - Files: `EDDrugsFormModal.tsx` (plus schema/hooks)
  - Action: Extract `EDDrugsFormModal` and `ED_DRUG_DATABASE` (move data to `constants.ts`). Prepare for `next/dynamic` usage.
  - Notes: Implement Pre-fetching logic in the hook (on hover).

- [ ] Task 7: Implement EDC Form Feature Module
  - Directory: `frontend/components/examination/forms/edc/`
  - Files: `EDCFormModal.tsx` (plus schema/hooks)
  - Action: Extract `EDCFormModal`. This is complex; ensure `answers` state is managed via schema/hook, not local state if possible, or keep local if it's transient.
  - Notes: Ensure Narrative Generation logic is moved to `logic.ts`.

### Phase 3: Strangler Rollout & Integration

- [ ] Task 8: Strangler Rollout - Phase 1 (IPSS & IIEF)
  - File: `frontend/app/(dashboard)/patients/[id]/examination/page.tsx`
  - Action: Implement `useFeatureFlag` check. Wrap the new `IPSSForm` and `IIEFForm` behind `flags.use_new_examination_forms`.
  - Notes: Ensure legacy code runs if flag is false. Verify data flow matches legacy behavior.

- [ ] Task 9: Strangler Rollout - Phase 2 (Modals)
  - File: `frontend/app/(dashboard)/patients/[id]/examination/page.tsx`
  - Action: Wrap `EDDrugsFormModal` and `EDCFormModal` imports/usage behind the same feature flag.
  - Notes: Verify `onExport` callbacks work correctly with the main page state in both modes.

- [ ] Task 10: Final Cleanup & Optimization
  - File: `frontend/app/(dashboard)/patients/[id]/examination/page.tsx`
  - Action: Delete the inline component definitions (`IPSSQuestion`, `IIEFQuestion`, `ED_DRUG_DATABASE`, etc.).
  - Action: Add `InAppDevTools` component (hidden).
  - Notes: Run final bundle analysis.

## 4. Acceptance Criteria

- [ ] AC 1: IPSS Form Entry
  - Given User is on the Examination Page
  - When User selects a score for an IPSS question
  - Then the UI updates instantly (Optimistic)
  - And the "Saving..." indicator appears momentarily
  - And the data is persisted to the global Store (and DB via auto-save)

- [ ] AC 2: Offline Resilience
  - Given User is offline (simulate via DevTools)
  - When User modifies the IIEF form
  - Then the changes are queued in IndexedDB
  - And the UI shows "Saved (Offline)"
  - And when connection is restored, the queue flushes effectively.

- [ ] AC 3: Crash Recovery
  - Given User has typed detailed notes in EDC Form
  - When the browser tab is accidentally closed/reloaded
  - Then upon re-opening, the draft data is restored from `sessionStorage`
  - And a toast notifies "Draft Restored".

- [ ] AC 4: Accessibility
  - Given User is using a Screen Reader
  - When focusing on any "Compact" IIEF question
  - Then the full question text and current value are announced via `aria-label`.

- [ ] AC 5: Legacy Compatibility
  - Given the refactor is complete
  - When User exports the Examination Narrative
  - Then the text generated matches exactly the format of the legacy system (verified via `logic.ts` tests).

## 5. Additional Context

### Dependencies

- `zod`: For schema validation. (Already in project)
- `lucide-react`: For icons. (Already in project)
- `idb` or `dexie` (Optional): Might need a light wrapper for IndexedDB if `localStorage` isn't enough (using `idb-keyval` is recommended for simplicity).
- `dependency-cruiser`: Dev dependency for architecture checks.

### Testing Strategy

- **Unit:** `vitest` spec files for `[Feature]/logic.ts` (scoring, narrative generation).
- **Integration:** Render `[Feature]Form` with `use[Feature]Controller` mocked to verify UI states (loading, error, readonly).
- **E2E:** Playwright test to automate a full exam entry, trigger a reload, and verify persistence.

### Notes

- **Risk:** `patient-store.ts` might have complex/hidden side effects. The adapters in `hooks.ts` need to be very careful to replicate strict strict subset of `setPatient`.
- **Logic:** The `EDCForm` has complex string concatenation logic. This MUST be covered by unit tests in `logic.ts` before deleting the old code.
