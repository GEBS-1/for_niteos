export interface GridRow {
  leadId: string;
  email: string;
  name: string;
}

/** Вставка из Excel: столбцы через Tab, строки через Enter */
export function parseExcelPaste(text: string): GridRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: GridRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t").map((c) => c.trim());
    if (cols.length === 1 && line.includes(";")) {
      const semi = line.split(";").map((c) => c.trim());
      rows.push({
        leadId: semi[0] ?? "",
        email: semi[1] ?? "",
        name: semi[2] ?? "",
      });
      continue;
    }
    rows.push({
      leadId: cols[0] ?? "",
      email: cols[1] ?? "",
      name: cols[2] ?? "",
    });
  }
  return rows;
}
