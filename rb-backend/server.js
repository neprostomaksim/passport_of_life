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
 * Создать заказ: принимает данные формы, создает запись в БД,
 * инициализирует платежную ссылку BePaid и возвращает её клиенту
 */
app.post('/api/orders', async (req, res) => {
  try {
    const formData = req.body;
    if (!formData || !formData.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const orderId = uuidv4();
    db.createOrder(orderId, formData);

    const shopId = process.env.BEPAID_SHOP_ID;
    const shopKey = process.env.BEPAID_SECRET_KEY;
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

    let paymentUrl = '';

    // Если используются тестовые заглушки в .env — перенаправляем на локальный имитатор оплаты
    if (!shopId || shopId === 'test_shop_id') {
      paymentUrl = `${publicUrl}/api/payments/mock-checkout-page?order_id=${orderId}`;
    } else {
      // Инициализируем платеж через реальный API BePaid
      const auth = Buffer.from(`${shopId}:${shopKey}`).toString('base64');
      const apiResponse = await fetch('https://checkout.bepaid.by/ctp/api/checkouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({
          "checkout": {
            "transaction_type": "payment",
            "order": {
              "amount": parseInt(process.env.BEPAID_AMOUNT || 2900),
              "currency": "BYN",
              "description": "Оплата заказа «Паспорт Жизни»",
              "tracking_id": orderId
            },
            "settings": {
              "success_url": `${publicUrl}/?payment_status=success&order_id=${orderId}`,
              "decline_url": `${publicUrl}/?payment_status=decline&order_id=${orderId}`,
              "fail_url": `${publicUrl}/?payment_status=fail&order_id=${orderId}`,
              "notification_url": `${publicUrl}/api/payments/webhook`,
              "language": "ru"
            }
          }
        })
      });

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        throw new Error(`BePaid Checkout API error: ${errText}`);
      }

      const checkoutData = await apiResponse.json();
      paymentUrl = checkoutData.checkout.redirect_url;
    }

    res.json({ orderId, paymentUrl });
  } catch (error) {
    console.error('Failed to create order and initialize payment:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Имитатор платежного шлюза BePaid для локального тестирования
 */
app.get('/api/payments/mock-checkout-page', (req, res) => {
  const orderId = req.query.order_id;
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Имитатор оплаты BePaid</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: #0C0820;
          color: #EDEAF5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .card {
          background: #1A1338;
          border: 1px solid rgba(227, 178, 60, 0.3);
          border-radius: 20px;
          padding: 40px;
          max-width: 450px;
          width: 100%;
          text-align: center;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
        h2 {
          font-family: serif;
          color: #F6E2A6;
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 28px;
        }
        .order-info {
          font-size: 14px;
          color: #A89FC4;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .price {
          font-size: 32px;
          font-weight: 600;
          color: #E3B23C;
          margin: 20px 0;
        }
        .btn {
          display: block;
          width: 100%;
          padding: 14px;
          border-radius: 9999px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
          border: none;
          transition: all 0.2s;
        }
        .btn-pay {
          background: linear-gradient(135deg, #F6E2A6, #C8922B);
          color: #2A1C05;
        }
        .btn-pay:hover {
          opacity: 0.9;
          transform: translateY(-2px);
        }
        .btn-cancel {
          background: rgba(239, 68, 68, 0.1);
          color: #F87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .btn-cancel:hover {
          background: rgba(239, 68, 68, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Тестовый шлюз BePaid</h2>
        <div class="order-info">
          <div>Оплата заказа <strong>«Паспорт Жизни»</strong></div>
          <div style="font-size: 11px; margin-top: 4px; opacity: 0.6;">ID заказа: ${orderId}</div>
          <div class="price">29.00 BYN</div>
        </div>
        <button onclick="pay(true)" class="btn btn-pay">Оплатить успешно (Тест)</button>
        <button onclick="pay(false)" class="btn btn-cancel">Отклонить платеж</button>
      </div>

      <script>
        async function pay(success) {
          if (success) {
            try {
              const res = await fetch('/api/payments/mock-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: '${orderId}', success: true })
              });
              if (!res.ok) throw new Error('Ошибка вебхука');
              window.location.href = '${publicUrl}/?payment_status=success&order_id=${orderId}';
            } catch (err) {
              alert('Ошибка симуляции платежа: ' + err.message);
            }
          } else {
            try {
              await fetch('/api/payments/mock-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: '${orderId}', success: false })
              });
            } catch (e) {}
            window.location.href = '${publicUrl}/?payment_status=decline&order_id=${orderId}';
          }
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

/**
 * Вспомогательная фоновая функция генерации натальной карты после оплаты
 */
function runBackgroundProcessing(orderId, formData) {
  (async () => {
    try {
      // Имитация 5 секунд задержки расчетов
      await new Promise(resolve => setTimeout(resolve, 5000));

      const stub = generateStubPassport(orderId, formData);
      const pdfPath = await generatePDF(orderId, stub.passport, formData);

      db.markSuccess(orderId, stub.passport, pdfPath);
      console.log(`[Success] Order ${orderId} generated successfully after payment.`);
    } catch (err) {
      console.error(`[Error] Failed to process paid order ${orderId}:`, err);
      db.markFail(orderId, err.message || 'Processing failed');
    }
  })();
}

/**
 * Отладочный эндпоинт имитации оплаты (mock-webhook)
 */
app.post('/api/payments/mock-webhook', (req, res) => {
  try {
    const { orderId, success } = req.body;
    const order = db.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (success) {
      db.markPaid(orderId);
      const formData = JSON.parse(order.form_data);
      runBackgroundProcessing(orderId, formData);
      console.log(`[Webhook Mock] Order ${orderId} marked as paid successfully.`);
    } else {
      db.markPaymentFailed(orderId, 'Тестовый платеж отклонен пользователем');
      console.log(`[Webhook Mock] Order ${orderId} marked as payment failed.`);
    }
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Mock webhook failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Реальный вебхук BePaid (notification_url)
 */
app.post('/api/payments/webhook', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.transaction) {
      return res.status(400).send('Invalid webhook payload');
    }

    const { status, tracking_id, message } = payload.transaction;
    const order = db.getOrder(tracking_id);
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Проверка Basic Auth (опционально для локального уровня, критично для боевого)
    const shopId = process.env.BEPAID_SHOP_ID;
    const shopKey = process.env.BEPAID_SECRET_KEY;
    if (shopId && shopId !== 'test_shop_id') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).send('Unauthorized webhook');
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      if (decoded !== `${shopId}:${shopKey}`) {
        return res.status(401).send('Invalid webhook credentials');
      }
    }

    if (status === 'successful') {
      db.markPaid(tracking_id);
      const formData = JSON.parse(order.form_data);
      runBackgroundProcessing(tracking_id, formData);
      console.log(`[BePaid Webhook] Order ${tracking_id} successfully paid.`);
    } else {
      db.markPaymentFailed(tracking_id, message || 'Payment declined');
      console.log(`[BePaid Webhook] Order ${tracking_id} payment failed: ${message}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('BePaid Webhook handler error:', error);
    res.status(500).send('Internal Server Error');
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

    let name = '';
    try {
      const fd = JSON.parse(order.form_data);
      name = fd.name;
    } catch (e) {}

    res.json({
      id: order.id,
      status: order.status,
      error: order.error,
      passport: order.passport_json ? JSON.parse(order.passport_json) : null,
      name: name,
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
