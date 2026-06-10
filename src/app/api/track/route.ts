import { NextRequest, NextResponse } from "next/server";
import { recordLeadEvent, sanitizeLeadId } from "@/lib/leadStore.server";
import type { LeadEventType, TrackEventPayload } from "@/lib/leadTypes";

const ALLOWED: LeadEventType[] = ["visit", "calculate", "result_view", "feedback"];

function parseBody(body: unknown): TrackEventPayload | string {
  if (!body || typeof body !== "object") return "Некорректный запрос";
  const o = body as Record<string, unknown>;
  const leadId = typeof o.leadId === "string" ? o.leadId : "";
  if (!sanitizeLeadId(leadId)) return "Некорректный leadId";
  const type = o.type as LeadEventType;
  if (!ALLOWED.includes(type)) return "Некорректный тип события";

  const meta =
    o.meta && typeof o.meta === "object"
      ? (o.meta as TrackEventPayload["meta"])
      : undefined;

  return {
    leadId,
    type,
    email: typeof o.email === "string" ? o.email : undefined,
    utmSource: typeof o.utmSource === "string" ? o.utmSource : undefined,
    utmCampaign: typeof o.utmCampaign === "string" ? o.utmCampaign : undefined,
    meta,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseBody(body);
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }

    const lead = recordLeadEvent(parsed);
    return NextResponse.json({ ok: true, leadId: lead.leadId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
