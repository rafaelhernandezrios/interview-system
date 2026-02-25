import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Writable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Program fees (MIRI) — registration not in invoice total, shown in Payment Terms only
const REGISTRATION_FEE_DISPLAY = 250; // shown in Payment Terms (1st Payment)
const TUITION_PER_WEEK_4_6 = 350;  // USD per week (4 to 6 weeks)
const TUITION_PER_WEEK_7_12 = 300; // USD per week (7 to 12 weeks)
const TAX_RATE = 0.10; // 10%
const RED = "#c53030";

// Payment to (hardcoded)
const BANK_DETAILS = {
  bankName: "MIZUHO BANK, LTD.",
  branchName: "SENBA BRANCH",
  branchAddress: "4-8, 3-CHOME HONMACHI CHUO-KU, OSAKA, JAPAN 541-0053",
  swift: "MHCBJPJT",
  account: "513-3017676",
  receiver: "MIRAI INNOVATION RESEARCH INSTITUTE",
  receiverAddress: "EDGE HONMACHI 3-12, 2-CHOME MINAMIHONMACHI CHUO-KU, OSAKA, JAPAN 541-0054",
};

/**
 * Computes number of weeks between two dates (full weeks, rounded up).
 */
function getWeeksBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.ceil(diffDays / 7));
}

/**
 * Tuition fee per week: $350 (4–6 weeks), $300 (7–12 weeks).
 */
function getTuitionPerWeek(weeks) {
  if (weeks >= 7 && weeks <= 12) return TUITION_PER_WEEK_7_12;
  return TUITION_PER_WEEK_4_6;
}

/**
 * Invoice breakdown (no registration fee):
 * - Tuition: $350/week (4-6 weeks) or $300/week (7-12 weeks).
 * - Scholarship: applied only to Tuition.
 * - Subtotal: Tuition (after discount).
 * - Tax (10%): on Subtotal.
 * - Total: Subtotal + Tax.
 */
function calculateInvoiceBreakdown(weeks, scholarshipPercentage = 0) {
  const tuitionPerWeek = getTuitionPerWeek(weeks);
  const tuitionBeforeScholarship = weeks * tuitionPerWeek;
  const scholarshipDiscount = tuitionBeforeScholarship * ((scholarshipPercentage || 0) / 100);
  const tuitionAfterScholarship = tuitionBeforeScholarship - scholarshipDiscount;

  const subtotal = tuitionAfterScholarship;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return {
    tuitionPerWeek,
    tuitionBeforeScholarship,
    scholarshipPercentage: scholarshipPercentage || 0,
    scholarshipDiscount,
    tuitionAfterScholarship,
    subtotal,
    tax,
    total,
  };
}

function formatDateLong(d) {
  if (!d) return "—";
  const date = new Date(d);
  const day = date.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31 ? "st" :
    day === 2 || day === 22 ? "nd" :
    day === 3 || day === 23 ? "rd" : "th";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).replace(/\d+/, day + suffix);
}

function formatUSD(amount) {
  return `$${Number(amount).toFixed(2)} USD`;
}

function formatUSDNegative(amount) {
  return `-$${Number(amount).toFixed(2)} USD`;
}

/**
 * Streams the MIRI Invoice PDF to res. Optimized layout: Helvetica, no overlap, thick table header, exact bank data.
 */
