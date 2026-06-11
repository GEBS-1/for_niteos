export interface GridRow {
  leadId: string;
  email: string;
  name: string;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Вставка из Excel: email + имя (2 столбца) или email;имя */
export function parseExcelPaste(text: string): GridRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: GridRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.includes(";") && !line.includes("\t")) {
      const semi = line.split(";").map((c) => c.trim());
      const withEmail = semi.find((c) => looksLikeEmail(c));
      const email = withEmail ?? "";
      const name = semi.find((c) => c !== email && c) ?? "";
      rows.push({ leadId: "", email, name });
      continue;
    }

    const cols = line.split("\t").map((c) => c.trim());
    if (cols.length === 1 && looksLikeEmail(cols[0])) {
      rows.push({ leadId: "", email: cols[0], name: "" });
      continue;
    }
    if (cols.length === 2) {
      if (looksLikeEmail(cols[0])) {
        rows.push({ leadId: "", email: cols[0], name: cols[1] ?? "" });
      } else if (looksLikeEmail(cols[1])) {
        rows.push({ leadId: "", email: cols[1], name: cols[0] ?? "" });
      } else {
        rows.push({ leadId: "", email: cols[0], name: cols[1] ?? "" });
      }
      continue;
    }
    if (cols.length >= 3) {
      const emailCol = cols.findIndex((c) => looksLikeEmail(c));
      if (emailCol >= 0) {
        const email = cols[emailCol];
        const name = cols.find((c, i) => i !== emailCol && c && !looksLikeEmail(c)) ?? "";
        rows.push({ leadId: "", email, name });
        continue;
      }
    }
    rows.push({ leadId: "", email: cols[0] ?? "", name: cols[1] ?? "" });
  }
  return rows;
}
