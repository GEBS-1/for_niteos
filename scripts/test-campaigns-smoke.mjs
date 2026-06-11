/**
 * Smoke-тест рассылки: API, парсинг контактов, создание кампании без отправки.
 * Запуск: npm run test:campaigns
 * Сервер: npm run build && PORT=3001 npm run start
 *        BASE_URL=http://127.0.0.1:3001 npm run test:campaigns
 * Если dev на :3000 отдаёт 500 (Cannot find module) — npm run dev:clean
 */
function parseExcelPaste(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t").map((c) => c.trim());
    if (cols.length === 1 && line.includes(";")) {
      const semi = line.split(";").map((c) => c.trim());
      rows.push({ leadId: semi[0] ?? "", email: semi[1] ?? "", name: semi[2] ?? "" });
      continue;
    }
    rows.push({ leadId: cols[0] ?? "", email: cols[1] ?? "", name: cols[2] ?? "" });
  }
  return rows;
}

const BASE = process.env.BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
const TOKEN = process.env.LEADS_VIEW_TOKEN || "local-dev-token";

const headers = {
  "Content-Type": "application/json",
  "x-leads-token": TOKEN,
};

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}: ${detail}`);
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

console.log(`\nCampaign smoke test → ${BASE}\n`);

// 1. Парсинг Excel
const pasted = parseExcelPaste("test@example.com\tИван\nbad@example.com\tПётр");
if (pasted.length === 2 && pasted[0].email === "test@example.com" && pasted[0].name === "Иван") {
  ok("parseExcelPaste (email + имя)");
} else {
  fail("parseExcelPaste", JSON.stringify(pasted));
}

const semi = parseExcelPaste("a-001;semi@example.com;Пётр");
if (semi.length === 1 && semi[0].email === "semi@example.com") {
  ok("parseExcelPaste (semicolon)");
} else {
  fail("parseExcelPaste semicolon", JSON.stringify(semi));
}

// 2. GET campaigns
try {
  const { res, json } = await api("/api/campaigns");
  if (res.status === 401) {
    fail("GET /api/campaigns", "401 — проверьте LEADS_VIEW_TOKEN");
  } else if (!res.ok) {
    fail("GET /api/campaigns", `${res.status} ${JSON.stringify(json)}`);
  } else {
    ok("GET /api/campaigns");
    if (typeof json.smtpConfigured === "boolean") ok("smtpConfigured в ответе");
    else fail("smtpConfigured", "нет поля");
    if (json.siteUrl && json.siteUrl.includes("194.226.187.101")) {
      ok("siteUrl указывает на сервер");
    } else if (json.siteUrl) {
      ok(`siteUrl = ${json.siteUrl}`);
    } else {
      fail("siteUrl", "пусто");
    }
  }
} catch (e) {
  fail("GET /api/campaigns", e.message);
}

// 3. GET leads
try {
  const { res, json } = await api(`/api/leads?token=${encodeURIComponent(TOKEN)}`);
  if (res.ok && Array.isArray(json.leads)) ok("GET /api/leads");
  else fail("GET /api/leads", `${res.status}`);
} catch (e) {
  fail("GET /api/leads", e.message);
}

// 4. Создание кампании без отправки
const testName = `smoke-${Date.now()}`;
try {
  const { res, json } = await api("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: testName,
      contacts: [{ leadId: "smoke-test-001", email: "smoke@example.com", name: "Smoke" }],
      sendNow: false,
    }),
  });
  if (res.ok && json.campaign?.id && json.campaign.recipients?.length === 1) {
    ok("POST /api/campaigns (без отправки)");
    const link = json.campaign.recipients[0].link;
    if (link.includes("lead=smoke-test-001") && link.includes("194.226.187.101")) {
      ok("персональная ссылка с lead и сервером");
    } else {
      fail("ссылка", link);
    }
  } else {
    fail("POST /api/campaigns", `${res.status} ${JSON.stringify(json)}`);
  }
} catch (e) {
  fail("POST /api/campaigns", e.message);
}

// 5. Пустые контакты — ожидаем 400
try {
  const { res } = await api("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({ name: "empty", contacts: [], sendNow: false }),
  });
  if (res.status === 400) ok("POST пустые контакты → 400");
  else fail("POST пустые контакты", `status ${res.status}`);
} catch (e) {
  fail("POST пустые контакты", e.message);
}

console.log(`\nИтого: ${passed} ok, ${failed} fail\n`);
process.exit(failed > 0 ? 1 : 0);
