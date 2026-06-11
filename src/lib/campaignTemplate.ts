import type { CampaignRecipient } from "./campaignTypes";

export function renderCampaignText(
  template: string,
  recipient: Pick<CampaignRecipient, "name" | "link" | "email" | "leadId">
): string {
  const name = recipient.name || "коллега";
  return template
    .replace(/\{имя\}/gi, name)
    .replace(/\{name\}/gi, name)
    .replace(/\{ссылка\}/gi, recipient.link)
    .replace(/\{link\}/gi, recipient.link)
    .replace(/\{email\}/gi, recipient.email)
    .replace(/\{leadId\}/gi, recipient.leadId);
}
