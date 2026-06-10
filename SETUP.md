# Запуск за 2 минуты

## 1. Ключ RouterAI (или GateLLM)

1. Откройте файл **`.env.local`** в корне проекта.
2. Вставьте ключ в строку **`OPENAI_API_KEY=`** (после `=`).
3. Для [RouterAI](https://routerai.ru): `OPENAI_BASE_URL=https://routerai.ru/api/v1`
4. Альтернатива GateLLM: `OPENAI_BASE_URL=https://gatellm.ru/v1`
5. Провайдер: `AI_IMAGE_PROVIDER=openai`

## 2. Запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:3000 — вверху блок **«Провайдер: OpenAI»** → **Проверить снова** (должно быть ✓).

## 3. Проверка в приложении

1. Загрузите фото здания (или «Мэрия Казани»).
2. Укажите высоту (например 18 м).
3. Выберите **МАГИСТРАЛЬ** → **Рассчитать**.

Ожидается: ваше фото с подсветкой, бейдж **OpenAI**.

## Если ошибка

| Сообщение | Действие |
|-----------|----------|
| 401 | Неверный ключ в `OPENAI_API_KEY` |
| 402 | Пополните баланс на routerai.ru или gatellm.ru |
| 400 model | В `.env.local` задайте `OPENAI_IMAGE_MODEL` из списка `GET /v1/models` |
| 404 images.edit | Нормально для RouterAI/GateLLM — используется `chat/completions` + ваше фото (1–2 мин) |

Проверка ключа:

```bash
npm run check:api
```

## Ошибки `Cannot find module './331.js'` или `SegmentViewNode`

Это **битый кэш** папки `.next` (часто после `npm run build` при работающем `npm run dev`).

```bash
# Остановите dev (Ctrl+C), затем:
npm run dev:clean
```

Или вручную: удалите папку `.next` и снова `npm run dev`.

**Не запускайте `npm run build`**, пока открыт `npm run dev`.

## GitHub Pages

Сайт: [gebs-1.github.io/for_niteos](https://gebs-1.github.io/for_niteos/)

GitHub Pages отдаёт **статику**, не Node.js. По умолчанию GitHub показывает **README** — не приложение.

В репозитории настроен workflow **Deploy to GitHub Pages**: собирается интерфейс NITEOS (форма, фото, расчёт, демо-подсветка в браузере).

В настройках репозитория: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Полный AI (GigaChat / GateLLM) — только локально: `npm run dev`.

Локальная проверка сборки под Pages:

```bash
npm run build:pages
```

## GigaChat (Сбер)

1. Создайте **`.env.gigachat`** (шаблон — `.env.gigachat.example` или комментарии в репозитории).
2. Укажите `GIGACHAT_CREDENTIALS`, `GIGACHAT_CLIENT_ID`, `AI_IMAGE_PROVIDER=gigachat`.
3. Модель **`GigaChat-2-Lite`** в файле автоматически маппится на **`GigaChat-2-Pro`** (в API нет Lite; `GigaChat-2` не принимает фото).
4. На Windows часто нужно: `GIGACHAT_VERIFY_SSL=false`.
5. Запуск с чистым кэшем: `npm run dev:gigachat`.

Проверки:

```bash
npm run check:gigachat          # OAuth + список моделей
npm run check:gigachat:visual   # upload + chat + JPG (~30 с)
npm run check:web:visual        # POST /api/visualize (PORT=3001 если 3000 занят)
```

В UI: провайдер **GigaChat**, бейдж **GigaChat** после расчёта. При сбое генерации — подсветка на фото (`ALLOW_LOCAL_FALLBACK=true`).

## Yandex (опционально)

Раскомментируйте `YANDEX_*` в `.env.local` и поставьте `AI_IMAGE_PROVIDER=yandex`.  
Для **вашего фото** лучше оставить `openai` + GateLLM.
