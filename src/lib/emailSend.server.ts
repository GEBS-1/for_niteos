import "server-only";

import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    user,
    pass,
    from: process.env.SMTP_FROM?.trim() || user,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function friendlySmtpError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("timeout") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound")
  ) {
    return (
      "Нет связи с почтовым сервером (Connection timeout). " +
      "VPS часто блокирует исходящий SMTP (порт 587). " +
      "Напишите в поддержку хостинга или шлите рассылку с локального npm run dev."
    );
  }
  if (lower.includes("invalid login") || lower.includes("authentication")) {
    return "Ошибка входа Gmail — проверьте SMTP_PASS (пароль приложения, 16 символов).";
  }
  return raw;
}

function createTransport(cfg: SmtpConfig, port: number) {
  return nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
    family: 4,
  } as nodemailer.TransportOptions);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error("SMTP не настроен: добавьте SMTP_USER и SMTP_PASS");
  }

  const ports = cfg.port === 465 ? [465] : [cfg.port, 465];
  let lastErr: unknown;

  for (const port of ports) {
    try {
      const transport = createTransport(cfg, port);
      await transport.sendMail({
        from: cfg.from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
      });
      return;
    } catch (e) {
      lastErr = e;
      console.error(`[smtp] send failed port ${port} → ${opts.to}:`, e);
    }
  }

  throw new Error(friendlySmtpError(lastErr));
}

/** Проверка: может ли сервер достучаться до SMTP */
export async function verifySmtpConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false, error: "SMTP не настроен" };
  try {
    const transport = createTransport(cfg, cfg.port);
    await transport.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlySmtpError(e) };
  }
}
