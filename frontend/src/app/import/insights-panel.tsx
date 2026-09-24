"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelV2AnalysisRun, createV2AnalysisRun, getV2AnalysisRun, listV2AnalysisRuns,
  type AnalysisRun,
} from "@/lib/api/client";

type Props = {
  versionId: string;
  onEvidenceClick: (transactionId: string) => Promise<void>;
};

const terminal = new Set(["completed", "partial", "failed", "cancelled"]);

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Insights are unavailable. Please retry.";
}

function metricEvidence(run: AnalysisRun, id: string): string {
  const call = run.tool_calls.find((item) => item.id === id);
  if (!call) return "Calculation unavailable";
  const result = call.result;
  if (call.tool_name === "summarize_cash_flow" && typeof result.net_cash_flow === "string") {
    return `Income ₹${result.income} · Expense ₹${result.expense} · Net cash flow ₹${result.net_cash_flow}`;
  }
  if (call.tool_name === "get_data_quality") {
    return `${result.transaction_count} transactions · ${result.excluded_count} excluded rows`;
  }
  if (Array.isArray(result.candidates)) return `${result.candidates.length} review candidates shown`;
  return call.tool_name.replaceAll("_", " ");
}

export function InsightsPanel({ versionId, onEvidenceClick }: Props) {
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let alive = true;
    setRun(null);
    setError("");
    void listV2AnalysisRuns(versionId).then((page) => {
      if (alive) setRun(page.items[0] ?? null);
    }).catch((cause: unknown) => {
      if (alive) setError(errorText(cause));
    });
    return () => { alive = false; };
  }, [versionId]);

  const runId = run?.id;
  const runStatus = run?.status;
  useEffect(() => {
    if (!runId || !runStatus || terminal.has(runStatus)) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 1500;
    const poll = async () => {
      try {
        const latest = await getV2AnalysisRun(runId);
        if (!alive) return;
        setRun(latest);
        setError("");
        if (!terminal.has(latest.status)) {
          delay = Math.min(delay * 1.5, 10_000);
          timer = setTimeout(() => void poll(), delay);
        }
      } catch (cause) {
        if (!alive) return;
        setError(errorText(cause));
        delay = Math.min(delay * 2, 15_000);
        timer = setTimeout(() => void poll(), delay);
      }
    };
    timer = setTimeout(() => void poll(), delay);
    return () => { alive = false; clearTimeout(timer); };
  }, [runId, runStatus]);

  async function generate() {
    setBusy(true);
    setError("");
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 8_000);
    try {
      setRun(await createV2AnalysisRun(versionId));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  }

  async function cancel() {
    if (!run) return;
    setBusy(true);
    setError("");
    try {
      setRun(await cancelV2AnalysisRun(run.id));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const expired = run?.status === "running" && run.active_lease_until
    && new Date(run.active_lease_until).getTime() < Date.now();
  const retry = !run || ((run.status === "failed" || run.status === "partial" || expired)
    && run.attempt_count < 3);

  return <section className="space-y-4 border-t border-stone-200 pt-5 dark:border-stone-800" aria-label="Insights">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold">Insights</h3>
        <p className="text-sm text-stone-600 dark:text-stone-400">Deterministic checks of this committed workbook.</p></div>
      <div className="flex gap-2">
        {retry && <Button type="button" disabled={busy} onClick={() => void generate()}>
          {busy ? "Starting…" : run ? "Retry insights" : "Generate insights"}</Button>}
        {run && (run.status === "queued" || run.status === "running") &&
          <Button type="button" variant="outline" disabled={busy} onClick={() => void cancel()}>Cancel</Button>}
      </div>
    </div>
    {slow && <p role="status" className="text-sm">The backend is taking longer than usual to respond…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {run && <div role="status" className="text-sm">
      {run.status === "queued" || run.status === "running"
        ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />
            {expired ? "Analysis paused after the server stopped. Retry to resume." : `Analysis ${run.status} · ${run.stage}`}</span>
        : run.status === "failed" ? <span className="text-rose-700">{run.error_message || "Analysis failed. Retry to resume."}</span>
          : run.status === "cancelled" ? "Analysis cancelled."
            : `${run.status === "partial" ? "Partial" : "Completed"} · ${run.findings.length} findings`}
    </div>}
    {run?.status === "partial" && run.error_message &&
      <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">{run.error_message}</p>}
    {run && run.attempt_count >= 3 && (run.status === "failed" || run.status === "partial" || expired) &&
      <p role="alert" className="text-sm text-rose-700">Analysis reached its retry limit.</p>}
    {run && (run.status === "completed" || run.status === "partial") &&
      (run.findings.length ? <ul className="space-y-3">{run.findings.map((finding) =>
        <li key={finding.id} className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">{finding.type.replace("_", " ")} · {finding.severity}</p>
          <h4 className="mt-1 font-semibold">{finding.title}</h4>
          <p className="mt-1 text-sm">{finding.explanation}</p>
          <div className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
            {finding.metric_refs.map((id) => <p key={id}>Calculation: {metricEvidence(run, id)}</p>)}
          </div>
          <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">Limit: {finding.limitations}</p>
          {finding.suggested_check && <p className="mt-1 text-xs">Next check: {finding.suggested_check}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">Evidence:
            {finding.source_refs.map((id, index) => <button key={id} type="button"
              className="text-amber-800 underline dark:text-amber-300"
              onClick={() => void onEvidenceClick(id)}>Transaction {index + 1}</button>)}
          </div>
        </li>)}</ul> : <p className="text-sm">No supported findings for this workbook.</p>)}
  </section>;
}
