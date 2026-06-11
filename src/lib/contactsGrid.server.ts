import "server-only";

import { sanitizeLeadId } from "@/lib/leadStore.server";
import type { ContactRow } from "@/lib/parseContactsCsv";
import type { GridRow } from "./contactsGrid.shared";

export function gridToContactRows(grid: GridRow[]): ContactRow[] | string {
  const out: ContactRow[] = [];
  let n = 0;
  for (const row of grid) {
    const email = row.email.trim();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    let leadId = sanitizeLeadId(row.leadId.trim().toLowerCase());
    if (!leadId) {
      n += 1;
      leadId = sanitizeLeadId(`lead-${n}`) ?? `lead-${n}`;
    }
    out.push({
      leadId,
      email,
      name: row.name.trim(),
    });
  }
  if (!out.length) return "Добавьте хотя бы один email";
  return out;
}
