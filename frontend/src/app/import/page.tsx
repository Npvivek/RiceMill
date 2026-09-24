"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InsightsPanel } from "./insights-panel";
import { AiAssistant } from "./ai-assistant";
import {
  getV2Import, listV2Imports, uploadV2Import,
  type ImportDetail, type ImportPage,
} from "@/lib/api/client";

type Phase = "idle" | "uploading" | "parsing" | "backend-cold" | "success" | "error";

const MAX_FILE_BYTES = 10_485_760;

function money(value: string): string {
  return `₹${value}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please retry.";
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [list, setList] = useState<ImportPage | null>(null);
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const coldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async (page = 1) => {
    setListLoading(true);
    setListError("");
    try {
      setList(await listV2Imports(page));
    } catch (error) {
      setListError(errorMessage(error));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    return () => {
      if (coldTimer.current) clearTimeout(coldTimer.current);
    };
  }, [loadList]);

  async function showDetail(importId: string, page = 1, focusTransactionId?: string) {
    setDetailLoading(true);
    setDetailError("");
    try {
      const record = await getV2Import(importId, page, 50, focusTransactionId);
      setDetail(record);
      setDetailPage(record.page);
      if (focusTransactionId) {
        window.setTimeout(() => document.getElementById(`transaction-${focusTransactionId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      }
    } catch (error) {
      setDetailError(errorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setPhase("error");
      setUploadMessage("Choose an .xlsx workbook first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx") || !file.size || file.size > MAX_FILE_BYTES) {
      setPhase("error");
      setUploadMessage("Choose an .xlsx workbook between 1 byte and 10 MB.");
      return;
    }
    setPhase("uploading");
    setProgress(0);
    setUploadMessage("");
    coldTimer.current = setTimeout(() => setPhase("backend-cold"), 8_000);
    try {
      const { result, duplicate } = await uploadV2Import(
        file,
        (percent) => setProgress(percent),
        () => setPhase("parsing"),
      );
      setPhase(result.status === "committed" ? "success" : "error");
      setUploadMessage(result.status === "failed"
        ? result.error_message || "This workbook previously failed to import. Correct the file before trying again."
        : result.status !== "committed"
          ? "This workbook is already being processed. Check its status below."
          : duplicate
            ? "This workbook was already imported. Showing the existing record."
            : `Imported ${result.transaction_count} transactions from ${result.file_name}.`);
      await Promise.all([loadList(), showDetail(result.id)]);
    } catch (error) {
      setPhase("error");
      setUploadMessage(errorMessage(error));
      await loadList();
    } finally {
      if (coldTimer.current) clearTimeout(coldTimer.current);
      coldTimer.current = null;
    }
  }

  const busy = phase === "uploading" || phase === "parsing" || phase === "backend-cold";

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 dark:bg-gray-950 dark:text-stone-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-amber-800 hover:underline dark:text-amber-300">
          <ArrowLeft className="h-4 w-4" /> Saved browser reports
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workbook imports</h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Upload an Excel workbook, inspect its transactions, and explore AI insights.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <label htmlFor="workbook" className="flex items-center gap-2 font-semibold">
                <FileSpreadsheet className="h-5 w-5 text-amber-700" /> Excel workbook
              </label>
              <input
                id="workbook" type="file" accept=".xlsx" disabled={busy}
                onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPhase("idle"); setUploadMessage(""); }}
                className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-amber-100 file:px-3 file:py-1 file:text-amber-950 dark:border-stone-700 dark:bg-gray-900"
              />
              <Button type="submit" disabled={busy || !file} className="gap-2">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {busy ? "Processing…" : "Import workbook"}
              </Button>
              <div role="status" aria-live="polite" className="min-h-5 text-sm">
                {phase === "uploading" && `Uploading… ${progress}%`}
                {phase === "parsing" && "Upload complete. Parsing and saving transactions…"}
                {phase === "backend-cold" && "The server is taking longer than usual. Your import is still processing…"}
                {phase === "success" && <span className="text-emerald-700 dark:text-emerald-400">{uploadMessage}</span>}
                {phase === "error" && <span className="text-rose-700 dark:text-rose-400">{uploadMessage}</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold">Past imports</h2>
            {listLoading ? <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading imports…</p>
              : listError ? <div className="space-y-2"><p role="alert" className="text-sm text-rose-700">{listError}</p><Button type="button" variant="outline" onClick={() => void loadList(list?.page ?? 1)}>Retry</Button></div>
                : !list?.items.length ? <p className="text-sm text-stone-600 dark:text-stone-400">No workbooks imported yet.</p>
                  : <ul className="divide-y divide-stone-200 dark:divide-stone-800">
                    {list.items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div><p className="font-medium">{item.file_name}</p><p className="text-xs text-stone-600 dark:text-stone-400">{item.status} · {item.transaction_count} transactions · {new Date(item.created_at).toLocaleString()}</p></div>
                      <Button type="button" variant="outline" onClick={() => void showDetail(item.id)}>View</Button>
                    </li>)}
                  </ul>}
            {list && list.total > list.page_size && <div className="flex items-center gap-3 text-sm">
              <Button type="button" variant="outline" disabled={list.page <= 1 || listLoading} onClick={() => void loadList(list.page - 1)}>Previous</Button>
              <span>Page {list.page}</span>
              <Button type="button" variant="outline" disabled={list.page * list.page_size >= list.total || listLoading} onClick={() => void loadList(list.page + 1)}>Next</Button>
            </div>}
          </CardContent>
        </Card>

        {(detail || detailError || detailLoading) && <Card>
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold">Import details</h2>
            {detailLoading ? <p role="status">Loading transactions…</p> : detailError ? <p role="alert" className="text-rose-700">{detailError}</p> : detail && <>
              <p className="text-sm">{detail.import_record.file_name} · {detail.import_record.status} · {detail.total} transactions</p>
              {detail.import_record.error_message && <p role="alert" className="text-sm text-rose-700">{detail.import_record.error_message}</p>}
              {detail.import_record.status === "committed" && detail.import_record.source_row_count > detail.import_record.transaction_count &&
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {detail.import_record.source_row_count - detail.import_record.transaction_count} source rows were excluded from totals. These may include headers, totals, notes, or invalid entries. Check the workbook if expected transactions are missing.
                </p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">Income <strong className="block text-lg">{money(detail.import_record.income_total)}</strong></p>
                <p className="rounded-lg bg-rose-50 p-3 text-sm dark:bg-rose-950/30">Expense <strong className="block text-lg">{money(detail.import_record.expense_total)}</strong></p>
              </div>
              {detail.dataset_version_id && detail.import_record.status === "committed" &&
                <><InsightsPanel key={`insights:${detail.dataset_version_id}`} versionId={detail.dataset_version_id}
                  onEvidenceClick={(id) => showDetail(detail.import_record.id, 1, id)} />
                  <AiAssistant key={`ai:${detail.dataset_version_id}`} versionId={detail.dataset_version_id}
                    onEvidenceClick={(id) => showDetail(detail.import_record.id, 1, id)} /></>}
              {detail.transactions.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
                <thead><tr className="border-b border-stone-300 dark:border-stone-700"><th className="py-2">Date</th><th>Description</th><th>Direction</th><th>Amount</th><th>Source</th></tr></thead>
                <tbody>{detail.transactions.map((row) => <tr key={row.id} id={`transaction-${row.id}`} className="scroll-mt-20 border-b border-stone-200 dark:border-stone-800 target:bg-amber-100">
                  <td className="py-2">{row.transaction_date}</td><td>{row.description}</td><td className="capitalize">{row.direction}</td><td>{money(row.amount)}</td><td>{row.source_sheet}:{row.source_row}</td>
                </tr>)}</tbody>
              </table></div>}
              {detail.total > detail.page_size && <div className="flex items-center gap-3 text-sm">
                <Button type="button" variant="outline" disabled={detailPage <= 1} onClick={() => void showDetail(detail.import_record.id, detailPage - 1)}>Previous</Button>
                <span>Page {detailPage}</span>
                <Button type="button" variant="outline" disabled={detailPage * detail.page_size >= detail.total} onClick={() => void showDetail(detail.import_record.id, detailPage + 1)}>Next</Button>
              </div>}
            </>}
          </CardContent>
        </Card>}
      </div>
    </main>
  );
}