export function streamInvoicePdf(res, user, application) {
  const fullName =
    application?.firstName && application?.lastName
      ? `${application.firstName} ${application.lastName}`
      : user?.name || "Participant";

  const startDate = application?.invoiceDateRange?.startDate
    ? new Date(application.invoiceDateRange.startDate)
    : null;
  const endDate = application?.invoiceDateRange?.endDate
    ? new Date(application.invoiceDateRange.endDate)
    : null;
  const weeks = getWeeksBetween(startDate, endDate);
  const scholarshipPercentage = application?.scholarshipPercentage ?? 0;

  const breakdown = calculateInvoiceBreakdown(weeks, scholarshipPercentage);

  const invoiceDate = new Date();
  const invoiceNumber =
    user?.digitalId
      ? `Invoice_${String(user.digitalId).replace(/\s+/g, "-")}`
      : `MIRI-${invoiceDate.getFullYear()}-${String(application?._id || "").slice(-6)}`;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 72, right: 72 },
  });

  res.setHeader?.("Content-Type", "application/pdf");
  res.setHeader?.(
    "Content-Disposition",
    `attachment; filename="MIRI_Invoice_${fullName.replace(/\s+/g, "_")}.pdf"`
  );
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const margin = 72;
  const textWidth = pageWidth - margin * 2;
  const headerY = 60;

  // ----- Header: company name/address LEFT, logo RIGHT -----
  const logoPath = path.join(__dirname, "..", "..", "frontend", "src", "assets", "logo.png");
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Mirai Innovation Research Institute", margin, headerY)
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444444")
    .text("[Headquarters] Minamihonmachi 2-3-12 Edge Honmachi")
    .text("Chuo-ku, Osaka-shi, Osaka, Japan. 5410054")
    .text("contact@mirai-innovation-lab.com");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, pageWidth - margin - 80, headerY - 10, { width: 80 });
  }
  doc.fillColor("black");

  // ----- Invoice info: Invoice No. and Date RIGHT-aligned, below logo (no overlap) -----
  const logoRight = pageWidth - margin - 80;
  const invoiceInfoWidth = logoRight - margin - 12; // stop before logo
  const invoiceInfoY = headerY + 82; // below logo
  doc.font("Helvetica").fontSize(10);
  doc.text(`Invoice No. ${invoiceNumber}`, margin, invoiceInfoY, { align: "right", width: invoiceInfoWidth });
  doc.text(
    invoiceDate.toISOString().slice(0, 10).replace(/-/g, "/"),
    margin,
    doc.y + 4,
    { align: "right", width: invoiceInfoWidth }
  );

  // ----- Title: Proforma Invoice, 16pt bold, left-aligned -----
  const titleY = invoiceInfoY + 28;
  doc.font("Helvetica-Bold").fontSize(16).text("Proforma Invoice", margin, titleY);

  // ----- Billed to -----
  doc.font("Helvetica").fontSize(10);
  let billedY = titleY + 28;
  doc.font("Helvetica-Bold").fontSize(10).text("Billed to:", margin, billedY);
  billedY += 14;
  doc.font("Helvetica").text(fullName, margin, billedY);
  doc.text(application?.countryOfResidency || "—", margin, doc.y + 12);
  doc.text(user?.email || "—", margin, doc.y + 12);
  doc.text(application?.phoneNumber || "—", margin, doc.y + 12);
  const billedBottom = doc.y + 4;

  // ----- Total (prominent, right) -----
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text(`Total ${formatUSD(breakdown.total)}`, margin, billedBottom + 16, { align: "right", width: textWidth });

  // ----- Table: Description | Amount -----
  const tableTop = billedBottom + 44;
  const col1X = margin;
  const col2X = pageWidth - margin - 130;
  const col2Width = 130;
  const descWidth = col2X - col1X - 16;
  const rowHeight = 20;

  // Table header (bold)
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Description", col1X, tableTop);
  doc.text("Amount", col2X, tableTop, { width: col2Width, align: "right" });
  // Thick horizontal line under header
  doc.lineWidth(2);
  doc.moveTo(margin, tableTop + rowHeight).lineTo(pageWidth - margin, tableTop + rowHeight).stroke();
  doc.lineWidth(1);

  let rowY = tableTop + rowHeight + 10;
  doc.font("Helvetica").fontSize(9);

  // Row 1: Tuition (description may wrap to avoid overlap)
  const periodStr = startDate && endDate
    ? `${formatDateLong(startDate)} to ${formatDateLong(endDate)}`
    : `${weeks} week(s)`;
  const tuitionDesc = `Mirai Innovation Research Immersion (MIRI) Program. Academic training tuition fee for ${weeks} week(s) (${weeks} × $${breakdown.tuitionPerWeek} USD). Course period: ${periodStr}.`;
  doc.text(tuitionDesc, col1X, rowY, { width: descWidth });
  const tuitionRowBottom = doc.y + 6;
  doc.text(formatUSD(breakdown.tuitionBeforeScholarship), col2X, rowY, { width: col2Width, align: "right" });
  rowY = Math.max(rowY + rowHeight, tuitionRowBottom);

  // Row 2: Scholarship (negative amount, red)
  if (breakdown.scholarshipPercentage > 0) {
    doc.fillColor(RED);
    doc.text(`Scholarship (${breakdown.scholarshipPercentage}%)`, col1X, rowY, { width: descWidth });
    doc.text(formatUSDNegative(breakdown.scholarshipDiscount), col2X, rowY, { width: col2Width, align: "right" });
    doc.fillColor("black");
    rowY += rowHeight;
  }

  // Subtotal
  doc.text("Subtotal", col1X, rowY, { width: descWidth });
  doc.text(formatUSD(breakdown.subtotal), col2X, rowY, { width: col2Width, align: "right" });
  rowY += rowHeight;

  // Tax (10%)
  doc.text("Tax (10%)", col1X, rowY, { width: descWidth });
  doc.text(formatUSD(breakdown.tax), col2X, rowY, { width: col2Width, align: "right" });
  rowY += rowHeight;

  // Total (bold)
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Total", col1X, rowY, { width: descWidth });
  doc.text(formatUSD(breakdown.total), col2X, rowY, { width: col2Width, align: "right" });
  doc.font("Helvetica");

  // ----- Payment Terms -----
  rowY += rowHeight + 18;
  doc.font("Helvetica-Bold").fontSize(10).text("Payment Terms:", margin, rowY);
  doc.font("Helvetica").fontSize(9);
  rowY += 14;
  doc.text("Amount", margin, rowY);
  doc.text("Deadline", col2X - 80, rowY);
  rowY += 12;
  doc.text("1st Payment: Registration", margin, rowY);
  doc.text(formatUSD(REGISTRATION_FEE_DISPLAY), col2X - 120, rowY, { width: 90, align: "right" });
  doc.fillColor(RED).text("PAID ONLINE", col2X, rowY, { width: col2Width, align: "right" }).fillColor("black");
  rowY += 14;
  doc.text("2nd Payment: Tuition", margin, rowY);
  doc.text(formatUSD(breakdown.total), col2X - 120, rowY, { width: 90, align: "right" });
  doc.text("As agreed", col2X, rowY, { width: col2Width, align: "right" });

  // ----- Payment to: exact bank data (hardcoded) -----
  rowY += 28;
  doc.font("Helvetica-Bold").fontSize(10).text("Payment to:", margin, rowY);
  doc.font("Helvetica").fontSize(9);
  const bankY = rowY + 12;
  doc.text(`Bank name: ${BANK_DETAILS.bankName}`, margin, bankY);
  doc.text(`Branch name: ${BANK_DETAILS.branchName}`, margin, doc.y + 10);
  doc.text(`Branch address: ${BANK_DETAILS.branchAddress}`, margin, doc.y + 10);
  doc.text(`SWIFT: ${BANK_DETAILS.swift}`, margin, doc.y + 10);
  doc.text(`Account: ${BANK_DETAILS.account}`, margin, doc.y + 10);
  doc.text(`Receiver: ${BANK_DETAILS.receiver}`, margin, doc.y + 10);
  doc.text(`Address: ${BANK_DETAILS.receiverAddress}`, margin, doc.y + 10);

  doc.end();
}

/**
 * Generates the invoice PDF and returns it as a Buffer.
 */
export function generateInvoicePdfBuffer(user, application) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const writable = new Writable({
      write(chunk, enc, cb) {
        chunks.push(chunk);
        cb();
      },
      final(cb) {
        resolve(Buffer.concat(chunks));
        cb();
      },
    });
    writable.setHeader = () => {};
    try {
      streamInvoicePdf(writable, user, application);
    } catch (e) {
      reject(e);
    }
  });
}
