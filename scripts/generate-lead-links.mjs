#!/usr/bin/env node
/**
 * Генерация персональных ссылок для email-рассылки.
 *
 * CSV (UTF-8), разделитель ; или , — колонки: leadId, email [, name]
 * Пример: data/leads-source.csv
 *
 *   leadId;email;name
 *   ivan-001;ivan@example.com;Иван
 *
 * node scripts/generate-lead-links.mjs data/leads-source.csv
 * node scripts/generate-lead-links.mjs data/leads-source.csv --base https://niteos.ru/configurator
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const LEAD_ID_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/;

function parseArgs(argv) {
  const args = argv.slice(2);
  let csvPath = null;
  let baseUrl = process.env.LEAD_LINK_BASE ?? "http://localhost:3000";
  let utmSource = "email";
  let utmCampaign = "configurator";

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--base" && args[i + 1]) {
      baseUrl = args[++i];
    } else if (a === "--utm-source" && args[i + 1]) {
      utmSource = args[++i];
    } else if (a === "--utm-campaign" && args[i + 1]) {
      utmCampaign = args[++i];
    } else if (!a.startsWith("-")) {
      csvPath = a;
    }
  }

  if (!csvPath) {
    console.error(
      "Использование: node scripts/generate-lead-links.mjs <файл.csv> [--base URL] [--utm-source email] [--utm-campaign configurator]"
    );
    process.exit(1);
  }

  return {
    csvPath: path.isAbsolute(csvPath) ? csvPath : path.join(root, csvPath),
    baseUrl: baseUrl.replace(/\/$/, ""),
    utmSource,
    utmCampaign,
  };
}

function detectDelimiter(headerLine) {
  const semi = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delim = detectDelimiter(lines[0]);
  const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase());

  const idx = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const leadCol = idx(["leadid", "lead_id", "lead", "id"]);
  const emailCol = idx(["email", "e-mail", "mail"]);
  const nameCol = idx(["name", "имя", "fio"]);

  if (leadCol < 0) {
    throw new Error("В CSV нужна колонка leadId (или lead, id)");
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim());
    const leadId = (cols[leadCol] ?? "").trim().toLowerCase();
    const email = emailCol >= 0 ? (cols[emailCol] ?? "").trim() : "";
    const name = nameCol >= 0 ? (cols[nameCol] ?? "").trim() : "";
    if (!leadId) continue;
    rows.push({ leadId, email, name });
  }
  return rows;
}

function buildLink(baseUrl, leadId, { email, utmSource, utmCampaign }) {
  const url = new URL(baseUrl);
  url.searchParams.set("lead", leadId);
  if (email) url.searchParams.set("email", email);
  if (utmSource) url.searchParams.set("utm_source", utmSource);
  if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign);
  return url.toString();
}

const { csvPath, baseUrl, utmSource, utmCampaign } = parseArgs(process.argv);

if (!fs.existsSync(csvPath)) {
  console.error("Файл не найден:", csvPath);
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const outPath = csvPath.replace(/\.csv$/i, "") + "-links.csv";

const outLines = ["leadId;email;name;link"];
let ok = 0;
let skipped = 0;

for (const row of rows) {
  if (!LEAD_ID_RE.test(row.leadId)) {
    console.warn("SKIP некорректный leadId:", row.leadId);
    skipped++;
    continue;
  }
  const link = buildLink(baseUrl, row.leadId, {
    email: row.email,
    utmSource,
    utmCampaign,
  });
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  outLines.push(
    [row.leadId, row.email, row.name, link].map(esc).join(";")
  );
  ok++;
}

fs.writeFileSync(outPath, outLines.join("\n") + "\n", "utf8");
console.log(`Готово: ${ok} ссылок → ${outPath}${skipped ? `, пропущено: ${skipped}` : ""}`);
