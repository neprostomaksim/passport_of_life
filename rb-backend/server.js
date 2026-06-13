/* ═══════════════════════════════════════════════════════════════
   Паспорт жизни — Бэкенд РБ (дирижёр)
   Этап 1: каркас — отдаёт фронтенд и проверочный /health
   ═══════════════════════════════════════════════════════════════ */

const path    = require('path');
const express = require('express');
const cors    = require('cors');

// Загружаем секреты/настройки из .env
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Мидлвары ──────────────────────────────────────────────────
app.use(cors());                           // разрешаем запросы с любого домена (для разработки)
app.use(express.json());                   // парсим JSON в теле запроса

// ── Отдача фронтенда ──────────────────────────────────────────
// Все статические файлы лежат в ../frontend относительно этого файла
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// ── Проверочный эндпоинт ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Для SPA: любой неизвестный GET → index.html ───────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ── Запуск ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Бэкенд РБ запущен: http://localhost:${PORT}`);
  console.log(`    Лендинг:  http://localhost:${PORT}/`);
  console.log(`    Health:   http://localhost:${PORT}/health\n`);
});
