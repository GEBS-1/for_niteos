/**
 * Тестовая отправка одному адресату + проверка ссылки и воронки.
 * node scripts/send-test-campaign.mjs [email]
 */
const BASE = process.env.BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
const TOKEN = process.env.LEADS_VIEW_TOKEN || "local-dev-token";
const EMAIL = process.argv[2] || "sahibullinkamil@gmail.com";
const LEAD_ID = "kamil-test-001";

const headers = {
  "Content-Type": "application/json",
  "x-leads-token": TOKEN,
};

async function main() {
  console.log(`\nТест рассылки → ${EMAIL}\n`);

  const createRes = await fetch(`${BASE}/api/campaigns`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Тест ${new Date().toISOString().slice(0, 16)}`,
      contacts: [{ leadId: LEAD_ID, email: EMAIL, name: "Камил" }],
      templates: {
        subject1: "NITEOS — тестовое письмо конфигуратора",
        body1: `Здравствуйте, {имя}!

Это тестовое письмо от конфигуратора NITEOS.
Перейдите по ссылке и попробуйте загрузить фото здания:

{ссылка}

С уважением,
NITEOS`,
      },
      sendNow: true,
    }),
  });

  const createText = await createRes.text();
  let createJson;
  try {
    createJson = JSON.parse(createText);
  } catch {
    console.error("Ошибка API:", createRes.status, createText.slice(0, 500));
    process.exit(1);
  }

  if (!createRes.ok) {
    console.error("Ошибка создания:", createJson.error ?? createText);
    process.exit(1);
  }

  const link = createJson.campaign?.recipients?.[0]?.link;
  const sent = createJson.sendResult?.sent ?? 0;
  const errors = createJson.sendResult?.errors ?? [];

  console.log(`Кампания: ${createJson.campaign?.id}`);
  console.log(`Отправлено: ${sent}`);
  if (errors.length) console.log("Ошибки:", errors);
  console.log(`Ссылка: ${link}\n`);

  if (!link) {
    console.error("Нет ссылки в ответе");
    process.exit(1);
  }

  // Имитация визита по ссылке
  const visitRes = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: LEAD_ID,
      type: "visit",
      email: EMAIL,
    }),
  });
  const visitJson = await visitRes.json();
  console.log("Трек visit:", visitRes.ok ? "ok" : visitJson);

  const leadsRes = await fetch(`${BASE}/api/leads?token=${encodeURIComponent(TOKEN)}`);
  const leadsJson = await leadsRes.json();
  const lead = leadsJson.leads?.find((l) => l.leadId === LEAD_ID);
  console.log("Лид в воронке:", lead ? `visitCount=${lead.visitCount}` : "не найден");

  console.log("\nПроверьте почту", EMAIL, "и откройте ссылку вручную для полного теста.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
