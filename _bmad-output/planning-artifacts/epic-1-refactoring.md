# Epic 1: Examination Page Refactoring

## Description

Refactor functionality of the Examination page to improve maintainability, type safety, and component architecture.

### Story 1.1: Strangler Fig Rollout

Mount IPSS and IIEF feature modules behind feature flags and verify data binding.

### Story 1.2: Final Cleanup

Remove feature flags, delete legacy components, and refactor unrelated forms.

### Story 1.3: Physical Exam & Diagnosis

Create Physical Exam and Diagnosis modules and replace inline UI.

### Story 1.4: History & Habits

Extract SystemQueryCombobox, create Anamnesis, System Query, Medical History, and Habits modules.

### Story 1.5: Deep Cleanup & Logic Extraction

Extract logic to custom hooks and separate sidebar component.

### Story 1.6: Component Extraction

Extract Toolbar and Dialogs components.

### Story 1.7: Polish & Strict Typing

Enforce strict typing across all adapters and hooks, removing 'as any'.
