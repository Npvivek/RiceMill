export type CashFlowKind = "income" | "expense" | "mixed" | "reference";

type Cell = string | number | boolean | Date | null;

export type WorkbookSheet = {
  sheet: string;
  data: Cell[][];
};

export type Transaction = {
  sheet: string;
  row: number;
  date: Date;
  description: string;
  amount: number;
  kind: "income" | "expense";
  category: string;
};

export type SheetAnalysis = {
  name: string;
  kind: CashFlowKind;
  headerRow: number | null;
  sourceRows: number;
  transactionCount: number;
  total: number;
  dateFrom: Date | null;
  dateTo: Date | null;
  missingDateRows: number;
  missingAmountRows: number;
  includedInCashFlow: boolean;
};

export type MonthlySummary = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

export type CategorySummary = {
  name: string;
  kind: "income" | "expense";
  amount: number;
  count: number;
};

export type WorkbookAnalysis = {
  fileName: string;
  sheetCount: number;
  sourceRows: number;
  transactionCount: number;
  income: number;
  expenses: number;
  net: number;
  dateFrom: Date | null;
  dateTo: Date | null;
  sheets: SheetAnalysis[];
  months: MonthlySummary[];
  categories: CategorySummary[];
  topTransactions: Transaction[];
  warnings: string[];
};

const HEADER_WORDS = [
  "date", "description", "descn", "particulars", "details", "narration",
  "amount", "amt", "value", "rate", "qty", "quantity", "weight",
  "bags", "party", "supplier", "customer", "advance", "paid", "balance",
  "debit", "credit", "revenue", "expense", "remarks",
];

const DESCRIPTION_HEADERS = [
  "description", "descn", "particulars", "details", "narration", "item",
  "product", "purpose", "party", "supplier", "customer", "name",
];

