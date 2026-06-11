import "server-only";

import {
  getCampaign,
  pickReminderKind,
  updateCampaign,
} from "./campaignStore.server";
import { renderCampaignText } from "./campaignTemplate";
import { sendEmail } from "./emailSend.server";
import { listLeads } from "./leadStore.server";

export interface SendBatchResult {
  sent: number;
  skipped: number;
  errors: { leadId: string; error: string }[];
}

export async function sendCampaignInitial(campaignId: string): Promise<SendBatchResult> {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Кампания не найдена");

  const result: SendBatchResult = { sent: 0, skipped: 0, errors: [] };

  for (const recipient of campaign.recipients) {
    if (recipient.email1SentAt) {
      result.skipped++;
      continue;
    }
    try {
      await sendEmail({
        to: recipient.email,
        subject: renderCampaignText(campaign.templates.subject1, recipient),
        text: renderCampaignText(campaign.templates.body1, recipient),
      });
      recipient.email1SentAt = new Date().toISOString();
      recipient.email1Error = undefined;
      result.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      recipient.email1Error = msg;
      result.errors.push({ leadId: recipient.leadId, error: msg });
    }
  }

  updateCampaign(campaign);
  return result;
}

export async function sendCampaignReminders(campaignId: string): Promise<SendBatchResult> {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Кампания не найдена");

  const leadsMap = new Map(listLeads().map((l) => [l.leadId, l]));
  const result: SendBatchResult = { sent: 0, skipped: 0, errors: [] };

  for (const recipient of campaign.recipients) {
    const lead = leadsMap.get(recipient.leadId);
    const kind = pickReminderKind(lead, recipient);
    if (!kind) {
      result.skipped++;
      continue;
    }

    const subject =
      kind === "no_visit"
        ? campaign.templates.subject2NoVisit
        : campaign.templates.subject2NoPhone;
    const body =
      kind === "no_visit"
        ? campaign.templates.body2NoVisit
        : campaign.templates.body2NoPhone;

    try {
      await sendEmail({
        to: recipient.email,
        subject: renderCampaignText(subject, recipient),
        text: renderCampaignText(body, recipient),
      });
      recipient.email2SentAt = new Date().toISOString();
      recipient.email2Kind = kind;
      recipient.email2Error = undefined;
      result.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      recipient.email2Error = msg;
      result.errors.push({ leadId: recipient.leadId, error: msg });
    }
  }

  updateCampaign(campaign);
  return result;
}
