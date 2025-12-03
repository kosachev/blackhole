import { promises as fs } from "node:fs";
import { PDFDocument, PageSizes } from "pdf-lib";

import fontkit from "@pdf-lib/fontkit";
import { type Invoice, fillInvoice } from "./invoice.form";
import { type Post112ep, post112p } from "./post112ep.form";
import { type Post7p, post7p } from "./post7p.form";

export type FieldsMap<T> = Record<keyof T, { font_size: number; field_name: string }>;
export type Form<T> = {
  data: Promise<Buffer>;
  fileds_map: FieldsMap<T>;
};

export class PDFBuilder {
  private font_data: Promise<Buffer>;
  private font_bold_data: Promise<Buffer>;

  constructor(
    private readonly font_path: string,
    private readonly font_bold_path: string,
  ) {
    this.font_data = fs.readFile(font_path);
    this.font_bold_data = fs.readFile(font_bold_path);
  }

  async fillPdf<T extends Record<string, string>>(
    params: T,
    fields_map: FieldsMap<T>,
    pdf: string | Uint8Array | ArrayBuffer,
  ): Promise<PDFDocument> {
    const doc = await PDFDocument.load(pdf);
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(await this.font_data, { subset: true });
    const form = doc.getForm();
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      const field = form.getTextField(fields_map[key].field_name);
      field.setText(value.toString());
      field.setFontSize(fields_map[key].font_size);
    }
    form.updateFieldAppearances(font);
    form.flatten();
    return doc;
  }

  async mergePdf(pdfs: PDFDocument[]): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    for (const pdf of pdfs) {
      for (const page of await doc.copyPages(pdf, Array.from(Array(pdf.getPageCount()).keys()))) {
        doc.addPage(page);
      }
    }
    return doc;
  }

  async fillPost7p(params: Post7p): Promise<Uint8Array> {
    return (await this.fillPdf<Post7p>(params, post7p.fileds_map, await post7p.data)).save();
  }

  async fillPost112ep(params: Post112ep): Promise<Uint8Array> {
    return (await this.fillPdf<Post112ep>(params, post112p.fileds_map, await post112p.data)).save();
  }

  async fillPost7pDoc(params: Post7p): Promise<PDFDocument> {
    return this.fillPdf<Post7p>(params, post7p.fileds_map, await post7p.data);
  }

  async fillPost112epDoc(params: Post112ep): Promise<PDFDocument> {
    return this.fillPdf<Post112ep>(params, post112p.fileds_map, await post112p.data);
  }

  async fillInvoice(params: Invoice): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(await this.font_data, { subset: true });
    const font_bold = await doc.embedFont(await this.font_bold_data, { subset: true });
    const page = doc.addPage(PageSizes.A4);
    fillInvoice(page, params, font, font_bold);
    return doc.save();
  }
}
