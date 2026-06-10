# Деплой NITEOS на сервер (VPS / REG.облако)

## REG.облако — быстрый старт (IP без домена)

1. В [cloud.reg.ru](https://cloud.reg.ru) → ваша VM → **SSH-ключи** → добавьте публичный ключ:
   ```
   cat deploy/niteos_deploy_key.pub
   ```
2. С Windows (из папки проекта):
   ```powershell
   .\deploy\remote-deploy.ps1 -Server 194.226.187.101 -User root
   ```
3. Откройте `http://194.226.187.101:3000` и `/admin/leads` (токен выведется в консоли).

На **1 GB RAM** скрипт сам создаёт swap 2G перед сборкой.

---

# Деплой NITEOS на сервер (VPS / Areкру)

Конфигуратор — **Next.js с API**. Для формы заявок, лидов и AI нужен **сервер с Node.js**, не GitHub Pages.

## Что прислать администратору / в Agent mode для настройки

Заполните и передайте **безопасным каналом** (не в открытый чат — только ключи и пароли):

### 1. Сервер (Areкру / VPS)

| Поле | Пример | Зачем |
|------|--------|--------|
| IP или hostname | `185.x.x.x` | SSH |
| SSH-пользователь | `root` или `ubuntu` | Вход |
| SSH-ключ **или** пароль | файл `.pem` / пароль | Доступ |
| ОС | Ubuntu 22.04 / 24.04 | Скрипты рассчитаны на Linux |
| RAM | от **2 GB** (лучше 4 GB) | Сборка + Sharp + AI |
| Диск | от **10 GB** | Код, `data/`, логи |

### 2. Домен (желательно)

| Поле | Пример |
|------|--------|
| Домен | `config.niteos.ru` |
| DNS уже на IP сервера? | да / нет |
| Нужен HTTPS (Let's Encrypt)? | да |

Без домена можно временно: `http://IP:3000` (только для теста).

### 3. Ключи AI (из вашего `.env.local`)

Скопируйте **значения** (не обязательно присылать файл целиком):

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://routerai.ru/api/v1
OPENAI_IMAGE_MODEL=google/gemini-2.5-flash-image
AI_IMAGE_PROVIDER=openai
AI_ANALYZE_FACADE=true
AI_VISION_MODEL=openai/gpt-4o-mini
ALLOW_LOCAL_FALLBACK=true
OPENAI_TIMEOUT_MS=180000
```

Проверка ключа локально: `npm run check:api`

### 4. Админка лидов

```env
LEADS_VIEW_TOKEN=длинный-случайный-секрет-32+символов
```

После деплоя: `https://ваш-домен/admin/leads`

### 5. Опционально

- Email для уведомлений о заявках (пока **не** подключён — на будущее)
- Базовый URL для ссылок рассылки: `https://config.niteos.ru`

---

## Быстрый деплой (Docker)

На сервере должны быть: **Docker** + **Docker Compose**.

```bash
# 1. Клонировать репозиторий
git clone https://github.com/GEBS-1/for_niteos.git
cd for_niteos

# 2. Создать .env.production (см. deploy/env.production.example)
cp deploy/env.production.example .env.production
nano .env.production   # вставить ключи

# 3. Запуск
docker compose up -d --build

# 4. Проверка
curl -s http://127.0.0.1:3000/api/ai-status
```

Данные заявок и лидов: том `niteos-data` → `/app/data` в контейнере.

---

## Деплой без Docker (PM2 + Nginx)

```bash
# На сервере (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2

git clone https://github.com/GEBS-1/for_niteos.git
cd for_niteos
cp deploy/env.production.example .env.production
nano .env.production

npm ci
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Nginx: скопировать `deploy/nginx.conf.example` → `/etc/nginx/sites-available/niteos`, подставить домен, `certbot --nginx`.

---

## После деплоя — чеклист

- [ ] Открывается главная, загрузка фото работает
- [ ] «Рассчитать» → визуализация (AI или локальный fallback)
- [ ] Форма внизу сохраняет заявку (`data/feedback-submissions.json` на сервере)
- [ ] `/admin/leads` + токен показывает таблицу
- [ ] Ссылка `?lead=test-001&email=test@example.com` → событие visit в воронке
- [ ] Генерация ссылок: `npm run leads:links -- data/list.csv --base https://ВАШ-ДОМЕН`

---

## Обновление версии

**Docker:**
```bash
cd for_niteos && git pull && docker compose up -d --build
```

**PM2:**
```bash
cd for_niteos && git pull && npm ci && npm run build && pm2 restart niteos
```

---

## Частые проблемы

| Симптом | Решение |
|---------|---------|
| 502 Bad Gateway | `pm2 logs niteos` или `docker compose logs -f` |
| AI не работает | Проверить `OPENAI_API_KEY`, баланс RouterAI |
| Заявки не сохраняются | Права на запись в `data/` |
| `/admin/leads` 401 | Задать `LEADS_VIEW_TOKEN` в `.env.production` |
| Сборка падает по памяти | VPS 1 GB — увеличить до 2 GB или `NODE_OPTIONS=--max-old-space-size=2048` |

---

## Автономная работа

Приложение после `docker compose up -d` или `pm2` **само поднимается** при перезагрузке сервера (restart policy / pm2 startup).

Резервное копирование (раз в день):
- `data/feedback-submissions.json`
- `data/leads-funnel.json`
