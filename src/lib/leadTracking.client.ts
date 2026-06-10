"use client";

import { withBasePath } from "@/lib/basePath";
import type { LeadEventType } from "@/lib/leadTypes";

const LEAD_ID_KEY = "niteos_lead_id";
const LEAD_EMAIL_KEY = "niteos_lead_email";
const VISIT_SESSION_KEY = "niteos_lead_visit_sent";

export interface LeadAttribution {
  leadId: string | null;
  email: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

function readSearchParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

export function sanitizeLeadIdClient(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(id)) return null;
  return id;
}

/** Читает ?lead= из URL, сохраняет в localStorage */
export function captureLeadFromUrl(): LeadAttribution {
  const params = readSearchParams();
  const fromUrl = sanitizeLeadIdClient(params?.get("lead"));
  const emailFromUrl = params?.get("email")?.trim() || null;
  const utmSource = params?.get("utm_source")?.trim() || null;
  const utmCampaign = params?.get("utm_campaign")?.trim() || null;

  if (fromUrl) {
    localStorage.setItem(LEAD_ID_KEY, fromUrl);
  }
  if (emailFromUrl) {
    localStorage.setItem(LEAD_EMAIL_KEY, emailFromUrl);
  }

  const leadId =
    fromUrl ?? sanitizeLeadIdClient(localStorage.getItem(LEAD_ID_KEY));
  const email = emailFromUrl ?? localStorage.getItem(LEAD_EMAIL_KEY);

  return {
    leadId,
    email: email || null,
    utmSource,
    utmCampaign,
  };
}

export function getStoredLeadId(): string | null {
  return sanitizeLeadIdClient(localStorage.getItem(LEAD_ID_KEY));
}

export function buildLeadLink(
  baseUrl: string,
  leadId: string,
  opts?: { email?: string; utmSource?: string; utmCampaign?: string }
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("lead", leadId);
  if (opts?.email) url.searchParams.set("email", opts.email);
  if (opts?.utmSource) url.searchParams.set("utm_source", opts.utmSource);
  if (opts?.utmCampaign) url.searchParams.set("utm_campaign", opts.utmCampaign);
  return url.toString();
}

export async function trackLeadEvent(
  type: LeadEventType,
  meta?: Record<string, string | number | boolean | null | undefined>
): Promise<void> {
  const { leadId, email, utmSource, utmCampaign } = captureLeadFromUrl();
  if (!leadId) return;

  if (type === "visit" && sessionStorage.getItem(VISIT_SESSION_KEY) === leadId) {
    return;
  }
  if (type === "visit") {
    sessionStorage.setItem(VISIT_SESSION_KEY, leadId);
  }

  try {
    await fetch(withBasePath("/api/track"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        type,
        email: email ?? undefined,
        utmSource: utmSource ?? undefined,
        utmCampaign: utmCampaign ?? undefined,
        meta,
      }),
      keepalive: true,
    });
  } catch {
    // не блокируем UI
  }
}
