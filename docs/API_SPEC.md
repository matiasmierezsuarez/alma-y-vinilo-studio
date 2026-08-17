# API Specification

Canonical endpoint list is in `ALMAYVINILO_STUDIO_2_FINAL_SPEC.md`
section 36.

Implementation requirements: - REST/JSON is acceptable. - All mutation
endpoints must return entity + version/status. - Long-running generation
uses job status. - Provider-specific payloads stay behind adapters. -
Publishing is blocked unless Review status is APPROVED. - Analytics
snapshots must be immutable.
