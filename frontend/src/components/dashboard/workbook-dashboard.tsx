"use client";

import readExcelFile from "read-excel-file/browser";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  HardDriveDownload,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeWorkbook, type WorkbookAnalysis, type WorkbookSheet } from "@/lib/excel-analysis";
import { downloadAnalysisPdf } from "@/lib/pdf-report";
import {
  deserializeAnalysis,
  hashWorkbook,
  REPORT_SUMMARY_COLUMNS,
  serializeAnalysis,
  type ReportSummary,
  type SavedReport,
} from "@/lib/reports";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const count = new Intl.NumberFormat("en-IN");

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function reportDate(value: string | null): string {
  return value ? shortDate.format(new Date(value)) : "—";
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function kindLabel(kind: string): string {
  if (kind === "income") return "Income";
  if (kind === "expense") return "Expense";
  if (kind === "reference") return "Reference";
  return "Mixed";
}

function LedgerMetric({ label, value, note, tone = "default" }: { label: string; value: string; note: string; tone?: "green" | "red" | "default" }) {
  const valueColor = tone === "green" ? "text-emerald-700 dark:text-emerald-400" : tone === "red" ? "text-rose-700 dark:text-rose-400" : "text-foreground";

  return (
    <div className="min-w-0 px-5 py-5 lg:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-2 truncate text-2xl font-bold tracking-[-0.03em] tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function ReportDisclosure({
  title,
  description,
  countLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  countLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {countLabel && <span className="text-[11px] font-medium text-muted-foreground">{countLabel}</span>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </Card>
  );
}

function SavedReports({
  reports,
  loading,
  error,
  actionId,
  onOpen,
  onDownload,
  onDelete,
  onExport,
}: {
  reports: ReportSummary[];
  loading: boolean;
  error: string | null;
  actionId: string | null;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            <Database className="h-4 w-4" /> Report archive
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Saved reports</h1>
            {!loading && !error && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {count.format(reports.length)} {reports.length === 1 ? "report" : "reports"}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Open, download, back up or remove your saved analyses.</p>
        </div>
        {reports.length > 0 && (
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2 self-start">
            <HardDriveDownload className="h-4 w-4" /> Export backup
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-border bg-card shadow-sm">
        {loading ? (
          <CardContent className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading saved reports…
          </CardContent>
        ) : error ? (
          <CardContent className="flex items-start gap-3 py-8 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Report history is not available yet.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        ) : reports.length === 0 ? (
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Clock3 className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">No saved reports yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your first Excel analysis will be saved here automatically.</p>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {reports.map((report) => (
              <article key={report.id} className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <button type="button" onClick={() => onOpen(report.id)} className="max-w-full text-left">
                    <p className="truncate text-sm font-semibold text-foreground hover:text-amber-700 dark:hover:text-amber-400">{report.file_name}</p>
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{reportDate(report.analyzed_at)}</span>
                    <span>{count.format(report.transaction_count)} transactions</span>
                    <span>{report.sheet_count} sheets</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:max-w-lg">
                    <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Income</span><span className="font-semibold text-emerald-700 dark:text-emerald-400">{money.format(report.income)}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</span><span className="font-semibold text-rose-700 dark:text-rose-400">{money.format(report.expenses)}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Net</span><span className="font-semibold text-foreground">{money.format(report.net)}</span></div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button size="sm" variant="outline" onClick={() => onOpen(report.id)} disabled={actionId === report.id} className="gap-1.5">
                    {actionId === report.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Open
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDownload(report.id)} disabled={actionId === report.id} aria-label={`Download ${report.file_name} PDF`}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(report.id)} disabled={actionId === report.id} className="text-muted-foreground hover:text-rose-700" aria-label={`Delete ${report.file_name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function EmptyAnalyzer({
  busy,
  dragging,
  error,
  onFile,
  onDragging,
}: {
  busy: boolean;
  dragging: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onDragging: (value: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Excel analysis</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upload an .xlsx workbook to create a complete financial report.
        </p>
      </div>

      <Card className="overflow-hidden border-border bg-card shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <label
            htmlFor="workbook-upload"
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
            onKeyDown={(event) => {
              if (!busy && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              onDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget === event.target) onDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) onFile(file);
            }}
            className={`group flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-10 text-center transition-all ${
              dragging
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                : "border-amber-300/80 bg-amber-50/35 hover:border-amber-500 hover:bg-amber-50/60 dark:border-amber-900/80 dark:bg-amber-950/10 dark:hover:border-amber-700 dark:hover:bg-amber-950/20"
            } ${busy ? "cursor-wait" : "cursor-pointer"}`}
          >
            <input
              ref={inputRef}
              id="workbook-upload"
              type="file"
              disabled={busy}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file);
                event.currentTarget.value = "";
              }}
            />
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition-transform group-hover:-translate-y-0.5 dark:bg-amber-900/50 dark:text-amber-300">
              {busy ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
            </div>
            <p className="text-lg font-semibold text-foreground">{busy ? "Reading every worksheet…" : "Drop your Excel file here"}</p>
            <p className="mt-1 text-sm text-muted-foreground">or click to choose a .xlsx file, up to 20 MB</p>
            {!busy && (
              <span className="mt-5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm group-hover:bg-amber-700">
                Choose workbook
              </span>
            )}
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

    </div>
  );
}

function AnalysisReport({
  analysis,
  onReset,
  saveState,
  returnToReports = false,
}: {
  analysis: WorkbookAnalysis;
  onReset: () => void;
  saveState: "saving" | "saved" | "error" | null;
  returnToReports?: boolean;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const chartMax = Math.max(1, ...analysis.months.flatMap((month) => [Math.abs(month.income), Math.abs(month.expense)]));
  const categoryMax = Math.max(1, ...analysis.categories.slice(0, 8).map((category) => Math.abs(category.amount)));
  const activeMonths = analysis.months.length;
  const displayedIncome = analysis.months.reduce((total, month) => total + month.income, 0);
  const displayedExpenses = analysis.months.reduce((total, month) => total + month.expense, 0);
  const averageIncome = activeMonths ? displayedIncome / activeMonths : 0;
  const averageExpenses = activeMonths ? displayedExpenses / activeMonths : 0;
  const expenseRatio = analysis.income > 0 ? analysis.expenses / analysis.income * 100 : 0;
  const rowCoverage = analysis.sourceRows > 0 ? Math.min(100, analysis.transactionCount / analysis.sourceRows * 100) : 0;
  const includedSheets = analysis.sheets.filter((sheet) => sheet.includedInCashFlow).length;
  const reviewSheets = analysis.sheetCount - includedSheets;
  const missingDates = analysis.sheets.reduce((total, sheet) => total + sheet.missingDateRows, 0);
  const missingAmounts = analysis.sheets.reduce((total, sheet) => total + sheet.missingAmountRows, 0);
  const topIncomeCategory = analysis.categories.find((category) => category.kind === "income");
  const topExpenseCategory = analysis.categories.find((category) => category.kind === "expense");
  const highestIncomeMonth = activeMonths
    ? analysis.months.reduce((highest, month) => month.income > highest.income ? month : highest)
    : null;
  const highestExpenseMonth = activeMonths
    ? analysis.months.reduce((highest, month) => month.expense > highest.expense ? month : highest)
    : null;
  const dateSpanYears = analysis.dateFrom && analysis.dateTo
    ? (analysis.dateTo.getTime() - analysis.dateFrom.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const dateRangeNeedsReview = dateSpanYears > 10 || analysis.warnings.some((warning) => /date typo|date outlier/i.test(warning));
  const confidence = analysis.warnings.length === 0 && !dateRangeNeedsReview
    ? "High"
    : analysis.warnings.length <= 5 && !dateRangeNeedsReview
      ? "Moderate"
      : "Needs review";
  const visibleNotes = showAllNotes ? analysis.warnings : analysis.warnings.slice(0, 4);

  async function handlePdfDownload() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadAnalysisPdf(analysis);
    } catch (reason) {
      console.error(reason);
      setPdfError("The PDF could not be created. Please try the download again.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            <FileSpreadsheet className="h-4 w-4" /> Workbook report
          </div>
          <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">{analysis.fileName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{formatDate(analysis.dateFrom)} – {formatDate(analysis.dateTo)}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.sheetCount} sheets</span>
            <span aria-hidden="true">·</span>
            <span>{count.format(analysis.sourceRows)} populated rows</span>
            <span
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                saveState === "error"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              }`}
            >
              {saveState === "saving" && <LoaderCircle className="h-3 w-3 animate-spin" />}
              {saveState === "saving" ? "Saving" : saveState === "error" ? "Not saved" : saveState === "saved" ? "Saved" : "Ready"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <Button onClick={handlePdfDownload} disabled={pdfBusy} className="gap-2 bg-amber-600 text-white hover:bg-amber-700">
            {pdfBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfBusy ? "Preparing PDF..." : "Download PDF"}
          </Button>
          <Button variant="outline" onClick={onReset} className="gap-2">
            {returnToReports ? <ArrowLeft className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {returnToReports ? "Back to saved reports" : "Analyze another file"}
          </Button>
        </div>
      </div>

      {saveState === "error" && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>The report is ready but was not saved. Download the PDF before leaving this page.</p>
        </div>
      )}

      {pdfError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{pdfError}</p>
        </div>
      )}

      <Card className="overflow-hidden border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 lg:px-6">
          <span className="h-8 w-1 rounded-full bg-amber-500" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Financial snapshot</h2>
            <p className="text-xs text-muted-foreground">Classified cash movement from the workbook</p>
          </div>
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <LedgerMetric label="Money received" value={money.format(analysis.income)} note="Classified receipts" tone="green" />
          <LedgerMetric label="Money spent" value={money.format(analysis.expenses)} note="Classified outflows" tone="red" />
          <LedgerMetric label="Net cash flow" value={money.format(analysis.net)} note={analysis.net >= 0 ? "Income exceeded expenses" : "Expenses exceeded income"} tone={analysis.net < 0 ? "red" : "green"} />
          <LedgerMetric label="Transactions included" value={count.format(analysis.transactionCount)} note="Dated rows used in totals" />
        </div>
        <div className="grid border-t border-border bg-muted/20 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Expense / income", analysis.income > 0 ? `${expenseRatio.toFixed(1)}%` : "—"],
            ["Average inflow shown", activeMonths ? money.format(averageIncome) : "—"],
            ["Average outflow shown", activeMonths ? money.format(averageExpenses) : "—"],
            ["Months shown", count.format(activeMonths)],
            ["Rows classified", `${rowCoverage.toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-border px-5 py-3 last:border-b-0 sm:border-b sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden border-border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="p-5 lg:p-6">
            <div className="flex items-center gap-3">
              <span className="h-7 w-1 rounded-full bg-amber-500" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">What stands out</h2>
                <p className="text-xs text-muted-foreground">A quick reading of this report</p>
              </div>
            </div>
            <ul className="mt-5 space-y-4">
              <li className="flex gap-3 text-sm leading-6 text-foreground">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {analysis.net >= 0
                  ? `Money received exceeded spending by ${money.format(analysis.net)}.`
                  : `Spending exceeded money received by ${money.format(Math.abs(analysis.net))}.`}
              </li>
              {highestIncomeMonth && (
                <li className="flex gap-3 text-sm leading-6 text-foreground">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {highestIncomeMonth.label} had the highest detected inflow at {money.format(highestIncomeMonth.income)}.
                </li>
              )}
              {topExpenseCategory && (
                <li className="flex gap-3 text-sm leading-6 text-foreground">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {topExpenseCategory.name} was the largest detected expense category at {money.format(topExpenseCategory.amount)}.
                </li>
              )}
            </ul>
          </div>
          <div className="border-t border-border bg-muted/20 p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Data quality</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Confidence in the automatic reading</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${confidence === "High" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>{confidence}</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
              <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Included sheets</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{includedSheets}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Review-only sheets</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{reviewSheets}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Missing dates</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{count.format(missingDates)}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Missing amounts</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{count.format(missingAmounts)}</dd></div>
            </dl>
            {dateRangeNeedsReview && (
              <p className="mt-5 flex gap-2 border-t border-amber-200 pt-4 text-xs leading-5 text-amber-800 dark:border-amber-900/70 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> One or more dates may be mistyped or outside the main reporting period. Review the notes before relying on the timeline.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly movement</CardTitle>
            <p className="text-xs text-muted-foreground">Latest 12 active months found in the workbook</p>
          </CardHeader>
          <CardContent>
            {analysis.months.length > 0 ? (
              <div>
                <div className="flex h-52 items-end gap-2 border-b border-border pt-4 sm:gap-3">
                  {analysis.months.map((month) => (
                    <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                      <div className="flex h-[calc(100%-24px)] items-end justify-center gap-0.5 sm:gap-1" title={`${month.label}: Income ${money.format(month.income)}, Expenses ${money.format(month.expense)}`}>
                        <div className="w-2.5 rounded-t bg-emerald-500/85 sm:w-4" style={{ height: `${Math.max(month.income ? 3 : 0, Math.abs(month.income) / chartMax * 100)}%` }} />
                        <div className="w-2.5 rounded-t bg-rose-400/90 sm:w-4" style={{ height: `${Math.max(month.expense ? 3 : 0, Math.abs(month.expense) / chartMax * 100)}%` }} />
                      </div>
                      <p className="mt-2 truncate text-center text-[9px] text-muted-foreground sm:text-[10px]">{month.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Income</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Expenses</span>
                </div>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No dated cash-flow rows were found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Largest categories</CardTitle>
            <p className="text-xs text-muted-foreground">Automatic rice-mill grouping</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.categories.slice(0, 8).map((category) => (
              <div key={`${category.kind}-${category.name}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-foreground">{category.name}</span>
                  <span className={category.kind === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                    {money.format(category.amount)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${category.kind === "income" ? "bg-emerald-500" : "bg-rose-400"}`}
                    style={{ width: `${Math.max(3, Math.abs(category.amount) / categoryMax * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {analysis.categories.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No categories available.</p>}
            {(topIncomeCategory || topExpenseCategory) && (
              <p className="border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
                {topIncomeCategory ? `Largest inflow: ${topIncomeCategory.name}. ` : ""}
                {highestExpenseMonth ? `Highest outflow month: ${highestExpenseMonth.label}.` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ReportDisclosure title="Sheet audit" description="See which worksheets contributed to the totals" countLabel={`${analysis.sheetCount} sheets`}>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-y border-border bg-muted/45 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Sheet</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Entries</th>
                  <th className="px-4 py-3 text-right font-semibold">Detected total</th>
                  <th className="px-4 py-3 font-semibold">Date range</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analysis.sheets.map((sheet) => (
                  <tr key={sheet.name} className="hover:bg-muted/25">
                    <td className="px-5 py-3 font-medium text-foreground">{sheet.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={sheet.kind === "income" ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400" : sheet.kind === "expense" ? "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400" : "text-muted-foreground"}>
                        {kindLabel(sheet.kind)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{count.format(sheet.transactionCount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{sheet.transactionCount ? money.format(sheet.total) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(sheet.dateFrom)} – {formatDate(sheet.dateTo)}</td>
                    <td className="px-5 py-3 text-xs">
                      {sheet.includedInCashFlow ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Included</span>
                      ) : (
                        <span className="text-muted-foreground">Review only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {analysis.sheets.map((sheet) => (
              <div key={sheet.name} className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-foreground">{sheet.name}</p>
                  <Badge variant="outline" className={sheet.kind === "income" ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400" : sheet.kind === "expense" ? "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400" : "text-muted-foreground"}>{kindLabel(sheet.kind)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="block text-muted-foreground">Entries</span><span className="mt-0.5 block font-medium tabular-nums text-foreground">{count.format(sheet.transactionCount)}</span></div>
                  <div><span className="block text-muted-foreground">Detected total</span><span className="mt-0.5 block font-medium tabular-nums text-foreground">{sheet.transactionCount ? money.format(sheet.total) : "—"}</span></div>
                  <div className="col-span-2"><span className="block text-muted-foreground">Date range</span><span className="mt-0.5 block text-foreground">{formatDate(sheet.dateFrom)} – {formatDate(sheet.dateTo)}</span></div>
                </div>
              </div>
            ))}
          </div>
      </ReportDisclosure>

      <ReportDisclosure title="Largest entries" description="Inspect unusual or high-value transactions" countLabel={`${analysis.topTransactions.length} entries`}>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-y border-border bg-muted/45 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Sheet</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analysis.topTransactions.map((transaction) => (
                    <tr key={`${transaction.sheet}-${transaction.row}`} className="hover:bg-muted/25">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{formatDate(transaction.date)}</td>
                      <td className="max-w-64 truncate px-4 py-3 font-medium text-foreground" title={transaction.description}>{transaction.description}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.sheet}</td>
                      <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${transaction.kind === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                        {money.format(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {analysis.topTransactions.map((transaction) => (
                <div key={`${transaction.sheet}-${transaction.row}`} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 font-medium text-foreground">{transaction.description}</p>
                    <p className={`shrink-0 font-semibold tabular-nums ${transaction.kind === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{money.format(transaction.amount)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(transaction.date)} · {transaction.sheet}</p>
                </div>
              ))}
            </div>
      </ReportDisclosure>

      <ReportDisclosure title="Review notes" description="Items the automatic analysis could not safely assume" countLabel={analysis.warnings.length ? `${analysis.warnings.length} notes` : "No issues"} defaultOpen={analysis.warnings.length > 0}>
          <div className="p-5">
            {analysis.warnings.length > 0 ? (
              <ul className="space-y-3">
                {visibleNotes.map((warning) => (
                  <li key={warning} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> {warning}
                  </li>
                ))}
                {analysis.warnings.length > 4 && (
                  <li className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAllNotes((current) => !current)}
                      aria-expanded={showAllNotes}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 transition-colors hover:text-amber-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-400 dark:hover:text-amber-200"
                    >
                      {showAllNotes ? "Show fewer" : `Show all ${analysis.warnings.length} notes`}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllNotes ? "rotate-180" : ""}`} />
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              <div className="flex items-center gap-2 py-4 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> No obvious data-quality issues detected.
              </div>
            )}
          </div>
      </ReportDisclosure>
    </div>
  );
}

export function WorkbookDashboard({ view }: { view: "analyzer" | "reports" }) {
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportActionId, setReportActionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: queryError } = await supabase
          .from("reports")
          .select(REPORT_SUMMARY_COLUMNS)
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;
        if (active) setReports((data ?? []) as unknown as ReportSummary[]);
      } catch (reason) {
        console.error(reason);
        if (active) setReportsError("Connect Supabase and run the reports migration to enable saved history.");
      } finally {
        if (active) setReportsLoading(false);
      }
    }

    void loadReports();
    return () => {
      active = false;
    };
  }, []);

  async function fetchSavedReport(id: string): Promise<SavedReport> {
    const supabase = createSupabaseBrowserClient();
    const { data, error: queryError } = await supabase.from("reports").select("*").eq("id", id).single();
    if (queryError || !data) throw queryError ?? new Error("Saved report not found");
    return data as unknown as SavedReport;
  }

  async function saveReport(file: File, result: WorkbookAnalysis) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error("Not authenticated");

    const fileHash = await hashWorkbook(file);
    const serialized = serializeAnalysis(result);
    const payload = {
      user_id: user.id,
      file_name: result.fileName,
      file_size: file.size,
      file_hash: fileHash,
      analyzed_at: new Date().toISOString(),
      date_from: serialized.dateFrom?.slice(0, 10) ?? null,
      date_to: serialized.dateTo?.slice(0, 10) ?? null,
      income: result.income,
      expenses: result.expenses,
      net: result.net,
      transaction_count: result.transactionCount,
      sheet_count: result.sheetCount,
      source_rows: result.sourceRows,
      parser_version: "1",
      analysis: serialized,
    };

    const { data, error: saveError } = await supabase
      .from("reports")
      .upsert(payload, { onConflict: "user_id,file_hash" })
      .select(REPORT_SUMMARY_COLUMNS)
      .single();

    if (saveError || !data) throw saveError ?? new Error("Report was not saved");
    const summary = data as unknown as ReportSummary;
    setReports((current) => [summary, ...current.filter((report) => report.id !== summary.id)]);
  }

  async function openReport(id: string) {
    setReportActionId(id);
    try {
      const report = await fetchSavedReport(id);
      setAnalysis(deserializeAnalysis(report.analysis));
      setSaveState("saved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      console.error(reason);
      toast.error("That saved report could not be opened.");
    } finally {
      setReportActionId(null);
    }
  }

  async function downloadSavedPdf(id: string) {
    setReportActionId(id);
    try {
      const report = await fetchSavedReport(id);
      await downloadAnalysisPdf(deserializeAnalysis(report.analysis));
    } catch (reason) {
      console.error(reason);
      toast.error("The saved PDF could not be created.");
    } finally {
      setReportActionId(null);
    }
  }

  async function deleteSavedReport(id: string) {
    if (!window.confirm("Delete this saved report? The original Excel file on your device will not be affected.")) return;

    setReportActionId(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("reports").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setReports((current) => current.filter((report) => report.id !== id));
      toast.success("Saved report deleted.");
    } catch (reason) {
      console.error(reason);
      toast.error("The report could not be deleted.");
    } finally {
      setReportActionId(null);
    }
  }

  async function exportReportBackup() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: queryError } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (queryError) throw queryError;

      const backup = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), reports: data ?? [] }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(backup);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `panduranga-report-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Report backup downloaded.");
    } catch (reason) {
      console.error(reason);
      toast.error("The report backup could not be created.");
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setAnalysis(null);
    setSaveState(null);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please choose an .xlsx Excel workbook. Older .xls files should be saved as .xlsx first.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("This workbook is larger than 20 MB. Split it into a smaller file before analyzing it.");
      return;
    }

    setBusy(true);
    try {
      const sheets = await readExcelFile(file);
      const result = analyzeWorkbook(file.name, sheets as unknown as WorkbookSheet[]);
      setAnalysis(result);
      setSaveState("saving");

      try {
        await saveReport(file, result);
        setSaveState("saved");
      } catch (saveReason) {
        console.error(saveReason);
        setSaveState("error");
      }
    } catch (reason) {
      console.error(reason);
      setError("I could not read this workbook. Make sure it is a valid, unencrypted .xlsx file and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (analysis) {
    return (
      <AnalysisReport
        analysis={analysis}
        saveState={saveState}
        returnToReports={view === "reports"}
        onReset={() => {
          setAnalysis(null);
          setSaveState(null);
        }}
      />
    );
  }

  if (view === "reports") {
    return (
      <SavedReports
        reports={reports}
        loading={reportsLoading}
        error={reportsError}
        actionId={reportActionId}
        onOpen={openReport}
        onDownload={downloadSavedPdf}
        onDelete={deleteSavedReport}
        onExport={exportReportBackup}
      />
    );
  }

  return (
    <EmptyAnalyzer
      busy={busy}
      dragging={dragging}
      error={error}
      onFile={handleFile}
      onDragging={setDragging}
    />
  );
}
