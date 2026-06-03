# NITEOS — Конфигуратор архитектурной подсветки (MVP)

Веб-сервис для расчёта фасадной подсветки зданий по фотографии. Пользователь загружает фото, указывает контрольный размер, выбирает тип подсветки — сервис подбирает светильники из каталога NITEOS, считает количество, мощность, смету и показывает mock-визуализацию «до/после».

## Стек

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **API:** Next.js Route Handlers (`/api/analyze`)
- **Каталог:** `data/catalog.json` (готово к замене на Supabase)
- **AI:** mock (`src/lib/mockAi.ts`), интерфейс `AiAnalysisProvider` для подключения реального API

## Запуск локально

1. Скопируйте `.env.example` → `.env.local` (или отредактируйте готовый `.env.local`).
2. Вставьте ключ GateLLM в **`OPENAI_API_KEY`** — подробно в [SETUP.md](./SETUP.md).

```bash
npm install
npm run dev
```

Проверка ключа: `npm run check:api`

Откройте [http://localhost:3000](http://localhost:3000).

## Сценарий демо

1. Загрузите фото фасада (файл, drag & drop или **Ctrl+V** из буфера).
2. Укажите хотя бы один размер в метрах: **ширина**, **длина** или **высота**.
3. Нажмите **«Рассчитать проект»**.
4. В блоке **«Результат и расчёт»** выберите тип подсветки и вариант применения светильника (промпт).
5. Просмотрите визуализацию «До / После» (яркое наложение светильников NITEOS).
6. Ознакомьтесь со спецификацией и оставьте заявку (демо).

## Логика расчёта

- `pixels_per_meter = referencePixels / referenceMeters`
- Размеры фасада из размеров изображения и масштаба
- `quantity = ceil(zoneLength / mountingStepMeters)`
- `totalPower = quantity × power`
- `equipmentPrice = quantity × price`
- `workPrice = equipmentPrice × 0.3`
- `totalPrice = equipmentPrice + workPrice`

## Подключение реального AI

1. Реализуйте `AiAnalysisProvider` в `src/lib/` (например, `openAiProvider.ts`).
2. В `src/app/api/analyze/route.ts` вызывайте провайдер для детекции окон, углов и зон.
3. Для визуализации используйте inpainting **только** с маской зон монтажа; не добавляйте объекты вне каталога.
4. Светильники — строго из `data/catalog.json`.

## Структура проекта

```
data/catalog.json          # Каталог NITEOS
src/app/api/analyze/       # API расчёта
src/lib/calculation.ts     # Масштаб, зоны, количество
src/lib/mockAi.ts          # Mock визуализация (canvas overlay)
src/components/            # UI
```

## Сборка

```bash
npm run build
npm start
```
