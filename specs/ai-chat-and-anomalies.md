# Spec: Conversational AI and Intelligent Anomalies

Date: 2026-09-24
Status: active implementation spec
Base: Builds upon Milestone D (Deterministic Analysis).

## 1. Outcome and Goals
Add a conversational LLM layer to the RiceMill V2 dashboard to interpret messy, human-entered Excel data.
- **Intelligent Anomalies:** A dedicated UI box that automatically reads raw transaction descriptions and surfaces anomalies (e.g., categorizing messy strings like "pd 4 trck rpr" into actionable insights).
- **Conversational Assistant:** A chat interface allowing the user to ask ad-hoc questions about the uploaded dataset.

## 2. Architectural Constraints & Codebase Rules
- **Immutable Source of Truth:** The database stores the messy raw data exactly as uploaded. The LLM NEVER modifies, cleans, or writes transaction data to the database. It strictly *reads* and interprets on the fly.
- **Tools:** The LLM must use the existing 7 read-only deterministic tools in `backend/app/v2/ai/tools.py` (e.g., `get_transactions`) to fetch data. Do not rewrite these tools.
- **Model:** Use `inclusionai/ling-3.0-flash-fin:free` via the OpenRouter API. Read `OPENROUTER_API_KEY` from the environment.
- **Zero Math Policy & Validation:** The LLM is prohibited from calculating totals itself. It must rely on the deterministic tools for math. Implement a safety boundary (e.g., forcing XML `<cite>` tags or strict validation nodes) to reject any LLM response containing hallucinated numbers not present in the tool results.
- **State Separation:** Use `langgraph-checkpoint-postgres` for multi-turn chat threads (`thread_id`). Do not pollute the existing one-shot `graph_checkpoints` used by the deterministic runs.
- **Money:** Strictly use `Decimal`. No floats.

## 3. High-Level Design (HLD)
1. **API Layer (`backend/app/v2/api/routes/conversations.py`):**
   - `POST /conversations` (start thread)
   - `POST /conversations/{thread_id}/messages` (chat)
   - `GET /conversations/{thread_id}` (history)
2. **AI Layer (`backend/app/v2/ai/`):**
   - A LangGraph workflow with an Agent Node (Ling 3.0), Tool Node (existing tools), and a Validation Node (to strip hallucinated math).
   - A fallback circuit breaker: if OpenRouter returns 429/5xx, gracefully fall back to the existing static insights.
3. **Frontend Layer (`frontend/src/app/import/`):**
   - A new Chat component.
   - An updated Insights panel that displays the LLM-generated anomaly observations alongside the static totals.

## 4. Instructions for the Coding Agent (Codex)
**You (the coding agent) must strictly follow this workflow:**
1. **Read this Spec** thoroughly to understand the architectural boundaries.
2. **Create a Task List:** Before writing any application code, create a new file at `tasks/rice-mill-v2-ai-chat.md`. Outline your step-by-step execution plan using markdown checkboxes (`- [ ]`).
3. **Execute Iteratively:** Write the code to fulfill the tasks autonomously. Check off the boxes in your `tasks/rice-mill-v2-ai-chat.md` file as you complete them.
4. **Respect the Repo:** Read `tasks/README.md`, `specs/decisions.md`, and `frontend/AGENTS.md`. Maintain existing code styles, Pydantic typing, and Next.js App Router conventions.
5. **Testing & Deployment:** Write automated tests for the validation node and API routes. Ensure tests pass locally. Prepare the code for merge and deployment, then halt and prompt the human user to perform manual end-to-end testing in the deployed environment.
