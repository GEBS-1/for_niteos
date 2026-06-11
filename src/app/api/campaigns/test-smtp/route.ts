import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth.server";
import { getSmtpConfig, sendEmail } from "@/lib/emailSend.server";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  const cfg = getSmtpConfig();
  if (!cfg) {
    return NextResponse.json({ error: "SMTP не настроен" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const to =
      typeof body.to === "string" && body.to.includes("@") ? body.to : cfg.user;

    await sendEmail({
      to,
      subject: "NITEOS — тест SMTP",
      text: "Письмо отправлено с локального конфигуратора. SMTP работает.",
    });

    return NextResponse.json({ ok: true, to });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка SMTP" },
      { status: 500 }
    );
  }
}
