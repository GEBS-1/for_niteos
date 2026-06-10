# PNG для сайта (генерируется из assets)

Рабочие исходники: **`assets/fixtures/{id}/`**

Обновление:

```bash
npm run sync:fixtures
```

Структура:

```text
public/fixtures/
  magistral-v3-ai-70/   front.png  side.png  top.png
  nt-park-step/          front.png  side.png
```

Пути в `data/catalog.json` → `/fixtures/{id}/front.png`
