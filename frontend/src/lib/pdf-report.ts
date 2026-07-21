import type { jsPDF as JsPDF } from "jspdf";
import type { WorkbookAnalysis } from "@/lib/excel-analysis";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 18;

const colors = {
  ink: [31, 29, 24] as const,
  muted: [103, 96, 84] as const,
  amber: [217, 142, 24] as const,
  amberPale: [255, 247, 226] as const,
  green: [19, 126, 85] as const,
  greenPale: [232, 247, 239] as const,
  red: [190, 65, 65] as const,
  redPale: [254, 239, 237] as const,
  line: [226, 220, 207] as const,
  soft: [248, 246, 240] as const,
};

function money(value: number): string {
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

function count(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

function date(value: Date | null): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function safeText(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/₹/g, "INR ");
}

function setText(doc: JsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setFill(doc: JsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc: JsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function pageTop(doc: JsPDF, continued = false): number {
  if (continued) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, colors.amber);
    doc.text("PANDURANGA RICE MILL / WORKBOOK ANALYSIS", MARGIN, 11);
    setDraw(doc, colors.line);
    doc.line(MARGIN, 14, PAGE_WIDTH - MARGIN, 14);
  }
  return continued ? 21 : MARGIN;
}

function ensureRoom(doc: JsPDF, y: number, height: number): number {
  if (y + height <= BOTTOM_LIMIT) return y;
  doc.addPage();
  return pageTop(doc, true);
}

function sectionTitle(doc: JsPDF, title: string, subtitle: string, y: number): number {
  y = ensureRoom(doc, y, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, colors.ink);
  doc.text(safeText(title), MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, colors.muted);
  doc.text(safeText(subtitle), MARGIN, y + 5);
  setDraw(doc, colors.line);
  doc.line(MARGIN, y + 9, PAGE_WIDTH - MARGIN, y + 9);
  return y + 14;
}

function tableHeader(doc: JsPDF, labels: string[], widths: number[], y: number, alignRight: number[] = []): number {
  setFill(doc, colors.ink);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 249, 235);
  let x = MARGIN + 3;
  labels.forEach((label, index) => {
    const right = alignRight.includes(index);
    doc.text(label.toUpperCase(), right ? x + widths[index] - 6 : x, y + 5.2, { align: right ? "right" : "left" });
    x += widths[index];
  });
  return y + 8;
}

function drawRow(
  doc: JsPDF,
  values: string[],
  widths: number[],
  y: number,
  index: number,
  alignRight: number[] = [],
  rowHeight = 8,
): number {
  if (index % 2 === 0) {
    setFill(doc, colors.soft);
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, colors.ink);
  let x = MARGIN + 3;
  values.forEach((raw, column) => {
    const value = safeText(raw);
    const right = alignRight.includes(column);
    const available = widths[column] - 6;
    const clipped = doc.getTextWidth(value) > available
      ? `${value.slice(0, Math.max(4, Math.floor(available / 1.8)))}...`
      : value;
    doc.text(clipped, right ? x + widths[column] - 6 : x, y + rowHeight / 2 + 2.2, { align: right ? "right" : "left" });
    x += widths[column];
  });
  setDraw(doc, colors.line);
  doc.line(MARGIN, y + rowHeight, PAGE_WIDTH - MARGIN, y + rowHeight);
  return y + rowHeight;
}

