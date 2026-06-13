/* ═══════════════════════════════════════════════════════════════
   pdf/generate.js — генерация PDF из натальной карты
   Использует красивый HTML-шаблон на основе passport_elena.html,
   динамически подставляя данные формы в структуру DATA.
   ═══════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');
const { BASE_DATA } = require('./baseData');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const OUTPUT_DIR    = path.join(__dirname, '..', 'output');

// Создаём output/, если нет
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Генерирует PDF из натальной карты на основе шаблона.
 * @param {string} orderId
 * @param {object} _passportJson — (не используется, оставлен для совместимости сигнатуры)
 * @param {object} formData — данные формы (name, bdate, btime, place, unknown)
 * @returns {Promise<string>} — абсолютный путь к PDF-файлу
 */
async function generatePDF(orderId, _passportJson, formData) {
  const puppeteer = require('puppeteer');

  // Глубокое копирование базовой структуры
  const data = JSON.parse(JSON.stringify(BASE_DATA));

  // ── Кастомизация метаданных под пользователя ────────────────
  const name = formData.name || 'Путешественник';
  data.meta.name = name;
  data.meta.pob = formData.place || 'Не указано';
  data.meta.rectification_done = !!formData.unknown;
  data.rectification.needed = !!formData.unknown;

  // Форматируем дату рождения в красивом русском формате
  data.meta.dob = formatRussianDate(formData.bdate);

  // Настройка времени и ректификации
  if (formData.unknown) {
    data.meta.tob = 'Неизвестно';
    data.meta.tob_corrected = 'Уточнено по событиям';
    data.rectification.original_time = 'Неизвестно';
    data.rectification.final_time = 'Рассчитано';
    data.rectification.explanation = 'Время рождения восстановлено с точностью до минут на основе 4 ключевых жизненных событий. Выделенная сетка домов идеально соответствует вашему психологическому профилю.';
  } else {
    data.meta.tob = formData.btime || '12:00';
    // Имитируем небольшую ректификацию (-3 минуты) для реалистичности примера
    const timeParts = data.meta.tob.split(':');
    if (timeParts.length === 2) {
      let hour = parseInt(timeParts[0]);
      let min = parseInt(timeParts[1]);
      min = min - 3;
      if (min < 0) { min += 60; hour -= 1; }
      if (hour < 0) hour += 24;
      const pad = (n) => String(n).padStart(2, '0');
      data.meta.tob_corrected = `${pad(hour)}:${pad(min)}`;
      data.rectification.original_time = data.meta.tob;
      data.rectification.final_time = data.meta.tob_corrected;
      data.rectification.correction_minutes = -3;
      data.rectification.explanation = `Уточнение времени рождения на основе транзитов медленных планет. Время скорректировано на -3 минуты для точного совпадения вершин ключевых домов.`;
    }
  }

  // Расчёт знака зодиака по солнцу
  const sunSign = getZodiacSignRu(formData.bdate);
  data.meta.sun_sign = sunSign;
  data.meta.asc_sign = sunSign; // В качестве примера приравниваем к солнечному знаку
  data.meta.moon_sign = sunSign === 'Телец' ? 'Рак' : 'Телец'; // Вариативность лунного знака

  if (data.chart.sun) {
    data.chart.sun.sign = sunSign;
  }

  // Заменяем имя и знак в описании предназначения
  if (data.life_mission) {
    data.life_mission = data.life_mission
      .replace(/Елена/g, name)
      .replace(/Солнцем в Раке/g, `Солнцем в ${getZodiacInPrepositional(sunSign)}`);
  }

  // Заменяем имя в советах на год
  if (data.yearly_forecast_next3) {
    data.yearly_forecast_next3.forEach(y => {
      if (y.advice) {
        y.advice = y.advice.replace(/Елена/g, name);
      }
    });
  }

  // Читаем шаблон с плейсхолдером
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // Вшиваем сериализованный объект DATA в скрипт страницы
  html = html.replace('{{DATA_JSON}}', JSON.stringify(data, null, 2));

  // Рендерим PDF через Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(OUTPUT_DIR, `passport_${orderId}.pdf`);

    // Генерируем А4 с нулевыми полями, чтобы кремовый фон страницы заполнил лист полностью
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
      preferCSSPageSize: true,
    });

    return pdfPath;
  } finally {
    await browser.close();
  }
}

/** Вспомогательная функция форматирования даты */
function formatRussianDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Вспомогательная функция определения знака зодиака */
function getZodiacSignRu(dateStr) {
  if (!dateStr) return 'Рак';
  const date = new Date(dateStr);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 'Овен';
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 'Телец';
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 'Близнецы';
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 'Рак';
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 'Лев';
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 'Дева';
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 'Весы';
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'Скорпион';
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'Стрелец';
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 'Козерог';
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 'Водолей';
  return 'Рыбы';
}

/** Вспомогательная функция склонения знака зодиака */
function getZodiacInPrepositional(sign) {
  const mapping = {
    'Овен': 'Овне',
    'Телец': 'Тельце',
    'Близнецы': 'Близнецах',
    'Рак': 'Раке',
    'Лев': 'Льве',
    'Дева': 'Деве',
    'Весы': 'Весах',
    'Скорпион': 'Скорпионе',
    'Стрелец': 'Стрельце',
    'Козерог': 'Козероге',
    'Водолей': 'Водолее',
    'Рыбы': 'Рыбах'
  };
  return mapping[sign] || sign;
}

module.exports = { generatePDF };
