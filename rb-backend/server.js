/* ═══════════════════════════════════════════════════════════════
   Паспорт жизни — Бэкенд РБ (дирижёр)
   Этап 1: каркас — отдаёт фронтенд и проверочный /health
   ═══════════════════════════════════════════════════════════════ */

const path    = require('path');
const fs      = require('fs');
const express = require('express');
const cors    = require('cors');


const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { generateStubPassport } = require('./stub');
const { generatePDF, getCustomizedHTML } = require('./pdf/generate');

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

// ── API-эндпоинты для заказов ─────────────────────────────────

/**
 * Создать заказ: принимает данные формы, возвращает orderId и запускает генерацию в фоне
 */
app.post('/api/orders', (req, res) => {
  try {
    const formData = req.body;
    if (!formData || !formData.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const orderId = uuidv4();
    db.createOrder(orderId, formData);

    // Фоновая обработка заказа (имитация ИИ + генерация PDF)
    (async () => {
      try {
        // Задержка 5 секунд, чтобы пользователь успел увидеть анимацию прогресса
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 1. Получаем текстовые данные из заглушки
        const stub = generateStubPassport(orderId, formData);

        // 2. Рендерим PDF
        const pdfPath = await generatePDF(orderId, stub.passport, formData);

        // 3. Сохраняем в бд
        db.markSuccess(orderId, stub.passport, pdfPath);
        console.log(`[Success] Order ${orderId} generated successfully.`);
      } catch (err) {
        console.error(`[Error] Failed to process order ${orderId}:`, err);
        db.markFail(orderId, err.message || 'Unknown processing error');
      }
    })();

    // Возвращаем ID заказа сразу
    res.json({ orderId });
  } catch (error) {
    console.error('Failed to create order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Получить статус и данные заказа
 */
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      id: order.id,
      status: order.status,
      error: order.error,
      passport: order.passport_json ? JSON.parse(order.passport_json) : null,
    });
  } catch (error) {
    console.error('Failed to get order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Скачать сгенерированный PDF
 */
app.get('/api/orders/:id/pdf', (req, res) => {
  try {
    const order = db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'success' || !order.pdf_path) {
      return res.status(400).json({ error: 'PDF is not ready or generation failed' });
    }

    // Проверяем существование файла на диске
    if (!fs.existsSync(order.pdf_path)) {
      return res.status(404).json({ error: 'PDF file not found on server' });
    }

    res.download(order.pdf_path, `passport_${order.id}.pdf`);
  } catch (error) {
    console.error('Failed to download PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Получить превью-страницу натальной карты (HTML)
 */
app.get('/api/orders/:id/preview', (req, res) => {
  try {
    const order = db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const formData = JSON.parse(order.form_data);
    const html = getCustomizedHTML(formData);

    res.send(html);
  } catch (error) {
    console.error('Failed to get preview:', error);
    res.status(500).send('Internal server error');
  }
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
