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
 * Возвращает кастомизированный HTML-шаблон на основе готового JSON натальной карты.
 * @param {object} passportJson
 * @returns {string} — готовый HTML
 */
function getCustomizedHTML(passportJson) {
  // Читаем шаблон с плейсхолдером
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // Вшиваем сериализованный объект DATA в скрипт страницы
  return html.replace('{{DATA_JSON}}', JSON.stringify(passportJson, null, 2));
}

/**
 * Генерирует PDF из натальной карты на основе шаблона.
 * @param {string} orderId
 * @param {object} passportJson — готовый JSON натальной карты
 * @returns {Promise<string>} — абсолютный путь к PDF-файлу
 */
async function generatePDF(orderId, passportJson) {
  const puppeteer = require('puppeteer');

  const html = getCustomizedHTML(passportJson);

  // Рендерим PDF через Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(OUTPUT_DIR, `passport_${orderId}.pdf`);

    // Генерируем А4 с нулевыми полями
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

module.exports = { generatePDF, getCustomizedHTML };
