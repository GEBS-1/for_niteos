"use client";

import { useState } from "react";
import { withBasePath } from "@/lib/basePath";
import { getStoredLeadId } from "@/lib/leadTracking.client";

export interface FeedbackContext {
  fixtureName?: string;
  fixtureId?: string;
  quantity?: number;
  totalPrice?: number;
}

interface ResultsFeedbackFormProps {
  context?: FeedbackContext;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

export function ResultsFeedbackForm({ context }: ResultsFeedbackFormProps) {
  const [interested, setInterested] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (interested === null) {
      setError("Выберите, интересно ли вам решение");
      return;
    }

    if (interested) {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      if (!trimmedName) {
        setError("Укажите имя");
        return;
      }
      if (!trimmedPhone) {
        setError("Укажите номер телефона");
        return;
      }
      if (!isValidPhone(trimmedPhone)) {
        setError("Введите корректный номер телефона (не менее 10 цифр)");
        return;
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Некорректный адрес email");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: getStoredLeadId() ?? undefined,
          interested,
          name: interested ? name.trim() : undefined,
          phone: interested ? phone.trim() : undefined,
          email: interested ? email.trim() || undefined : undefined,
          context,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="glass rounded-2xl px-6 py-8 text-center space-y-2">
        <p className="text-lg font-semibold text-niteos-electric">Спасибо!</p>
        <p className="text-sm text-niteos-muted max-w-md mx-auto">
          {interested
            ? "Мы передали заявку специалисту NITEOS — свяжемся с вами в ближайшее время."
            : "Ваш отзыв учтён. Если передумаете — всегда можно рассчитать проект заново."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl px-6 py-5 space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Обратная связь</h3>
        <p className="text-sm text-niteos-muted">
          Интересно ли вам такое решение? Оставьте контакты — специалист NITEOS свяжется с вами.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-niteos-muted mb-2">
            Вам интересно это решение?
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setInterested(true)}
              className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                interested === true
                  ? "border-niteos-electric bg-niteos-electric/15 text-niteos-electric"
                  : "border-niteos-border text-niteos-muted hover:border-niteos-electric/50"
              }`}
            >
              Да, интересно
            </button>
            <button
              type="button"
              onClick={() => setInterested(false)}
              className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                interested === false
                  ? "border-niteos-border bg-niteos-surface text-white"
                  : "border-niteos-border text-niteos-muted hover:border-niteos-border/80"
              }`}
            >
              Пока нет
            </button>
          </div>
        </fieldset>

        {interested === true && (
          <div className="space-y-3 pt-1 border-t border-niteos-border/40">
            <div className="space-y-1.5">
              <label htmlFor="feedback-name" className="text-sm text-niteos-muted">
                Имя <span className="text-niteos-electric">*</span>
              </label>
              <input
                id="feedback-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-niteos-electric/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="feedback-phone" className="text-sm text-niteos-muted">
                Телефон <span className="text-niteos-electric">*</span>
              </label>
              <input
                id="feedback-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 000-00-00"
                className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-niteos-electric/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="feedback-email" className="text-sm text-niteos-muted">
                Email <span className="text-niteos-muted/70">(необязательно)</span>
              </label>
              <input
                id="feedback-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.ru"
                className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-niteos-electric/50"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-orange-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || interested === null}
          className="w-full py-3 rounded-xl electric-gradient text-niteos-bg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Отправка…" : interested === false ? "Отправить отзыв" : "Отправить заявку"}
        </button>

        <p className="text-xs text-center text-niteos-muted">
          Нажимая кнопку, вы соглашаетесь на обработку контактных данных для связи по проекту.
        </p>
      </form>
    </div>
  );
}
