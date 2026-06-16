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
const { generatePDF, getCustomizedHTML } = require('./pdf/generate');
const { calculateBaZi, formatChart, getAnnualPillars, ganzhiLabel } = require('./bazi-calc');

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

const ANNUAL_SCORE_PROMPT = `Ты — профессиональный аналитик карты Ба-цзы.

Перед тобой натальная карта и список 流年 (годовых столпов) с возрастом для каждого года.

Твоя задача: оценить каждый год по 8 сферам жизни по шкале 1–10.
1–3 = сложный / ресурс слабый   4–6 = умеренный / переходный   7–9 = благоприятный   10 = пиковый

Применяй правила Ба-цзы:
• Если 流年 стебель поддерживает или питает Господина дня → повышай оценки карьеры, финансов, роста.
• Если 流年 стебель контролирует или истощает Господина дня → понижай оценки здоровья, отношений.
• Учитывай взаимодействие ветвей 流年 с ветвями натальных столпов (合 гармония, 冲 конфликт, 刑 наказание).
• Активный десятилетний такт удачи задаёт базовый фон для всех лет этого десятилетия.

7 сфер (колесо баланса):
• love     — любовь и отношения (романтика, партнёрство, близость)
• money    — деньги и материальное (доходы, накопления, финансы)
• career   — карьера и призвание (профессиональное развитие, реализация)
• family   — семья и род (близкие, дети, родители)
• health   — здоровье и тело (физическое и психологическое состояние)
• growth   — саморазвитие и духовный путь (обучение, внутренний рост, смысл)
• creative — творчество и самовыражение (хобби, проекты, радость, самопроявление)

Верни ТОЛЬКО валидный JSON — без пояснений, без markdown-блоков:
{"annual":[{"year":1999,"age":14,"love":6,"money":5,"career":7,"family":4,"health":6,"growth":7,"creative":5},...]}
`;

function buildAnnualScoringPrompt(chart) {
  const { dayMaster, elementBalance, luckyPillars, year, month, day, hour, birthdate } = chart;
  const birthYear  = Number(birthdate.split('-')[0]);
  const currentYear = new Date().getFullYear();
  const endYear    = currentYear + 3;

  const elemOrder = ['Дерево','Огонь','Земля','Металл','Вода'];
  const elemLine  = elemOrder.map(e => `${e} ${elementBalance[e] ?? 0}%`).join(', ');

  const luckyLines = luckyPillars.pillars
    .map(p => `  ${p.startAge}–${p.endAge} (${p.startYear}–${p.startYear + 9}): ${ganzhiLabel(p)}`)
    .join('\n');

  const annualList = getAnnualPillars(birthYear, endYear)
    .map(p => `  ${p.year} | возраст ${p.age} | ${p.ganzhi} (${p.stemName} / ${p.branchName})`)
    .join('\n');

  return ANNUAL_SCORE_PROMPT
    + `НАТАЛЬНАЯ КАРТА:\n`
    + `Господин дня: ${dayMaster.stem} — ${dayMaster.name} (${dayMaster.element})\n`
    + `Четыре столпа: год ${ganzhiLabel(year)}, месяц ${ganzhiLabel(month)}, день ${ganzhiLabel(day)}, час ${ganzhiLabel(hour)}\n`
    + `Баланс элементов: ${elemLine}\n`
    + `Десятилетние такты удачи:\n${luckyLines}\n`
    + `\nГОДОВЫЕ СТОЛПЫ (流年) — от ${birthYear + 14} до ${endYear}:\n`
    + annualList;
}

function buildInterpretPrompt(chartText, name, gender, birthYear) {
  const template = fs.readFileSync(
    path.join(__dirname, 'prompt', 'basci-interpret-v2.txt'),
    'utf-8'
  );
  const genderLabel  = gender === 'female' ? 'Женский' : 'Мужской';
  const currentYear  = new Date().getFullYear();
  const currentAge   = currentYear - Number(birthYear);
  const cycleStart   = Math.floor(currentAge / 7) * 7;
  const nextCycleEnd = cycleStart + 14;

  return template
    .replace('[ПОЛ]', genderLabel)
    .replace('[КАРТА]', chartText)
    + `\n\nИмя человека: ${name}`
    + `\nТекущая дата: ${new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}`
    + `\nТекущий год: ${currentYear}`
    + `\nТекущий возраст: ${currentAge} лет`
    + `\nТекущий 7-летний цикл: ${cycleStart}–${cycleStart + 7} (is_current: true)`
    + `\nПоследний цикл для отображения: ${cycleStart + 7}–${nextCycleEnd} (один цикл после текущего — больше не надо)`;
}

