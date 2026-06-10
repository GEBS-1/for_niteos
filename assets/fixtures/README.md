# Исходники PNG светильников NITEOS

Здесь хранятся **исходники** для каталога. На сайт попадают файлы из `public/fixtures/{id}/`.

## Структура

```text
assets/fixtures/
  magistral-v3-ai-70/
    source/     ← PROM-рендеры, черновики (не обязательно на сайте)
    front.png   ← скопировать в public при обновлении
    side.png
    top.png
  nt-park-step/
    source/
    front.png
    side.png
```

## Синхронизация на сайт

```bash
npm run sync:fixtures
```

Копирует `front.png`, `side.png`, `top.png` из `assets/fixtures/{id}/` в `public/fixtures/{id}/`.

## Ракурсы

| Товар | front | side | top |
|-------|-------|------|-----|
| **magistral-v3-ai-70** | Карточка товара | Наложение на фасад (линейный) | Опционально |
| **nt-park-step** | Опора, вид спереди | Крупный план / сбоку | — |

## Требования к PNG

- Прозрачный фон (alpha)
- **side** для МАГИСТРАЛЬ — горизонтальный вид на стену (не вертикальный PROM целиком)
- Имена файлов строго: `front.png`, `side.png`, `top.png`

## Каталог

Пути в `data/catalog.json`:

```json
"image": "/fixtures/magistral-v3-ai-70/front.png",
"imageSide": "/fixtures/magistral-v3-ai-70/side.png"
```

`id` в JSON = имя папки.
