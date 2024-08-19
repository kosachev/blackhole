import { convert } from "number-to-words-ru";
import { PDFFont, PDFPage } from "pdf-lib";

const invoice = {
  header: { x: 15, y: 20, font_size: 10, line_height: 14 },
  title: {
    y: 85,
    font_size: 14,
    line_height: 14,
    text: (id: string, date: string) => `ТОВАРНЫЙ ЧЕК №${id} от ${date}`,
  },
  lead: { x: 15, y: 120, font_size: 11, line_height: 14 },
  table: { x: 15, y: 200, font_size: 10, line_height: 12, border_width: 0.5 },
  footer: {
    x: 15,
    y: 310,
    font_size: 9,
    line_height: 11,
    text: (total: number) =>
      `Всего отпущено и оплачено товаров на сумму: ${total}.00 руб. (${convert(total).toLocaleLowerCase()})\n
Продавец: ____________________________________________\n
Гарантийные обязательства
Товар получил(ла) полностью. Претензий по комплектности, внешнему виду и упаковке, не имею. С правилами гарантийного
обслуживания ознакомлен(на).\n
Дата: ____________________ Покупатель: ____________________________________________`,
  },
};

export type Invoice = {
  header: string;
  id: string;
  date: string;
  lead: string;
  goods: {
    name: string;
    price: number;
    quantity: number;
  }[];
  delivery_cost?: number;
  discount?: string;
};

export function fillInvoice(page: PDFPage, data: Invoice, font: PDFFont, font_bold: PDFFont) {
  const top = (value: number) => page.getHeight() - value;

  page.setFont(font);

  // header
  page.drawText(data.header, {
    x: invoice.header.x,
    y: top(invoice.header.y),
    size: invoice.header.font_size,
    lineHeight: invoice.header.line_height,
    font: font_bold,
  });

  // title
  const title_text = invoice.title.text(data.id, data.date);
  page.drawText(title_text, {
    x: (page.getWidth() - font_bold.widthOfTextAtSize(title_text, invoice.title.font_size)) / 2,
    y: top(invoice.title.y),
    size: invoice.title.font_size,
    lineHeight: invoice.title.line_height,
    font: font_bold,
  });

  // lead
  page.drawText(data.lead, {
    x: invoice.lead.x,
    y: top(invoice.lead.y),
    size: invoice.lead.font_size,
    lineHeight: invoice.lead.line_height,
  });

  // table

  function drawTableLine(
    coordinates: [number, number],
    data: { width: number; text: string; align?: "left" | "right" | "center"; bold?: boolean }[],
  ) {
    let cur_x = coordinates[0];
    for (const { width, text, align, bold } of data) {
      page.drawRectangle({
        x: cur_x,
        y: coordinates[1],
        width: width,
        height: invoice.table.line_height,
        opacity: 0,
        borderWidth: invoice.table.border_width,
      });

      page.drawText(text, {
        x:
          align === "right"
            ? cur_x + width - 3.5 - font.widthOfTextAtSize(text, invoice.table.font_size)
            : align === "center"
              ? cur_x + (width - font.widthOfTextAtSize(text, invoice.table.font_size)) / 2
              : cur_x + 3.5,
        y: coordinates[1] + 2.5,
        size: invoice.table.font_size,
        font: bold ? font_bold : font,
      });
      cur_x += width;
    }
  }

  // table header
  drawTableLine(
    [invoice.table.x, top(invoice.table.y)],
    [
      { width: 12, text: "#", bold: true },
      { width: 340, text: "Название товара", align: "center", bold: true },
      { width: 70, text: "Цена", align: "center", bold: true },
      { width: 70, text: "Кол-во", align: "center", bold: true },
      { width: 70, text: "Сумма", align: "center", bold: true },
    ],
  );

  let total = data.delivery_cost ?? 0;

  for (const [index, item] of data.goods.entries()) {
    drawTableLine(
      [invoice.table.x, top(invoice.table.y + invoice.table.line_height * (index + 1))],
      [
        { width: 12, text: (index + 1).toString() },
        { width: 340, text: item.name },
        { width: 70, text: item.price.toString(), align: "center" },
        { width: 70, text: item.quantity.toString(), align: "center" },
        { width: 70, text: (item.price * item.quantity).toString(), align: "center" },
      ],
    );
    total += item.price * item.quantity;
  }

  let addition_lines = 1;

  // delivery line
  drawTableLine(
    [
      invoice.table.x,
      top(invoice.table.y + invoice.table.line_height * (data.goods.length + addition_lines)),
    ],
    [
      { width: 352, text: "Доставка", align: "right" },
      { width: 210, text: (data.delivery_cost ?? 0).toString(), align: "right" },
    ],
  );

  // discount line
  if (data.discount) {
    addition_lines++;
    drawTableLine(
      [
        invoice.table.x,
        top(invoice.table.y + invoice.table.line_height * (data.goods.length + addition_lines)),
      ],
      [
        { width: 352, text: "Скидка", align: "right" },
        { width: 210, text: data.discount, align: "right" },
      ],
    );
  }

  // table footer
  addition_lines++;
  drawTableLine(
    [
      invoice.table.x,
      top(invoice.table.y + invoice.table.line_height * (data.goods.length + addition_lines)),
    ],
    [
      { width: 352, text: "ИТОГО", align: "right", bold: true },
      { width: 210, text: total.toString(), align: "right" },
    ],
  );

  // footer
  page.drawText(invoice.footer.text(total), {
    x: invoice.footer.x,
    y: top(invoice.footer.y),
    size: invoice.footer.font_size,
    lineHeight: invoice.footer.line_height,
  });
}
