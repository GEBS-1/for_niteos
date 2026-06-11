export function buildLeadLink(
  baseUrl: string,
  leadId: string,
  opts?: { email?: string; utmSource?: string; utmCampaign?: string }
): string {
  const url = new URL(baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl);
  url.searchParams.set("lead", leadId);
  if (opts?.email) url.searchParams.set("email", opts.email);
  if (opts?.utmSource) url.searchParams.set("utm_source", opts.utmSource);
  if (opts?.utmCampaign) url.searchParams.set("utm_campaign", opts.utmCampaign);
  return url.toString();
}

/** URL конфигуратора в ссылках писем (сервер, не localhost) */
export function getCampaignBaseUrl(): string {
  const fromEnv = process.env.CAMPAIGN_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://194.226.187.101:3000";
}
