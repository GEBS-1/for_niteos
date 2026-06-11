"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { withBasePath } from "@/lib/basePath";
import {
  DEFAULT_CAMPAIGN_TEMPLATES,
  type Campaign,
  type CampaignTemplates,
} from "@/lib/campaignTypes";
import { adminTokenHint, resolveAdminToken } from "@/lib/adminToken.client";
import { parseExcelPaste, type GridRow } from "@/lib/contactsGrid.shared";

const EMPTY_ROW = (): GridRow => ({ leadId: "", email: "", name: "" });

type EnrichedRecipient = Campaign["recipients"][0] & {
  visited?: boolean;
  calculateCount?: number;
  resultViewCount?: number;
  feedbackSubmitted?: boolean;
  interested?: boolean;
  phone?: string;
};

function flag(ok: boolean | undefined) {
  return ok ? "✓" : "—";
}

const labelClass = "text-sm text-black font-medium";
const inputClass =
  "border border-gray-300 rounded w-full px-2 py-1.5 mt-1 text-black bg-white placeholder:text-black/40";
const hintClass = "text-sm text-black";
const btnOutline =
  "px-3 py-1.5 border border-black rounded text-sm text-black bg-white hover:bg-gray-100 disabled:opacity-50";

async function readApiError(res: Response): Promise<string> {
  if (res.status === 401) {
    return "Доступ запрещён — откройте страницу с ?token=ВАШ_ТОКЕН в адресе";
  }
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    if (text.includes("Cannot find module")) {
      return "Сервер сломан (кэш .next). Перезапустите: npm run dev:clean";
    }
  }
  return `Ошибка ${res.status}`;
}

