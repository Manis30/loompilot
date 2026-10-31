import pdfmake from "pdfmake";
// @ts-ignore
import vfsFonts from "pdfmake/build/vfs_fonts.js";
import { formatINR } from "@loompilot/shared";

// Initialize Virtual File System and Roboto fonts once
try {
  for (const [k, v] of Object.entries(vfsFonts as Record<string, string>)) {
    (pdfmake as any).virtualfs.writeFileSync(k, Buffer.from(v, "base64"));
  }
  (pdfmake as any).addFonts({
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  });
} catch {
  // Already initialized
}

export interface QuotationPdfData {
  orderNumber: string;
  clientName: string;
  clientEmail?: string;
  productDescription: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  etaDate: string;
  paymentSchedule: Array<{
    milestone: string;
    percent: number;
    amountPaise: number;
    trigger: string;
    stage?: string;
  }>;
  processPlan?: Array<{
    stage: string;
    start: string;
    end: string;
    dailyTarget?: number;
  }>;
  clientExplanation?: string;
  priceVariationClause?: string;
  termsVersion?: string;
}

export class QuotationPdfService {
  async generateQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
    const paymentRows: any[][] = [
      [
        { text: "Milestone", bold: true, fillColor: "#f2f2f2" },
        { text: "Trigger", bold: true, fillColor: "#f2f2f2" },
        { text: "Share (%)", bold: true, alignment: "right", fillColor: "#f2f2f2" },
        { text: "Amount", bold: true, alignment: "right", fillColor: "#f2f2f2" },
      ],
    ];

    for (const p of data.paymentSchedule) {
      paymentRows.push([
        p.milestone,
        p.stage ? `${p.trigger} (${p.stage})` : p.trigger,
        { text: `${p.percent}%`, alignment: "right" },
        { text: formatINR(p.amountPaise), alignment: "right" },
      ]);
    }

    const planRows: any[][] = [
      [
        { text: "Stage", bold: true, fillColor: "#f2f2f2" },
        { text: "Start Date", bold: true, fillColor: "#f2f2f2" },
        { text: "End Date", bold: true, fillColor: "#f2f2f2" },
        { text: "Daily Target", bold: true, alignment: "right", fillColor: "#f2f2f2" },
      ],
    ];

    if (data.processPlan && data.processPlan.length > 0) {
      for (const step of data.processPlan) {
        planRows.push([
          step.stage,
          step.start,
          step.end,
          { text: step.dailyTarget ? `${step.dailyTarget} pcs/day` : "-", alignment: "right" },
        ]);
      }
    }

    const docDefinition: any = {
      content: [
        { text: "LOOMPILOT MANUFACTURING", style: "header" },
        { text: "Official Quotation & Manufacturing Proposal", style: "subheader" },
        { text: "\n" },
        {
          columns: [
            [
              { text: `Quotation Number: ${data.orderNumber}`, bold: true },
              { text: `Date: ${new Date().toISOString().split("T")[0]}` },
              { text: `Estimated Completion: ${data.etaDate}`, color: "#1a73e8", bold: true },
            ],
            [
              { text: "Prepared For:", bold: true, alignment: "right" },
              { text: data.clientName, alignment: "right" },
              { text: data.clientEmail || "", alignment: "right" },
            ],
          ],
        },
        { text: "\n" },
        { text: "Product Specifications & Pricing", style: "sectionHeader" },
        {
          table: {
            headerRows: 1,
            widths: ["*", "auto", "auto", "auto"],
            body: [
              [
                { text: "Item Description", bold: true, fillColor: "#f2f2f2" },
                { text: "Quantity", bold: true, alignment: "right", fillColor: "#f2f2f2" },
                { text: "Unit Price", bold: true, alignment: "right", fillColor: "#f2f2f2" },
                { text: "Total Amount", bold: true, alignment: "right", fillColor: "#f2f2f2" },
              ],
              [
                data.productDescription,
                { text: `${data.quantity.toLocaleString()} pcs`, alignment: "right" },
                { text: formatINR(data.unitPricePaise), alignment: "right" },
                { text: formatINR(data.totalPaise), alignment: "right", bold: true },
              ],
            ],
          },
        },
        { text: "\n" },
        { text: "Payment Schedule & Milestones", style: "sectionHeader" },
        {
          table: {
            headerRows: 1,
            widths: ["*", "*", "auto", "auto"],
            body: paymentRows,
          },
        },
        { text: "\n" },
        ...(data.processPlan && data.processPlan.length > 0
          ? [
              { text: "Target Production Timeline", style: "sectionHeader" },
              {
                table: {
                  headerRows: 1,
                  widths: ["*", "*", "*", "auto"],
                  body: planRows,
                },
              },
              { text: "\n" },
            ]
          : []),
        ...(data.clientExplanation
          ? [
              { text: "Order Notes & Manufacturing Summary", style: "sectionHeader" },
              { text: data.clientExplanation, italics: true },
              { text: "\n" },
            ]
          : []),
        ...(data.priceVariationClause
          ? [
              { text: "Price Variation Clause", bold: true },
              { text: data.priceVariationClause, fontSize: 9, color: "#555555" },
              { text: "\n" },
            ]
          : []),
        {
          text: `Terms Version: ${data.termsVersion || "v1.0"} | LoomPilot Automated Agentic Manufacturing Platform`,
          fontSize: 8,
          alignment: "center",
          color: "#888888",
        },
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          color: "#0f172a",
        },
        subheader: {
          fontSize: 12,
          color: "#64748b",
          margin: [0, 2, 0, 8],
        },
        sectionHeader: {
          fontSize: 13,
          bold: true,
          color: "#0f172a",
          margin: [0, 8, 0, 4],
        },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    return doc.getBuffer();
  }
}
