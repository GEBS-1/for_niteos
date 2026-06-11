import "server-only";

import { sanitizeLeadId } from "@/lib/leadStore.server";
import type { ContactRow } from "@/lib/parseContactsCsv";
import type { GridRow } from "./contactsGrid.shared";

function leadIdFromEmail(email: string, index: number, used: Set<string>): string {
  const local = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = (local.length >= 3 ? local : "lead").slice(0, 48);
  let candidate = base;
  let n = index;
  while (!sanitizeLeadId(candidate) || used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return sanitizeLeadId(candidate)!;
}

export function gridToContactRows(grid: GridRow[]): ContactRow[] | string {
  const out: ContactRow[] = [];
  const used = new Set<string>();
  let n = 0;
  for (const row of grid) {
    const email = row.email.trim();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    n += 1;
    const manual = sanitizeLeadId(row.leadId.trim().toLowerCase());
    const leadId = manual && !used.has(manual) ? manual : leadIdFromEmail(email, n, used);
    used.add(leadId);

    out.push({
      leadId,
      email,
      name: row.name.trim(),
    });
  }
  if (!out.length) return "Добавьте хотя бы один email";
  return out;
}