function addPageNumbers(doc: JsPDF) {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, colors.muted);
    doc.text("Generated privately in your browser", MARGIN, PAGE_HEIGHT - 8);
    doc.text(`Page ${page} of ${total}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
  }
}

export async function createAnalysisPdf(analysis: WorkbookAnalysis): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let y = pageTop(doc);

  setFill(doc, colors.ink);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 44, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(238, 189, 71);
  doc.text("PANDURANGA RICE MILL", MARGIN + 7, y + 9);
  doc.setFontSize(21);
  doc.setTextColor(255, 249, 235);
  doc.text("Workbook analysis", MARGIN + 7, y + 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(213, 207, 195);
  const fileLines = doc.splitTextToSize(safeText(analysis.fileName), 114).slice(0, 2);
  doc.text(fileLines, MARGIN + 7, y + 29);
  doc.text(`${date(analysis.dateFrom)} - ${date(analysis.dateTo)}`, PAGE_WIDTH - MARGIN - 7, y + 9, { align: "right" });
  doc.text(`${analysis.sheetCount} sheets / ${count(analysis.sourceRows)} populated rows`, PAGE_WIDTH - MARGIN - 7, y + 35, { align: "right" });
  y += 51;

  const metrics = [
    { label: "INCOME", value: money(analysis.income), fill: colors.greenPale, text: colors.green },
    { label: "EXPENSES", value: money(analysis.expenses), fill: colors.redPale, text: colors.red },
    { label: "NET CASH FLOW", value: money(analysis.net), fill: colors.amberPale, text: analysis.net >= 0 ? colors.green : colors.red },
    { label: "TRANSACTIONS", value: count(analysis.transactionCount), fill: colors.soft, text: colors.ink },
  ];
  const metricGap = 3;
  const metricWidth = (CONTENT_WIDTH - metricGap * 3) / 4;
  metrics.forEach((metric, index) => {
    const x = MARGIN + index * (metricWidth + metricGap);
    setFill(doc, metric.fill);
    setDraw(doc, colors.line);
    doc.roundedRect(x, y, metricWidth, 23, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    setText(doc, colors.muted);
    doc.text(metric.label, x + 4, y + 7);
    doc.setFontSize(10.5);
    setText(doc, metric.text);
    const value = doc.getTextWidth(metric.value) > metricWidth - 8 ? `${metric.value.slice(0, 15)}...` : metric.value;
    doc.text(value, x + 4, y + 16);
  });
  y += 31;

  y = sectionTitle(doc, "Monthly movement", "Latest 12 active months found in the workbook", y);
  const monthWidths = [42, 47, 47, 46];
  y = tableHeader(doc, ["Month", "Income", "Expenses", "Net"], monthWidths, y, [1, 2, 3]);
  const months = analysis.months.slice(-12);
  if (months.length === 0) {
    y = drawRow(doc, ["No dated cash-flow rows found", "", "", ""], monthWidths, y, 0);
  } else {
    months.forEach((month, index) => {
      y = drawRow(doc, [month.label, money(month.income), money(month.expense), money(month.income - month.expense)], monthWidths, y, index, [1, 2, 3]);
    });
  }
  y += 8;

  y = sectionTitle(doc, "Largest categories", "Automatic rice-mill grouping by detected description", y);
  const categoryWidths = [72, 35, 31, 44];
  y = tableHeader(doc, ["Category", "Type", "Entries", "Amount"], categoryWidths, y, [2, 3]);
  analysis.categories.slice(0, 10).forEach((category, index) => {
    if (y + 8 > BOTTOM_LIMIT) {
      doc.addPage();
      y = pageTop(doc, true);
      y = tableHeader(doc, ["Category", "Type", "Entries", "Amount"], categoryWidths, y, [2, 3]);
    }
    y = drawRow(doc, [category.name, category.kind === "income" ? "Income" : "Expense", count(category.count), money(category.amount)], categoryWidths, y, index, [2, 3]);
  });
  if (analysis.categories.length === 0) y = drawRow(doc, ["No categories available", "", "", ""], categoryWidths, y, 0);
  y += 8;

  y = sectionTitle(doc, "Sheet audit", "Only income and expense sheets contribute to the cash-flow totals", y);
  const sheetWidths = [58, 27, 27, 42, 28];
  y = tableHeader(doc, ["Sheet", "Type", "Entries", "Detected total", "Status"], sheetWidths, y, [2, 3]);
  analysis.sheets.forEach((sheet, index) => {
    if (y + 8 > BOTTOM_LIMIT) {
      doc.addPage();
      y = pageTop(doc, true);
      y = tableHeader(doc, ["Sheet", "Type", "Entries", "Detected total", "Status"], sheetWidths, y, [2, 3]);
    }
    const kind = sheet.kind === "income" ? "Income" : sheet.kind === "expense" ? "Expense" : sheet.kind === "reference" ? "Reference" : "Mixed";
    y = drawRow(doc, [sheet.name, kind, count(sheet.transactionCount), sheet.transactionCount ? money(sheet.total) : "-", sheet.includedInCashFlow ? "Included" : "Review"], sheetWidths, y, index, [2, 3]);
  });
  y += 8;

  y = sectionTitle(doc, "Largest entries", "High-value transactions to review", y);
  const entryWidths = [28, 74, 38, 42];
  y = tableHeader(doc, ["Date", "Description", "Sheet", "Amount"], entryWidths, y, [3]);
  analysis.topTransactions.slice(0, 12).forEach((transaction, index) => {
    if (y + 8 > BOTTOM_LIMIT) {
      doc.addPage();
      y = pageTop(doc, true);
      y = tableHeader(doc, ["Date", "Description", "Sheet", "Amount"], entryWidths, y, [3]);
    }
    y = drawRow(doc, [date(transaction.date), transaction.description, transaction.sheet, money(transaction.amount)], entryWidths, y, index, [3]);
  });
  if (analysis.topTransactions.length === 0) y = drawRow(doc, ["No entries available", "", "", ""], entryWidths, y, 0);
  y += 8;

  y = sectionTitle(doc, "Review notes", "Items the automatic analysis could not safely assume", y);
  const notes = analysis.warnings.length ? analysis.warnings : ["No obvious data-quality issues were detected."];
  notes.slice(0, 12).forEach((warning) => {
    const lines = doc.splitTextToSize(safeText(warning), CONTENT_WIDTH - 12);
    const height = Math.max(9, lines.length * 4 + 4);
    y = ensureRoom(doc, y, height);
    setFill(doc, colors.amberPale);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height - 1, 1.5, 1.5, "F");
    setFill(doc, colors.amber);
    doc.circle(MARGIN + 4.5, y + 4.8, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, colors.ink);
    doc.text(lines, MARGIN + 9, y + 5.2);
    y += height + 1;
  });

  addPageNumbers(doc);
  doc.setProperties({
    title: `Workbook analysis - ${analysis.fileName}`,
    subject: "Private rice mill workbook analysis",
    author: "Panduranga Rice Mill",
    creator: "Panduranga Rice Mill dashboard",
  });
  return doc.output("blob");
}

export async function downloadAnalysisPdf(analysis: WorkbookAnalysis): Promise<void> {
  const blob = await createAnalysisPdf(analysis);
  const url = URL.createObjectURL(blob);
  const fileStem = analysis.fileName.replace(/\.xlsx$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "workbook";
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileStem}-analysis.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
