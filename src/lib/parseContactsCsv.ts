import { sanitizeLeadId } from "@/lib/leadStore.server";

export interface ContactRow {
  leadId: string;
  email: string;
  name: string;
}

function detectDelimiter(headerLine: string): string {
  const semi = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

export function parseContactsCsv(text: string): ContactRow[] | string {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "Пустой файл";

  const delim = detectDelimiter(lines[0]);
  const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase());

  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const leadCol = idx(["leadid", "lead_id", "lead", "id"]);
  const emailCol = idx(["email", "e-mail", "mail", "почта"]);
  const nameCol = idx(["name", "имя", "fio", "фио"]);

  if (leadCol < 0) return "Нужна колонка leadId (или lead, id)";
  if (emailCol < 0) return "Нужна колонка email";

  const rows: ContactRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const leadRaw = (cols[leadCol] ?? "").trim().toLowerCase();
    const leadId = sanitizeLeadId(leadRaw);
    if (!leadId) continue;
    const email = (cols[emailCol] ?? "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const name = nameCol >= 0 ? (cols[nameCol] ?? "").trim() : "";
    rows.push({ leadId, email, name });
  }

  if (!rows.length) return "Нет валидных строк (проверьте leadId и email)";
  return rows;
}
