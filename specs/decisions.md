# Decision log

Append-only. Each entry records its date, decision, reason, and alternatives considered. Add new entries below existing ones; do not rewrite past entries.

## Empty entry template

### YYYY-MM-DD — Decision title

- **Date:** YYYY-MM-DD
- **Decision:**
- **Reason:**
- **Alternatives considered:**

## 2026-09-23 — Cross-workspace integrity for C tables
Decision: Carry workspace_id through imports, dataset_versions, source_rows and transactions; enforce lineage with composite foreign keys.
Reason: Database constraints reject cross-workspace links during application, direct SQL and admin writes.
The transaction-to-source-row key includes dataset_version_id, preventing links to another dataset within the same workspace.
Accept that these constraints do not enforce review approval; the commit path must separately reject unresolved source rows.
Alternatives considered:
- Trigger-based checks: rejected for relationship equality because custom mutation coverage and locking duplicate native FK enforcement.
- RLS-only: rejected because authorization policies can be bypassed and do not inherently guarantee relational consistency.
- Exclusive database write functions: rejected as sole enforcement because privileged direct writes and function bugs can bypass their checks.
