# Documentation

These rules govern project documentation, not the user's global communication preferences.

- Read order: `tasks/README.md` → the active handoff → the relevant spec section → `specs/decisions.md` if the task touches a settled choice.
- Specs describe intended behavior. Handoffs describe current state. Recon describes verifiable present truth. Decisions record settled choices.
- Do not duplicate content across docs. Link instead.
- Recon reports are dated and immutable. If wrong, write a new one; do not edit the old.
- Decisions are append-only. Never rewrite a past entry.
- A handoff marked COMPLETE is not edited. Start a new one.
- In recon and handoff files, cite code with Markdown links whose URL fragment contains the line number, such as `[file.py](../backend/app/file.py#L18)`. Do not put `(line 18)` in the link text.
