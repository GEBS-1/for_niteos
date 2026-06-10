import "server-only";

import fs from "fs";
import path from "path";
import type {
  LeadEventType,
  LeadRecord,
  LeadsFunnelStore,
  TrackEventPayload,
} from "./leadTypes";

const STORE_PATH = path.join(process.cwd(), "data", "leads-funnel.json");

export function sanitizeLeadId(raw: string): string | null {
  const id = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(id)) return null;
  return id;
}

function loadStore(): LeadsFunnelStore {
  if (!fs.existsSync(STORE_PATH)) {
    return { leads: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as LeadsFunnelStore;
    if (!parsed.leads || typeof parsed.leads !== "object") {
      return { leads: {} };
    }
    return parsed;
  } catch {
    return { leads: {} };
  }
}

function saveStore(store: LeadsFunnelStore): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function emptyLead(leadId: string, now: string): LeadRecord {
  return {
    leadId,
    firstSeen: now,
    lastSeen: now,
    visited: false,
    visitCount: 0,
    calculateCount: 0,
    resultViewCount: 0,
    feedbackSubmitted: false,
    events: [],
  };
}

export function recordLeadEvent(payload: TrackEventPayload): LeadRecord {
  const leadId = sanitizeLeadId(payload.leadId);
  if (!leadId) throw new Error("Некорректный leadId");

  const store = loadStore();
  const now = new Date().toISOString();
  const lead = store.leads[leadId] ?? emptyLead(leadId, now);

  if (payload.email?.trim()) lead.email = payload.email.trim();
  if (payload.utmSource?.trim()) lead.utmSource = payload.utmSource.trim();
  if (payload.utmCampaign?.trim()) lead.utmCampaign = payload.utmCampaign.trim();

  lead.lastSeen = now;
  lead.events.push({
    type: payload.type,
    at: now,
    meta: payload.meta,
  });
  if (lead.events.length > 200) {
    lead.events = lead.events.slice(-200);
  }

  switch (payload.type) {
    case "visit":
      lead.visited = true;
      lead.visitCount += 1;
      break;
    case "calculate":
      lead.calculateCount += 1;
      if (payload.meta?.fixtureId) lead.lastFixtureId = String(payload.meta.fixtureId);
      if (payload.meta?.fixtureName) lead.lastFixtureName = String(payload.meta.fixtureName);
      if (typeof payload.meta?.quantity === "number") lead.lastQuantity = payload.meta.quantity;
      if (typeof payload.meta?.totalPrice === "number") {
        lead.lastTotalPrice = payload.meta.totalPrice;
      }
      break;
    case "result_view":
      lead.resultViewCount += 1;
      break;
    case "feedback":
      lead.feedbackSubmitted = true;
      if (typeof payload.meta?.interested === "boolean") {
        lead.interested = payload.meta.interested;
      }
      if (payload.meta?.name) lead.name = String(payload.meta.name);
      if (payload.meta?.phone) lead.phone = String(payload.meta.phone);
      if (payload.meta?.contactEmail) lead.contactEmail = String(payload.meta.contactEmail);
      break;
  }

  store.leads[leadId] = lead;
  saveStore(store);
  return lead;
}

export function listLeads(): LeadRecord[] {
  const store = loadStore();
  return Object.values(store.leads).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

export function leadEventLabel(type: LeadEventType): string {
  switch (type) {
    case "visit":
      return "Визит";
    case "calculate":
      return "Расчёт";
    case "result_view":
      return "Результат";
    case "feedback":
      return "Форма";
  }
}
