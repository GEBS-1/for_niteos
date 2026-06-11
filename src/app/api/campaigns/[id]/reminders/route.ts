import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth.server";
import { sendCampaignReminders } from "@/lib/campaignSend.server";
import { isSmtpConfigured } from "@/lib/emailSend.server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP не настроен в .env.local (SMTP_USER, SMTP_PASS)" },
      { status: 400 }
    );
  }

  try {
    const { id } = await params;
    const result = await sendCampaignReminders(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка отправки" },
      { status: 500 }
    );
  }
}
