import "server-only";

import fs from "fs";
import path from "path";
import { buildLeadLink } from "./buildLeadLink";
import type { Campaign, CampaignRecipient, CampaignsStore, CampaignTemplates } from "./campaignTypes";
import { DEFAULT_CAMPAIGN_TEMPLATES } from "./campaignTypes";
import type { ContactRow } from "./parseContactsCsv";
import { listLeads } from "./leadStore.server";
import type { LeadRecord } from "./leadTypes";
import type { ReminderKind } from "./campaignTypes";

const STORE_PATH = path.join(process.cwd(), "data", "campaigns.json");

function loadStore(): CampaignsStore {
  if (!fs.existsSync(STORE_PATH)) return { campaigns: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as CampaignsStore;
    if (!parsed.campaigns || typeof parsed.campaigns !== "object") {
      return { campaigns: {} };
    }
    return parsed;
  } catch {
    return { campaigns: {} };
  }
}

function saveStore(store: CampaignsStore): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function newId(): string {
  return `cmp-${Date.now().toString(36)}`;
}

export function listCampaigns(): Campaign[] {
  const store = loadStore();
  return Object.values(store.campaigns).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getCampaign(id: string): Campaign | null {
  const store = loadStore();
  return store.campaigns[id] ?? null;
}

export function createCampaign(input: {
  name: string;
  baseUrl: string;
  contacts: ContactRow[];
  templates?: Partial<CampaignTemplates>;
}): Campaign {
  const templates: CampaignTemplates = {
    ...DEFAULT_CAMPAIGN_TEMPLATES,
    ...input.templates,
  };

  const recipients: CampaignRecipient[] = input.contacts.map((c) => ({
    leadId: c.leadId,
    email: c.email,
    name: c.name,
    link: buildLeadLink(input.baseUrl, c.leadId, {
      email: c.email,
      utmSource: "email",
      utmCampaign: input.name.slice(0, 40) || "configurator",
    }),
  }));

  const campaign: Campaign = {
    id: newId(),
    name: input.name.trim() || "Рассылка",
    createdAt: new Date().toISOString(),
    baseUrl: input.baseUrl,
    templates,
    recipients,
  };

  const store = loadStore();
  store.campaigns[campaign.id] = campaign;
  saveStore(store);
  return campaign;
}

export function updateCampaign(campaign: Campaign): void {
  const store = loadStore();
  store.campaigns[campaign.id] = campaign;
  saveStore(store);
}

export function enrichRecipientWithLead(
  recipient: CampaignRecipient,
  lead?: LeadRecord
): CampaignRecipient & {
  visited: boolean;
  calculateCount: number;
  resultViewCount: number;
  feedbackSubmitted: boolean;
  phone?: string;
  interested?: boolean;
} {
  return {
    ...recipient,
    visited: lead?.visited ?? false,
    calculateCount: lead?.calculateCount ?? 0,
    resultViewCount: lead?.resultViewCount ?? 0,
    feedbackSubmitted: lead?.feedbackSubmitted ?? false,
    phone: lead?.phone,
    interested: lead?.interested,
  };
}

export function getCampaignWithFunnel(id: string) {
  const campaign = getCampaign(id);
  if (!campaign) return null;
  const leadsMap = new Map(listLeads().map((l) => [l.leadId, l]));
  return {
    ...campaign,
    recipients: campaign.recipients.map((r) =>
      enrichRecipientWithLead(r, leadsMap.get(r.leadId))
    ),
  };
}

export function pickReminderKind(
  lead: LeadRecord | undefined,
  recipient: CampaignRecipient
): ReminderKind | null {
  if (recipient.email2SentAt) return null;
  if (!recipient.email1SentAt) return null;
  if (lead?.feedbackSubmitted && lead.phone) return null;
  if (!lead?.visited) return "no_visit";
  if (lead.visited && !lead.feedbackSubmitted) return "no_phone";
  if (lead.feedbackSubmitted && !lead.interested) return null;
  return null;
}
