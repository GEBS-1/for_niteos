"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/basePath";
import type { LeadRecord } from "@/lib/leadTypes";

const TOKEN_KEY = "niteos_leads_admin_token";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

function boolLabel(v: boolean | undefined) {
  if (v === true) return "да";
  if (v === false) return "нет";
  return "—";
}

export default function AdminLeadsPage() {
  const [token, setToken] = useState("");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    const stored = localStorage.getItem(TOKEN_KEY);
    setToken(fromUrl ?? stored ?? "");
  }, []);

  const load = useCallback(async () => {
    if (!token.trim()) {
      setError("Введите токен доступа (LEADS_VIEW_TOKEN)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        withBasePath(`/api/leads?token=${encodeURIComponent(token.trim())}`)
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Ошибка загрузки");
      }
      setLeads(data.leads ?? []);
      localStorage.setItem(TOKEN_KEY, token.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-2">Воронка лидов</h1>
      <p className="text-sm text-gray-600 mb-6">
        Фаза 1: события visit → calculate → result_view → feedback. Экспорт:{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">npm run export:leads</code>
      </p>

      <div className="flex flex-wrap gap-2 mb-6 items-end">
        <label className="flex flex-col gap-1 text-sm">
          Токен
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="border rounded px-3 py-2 min-w-[240px]"
            placeholder="LEADS_VIEW_TOKEN"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2 rounded bg-slate-800 text-white text-sm disabled:opacity-50"
        >
          {loading ? "Загрузка…" : "Обновить"}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <p className="text-sm text-gray-600 mb-3">Всего: {leads.length}</p>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">leadId</th>
              <th className="px-3 py-2 font-medium">email</th>
              <th className="px-3 py-2 font-medium">визиты</th>
              <th className="px-3 py-2 font-medium">расчёты</th>
              <th className="px-3 py-2 font-medium">результат</th>
              <th className="px-3 py-2 font-medium">форма</th>
              <th className="px-3 py-2 font-medium">интерес</th>
              <th className="px-3 py-2 font-medium">телефон</th>
              <th className="px-3 py-2 font-medium">светильник</th>
              <th className="px-3 py-2 font-medium">последний визит</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.leadId} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{lead.leadId}</td>
                <td className="px-3 py-2">{lead.email ?? lead.contactEmail ?? "—"}</td>
                <td className="px-3 py-2">{lead.visitCount}</td>
                <td className="px-3 py-2">{lead.calculateCount}</td>
                <td className="px-3 py-2">{lead.resultViewCount}</td>
                <td className="px-3 py-2">{boolLabel(lead.feedbackSubmitted)}</td>
                <td className="px-3 py-2">{boolLabel(lead.interested)}</td>
                <td className="px-3 py-2">{lead.phone ?? "—"}</td>
                <td className="px-3 py-2">{lead.lastFixtureName ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(lead.lastSeen)}</td>
              </tr>
            ))}
            {!leads.length && !loading && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  Нет данных. Загрузите таблицу или откройте ссылку с ?lead=…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
