import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth.server";
import { getCampaignBaseUrl } from "@/lib/buildLeadLink";
import { sendCampaignInitial } from "@/lib/campaignSend.server";
import { createCampaign, listCampaigns } from "@/lib/campaignStore.server";
import type { CampaignTemplates } from "@/lib/campaignTypes";
import type { GridRow } from "@/lib/contactsGrid.shared";
import { gridToContactRows } from "@/lib/contactsGrid.server";
import { isSmtpConfigured } from "@/lib/emailSend.server";
import { parseContactsCsv, type ContactRow } from "@/lib/parseContactsCsv";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }
  return NextResponse.json({
    campaigns: listCampaigns(),
    smtpConfigured: isSmtpConfigured(),
    siteUrl: getCampaignBaseUrl(),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "Рассылка";
    const baseUrl = getCampaignBaseUrl();
    const sendNow = body.sendNow === true;

    let contacts: ContactRow[] | string;
    if (Array.isArray(body.contacts)) {
      contacts = gridToContactRows(body.contacts as GridRow[]);
    } else if (typeof body.csv === "string" && body.csv.trim()) {
      contacts = parseContactsCsv(body.csv);
    } else {
      return NextResponse.json({ error: "Добавьте контакты" }, { status: 400 });
    }
    if (typeof contacts === "string") {
      return NextResponse.json({ error: contacts }, { status: 400 });
    }

    const templates = body.templates as Partial<CampaignTemplates> | undefined;
    const campaign = createCampaign({
      name,
      baseUrl,
      contacts,
      templates,
    });

    let sendResult = null;
    if (sendNow) {
      if (!isSmtpConfigured()) {
        return NextResponse.json(
          { error: "SMTP не настроен (SMTP_USER, SMTP_PASS в .env)", campaign },
          { status: 400 }
        );
      }
      sendResult = await sendCampaignInitial(campaign.id);
    }

    return NextResponse.json({ ok: true, campaign, sendResult });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка создания кампании" }, { status: 500 });
  }
}
