import type {
  CategorySummary,
  MonthlySummary,
  SheetAnalysis,
  Transaction,
  WorkbookAnalysis,
} from "@/lib/excel-analysis";

export type SerializedTransaction = Omit<Transaction, "date"> & { date: string };
export type SerializedSheetAnalysis = Omit<SheetAnalysis, "dateFrom" | "dateTo"> & {
  dateFrom: string | null;
  dateTo: string | null;
};

export type SerializedWorkbookAnalysis = Omit<
  WorkbookAnalysis,
  "dateFrom" | "dateTo" | "sheets" | "months" | "categories" | "topTransactions"
> & {
  dateFrom: string | null;
  dateTo: string | null;
  sheets: SerializedSheetAnalysis[];
  months: MonthlySummary[];
  categories: CategorySummary[];
  topTransactions: SerializedTransaction[];
};

export type ReportSummary = {
  id: string;
  file_name: string;
  file_size: number;
  analyzed_at: string;
  date_from: string | null;
  date_to: string | null;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
  sheet_count: number;
  created_at: string;
};

export type SavedReport = ReportSummary & {
  file_hash: string;
  source_rows: number;
  parser_version: string;
  analysis: SerializedWorkbookAnalysis;
};

export const REPORT_SUMMARY_COLUMNS =
  "id,file_name,file_size,analyzed_at,date_from,date_to,income,expenses,net,transaction_count,sheet_count,created_at";

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function serializeAnalysis(analysis: WorkbookAnalysis): SerializedWorkbookAnalysis {
  return {
    ...analysis,
    dateFrom: iso(analysis.dateFrom),
    dateTo: iso(analysis.dateTo),
    sheets: analysis.sheets.map((sheet) => ({
      ...sheet,
      dateFrom: iso(sheet.dateFrom),
      dateTo: iso(sheet.dateTo),
    })),
    topTransactions: analysis.topTransactions.map((transaction) => ({
      ...transaction,
      date: transaction.date.toISOString(),
    })),
  };
}

function date(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export function deserializeAnalysis(analysis: SerializedWorkbookAnalysis): WorkbookAnalysis {
  return {
    ...analysis,
    dateFrom: date(analysis.dateFrom),
    dateTo: date(analysis.dateTo),
    sheets: analysis.sheets.map((sheet) => ({
      ...sheet,
      dateFrom: date(sheet.dateFrom),
      dateTo: date(sheet.dateTo),
    })),
    topTransactions: analysis.topTransactions.map((transaction) => ({
      ...transaction,
      date: new Date(transaction.date),
    })),
  };
}

export async function hashWorkbook(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