async function callOpenAI(prompt, model = 'gpt-4o', retries = 3) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const O_SERIES_MODELS = new Set(['o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini']);
  const isOSeries = O_SERIES_MODELS.has(model);
  const params = {
    model,
    messages: [{ role: 'user', content: prompt }],
    ...(isOSeries ? { max_completion_tokens: 8192 } : { max_tokens: 8192 })
  };
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await client.chat.completions.create(params);
      return completion.choices[0]?.message?.content || '';
    } catch (err) {
      console.warn(`[OpenAI] Attempt ${attempt} failed: ${err.message || err}`);
      if (attempt === retries) throw err;
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, attempt * 3000));
    }
  }
}

async function callClaude(prompt, model = 'claude-opus-4-5') {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0]?.text || '';
}

/**
 * Вспомогательная фоновая функция генерации натальной карты после оплаты
 */
function runBackgroundProcessing(orderId, formData) {
  (async () => {
    try {
      console.log(`[Processing] Starting calculations for order ${orderId}...`);

      const name = formData.name;
      const birthdate = formData.bdate; // YYYY-MM-DD
      const birthplace = formData.place;
      const gender = formData.gender || 'female';
      const unknown = !!formData.unknown;
      // Если время неизвестно, считаем карту на полдень (12:00)
      const birthtime = unknown ? '12:00' : (formData.btime || '12:00');
      const tzOffset = null;

      console.log(`[Bazi Calc] name: ${name}, dob: ${birthdate}, tob: ${birthtime}, unknown: ${unknown}, pob: ${birthplace}, gender: ${gender}`);

      const chart = await calculateBaZi({ name, birthdate, birthtime, birthplace, gender, tzOffset });
      const chartText = formatChart(chart);

      let interpretation = null;
      let annualScores = null;

      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasClaude = !!process.env.ANTHROPIC_API_KEY;

      if (process.env.PASSPORT_USE_AI === 'true' && (hasOpenAI || hasClaude)) {
        console.log(`[AI] Generating interpretation for ${name}...`);

        const birthYear = birthdate.split('-')[0];
        const interpretPrompt = buildInterpretPrompt(chartText, name, gender, birthYear);

        let rawText = '';
        const provider = hasClaude ? 'claude' : 'openai';
        const model = provider === 'claude' ? 'claude-opus-4-5' : 'gpt-4o-mini';

        if (provider === 'openai') {
          rawText = await callOpenAI(interpretPrompt, model);
        } else {
          rawText = await callClaude(interpretPrompt, model);
        }

        const stripHieroglyphs = (s) =>
          s.replace(/[\u2E80-\u2EFF\u2F00-\u2FDF\u3000-\u303F\u3040-\u30FF\u3100-\u31FF\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/gu, '');

        rawText = stripHieroglyphs(rawText);

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI interpretation response did not contain valid JSON');
        }

        interpretation = JSON.parse(jsonMatch[0]);

        console.log(`[AI] Generating annual scores for ${name}...`);
        const scoresPrompt = buildAnnualScoringPrompt(chart);
        let scoresRaw = '';
        if (hasOpenAI) {
          scoresRaw = await callOpenAI(scoresPrompt, 'gpt-4o-mini');
        } else {
          scoresRaw = await callClaude(scoresPrompt, 'claude-3-5-haiku-20241022');
        }

        const scoresMatch = scoresRaw.match(/\{[\s\S]*\}/);
        if (scoresMatch) {
          annualScores = JSON.parse(scoresMatch[0]).annual;
        }
      }

      // Офлайн заглушка, если ИИ выключен или нет ключей
      if (!interpretation) {
        console.log(`[Offline Mode] Using demo mock interpretation for ${name}...`);
        interpretation = {
          section1: `Это демонстрационная версия отчёта Ба-цзы для ${name}, так как ИИ-интерпретация отключена или отсутствуют API-ключи в файле конфигурации .env.`,
          section3: {
            portrait: `В твоей природе заложена гармония и стремление к росту. Твой характер сочетает черты устойчивости и гибкости.`,
            strengths: [
              { name: "Устойчивость", desc: "Умение сохранять внутреннее спокойствие в любых ситуациях." },
              { name: "Аналитичность", desc: "Способность видеть скрытые взаимосвязи и глубокие смыслы." }
            ],
            shadows: [
              { name: "Склонность к сомнениям", body: "Периодический перегруз мыслями мешает быстро делать выбор.", lesson: "Доверяй своей первой интуитивной реакции." }
            ],
            tasks: {
              develop: ["Уверенность в своих решениях", "Практики заземления"],
              release: ["Потребность контролировать всё вокруг"],
              form: ["Новые привычки заботы о физическом теле"],
              summary: "Когда эти задачи будут выполнены, ты почувствуешь огромный прилив сил."
            }
          },
          section4: {
            love: {
              natural: "Искренность и забота о близких.",
              now: "Период благоприятен для укрепления союзов.",
              partner_type: "Внимательный партнер, ценящий верность и стабильность.",
              patterns: "Склонность брать на себя слишком много эмоциональной ответственности.",
              tendency: "Ориентация на долгосрочный семейный союз."
            },
            love_patterns: {
              how_you_love: "Проявляешь заботу через конкретные дела и внимание к мелочам.",
              what_you_need: "Тебе важно чувствовать эмоциональную безопасность и стабильность.",
              triggers: "Остро реагируешь на эмоциональную холодность или недоверие.",
              shadow_in_love: "При испуге склонна временно отдаляться для самозащиты.",
              growth_in_love: "Важно развивать открытый диалог о своих глубинных потребностях."
            },
            money: {
              natural: "Практичный подход и умение копить.",
              now: "Финансовая энергия стабильна.",
              earning_style: "Через экспертные знания и интеллектуальный труд.",
              accumulation: "Склонность к планомерному накоплению сбережений.",
              risk: "Консервативное отношение, избегание неоправданных рисков."
            },
            career: {
              natural: "Склонность к аналитической или помогающей деятельности.",
              now: "Хорошее время для обучения.",
              professions: ["Психолог", "Аналитик", "Консультант"],
              work_style: "Предпочитает экспертную работу в спокойной атмосфере.",
              entrepreneur: "Умеренный бизнес-потенциал, лучше в партнерстве."
            },
            family: {
              natural: "Глубокая привязанность к семейным ценностям.",
              now: "Взаимопонимание с близкими.",
              parents: "Уважение к традициям и поддержка старшего поколения.",
              children: "Ответственный подход к воспитанию детей.",
              siblings: "Теплые дружеские отношения при сохранении личных границ."
            },
            health: {
              natural: "Высокая чувствительность нервной системы.",
              now: "Рекомендуется больше отдыхать.",
              organs: "Уязвимы нервная система и органы пищеварения.",
              lifestyle: "Регулярный сон, прогулки на воздухе и заземляющие практики."
            },
            growth: { natural: "Постоянное стремление к самопознанию.", now: "Период глубоких внутренних инсайтов." },
            creative: { natural: "Творческое выражение через текст или музыку.", now: "Благоприятные условия для хобби." },
            timeline: [
              { label: "Q3 2026", text: "Период адаптации и планирования." },
              { label: "Q4 2026", text: "Фокус на рабочих целях и финансах." },
              { label: "Q1 2027", text: "Время для отдыха и личных отношений." },
              { label: "Q2 2027", text: "Активное проявление в социуме." }
            ]
          },
          section5: {
            cycles: chart.luckyPillars.pillars.map(p => {
              const age = `${p.startAge}–${p.endAge}`;
              const isCur = chart.currentAge >= p.startAge && chart.currentAge <= p.endAge;
              return {
                range: age,
                theme: `Период ${p.ganzhi}`,
                 is_current: isCur,
                love: "Стабильный эмоциональный фон.",
                money: "Рост материальной устойчивости.",
                career: "Обретение экспертного статуса."
              };
            }).slice(0, 5),
            peaks: {
              love: { range: "28–35", reason: "Благоприятное сочетание элементов." },
              money: { range: "35–42", reason: "Усиление элемента богатства." },
              career: { range: "42–49", reason: "Период максимальной самореализации." }
            },
            current_summary: `Сейчас ты находишься в активном периоде, который требует внимания к балансу работы и личной жизни.`
          },
          section6: {
            destiny: "Твоя главная жизненная задача — раскрыть свой природный потенциал и научиться доверять себе.",
            recurring_themes: ["Поиск внутренней опоры", "Гармонизация отношений", "Финансовая независимость"],
            natural_gifts: "Твой природный талант — умение слышать людей и давать мудрые советы.",
            work_areas: "Сознательное развитие эмоционального интеллекта и границ в общении.",
            spiritual: "Путь к глубокой внутренней мудрости и покою.",
            ancestral: "Семейный опыт даёт тебе силу преодолевать любые жизненные испытания.",
            directions: "Благоприятные направления — Восток и Юг."
          },
          insights: {
            superpower: "Умение быстро находить решения в сложных ситуациях.",
            trap: "Желание сделать всё идеально с первого раза.",
            advice: "Позволь себе действовать из состояния лёгкости."
          },
          simple: `Привет! Твоя карта Ба-цзы показывает, что ты обладаешь сильной врождённой интуицией. Сейчас наступает время, когда нужно перестать сомневаться и начать действовать. Удели внимание своему здоровью, чаще отдыхай и доверяй ходу событий. Всё складывается наилучшим образом для тебя.`
        };
      }

      if (!annualScores) {
        const startYear = Number(birthdate.split('-')[0]) + 14;
        const currentYear = new Date().getFullYear();
        annualScores = [];
        for (let y = startYear; y <= currentYear + 3; y++) {
          const age = y - Number(birthdate.split('-')[0]);
          annualScores.push({
            year: y,
            age,
            love: 5 + Math.floor(Math.sin(y) * 3),
            money: 6 + Math.floor(Math.cos(y) * 2),
            career: 5 + Math.floor(Math.sin(y / 2) * 3),
            family: 7 + Math.floor(Math.cos(y / 2) * 2),
            health: 6 + Math.floor(Math.sin(y / 3) * 2),
            growth: 7 + Math.floor(Math.cos(y / 3) * 2),
            creative: 5 + Math.floor(Math.sin(y / 4) * 3)
          });
        }
      }

      const dateParts = birthdate.split('-'); // YYYY-MM-DD
      const dobFormatted = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;

      const passportJson = {
        meta: {
          name,
          dob: dobFormatted,
          tob: unknown ? '—' : birthtime,
          pob: birthplace,
          gender,
          timezone_note: `UTC${chart.tz >= 0 ? '+' : ''}${chart.tz} (на основе долготы места рождения)`
        },
        chart,
        annualScores,
        section1: interpretation.section1,
        section3: interpretation.section3,
        section4: interpretation.section4,
        section5: interpretation.section5,
        section6: interpretation.section6,
        insights: interpretation.insights,
        simple: interpretation.simple
      };

      const pdfPath = await generatePDF(orderId, passportJson);

      db.markSuccess(orderId, passportJson, pdfPath);
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
app.get('/api/orders/:id/preview', async (req, res) => {
  try {
    const order = db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let passportJson;
    if (order.passport_json) {
      passportJson = JSON.parse(order.passport_json);
    } else {
      const formData = JSON.parse(order.form_data);
      const name = formData.name;
      const birthdate = formData.bdate;
      const birthplace = formData.place;
      const gender = formData.gender || 'female';
      const unknown = !!formData.unknown;
      const birthtime = unknown ? '12:00' : (formData.btime || '12:00');
      const tzOffset = null;

      const chart = await calculateBaZi({ name, birthdate, birthtime, birthplace, gender, tzOffset });

      passportJson = {
        meta: {
          name,
          dob: birthdate.split('-').reverse().join('.'),
          tob: unknown ? '—' : birthtime,
          pob: birthplace,
          gender,
          timezone_note: `UTC${chart.tz >= 0 ? '+' : ''}${chart.tz}`
        },
        chart,
        section1: "Предпросмотр Паспорта Жизни...",
        section3: { portrait: "", strengths: [], shadows: [], tasks: {} },
        section4: { timeline: [] },
        section5: { cycles: [] },
        section6: {},
        insights: {}
      };
    }

    const html = getCustomizedHTML(passportJson);
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

// Python spawn removed