export default function AdminCampaignsPage() {
  const [token, setToken] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<EnrichedRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [grid, setGrid] = useState<GridRow[]>([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [templates, setTemplates] = useState<CampaignTemplates>(DEFAULT_CAMPAIGN_TEMPLATES);

  useEffect(() => {
    setToken(resolveAdminToken());
  }, []);

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      "x-leads-token": token.trim(),
    }),
    [token]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/campaigns"), { headers: headers() });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
      setSmtpOk(data.smtpConfigured ?? false);
      if (data.siteUrl) setSiteUrl(data.siteUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    if (!token) {
      setError(adminTokenHint() || "Нет токена доступа");
      return;
    }
    void loadList();
  }, [token, loadList]);

  const loadCampaign = useCallback(
    async (id: string) => {
      setActiveId(id);
      setLoading(true);
      try {
        const res = await fetch(withBasePath(`/api/campaigns/${id}`), { headers: headers() });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = await res.json();
        setRecipients(data.campaign?.recipients ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setLoading(false);
      }
    },
    [headers]
  );

  const handleGridPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes(";")) return;
    e.preventDefault();
    const pasted = parseExcelPaste(text);
    if (pasted.length) setGrid(pasted);
  };

  const updateCell = (index: number, field: keyof GridRow, value: string) => {
    setGrid((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const createAndSend = async () => {
    if (!name.trim()) {
      setError("Укажите название рассылки");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(withBasePath("/api/campaigns"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: name.trim(),
          contacts: grid,
          templates,
          sendNow: true,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      const sent = data.sendResult?.sent ?? 0;
      const errs = data.sendResult?.errors?.length ?? 0;
      setMessage(
        errs > 0
          ? `Отправлено: ${sent}, ошибок: ${errs}. Смотрите таблицу ниже.`
          : `Готово: «${name}» — отправлено писем: ${sent}`
      );
      setName("");
      setGrid([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      await loadList();
      await loadCampaign(data.campaign.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const testSmtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/campaigns/test-smtp"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      setMessage(`Тест: письмо ушло на ${data.to}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-black bg-white">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h1 className="text-2xl font-bold text-black">Рассылка</h1>
        <div className="flex gap-3 text-sm text-black">
          <Link href={withBasePath("/admin/leads")} className="text-black underline">
            Статистика
          </Link>
          <Link href={withBasePath("/")} className="text-black underline">
            Конфигуратор
          </Link>
        </div>
      </div>

      <p className={hintClass}>
        Ссылки в письмах ведут на конфигуратор:{" "}
        <strong className="text-black">{siteUrl || "…"}</strong>. В тексте письма используйте{" "}
        <strong className="text-black">{"{имя}"}</strong> и{" "}
        <strong className="text-black">{"{ссылка}"}</strong>.
        {smtpOk === false && " — настройте Gmail в .env.local (SMTP_USER, SMTP_PASS)."}
        {smtpOk === true && " — почта подключена."}
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={() => void testSmtp()} disabled={loading} className={btnOutline}>
          Проверить почту
        </button>
        <button type="button" onClick={() => void loadList()} disabled={loading} className={btnOutline}>
          Обновить
        </button>
      </div>

      {error && <p className="text-red-700 text-sm font-medium">{error}</p>}
      {message && <p className="text-green-800 text-sm font-medium">{message}</p>}

      <section className="border border-gray-300 rounded-lg p-4 space-y-4 bg-white">
        <h2 className="font-semibold text-black">Новая рассылка</h2>

        <label className="block">
          <span className={labelClass}>Название рассылки</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Архитекторы Москва, март"
            className={inputClass}
          />
        </label>

        <div>
          <span className={labelClass}>Контакты</span>
          <p className={hintClass + " mt-1 mb-2"}>
            Email и имя — вставьте из Excel (2 столбца) через Ctrl+V. Код ссылки создаётся автоматически.
          </p>
          <div className="overflow-x-auto border border-gray-300 rounded bg-white" onPaste={handleGridPaste}>
            <table className="min-w-full text-sm text-black">
              <thead className="bg-white border-b border-gray-300">
                <tr>
                  <th className="p-2 text-left font-medium text-black">Email</th>
                  <th className="p-2 text-left font-medium text-black">Имя</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((row, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="p-1">
                      <input
                        value={row.email}
                        onChange={(e) => updateCell(i, "email", e.target.value)}
                        className="w-full px-2 py-1 border-0 bg-white text-black placeholder:text-black/40"
                        placeholder="email@firm.ru"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={row.name}
                        onChange={(e) => updateCell(i, "name", e.target.value)}
                        className="w-full px-2 py-1 border-0 bg-white text-black placeholder:text-black/40"
                        placeholder="Иван"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setGrid((g) => [...g, EMPTY_ROW()])}
            className="mt-2 text-sm text-black underline"
          >
            + строка
          </button>
        </div>

        <label className="block">
          <span className={labelClass}>Тема письма</span>
          <input
            value={templates.subject1}
            onChange={(e) => setTemplates({ ...templates, subject1: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Текст письма</span>
          <textarea
            value={templates.body1}
            onChange={(e) => setTemplates({ ...templates, body1: e.target.value })}
            rows={9}
            className={inputClass + " text-sm"}
          />
        </label>

        <button
          type="button"
          onClick={() => void createAndSend()}
          disabled={loading || smtpOk === false}
          className="px-5 py-2.5 bg-blue-700 text-white rounded font-medium disabled:opacity-50 !text-white"
        >
          {loading ? "Отправка…" : "Создать и отправить"}
        </button>
      </section>

      {campaigns.length > 0 && (
        <section className="border border-gray-300 rounded-lg p-4 bg-white space-y-3">
          <h2 className="font-semibold text-black">Прошлые рассылки</h2>
          <ul className="text-sm space-y-2 text-black">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  className="text-black underline font-medium"
                  onClick={() => void loadCampaign(c.id)}
                >
                  {c.name}
                </button>
                <span className="text-black">({c.recipients.length} адресов)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeId && recipients.length > 0 && (
        <section className="overflow-x-auto border border-gray-300 rounded-lg bg-white">
          <p className="p-3 text-sm text-black border-b border-gray-200">
            Статистика по рассылке — обновите страницу, чтобы увидеть новые действия на сайте.
          </p>
          <table className="min-w-full text-sm text-black">
            <thead className="bg-white border-b border-gray-300">
              <tr>
                <th className="p-2 text-left text-black">Email</th>
                <th className="p-2 text-left text-black">Имя</th>
                <th className="p-2 text-black">Письмо</th>
                <th className="p-2 text-black">Зашёл</th>
                <th className="p-2 text-black">Расчёт</th>
                <th className="p-2 text-black">Результат</th>
                <th className="p-2 text-black">Форма</th>
                <th className="p-2 text-black">Интерес</th>
                <th className="p-2 text-black">Телефон</th>
                <th className="p-2 text-black">Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.leadId} className="border-t border-gray-200">
                  <td className="p-2 text-black">{r.email}</td>
                  <td className="p-2 text-black">{r.name || "—"}</td>
                  <td className="p-2 text-center text-black">
                    {r.email1SentAt ? "✓" : r.email1Error ? `✗` : "—"}
                  </td>
                  <td className="p-2 text-center text-black">{flag(r.visited)}</td>
                  <td className="p-2 text-center text-black">{flag((r.calculateCount ?? 0) > 0)}</td>
                  <td className="p-2 text-center text-black">
                    {flag((r.resultViewCount ?? 0) > 0)}
                  </td>
                  <td className="p-2 text-center text-black">{flag(r.feedbackSubmitted)}</td>
                  <td className="p-2 text-center text-black">{flag(r.interested)}</td>
                  <td className="p-2 text-black">{r.phone ?? "—"}</td>
                  <td className="p-2">
                    <a href={r.link} className="text-black underline" target="_blank" rel="noreferrer">
                      открыть
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
