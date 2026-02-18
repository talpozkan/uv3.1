# Story 3.2: Standartlaştırılmış PyMuPDF Rapor Motoru (Unified PDF Engine)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Doctor,
I want my reports to have a consistent brand image (Font, Logo, Layout) across the system,
so that I can provide professional and readable medical documents.

## Acceptance Criteria

1. **Brand Consistency**: The PDF header must include the official UroLog logo (`logo.png`) and utilize the `Roboto` font family for all text elements. (AC: #1)
2. **Performance SLA**: PDF generation must complete in under 2 seconds under normal system load. (AC: #2)
3. **Secure Verification**: Each PDF footer must contain a "UroLog Secure PDF" label and a unique verification code derived from a UUID for document traceability. (AC: #3)
4. **Turkish Support**: Full support for Turkish characters (ğ, ü, ş, i, ö, ç) must be guaranteed through proper font embedding (Roboto TTF). (AC: #4)

## Tasks / Subtasks

- [x] Task 1: Asset Preparation (AC: #1, #4)
  - [x] Copy `logo.png` and `Roboto-*.ttf` files from `frontend/public` to `backend/app/assets/branding/`.
  - [x] Ensure the backend directory structure supports static asset loading.
- [x] Task 2: Enhance Base PDF Service (AC: #1, #3, #4)
  - [x] Update `backend/app/services/pdf/base.py` to load Roboto as the primary font.
  - [x] Implement `draw_logo()` method to place the brand logo in the header.
  - [x] Update `draw_footer()` to include the "UroLog Secure PDF" label and a generated UUID.
- [x] Task 3: Refactor Patient Report Service (AC: #1, #2)
  - [x] Update `backend/app/services/pdf_report_service.py` to use the new branding methods from `BasePDFService`.
  - [x] Standardize spacing, colors (Corporate Blue/Gray), and font sizes across sections.
- [x] Task 4: Performance & Character Validation (AC: #2, #4)
  - [x] Verify Turkish character rendering in all sections (Demographics, Clinical, Finance).
  - [x] Benchmark generation time to ensure it meets the <2s requirement.

## Dev Notes

- **Font Handling**: Use `page.insert_font()` with the Roboto TTF files. Do not rely on system-installed fonts to ensure environment parity.
- **Image Handling**: Use `page.insert_image()` for the logo. Position suggested: Top-left of the header rectangle.
- **Architecture Compliance**: Maintain strict Pydantic DTO usage for data passing to the PDF engine. No direct DB calls from the PDF service.
- **Colors**: Use the established medical palette:
  - Header/Titles: Dark Blue `(0.1, 0.2, 0.5)`
  - Accents: Medium Blue `(0.3, 0.5, 0.8)`
  - Text: Dark Gray `(0.2, 0.2, 0.2)`
- **Constraint**: Purple/Neon-pink designs are strictly forbidden.

### Project Structure Notes

- Branding Assets: `backend/app/assets/branding/`
- Base Service: `backend/app/services/pdf/base.py`
- Report Service: `backend/app/services/pdf_report_service.py`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Architecture: _bmad-output/planning-artifacts/architecture.md#Decision: Library Standardization]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
