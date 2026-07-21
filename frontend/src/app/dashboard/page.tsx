"use client";

import readExcelFile from "read-excel-file/browser";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  IndianRupee,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeWorkbook, type WorkbookAnalysis, type WorkbookSheet } from "@/lib/excel-analysis";
import { downloadAnalysisPdf } from "@/lib/pdf-report";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const count = new Intl.NumberFormat("en-IN");

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

function MetricCard({
  label,
  value,
  note,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: "green" | "red" | "amber" | "slate";
  icon: typeof IndianRupee;
}) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Sparkles className="h-3.5 w-3.5" /> Personal workbook analyzer
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Turn your mill accounts into a clear report.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
          Upload an Excel workbook to see income, expenses, cash flow, monthly movement, categories, large entries, and data-quality problems.
        </p>
      </div>

      <Card className="overflow-hidden border-amber-200 bg-card shadow-sm dark:border-amber-900/70">
        <CardContent className="p-3 sm:p-5">
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
            className={`group flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-12 text-center transition-all ${
              dragging
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                : "border-amber-200 bg-gradient-to-b from-amber-50/70 to-background hover:border-amber-400 dark:border-amber-900 dark:from-amber-950/20 dark:hover:border-amber-700"
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
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition-transform group-hover:-translate-y-0.5 dark:bg-amber-900/50 dark:text-amber-300">
              {busy ? <LoaderCircle className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
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

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Private by design", text: "The workbook stays in your browser and is never sent to a server." },
          { icon: BarChart3, title: "Messy-sheet friendly", text: "Finds headers, dates, descriptions, and amounts across multiple sheets." },
          { icon: CheckCircle2, title: "Rice-mill categories", text: "Groups bran, husk, broken rice, paddy, transport, labour, repairs, and more." },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-card p-4">
            <item.icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="mt-3 text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisReport({ analysis, onReset }: { analysis: WorkbookAnalysis; onReset: () => void }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const chartMax = Math.max(1, ...analysis.months.flatMap((month) => [Math.abs(month.income), Math.abs(month.expense)]));
  const categoryMax = Math.max(1, ...analysis.categories.slice(0, 8).map((category) => Math.abs(category.amount)));

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
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            <FileSpreadsheet className="h-4 w-4" /> Workbook report
          </div>
          <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">{analysis.fileName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(analysis.dateFrom)} – {formatDate(analysis.dateTo)} · {analysis.sheetCount} sheets · {count.format(analysis.sourceRows)} populated rows
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <Button onClick={handlePdfDownload} disabled={pdfBusy} className="gap-2 bg-amber-600 text-white hover:bg-amber-700">
            {pdfBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfBusy ? "Preparing PDF..." : "Download PDF"}
          </Button>
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Analyze another file
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <ShieldCheck className="h-4 w-4 shrink-0" /> Analysis and PDF generation happen locally in this browser. No workbook data is uploaded.
      </div>

      {pdfError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{pdfError}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Income" value={money.format(analysis.income)} note="Confidently classified receipts" tone="green" icon={ArrowUpRight} />
        <MetricCard label="Expenses" value={money.format(analysis.expenses)} note="Confidently classified outflows" tone="red" icon={ArrowDownRight} />
        <MetricCard
          label="Net cash flow"
          value={money.format(analysis.net)}
          note={analysis.net >= 0 ? "Income less expenses" : "Expenses exceeded income"}
          tone={analysis.net >= 0 ? "amber" : "red"}
          icon={IndianRupee}
        />
        <MetricCard label="Transactions" value={count.format(analysis.transactionCount)} note="Dated rows included in totals" tone="slate" icon={FileSpreadsheet} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly movement</CardTitle>
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
            <CardTitle className="text-base">Largest categories</CardTitle>
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
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sheet audit</CardTitle>
          <p className="text-xs text-muted-foreground">Only sheets classified as income or expense contribute to the cash-flow cards.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Largest entries</CardTitle>
            <p className="text-xs text-muted-foreground">Useful for spotting unusual or high-value transactions</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
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
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base">Review notes</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Items the automatic analysis could not safely assume</p>
          </CardHeader>
          <CardContent>
            {analysis.warnings.length > 0 ? (
              <ul className="space-y-3">
                {analysis.warnings.slice(0, 7).map((warning) => (
                  <li key={warning} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> {warning}
                  </li>
                ))}
                {analysis.warnings.length > 7 && <li className="text-xs font-medium text-amber-700 dark:text-amber-400">+ {analysis.warnings.length - 7} more notes</li>}
              </ul>
            ) : (
              <div className="flex items-center gap-2 py-8 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> No obvious data-quality issues detected.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setAnalysis(null);

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
      setAnalysis(analyzeWorkbook(file.name, sheets as unknown as WorkbookSheet[]));
    } catch (reason) {
      console.error(reason);
      setError("I could not read this workbook. Make sure it is a valid, unencrypted .xlsx file and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (analysis) return <AnalysisReport analysis={analysis} onReset={() => setAnalysis(null)} />;

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
