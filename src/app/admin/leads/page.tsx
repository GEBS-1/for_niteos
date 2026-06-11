"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/basePath";
import type { LeadRecord } from "@/lib/leadTypes";

const TOKEN_KEY = "niteos_admin_token";
const DEV_TOKEN = "local-dev-token";

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
  const [token, setToken] = useState(DEV_TOKEN);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    const stored = localStorage.getItem(TOKEN_KEY);
    setToken(fromUrl ?? stored ?? DEV_TOKEN);
  }, []);

  const load = useCallback(async () => {
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

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-black bg-white">
      <h1 className="text-2xl font-bold mb-2 text-black">Статистика по ссылкам</h1>
      <p className="text-sm text-black mb-6">
        Кто зашёл по ссылке, сделал расчёт, оставил заявку.{" "}
        <a href={withBasePath("/admin/campaigns")} className="text-black underline">
          Рассылка
        </a>
      </p>

      <div className="flex flex-wrap gap-2 mb-6 items-end">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2 rounded border border-black bg-white text-black text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? "Загрузка…" : "Обновить"}
        </button>
      </div>

      {error && (
        <p className="text-red-700 text-sm mb-4 font-medium" role="alert">
          {error}
        </p>
      )}

      <p className="text-sm text-black mb-3">Всего: {leads.length}</p>

      <div className="overflow-x-auto border border-gray-300 rounded-lg bg-white">
        <table className="min-w-full text-sm text-black">
          <thead className="bg-white border-b border-gray-300 text-left text-black">
            <tr>
              <th className="px-3 py-2 font-medium text-black">leadId</th>
              <th className="px-3 py-2 font-medium text-black">email</th>
              <th className="px-3 py-2 font-medium text-black">визиты</th>
              <th className="px-3 py-2 font-medium text-black">расчёты</th>
              <th className="px-3 py-2 font-medium text-black">результат</th>
              <th className="px-3 py-2 font-medium text-black">форма</th>
              <th className="px-3 py-2 font-medium text-black">интерес</th>
              <th className="px-3 py-2 font-medium text-black">телефон</th>
              <th className="px-3 py-2 font-medium text-black">светильник</th>
              <th className="px-3 py-2 font-medium text-black">последний визит</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.leadId} className="border-t border-gray-200">
                <td className="px-3 py-2 font-mono text-xs text-black">{lead.leadId}</td>
                <td className="px-3 py-2 text-black">{lead.email ?? lead.contactEmail ?? "—"}</td>
                <td className="px-3 py-2 text-black">{lead.visitCount}</td>
                <td className="px-3 py-2 text-black">{lead.calculateCount}</td>
                <td className="px-3 py-2 text-black">{lead.resultViewCount}</td>
                <td className="px-3 py-2 text-black">{boolLabel(lead.feedbackSubmitted)}</td>
                <td className="px-3 py-2 text-black">{boolLabel(lead.interested)}</td>
                <td className="px-3 py-2 text-black">{lead.phone ?? "—"}</td>
                <td className="px-3 py-2 text-black">{lead.lastFixtureName ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-black">{formatDate(lead.lastSeen)}</td>
              </tr>
            ))}
            {!leads.length && !loading && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-black">
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
