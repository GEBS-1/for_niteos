export type ReminderKind = "no_visit" | "no_phone";

export interface CampaignRecipient {
  leadId: string;
  email: string;
  name: string;
  link: string;
  email1SentAt?: string;
  email1Error?: string;
  email2SentAt?: string;
  email2Kind?: ReminderKind;
  email2Error?: string;
}

export interface CampaignTemplates {
  subject1: string;
  body1: string;
  subject2NoVisit: string;
  body2NoVisit: string;
  subject2NoPhone: string;
  body2NoPhone: string;
}

export interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  baseUrl: string;
  templates: CampaignTemplates;
  recipients: CampaignRecipient[];
}

export interface CampaignsStore {
  campaigns: Record<string, Campaign>;
}

export const DEFAULT_CAMPAIGN_TEMPLATES: CampaignTemplates = {
  subject1: "Коммерческое предложение — архитектурная подсветка NITEOS",
  body1: `Здравствуйте, {имя}!

Предлагаем попробовать конфигуратор архитектурной подсветки NITEOS: загрузите фото здания и получите визуализацию с расчётом.

Перейдите по ссылке: {ссылка}

С уважением,
NITEOS`,
  subject2NoVisit: "Напоминание — конфигуратор подсветки NITEOS",
  body2NoVisit: `Здравствуйте, {имя}!

Напоминаем о возможности бесплатно рассчитать подсветку фасада по вашему фото.

Перейдите по ссылке: {ссылка}

С уважением,
NITEOS`,
  subject2NoPhone: "Вы смотрели конфигуратор NITEOS — нужна помощь?",
  body2NoPhone: `Здравствуйте, {имя}!

Вы уже заходили в наш конфигуратор подсветки. Если нужен расчёт или консультация — оставьте телефон в форме на сайте или ответьте на это письмо.

Ваша ссылка: {ссылка}

С уважением,
NITEOS`,
};
