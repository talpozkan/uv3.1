# Retrospective: Epic 3 - Resilient Reporting

**Date**: 2026-02-01
**Status**: Completed

## 1. Executive Summary

Epic 3 focused on ensuring clinical reports could be generated reliably and professionally, even under partial system failure. We successfully implemented a "Non-Stop" reporting mechanisms and a unified, brand-compliant PDF engine.

**Key Metrics:**

- **Stories Completed**: 2/2
- **Performance**: PDF Generation < 0.02s (Target: < 2s)
- **Compliance**: KVKK Compliant (No PII in logs), Secure Verification added to footers.

## 2. What Went Well (Successes)

- **Performance optimization**: The final optimizations (in-memory asset caching) resulted in extremely fast PDF generation (0.013s), far exceeding the 2s SLA.
- **Resilience**: The report service gracefully handles missing financial data, ensuring doctors can still generate clinical summaries (Story 3.1).
- **Standardization**: The `BasePDFService` refactoring successfully centralized branding logic, ensuring all future reports will automatically inherit the correct look and feel.

## 3. Challenges & Lessons Learned

- **Typography & Font Weights**: We initially missed that `fitz` (PyMuPDF) doesn't automatically synthesize bold weights for loaded fonts. We had to explicitly map `Roboto-Bold.ttf`.
  - *Lesson*: Always verify font rendering with visual inspection or specific weight checks, especially when using custom embedded fonts.
- **Resource Management**: Initial implementations re-opened font files and images for every page/request.
  - *Lesson*: For high-throughput services like reporting, asset caching (initializing once) is critical. Use `__init__` or a singleton pattern for static assets.

## 4. Action Items for Next Epic

- [ ] **monitor-pdf-performance**: Add production logging to track if PDF generation stays under 100ms under load.
- [ ] **font-fallback-strategy**: Verify that the fallback to Helvetica works correctly in a containerized environment where `Roboto` might accidentally be missing (defensive programming).

## 5. Conclusion

Epic 3 is a success. The "Resilient Reporting" module is robust, fast, and secure. We are ready to proceed to the next phase of the project.
