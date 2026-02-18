# Story 4.2: Akıllı Laboratuvar Analizi (Intelligent Lab Analysis)

Status: completed

### Implementation Summary

Implemented a unified trend analysis service for laboratory results.

- **Data Aggregation:** Queries both `GenelLabSonuc` (automated/structured) and `TetkikSonuc` (manual/summary) models.
- **Unit Normalization:** Canonical unit mapping and dynamic value conversion between units (e.g., ng/mL vs ng/dL).
- **PSA Handling:** Trend calculation enabled, but critical rise alerts disabled per user preference.
- **Frontend Integration:** Added `LabTrendSparkline` and `LabAnalysisWidget` to the Patient Dashboard for immediate visibility of critical markers.
- **API Specs:** Integrated into `/api/v1/lab-analysis/trends`.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Doctor,
I want to see trend analysis graphs for critical lab values (e.g., PSA, Creatinine),
So that I can detect progression or anomalies at a glance.

## Acceptance Criteria

### BDD Scenarios

#### Scenario 1: Trend Visualization

- **Given** historical lab data exists in `sharded_clinical_lab_results` for a patient.
- **When** viewing the patient dashboard / lab section.
- **Then** a "Trend Analysis" widget must display sparklines or line charts for key metrics (PSA, Testosteron, Kreatinin).

#### Scenario 2: Abnormal Slope Detection

- **Given** a sequence of lab results.
- **When** a sudden significant increase (e.g., >20% rise in PSA between consecutive tests) is detected.
- **Then** the standard visualization must be highlighted (e.g., red flag or distinctive icon) to alert the doctor.

#### Scenario 3: Mixed Source Handling

- **Given** lab results might come from legacy data and new sharded data.
- **When** trends are calculated.
- **Then** the service must normalize units and combine data sources to show a unified timeline.

## Tasks / Subtasks

- [ ] Task 1: Lab Data Aggregation Service
  - [ ] Create/Update service to fetch historical lab validation efficiently.
  - [ ] Normalize test names and units (e.g., ng/mL vs others).

- [ ] Task 2: Implement Trend Analysis Logic
  - [ ] Implement logic to calculate slopes/changes between data points.
  - [ ] Define "critical change" thresholds for key urology markers.

- [ ] Task 3: Backend API for Trends
  - [ ] Create `GET /api/v1/patients/{id}/lab-trends`.
  - [ ] Return time-series data suitable for frontend charting (Recharts/Chart.js).

- [ ] Task 4: Frontend Visualization Component
  - [ ] Create `LabTrendSparkline` component.
  - [ ] Integrate into Patient Dashboard.

## Dev Notes

### Architecture Compliance

- **Read-Only:** This feature is primarily read-heavy. Optimize queries.
- **Frontend-Backend:** Backend does the heavy lifting of data normalization; Frontend handles rendering.

### Technical Requirements

- **Libraries:** `pandas` (if complex analysis needed), or plain Python math.

### References

- **Epics:** `_bmad-output/planning-artifacts/epics.md` (Story 4.2)