const AMOUNT_HEADERS = [
  "amount", "amt", "total amount", "value", "debit", "credit",
  "revenue", "expense", "total paid", "paid", "advance", "balance",
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isEmpty(value: Cell | undefined): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function findHeaderRow(rows: Cell[][]): number | null {
  let bestIndex: number | null = null;
  let bestScore = 0;

  rows.slice(0, 30).forEach((row, index) => {
    const values = row.filter((cell) => !isEmpty(cell));
    if (values.length < 2) return;

    const normalized = values.map(normalize);
    const matches = normalized.filter((value) =>
      HEADER_WORDS.some((word) => value === word || value.includes(word)),
    ).length;
    const score = matches * 10 + Math.min(values.length, 8);

    if (matches >= 2 && score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function findColumn(headers: Cell[], candidates: string[]): number | null {
  const normalizedHeaders = headers.map(normalize);

  for (const candidate of candidates) {
    const exact = normalizedHeaders.findIndex((header) => header === candidate);
    if (exact >= 0) return exact;
  }

  for (const candidate of candidates) {
    const partial = normalizedHeaders.findIndex((header) => header.includes(candidate));
    if (partial >= 0) return partial;
  }

  return null;
}

function toAmount(value: Cell | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[₹,$\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(year: number, month: number, day: number): Date | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function toDate(value: Cell | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value !== "string") return null;
  const input = value.trim();

  let match = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return validDate(year, Number(match[2]), Number(match[1]));
  }

  match = input.match(/^(\d{1,2})\.(\d{2})(\d{4})/);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));

  match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));

  return null;
}

function inferSheetKind(name: string, descriptions: string[]): CashFlowKind {
  const sheet = normalize(name);

  if (/pending|debt|due|balance|stock/.test(sheet)) return "reference";
  if (/breakup|mixed|reconciliation/.test(sheet)) return "mixed";
  if (/revenue|income|sales|receipts?/.test(sheet)) return "income";
  if (/expense|cost|purchase|advance|payment|paddy|transport/.test(sheet)) return "expense";
  if (sheet === "summary") return "expense";

  const sample = normalize(descriptions.slice(0, 120).join(" "));
  const expenseScore = [
    "repair", "charges", "petrol", "diesel", "labour", "wages", "advance",
    "purchase", "paid", "cost", "emi", "food", "transport",
  ].filter((word) => sample.includes(word)).length;
  const incomeScore = ["revenue", "sale", "receipt", "received", "weighbridge"].filter((word) => sample.includes(word)).length;

  if (expenseScore >= 2 && expenseScore > incomeScore) return "expense";
  if (incomeScore >= 2 && incomeScore > expenseScore) return "income";
  return "mixed";
}

function categoryFor(description: string, kind: "income" | "expense"): string {
  const text = normalize(description);

  if (kind === "income") {
    if (/bran/.test(text)) return "Rice bran";
    if (/husk|vuka/.test(text)) return "Rice husk";
    if (/broken|nuka/.test(text)) return "Broken rice";
    if (/weigh/.test(text)) return "Weighbridge";
    if (/paddy/.test(text)) return "Paddy sales";
    return "Other income";
  }

  if (/paddy|farmer|supplier/.test(text)) return "Paddy procurement";
  if (/transport|vehicle|driver|diesel|petrol|freight/.test(text)) return "Transport & fuel";
  if (/labour|labor|wage|salary|worker/.test(text)) return "Labour & wages";
  if (/repair|bearing|motor|maintenance|machine/.test(text)) return "Repairs & maintenance";
  if (/officer|licen[cs]e|registration|gst|commission|bank|\bbg\b/.test(text)) return "Compliance & bank";
  if (/electric|power|tea|food|bag|wire|gunny|office/.test(text)) return "Mill operations";
  if (/advance|payment|paid/.test(text)) return "Advances & payments";
  return "Other expenses";
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

function minDate(dates: Date[]): Date | null {
  return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
}

function maxDate(dates: Date[]): Date | null {
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

export function analyzeWorkbook(fileName: string, workbookSheets: WorkbookSheet[]): WorkbookAnalysis {
  const transactions: Transaction[] = [];
  const sheets: SheetAnalysis[] = [];
  const warnings: string[] = [];
  let sourceRows = 0;

  for (const workbookSheet of workbookSheets) {
    const rows = workbookSheet.data;
    sourceRows += rows.filter((row) => row.some((cell) => !isEmpty(cell))).length;

    const headerRow = findHeaderRow(rows);
    if (headerRow === null) {
      sheets.push({
        name: workbookSheet.sheet,
        kind: "reference",
        headerRow: null,
        sourceRows: rows.length,
        transactionCount: 0,
        total: 0,
        dateFrom: null,
        dateTo: null,
        missingDateRows: 0,
        missingAmountRows: 0,
        includedInCashFlow: false,
      });
      warnings.push(`${workbookSheet.sheet}: no transaction header was detected.`);
      continue;
    }

    const headers = rows[headerRow];
    const dateColumn = findColumn(headers, ["date", "transaction date", "entry date"]);
    const descriptionColumn = findColumn(headers, DESCRIPTION_HEADERS);
    const amountColumn = findColumn(headers, AMOUNT_HEADERS);

    if (amountColumn === null) {
      sheets.push({
        name: workbookSheet.sheet,
        kind: "reference",
        headerRow: headerRow + 1,
        sourceRows: rows.length,
        transactionCount: 0,
        total: 0,
        dateFrom: null,
        dateTo: null,
        missingDateRows: 0,
        missingAmountRows: 0,
        includedInCashFlow: false,
      });
      warnings.push(`${workbookSheet.sheet}: no amount column was detected.`);
      continue;
    }

    const candidates: { row: number; date: Date; description: string; amount: number }[] = [];
    const descriptions: string[] = [];
    let missingDateRows = 0;
    let missingAmountRows = 0;
    let missingLabelRows = 0;

    for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!row || row.every(isEmpty)) continue;

      const primaryDescription = descriptionColumn === null ? "" : String(row[descriptionColumn] ?? "").trim();
      const fallbackDescription = row.slice(0, 20).find((cell, columnIndex) =>
        columnIndex !== dateColumn &&
        columnIndex !== amountColumn &&
        typeof cell === "string" &&
        cell.trim() !== "" &&
        toAmount(cell) === null &&
        toDate(cell) === null,
      );
      const description = primaryDescription || String(fallbackDescription ?? "").trim();
      const amount = toAmount(row[amountColumn]);
      const date = dateColumn === null ? null : toDate(row[dateColumn]);
      const rowText = row.slice(0, 20).filter((cell) => typeof cell === "string").join(" ");
      const looksLikeTotal = /(?:^|\s)(grand )?total(?:\s|$)|closing balance|opening balance/i.test(rowText);

      if (description) descriptions.push(description);
      if (looksLikeTotal) continue;

      if (amount === null) {
        if (date && description) missingAmountRows += 1;
        continue;
      }
      if (!date) {
        if (amount !== 0 && (description || dateColumn !== null)) missingDateRows += 1;
        continue;
      }
      if (!description) {
        if (amount !== 0) missingLabelRows += 1;
        continue;
      }

      candidates.push({
        row: rowIndex + 1,
        date,
        description,
        amount,
      });
    }

    const kind = inferSheetKind(workbookSheet.sheet, descriptions);
    const includedInCashFlow = kind === "income" || kind === "expense";
    const sheetTransactions: Transaction[] = includedInCashFlow
      ? candidates.map((candidate) => ({
          ...candidate,
          sheet: workbookSheet.sheet,
          kind,
          category: categoryFor(candidate.description, kind),
        }))
      : [];

    transactions.push(...sheetTransactions);
    const candidateDates = candidates.map((transaction) => transaction.date);

    sheets.push({
      name: workbookSheet.sheet,
      kind,
      headerRow: headerRow + 1,
      sourceRows: rows.length,
      transactionCount: candidates.length,
      total: candidates.reduce((sum, transaction) => sum + transaction.amount, 0),
      dateFrom: minDate(candidateDates),
      dateTo: maxDate(candidateDates),
      missingDateRows,
      missingAmountRows,
      includedInCashFlow,
    });

    if (!includedInCashFlow && candidates.length > 0) {
      warnings.push(`${workbookSheet.sheet}: ${candidates.length.toLocaleString("en-IN")} entries were treated as ${kind} data and excluded from cash-flow totals.`);
    }
    if (missingDateRows > 0) warnings.push(`${workbookSheet.sheet}: ${missingDateRows.toLocaleString("en-IN")} amount rows have no usable date.`);
    if (missingAmountRows > 0) warnings.push(`${workbookSheet.sheet}: ${missingAmountRows.toLocaleString("en-IN")} dated rows have no usable amount.`);
    if (missingLabelRows > 0) warnings.push(`${workbookSheet.sheet}: ${missingLabelRows.toLocaleString("en-IN")} dated amount rows have no description and were excluded.`);
  }

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  const income = transactions.filter((transaction) => transaction.kind === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = transactions.filter((transaction) => transaction.kind === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);

  const monthlyMap = new Map<string, MonthlySummary>();
  const categoryMap = new Map<string, CategorySummary>();

  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const monthly = monthlyMap.get(key) ?? { key, label: monthLabel(key), income: 0, expense: 0 };
    monthly[transaction.kind] += transaction.amount;
    monthlyMap.set(key, monthly);

    const categoryKey = `${transaction.kind}:${transaction.category}`;
    const category = categoryMap.get(categoryKey) ?? {
      name: transaction.category,
      kind: transaction.kind,
      amount: 0,
      count: 0,
    };
    category.amount += transaction.amount;
    category.count += 1;
    categoryMap.set(categoryKey, category);
  }

  const dates = transactions.map((transaction) => transaction.date);
  const yearCounts = new Map<number, number>();
  for (const date of dates) yearCounts.set(date.getFullYear(), (yearCounts.get(date.getFullYear()) ?? 0) + 1);
  const dominantYear = Array.from(yearCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const outlierYears = dominantYear === undefined
    ? []
    : Array.from(yearCounts.entries())
        .filter(([year, occurrences]) => Math.abs(year - dominantYear) > 5 && occurrences <= Math.max(2, dates.length * 0.005))
        .map(([year]) => year);
  const reportDates = dates.filter((date) => !outlierYears.includes(date.getFullYear()));

  if (outlierYears.length > 0) {
    warnings.push(`Possible date typo detected in ${outlierYears.sort().join(", ")}; those outliers were ignored for the report period.`);
  }
  const months = Array.from(monthlyMap.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  const categories = Array.from(categoryMap.values()).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const topTransactions = [...transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);

  if (transactions.length === 0) {
    warnings.unshift("No dated income or expense rows could be confidently classified. Check the sheet names and column headers.");
  }

  return {
    fileName,
    sheetCount: workbookSheets.length,
    sourceRows,
    transactionCount: transactions.length,
    income,
    expenses,
    net: income - expenses,
    dateFrom: minDate(reportDates.length ? reportDates : dates),
    dateTo: maxDate(reportDates.length ? reportDates : dates),
    sheets,
    months,
    categories,
    topTransactions,
    warnings,
  };
}
