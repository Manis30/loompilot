import PdfPrinter from "pdfmake";
import { TDocumentDefinitions } from "pdfmake/interfaces.js";
import { APP_NAME, formatINR } from "@loompilot/shared";

const fonts = {
  Roboto: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);

export interface QuotationPdfData {
  quotationNumber: string;
  customerName: string;
  validUntil: string;
  etaDate: string;
  lineItems: Array<{
    materialName: string;
    requiredQty: number;
    unit: string;
    unitCostPaise: number;
    totalCostPaise: number;
  }>;
  subtotalCostPaise: number;
  riskBufferPct: number;
  riskBufferCostPaise: number;
  wastagePct: number;
  wastageCostPaise: number;
  marginPct: number;
  finalPricePaise: number;
  explanation: string;
}

export function generateQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: `${APP_NAME} - Formal Quotation`, style: "header" },
        { text: `Quotation Reference: ${data.quotationNumber}`, style: "subheader" },
        { text: `Prepared For: ${data.customerName}`, margin: [0, 5, 0, 5] },
        { text: `Validity Period: Valid until ${data.validUntil}`, margin: [0, 0, 0, 5] },
        { text: `Estimated Delivery (ETA): ${data.etaDate}`, margin: [0, 0, 0, 15] },

        { text: "Itemised Bill of Materials & Cost Breakdown", style: "sectionTitle" },
        {
          table: {
            headerRows: 1,
            widths: ["*", "auto", "auto", "auto", "auto"],
            body: [
              [
                { text: "Material", bold: true },
                { text: "Qty", bold: true },
                { text: "Unit", bold: true },
                { text: "Unit Rate", bold: true },
                { text: "Total", bold: true },
              ],
              ...data.lineItems.map((item) => [
                item.materialName,
                item.requiredQty.toString(),
                item.unit,
                formatINR(item.unitCostPaise),
                formatINR(item.totalCostPaise),
              ]),
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 15],
        },

        {
          columns: [
            { text: "", width: "*" },
            {
              width: 250,
              table: {
                body: [
                  ["Raw Material Subtotal", formatINR(data.subtotalCostPaise)],
                  [`Wastage Allowance (${data.wastagePct}%)`, formatINR(data.wastageCostPaise)],
                  [`Price-Risk Buffer (${data.riskBufferPct}%)`, formatINR(data.riskBufferCostPaise)],
                  [`Target Margin (${data.marginPct}%)`, formatINR(data.finalPricePaise - data.subtotalCostPaise - data.wastageCostPaise - data.riskBufferCostPaise)],
                  [
                    { text: "Final Quotation Price", bold: true },
                    { text: formatINR(data.finalPricePaise), bold: true },
                  ],
                ],
              },
              layout: "noBorders",
            },
          ],
          margin: [0, 0, 0, 20],
        },

        { text: "Advisory Explanation & Working Assumptions", style: "sectionTitle" },
        { text: data.explanation, italics: true, margin: [0, 0, 0, 20] },

        {
          text: "Notice: This quotation is generated with intelligent manufacturing buffers and requires written customer confirmation.",
          style: "footerNote",
        },
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: "#1e3a8a", margin: [0, 0, 0, 5] },
        subheader: { fontSize: 13, bold: true, color: "#475569", margin: [0, 0, 0, 10] },
        sectionTitle: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], color: "#0f172a" },
        footerNote: { fontSize: 9, color: "#64748b", margin: [0, 30, 0, 0] },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", (err: Error) => reject(err));

    pdfDoc.end();
  });
}

