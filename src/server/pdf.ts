import PDFDocument from "pdfkit";
import type { Submission } from "wasp/entities";
import type { FormField, SubmissionData } from "../types";

export type SubmissionPdfForm = {
  id: string;
  title: string;
  fields: unknown;
};

export type SubmissionPdfSubmission = Pick<
  Submission,
  "id" | "data" | "createdAt" | "updatedAt"
>;

export type SubmissionPdfOptions = {
  /** Maps UploadedFile id -> original filename, used for file_upload values. */
  fileNames?: Record<string, string>;
};

const LAYOUT_TYPES = new Set(["divider", "paragraph", "hidden"]);

function getFields(form: SubmissionPdfForm): FormField[] {
  return Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
}

function getData(submission: SubmissionPdfSubmission): SubmissionData {
  return submission.data && typeof submission.data === "object"
    ? (submission.data as SubmissionData)
    : {};
}

/** Collect UploadedFile ids stored in file_upload field values. */
export function collectFileUploadIds(
  fields: FormField[],
  data: SubmissionData,
): string[] {
  const ids: string[] = [];
  for (const field of fields) {
    if (field.type !== "file_upload") {
      continue;
    }
    const value = data[field.key];
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === "string" && item && !ids.includes(item)) {
        ids.push(item);
      }
    }
  }
  return ids;
}

function formatValue(field: FormField, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "";
  }
  if (typeof value === "boolean") {
    if (field.type === "yes_no") {
      return value
        ? (field.yesLabel?.trim() || "Yes")
        : (field.noLabel?.trim() || "No");
    }
    return value ? "yes" : "no";
  }
  if (
    (field.type === "date" ||
      field.type === "created_date" ||
      field.type === "modified_date") &&
    typeof value === "string"
  ) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return field.type === "date"
        ? date.toLocaleDateString()
        : date.toLocaleString();
    }
  }
  return String(value);
}

function isSignatureImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function writeEntry(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#6b7280")
    .text(label.toUpperCase(), { characterSpacing: 0.6 });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(11).fillColor("#111827").text(value);
}

function writeSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(title);
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .lineWidth(1)
    .strokeColor("#d1d5db")
    .stroke();
  doc.moveDown(0.2);
}

function writeDivider(doc: PDFKit.PDFDocument): void {
  doc.moveDown(0.6);
  const y = doc.y;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.5)
    .strokeColor("#e5e7eb")
    .stroke();
  doc.moveDown(0.4);
}

function writeSignature(
  doc: PDFKit.PDFDocument,
  label: string,
  dataUrl: string,
): void {
  const base64 = dataUrl.split(",")[1] ?? "";
  const image = Buffer.from(base64, "base64");
  const maxWidth = 220;
  const maxHeight = 90;
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#6b7280")
    .text(label.toUpperCase(), { characterSpacing: 0.6 });
  doc.moveDown(0.3);
  // doc.image does not auto-break pages, so make room manually.
  if (doc.y + maxHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  try {
    doc.image(image, { fit: [maxWidth, maxHeight] });
  } catch (err) {
    console.error("Failed to embed signature image in PDF:", err);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#111827")
      .text("[signature]");
  }
}

/**
 * Build a single-submission PDF: form title header, submission metadata,
 * then label/value rows in field order. Layout elements are skipped
 * (section headers become bold section titles), empty values are skipped,
 * signatures are embedded as images and file uploads are listed by name.
 */
export function buildSubmissionPdf(
  form: SubmissionPdfForm,
  submission: SubmissionPdfSubmission,
  options: SubmissionPdfOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: { Title: `${form.title} - ${submission.id}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fields = getFields(form);
    const data = getData(submission);

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text(form.title);
    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(`Submission ${submission.id}`);
    doc.text(
      `Submitted ${submission.createdAt.toLocaleString()}  ·  Updated ${submission.updatedAt.toLocaleString()}`,
    );
    doc.moveDown(0.5);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(1.5)
      .strokeColor("#111827")
      .stroke();

    for (const field of fields) {
      if (field.type === "section_header") {
        writeSectionTitle(doc, field.label);
        continue;
      }
      if (LAYOUT_TYPES.has(field.type)) {
        if (field.type === "divider") {
          writeDivider(doc);
        }
        continue;
      }

      const value = data[field.key];

      if (field.type === "signature") {
        if (isSignatureImage(value)) {
          writeSignature(doc, field.label, value);
        }
        continue;
      }

      if (field.type === "file_upload") {
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        if (ids.length === 0) {
          continue;
        }
        const names = ids.map((id) =>
          typeof id === "string"
            ? (options.fileNames?.[id] ?? "[file]")
            : "[file]",
        );
        writeEntry(doc, field.label, names.join(", "));
        continue;
      }

      const text = formatValue(field, value);
      if (text === "") {
        continue;
      }
      writeEntry(doc, field.label, text);
    }

    doc.end();
  });
}
