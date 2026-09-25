# Revolve — landing page

Одностраничный сайт портативного винилового проигрывателя Revolve.
Vite + vanilla JS, анимации на GSAP / ScrollTrigger.

## Запуск локально

```bash
npm install
npm run dev
```

Сайт откроется на http://localhost:5173/.

## Сборка

```bash
npm run build
```

Готовые файлы — в папке `dist/`.

## Публикация

Сайт публикуется на GitHub Pages автоматически при каждом push в ветку `main`
(workflow `.github/workflows/deploy.yml`). Адрес: `https://<логин>.github.io/<репозиторий>/`.
Путь подпапки подставляется при сборке через переменную `BASE_PATH`.

Подробности об устройстве и анимациях — `NOW.md` и `ANIMATIONS.md`.
