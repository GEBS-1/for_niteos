#!/usr/bin/env node
/**
 * Экспорт data/leads-funnel.json в CSV для Excel.
 *
 * node scripts/export-leads-csv.mjs
 * node scripts/export-leads-csv.mjs --out reports/leads.csv
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const storePath = path.join(root, "data", "leads-funnel.json");

function parseArgs(argv) {
  const args = argv.slice(2);
  let outPath = path.join(root, "data", "leads-export.csv");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      outPath = path.isAbsolute(args[i + 1])
        ? args[i + 1]
        : path.join(root, args[i + 1]);
      i++;
    }
  }
  return { outPath };
}

function esc(s) {
  if (s == null || s === "") return "";
  return `"${String(s).replace(/"/g, '""')}"`;
}

function boolRu(v) {
  if (v === true) return "да";
  if (v === false) return "нет";
  return "";
}

const { outPath } = parseArgs(process.argv);

if (!fs.existsSync(storePath)) {
  console.error("Нет данных:", storePath);
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const leads = Object.values(store.leads ?? {}).sort(
  (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
);

const headers = [
  "leadId",
  "email",
  "utmSource",
  "utmCampaign",
  "firstSeen",
  "lastSeen",
  "visitCount",
  "calculateCount",
  "resultViewCount",
  "feedbackSubmitted",
  "interested",
  "name",
  "phone",
  "contactEmail",
  "lastFixtureName",
  "lastQuantity",
  "lastTotalPrice",
];

const lines = [headers.join(";")];

for (const lead of leads) {
  lines.push(
    [
      lead.leadId,
      lead.email,
      lead.utmSource,
      lead.utmCampaign,
      lead.firstSeen,
      lead.lastSeen,
      lead.visitCount,
      lead.calculateCount,
      lead.resultViewCount,
      boolRu(lead.feedbackSubmitted),
      boolRu(lead.interested),
      lead.name,
      lead.phone,
      lead.contactEmail,
      lead.lastFixtureName,
      lead.lastQuantity,
      lead.lastTotalPrice,
    ]
      .map(esc)
      .join(";")
  );
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`Экспорт: ${leads.length} лидов → ${outPath}`);
