require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const { calculateBaZi, formatChart, getAnnualPillars, ganzhiLabel } = require('./bazi-calc');

const app = express();
const PORT = process.env.PORT || 3000;
const LOGS_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Цены в USD за 1M токенов (input / output)
const PRICING = {
  // OpenAI
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60  },
  'o3':                { input: 10.00, output: 40.00 },
  'o3-mini':           { input: 1.10,  output: 4.40  },
  'o4-mini':           { input: 1.10,  output: 4.40  },
  'o1':                { input: 15.00, output: 60.00 },
  'o1-mini':           { input: 3.00,  output: 12.00 },
  'gpt-4-turbo':       { input: 10.00, output: 30.00 },
  'gpt-4':             { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo':     { input: 0.50,  output: 1.50  },
  // Anthropic
  'claude-opus-4-5':              { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':            { input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet-20241022':   { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku-20241022':    { input: 0.80,  output: 4.00  },
  'claude-3-opus-20240229':       { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229':     { input: 3.00,  output: 15.00 },
  'claude-3-haiku-20240307':      { input: 0.25,  output: 1.25  },
};

function calcCost(model, inputTokens, outputTokens) {
  const price = PRICING[model];
  if (!price) return null;
  const inputCost  = (inputTokens  / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;
  return {
    inputCost:  +inputCost.toFixed(6),
    outputCost: +outputCost.toFixed(6),
    totalCost:  +(inputCost + outputCost).toFixed(6),
  };
}

function buildPrompt(name, birthplace, birthtime, gender) {
  const promptTemplate = fs.readFileSync(
    path.join(__dirname, 'prompt', 'basci.txt'),
    'utf-8'
  );
  const genderLabel = gender === 'female' ? 'Женский' : 'Мужской';
  const dateStr = birthtime.split('T')[0] || birthtime;
  const timeStr = birthtime.split('T')[1] || 'не указано';

  return promptTemplate
    .replace('[ДАТА]', dateStr)
    .replace('[ВРЕМЯ]', timeStr)
    .replace('[ГОРОД]', birthplace)
    .replace('[ПОЛ]', genderLabel)
    + `\n\nИмя: ${name}\n\n`
    + `Текущая дата: ${new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}. `
    + `Текущий год: ${new Date().getFullYear()}. Используй именно этот год как «текущий» при расчёте тактов удачи и влияния текущего года.\n\n`
    + `ВАЖНО: для расчёта карты Ба-цзы используй местное солнечное время (истинное солнечное время). `
    + `Исходное время рождения ${timeStr} указано как местное гражданское время в городе ${birthplace}. `
    + `Определи долготу города ${birthplace}, вычисли поправку на местное солнечное время `
    + `(разницу между гражданским поясным временем и истинным солнечным временем для данной долготы) `
    + `и используй скорректированное солнечное время для определения часового столпа Ба-цзы.`;
}

function saveLog({ name, birthplace, birthtime, gender, model, provider, response, usage }) {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const safeName = name.replace(/[^а-яёa-z0-9_\- ]/gi, '').trim().replace(/\s+/g, '_');
  const safeModel = model.replace(/[^a-z0-9._-]/gi, '');

  const filename = `${datePart}_${timePart}__${safeName}__${safeModel}.md`;
  const filepath = path.join(LOGS_DIR, filename);

  const cost = usage ? calcCost(model, usage.inputTokens, usage.outputTokens) : null;

  const usageRows = usage ? [
    `| **Токены входящие**  | ${usage.inputTokens.toLocaleString('ru-RU')} |`,
    `| **Токены исходящие** | ${usage.outputTokens.toLocaleString('ru-RU')} |`,
    `| **Токены всего**     | ${(usage.inputTokens + usage.outputTokens).toLocaleString('ru-RU')} |`,
  ] : [];

  const costRows = cost ? [
    `| **Стоимость input**  | $${cost.inputCost} |`,
    `| **Стоимость output** | $${cost.outputCost} |`,
    `| **Стоимость итого**  | $${cost.totalCost} |`,
  ] : [];

  const content = [
    `# Паспорт Жизни — ${name}`,
    ``,
    `| Поле                 | Значение |`,
    `|----------------------|----------|`,
    `| **Имя**              | ${name} |`,
    `| **Место**            | ${birthplace} |`,
    `| **Дата/время**       | ${birthtime} |`,
    `| **Пол**              | ${gender === 'female' ? 'Женский' : 'Мужской'} |`,
    `| **Провайдер**        | ${provider} |`,
    `| **Модель**           | ${model} |`,
    `| **Дата запроса**     | ${now.toLocaleString('ru-RU')} |`,
    ...usageRows,
    ...costRows,
    ``,
    `---`,
    ``,
    response,
  ].join('\n');

  fs.writeFileSync(filepath, content, 'utf-8');

  const costStr = cost ? ` | $${cost.totalCost}` : '';
  const tokStr  = usage ? ` | ↑${usage.inputTokens} ↓${usage.outputTokens}` : '';
  console.log(`[LOG] ${filename}${tokStr}${costStr}`);

  return filename;
}

app.post('/api/analyze', async (req, res) => {
  const { name, birthplace, birthtime, gender, provider, model } = req.body;

  if (!name || !birthplace || !birthtime || !gender) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const fullPrompt = buildPrompt(name, birthplace, birthtime, gender);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let fullResponse = '';
    const onChunk = (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    };

    let usage = null;

    const effectiveModel = model || (provider === 'openai' ? 'gpt-4o' : 'claude-opus-4-5');

    if (provider === 'openai') {
      usage = await streamOpenAI(fullPrompt, onChunk, effectiveModel);
    } else {
      usage = await streamClaude(fullPrompt, onChunk, effectiveModel);
    }

    const cost = usage ? calcCost(effectiveModel, usage.inputTokens, usage.outputTokens) : null;

    const logFile = saveLog({ name, birthplace, birthtime, gender, model: effectiveModel, provider, response: fullResponse, usage });

    res.write(`data: ${JSON.stringify({ usage, cost, logFile })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

async function streamClaude(prompt, onChunk, model = 'claude-opus-4-5') {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = await client.messages.stream({
    model,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onChunk(chunk.delta.text);
    }
    if (chunk.type === 'message_start' && chunk.message?.usage) {
      inputTokens = chunk.message.usage.input_tokens || 0;
    }
    if (chunk.type === 'message_delta' && chunk.usage) {
      outputTokens = chunk.usage.output_tokens || 0;
    }
  }

  return { inputTokens, outputTokens };
}

const O_SERIES_MODELS = new Set(['o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini']);

async function streamOpenAI(prompt, onChunk, model = 'gpt-4o') {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const isOSeries = O_SERIES_MODELS.has(model);

  const stream = await client.chat.completions.create({
    model,
    ...(isOSeries
      ? { max_completion_tokens: 8192 }
      : { max_tokens: 8192 }),
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: 'user', content: prompt }],
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) onChunk(text);
    if (chunk.usage) {
      inputTokens  = chunk.usage.prompt_tokens     || 0;
      outputTokens = chunk.usage.completion_tokens || 0;
    }
  }

  return { inputTokens, outputTokens };
}

const DECODE_PROMPT = `Представь, что твой близкий друг только что получил большой подробный анализ своей судьбы — с иероглифами, элементами, столпами, тактами удачи. Он читал-читал и говорит тебе: «Слушай, я вообще не понял что это всё значит. Объясни мне по-человечески».

Ты берёшь этот анализ и рассказываешь другу простыми словами — без терминов, без иероглифов, без структурированных заголовков. Просто живой разговор: кто этот человек по своей природе, что сейчас происходит в его жизни, на что стоит обратить внимание. Как будто сидите за чашкой кофе.

Не пересказывай весь анализ — выдели самое важное и переведи это в понятный язык. 3–5 абзацев, тепло и по делу.

Вот анализ:
`;

const INSIGHTS_PROMPT = `Ты читаешь готовый детальный анализ карты человека.

На основе ЭТОГО КОНКРЕТНОГО анализа составь ровно три инсайта — строго опираясь на то, что написано в карте: Господин дня, баланс элементов, такты удачи, сильные стороны, теневые паттерны.

Формат ответа строго JSON (только JSON, без пояснений вокруг):
{
  "superpower": "Одно предложение: главная природная сила именно этого человека — что следует из его карты, что ему даётся легко от рождения.",
  "trap": "Одно предложение: главная повторяющаяся ловушка, которая видна в карте — в чём конкретно этот человек чаще всего застревает.",
  "advice": "Одно предложение: самый важный совет именно сейчас — основанный на текущем такте удачи и влиянии года."
}

Пиши на «ты», тепло и конкретно. Без терминов типа «Господин дня» или «Ян-Металл». Только JSON.

Анализ карты:
`;

app.post('/api/insights', async (req, res) => {
  const { analysisText, provider, model } = req.body;

  if (!analysisText) {
    return res.status(400).json({ error: 'Нет текста анализа' });
  }

  const prompt = INSIGHTS_PROMPT + analysisText;
  const effectiveModel = model || (provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022');

  try {
    let raw = '';
    const onChunk = (text) => { raw += text; };

    if (provider === 'openai') {
      await streamOpenAI(prompt, onChunk, effectiveModel);
    } else {
      await streamClaude(prompt, onChunk, effectiveModel);
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Не удалось получить инсайты' });

    const insights = JSON.parse(jsonMatch[0]);
    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/decode', async (req, res) => {
  const { analysisText, provider, model } = req.body;

  if (!analysisText) {
    return res.status(400).json({ error: 'Нет текста для расшифровки' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const prompt = DECODE_PROMPT + analysisText;
  const effectiveModel = model || (provider === 'openai' ? 'gpt-4o' : 'claude-opus-4-5');

  try {
    const onChunk = (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`);

    if (provider === 'openai') {
      await streamOpenAI(prompt, onChunk, effectiveModel);
    } else {
      await streamClaude(prompt, onChunk, effectiveModel);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.post('/api/log-append', (req, res) => {
  const { logFile, section, content } = req.body;
  if (!logFile || !content) return res.status(400).json({ error: 'missing fields' });

  const filepath = path.join(LOGS_DIR, path.basename(logFile));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'log not found' });

  const append = [
    ``,
    `---`,
    ``,
    `## ${section || 'Простыми словами'}`,
    ``,
    content,
  ].join('\n');

  fs.appendFileSync(filepath, append, 'utf-8');
  console.log(`[LOG] Добавлен блок "${section}" → ${logFile}`);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// /api/chart-scores — числовые оценки по годам (流年 лю нянь)
// ═══════════════════════════════════════════════════════════════

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

app.post('/api/chart-scores', async (req, res) => {
  const { chartData } = req.body;
  if (!chartData) return res.status(400).json({ error: 'Нет данных карты' });

  const prompt = buildAnnualScoringPrompt(chartData);

  try {
    let raw = '';
    await streamOpenAI(prompt, chunk => { raw += chunk; }, 'o3');

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Не удалось распознать оценки' });

    const data = JSON.parse(jsonMatch[0]);
    res.json(data);
  } catch (err) {
    console.error('[chart-scores]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// /api/cities — автодополнение городов через Nominatim
// ═══════════════════════════════════════════════════════════════

function nominatimSearch(q) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      q,
      format:         'json',
      limit:          '8',
      addressdetails: '1',
      featuretype:    'settlement',
      'accept-language': 'ru,en',
    });
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path:     `/search?${params}`,
      headers:  {
        'User-Agent': 'BaZiPassport/1.0 (educational)',
        'Referer':    'http://localhost:3000',
      },
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(6000, () => { req.destroy(); resolve([]); });
  });
}

const PLACE_TYPE_RU = {
  city:         'город',
  town:         'город',
  village:      'село',
  hamlet:       'хутор',
  suburb:       'район',
  municipality: 'муниципалитет',
  county:       'район',
  district:     'район',
  locality:     'местность',
  isolated_dwelling: 'посёлок',
  quarter:      'квартал',
};

app.get('/api/cities', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const raw = await nominatimSearch(q);

  const items = raw
    .filter(r => r.addresstype && (
      r.addresstype === 'city'    ||
      r.addresstype === 'town'    ||
      r.addresstype === 'village' ||
      r.addresstype === 'hamlet'  ||
      r.addresstype === 'suburb'  ||
      r.addresstype === 'municipality' ||
      r.addresstype === 'isolated_dwelling' ||
      r.class === 'place'
    ))
    .map(r => {
      const addr  = r.address || {};
      const name  = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || r.name || r.display_name.split(',')[0];
      const country = addr.country || '';
      const region  = addr.state || addr.region || addr.county || '';
      const sub  = [region, country].filter(Boolean).join(', ');
      const type = PLACE_TYPE_RU[r.addresstype] || PLACE_TYPE_RU[r.type] || r.addresstype || '';
      return {
        main: name,
        sub,
        type,
        full: sub ? `${name}, ${sub}` : name,
        lon:  parseFloat(r.lon),
        lat:  parseFloat(r.lat),
      };
    })
    // De-duplicate by full name
    .filter((item, idx, arr) => arr.findIndex(x => x.full === item.full) === idx);

  res.json(items);
});

// ═══════════════════════════════════════════════════════════════
// /api/mock-logs — dev: список логов + получение содержимого
// ═══════════════════════════════════════════════════════════════

app.get('/api/mock-logs', (req, res) => {
  try {
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(f => {
        // Parse display name from filename: 2026-06-14_17-01-50__САша__o3.md
        const m = f.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})__(.+?)__(.+?)\.md$/);
        return {
          file: f,
          label: m ? `${m[3]}  •  ${m[1]} ${m[2].replace(/-/g,':')}  •  ${m[4]}` : f,
        };
      });
    res.json(files);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/mock-logs/:file', (req, res) => {
  const file = path.basename(req.params.file);   // no path traversal
  const full = path.join(LOGS_DIR, file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'not found' });
  const md = fs.readFileSync(full, 'utf-8');

  // New format: JSON interpretation block
  const jsonSectionIdx = md.indexOf('## Интерпретация JSON');
  if (jsonSectionIdx !== -1) {
    const jsonBlockMatch = md.slice(jsonSectionIdx).match(/```json\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      try {
        const jsonStr  = jsonBlockMatch[1].trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const interpretation = JSON.parse(jsonMatch[0]);
          return res.json({ file, interpretation });
        }
      } catch { /* fall through to text format */ }
    }
  }

  // Old format: raw text interpretation
  const interpIdx = md.indexOf('## Интерпретация');
  const text = interpIdx !== -1 ? md.slice(interpIdx + '## Интерпретация'.length).trim() : md;
  res.json({ file, text });
});

// ═══════════════════════════════════════════════════════════════
// /api/analyze-v2 — точный расчёт + интерпретация LLM
// ═══════════════════════════════════════════════════════════════

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

app.post('/api/analyze-v2', async (req, res) => {
  const { name, birthplace, birthdate, birthtime, gender, provider, model, tzOffset } = req.body;

  if (!name || !birthplace || !birthdate || !birthtime || !gender) {
    return res.status(400).json({ error: 'Заполните все поля (имя, место, дата, время, пол)' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Шаг 1: математический расчёт карты
  let chart;
  try {
    chart = await calculateBaZi({ name, birthdate, birthtime, birthplace, gender, tzOffset });
  } catch (err) {
    console.error('[CALC ERROR]', err);
    res.write(`data: ${JSON.stringify({ error: 'Ошибка расчёта карты: ' + err.message })}\n\n`);
    res.end();
    return;
  }

  const chartText = formatChart(chart);

  // Шаг 2: отправляем рассчитанную карту клиенту (для отображения в статусе)
  res.write(`data: ${JSON.stringify({ chart, chartText })}\n\n`);

  // Шаг 3: строим промпт для интерпретации
  const birthYear       = birthdate.split('-')[0];
  const interpretPrompt = buildInterpretPrompt(chartText, name, gender, birthYear);
  const effectiveModel  = model || (provider === 'openai' ? 'gpt-4o' : 'claude-opus-4-5');

  // Strip CJK / Bazi hieroglyphs the model leaks despite prompt instructions
  // Covers: CJK Unified (4E00-9FFF), Extension A (3400-4DBF), Compat (F900-FAFF),
  //         CJK Radicals (2E80-2EFF), Kangxi (2F00-2FDF), Bopomofo (3100-312F),
  //         Katakana/Hiragana (3040-30FF), Enclosed CJK (3200-32FF), etc.
  const stripHieroglyphs = (s) =>
    s.replace(/[\u2E80-\u2EFF\u2F00-\u2FDF\u3000-\u303F\u3040-\u30FF\u3100-\u31FF\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/gu, '');

  try {
    // Шаг 3: собираем полный ответ (без стриминга клиенту — нужен JSON целиком)
    let rawText = '';
    const collectChunk = (text) => { rawText += text; };

    let usage = null;
    if (provider === 'openai') {
      usage = await streamOpenAI(interpretPrompt, collectChunk, effectiveModel);
    } else {
      usage = await streamClaude(interpretPrompt, collectChunk, effectiveModel);
    }

    rawText = stripHieroglyphs(rawText);

    // Шаг 4: извлекаем JSON из ответа
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Модель не вернула JSON — попробуйте ещё раз');
    let interpretation;
    try {
      interpretation = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Ошибка разбора JSON — попробуйте ещё раз');
    }

    const cost = usage ? calcCost(effectiveModel, usage.inputTokens, usage.outputTokens) : null;

    const logFile = saveLog({
      name,
      birthplace,
      birthtime: `${birthdate}T${birthtime}`,
      gender,
      model: effectiveModel,
      provider,
      response: `## Рассчитанная карта\n\`\`\`\n${chartText}\n\`\`\`\n\n---\n\n## Интерпретация JSON\n\n\`\`\`json\n${rawText}\n\`\`\``,
      usage,
    });

    res.write(`data: ${JSON.stringify({ interpretation, usage, cost, logFile })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
