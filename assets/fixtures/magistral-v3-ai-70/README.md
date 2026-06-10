# МАГИСТРАЛЬ v 3.0 AI 70

Каталог: `magistral-v3-ai-70` · линейный фасадный светильник (525 мм).

| Файл | Источник | Назначение |
|------|----------|------------|
| `front.png` | PROM, вид ¾ (корпус + кольца) | Карточка товара в UI |
| `side.png` | PROM, светодиодная грань → **горизонтально** | Наложение на фасад |
| `top.png` | копия front | Опционально |
| `source/prom-front-original.png` | исходник front | Архив |
| `source/prom-side-original.png` | исходник side | Архив |

Размеры в каталоге: 525 × 138 × 95 мм.

### Обновить PNG из новых PROM

```bash
node scripts/import-magistral-assets.mjs "путь/к/front-prom.png" "путь/к/side-prom.png"
npm run sync:fixtures
```

После замены — пересчитайте проект в dev (режим **Демо** лучше видит корпуса).
