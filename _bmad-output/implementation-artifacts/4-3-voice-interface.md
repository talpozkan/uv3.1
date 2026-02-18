# Story 4.3: Sesli Komut Arayüzü (Voice Interface)

Status: backlog

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Doctor,
I want a microphone button on the examination form,
So that I can trigger the AI Scribe directly from the UI.

## Acceptance Criteria

### BDD Scenarios

#### Scenario 1: Voice Capture

- **Given** the examination page is open in the browser.
- **When** the "Start Recording" button is clicked.
- **Then** the browser must request microphone permission and start capturing audio.
- **And** provide visual feedback (recording indicator/waveform).

#### Scenario 2: Audio Submission

- **Given** a recording session is active.
- **When** the "Stop/Analyze" button is clicked.
- **Then** the audio blob must be sent to the backend `AIService` endpoint.
- **And** a loading state must be shown while processing.

#### Scenario 3: Auto-Fill

- **Given** the backend returns structured JSON from the audio.
- **When** the response is received.
- **Then** the form fields (Chief Complaint, etc.) must be automatically populated with the returned data.
- **And** the doctor must be able to edit the filled data before saving.

## Tasks / Subtasks

- [ ] Task 1: Frontend Audio Capture
  - [ ] Implement `AudioRecorder` component using MediaStream Recording API.
  - [ ] Handle permissions and error states (no mic, permission denied).

- [ ] Task 2: Integration with AI Backend
  - [ ] Connect `AudioRecorder` to `POST /api/v1/ai-scribe/analyze` (multipart/form-data for audio).

- [ ] Task 3: Form State Management
  - [ ] Update Examination Form to accept "auto-fill" payloads.
  - [ ] Ensure manual edits are preserved if auto-fill only targets specific fields.

## Dev Notes

### Architecture Compliance

- **UI/UX:** Must fit seamlessly into the existing Examination Form design (Cyan theme).
- **Browser Compatibility:** Support modern Chrome/Firefox/Safari.

### Technical Requirements

- **Frontend:** React/Vue (depending on stack), MediaRecorder API.

### References

- **Epics:** `_bmad-output/planning-artifacts/epics.md` (Story 4.3)
