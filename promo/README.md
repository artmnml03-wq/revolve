# Ролик для Instagram (Reels) — Revolve

Вертикальное видео 1080×1920, 30 к/с, 34 с: MacBook с десктопной версией сайта (курсор с шлейфом
пластинок в hero, счётчики в «Crafted to last»), потом iPhone с мобильной (открытие меню).
В кадре только мокапы и логотип сверху — без подписей и адреса сайта.

```bash
cd promo
npm install          # один раз (puppeteer-core, Chrome берётся системный)
cd .. && BASE_PATH=/site/ npx vite build --outDir promo/.site --emptyOutDir && cd promo
node render.mjs      # кадры → out/revolve-reel.mp4 + out/cover.jpg
node render.mjs --frames 2.2,13,29,33   # отдельные моменты в preview/ (переходы в них не успевают — смотри полный рендер)
```

Тайминги — вверху скрипта в `scene.html` (`MAC_WP`, `PHONE_WP`, `MENU`, `POINTER`, `COVER`).
