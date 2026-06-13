/* ═══════════════════════════════════════════════════════════════
   pdf/generate.js — генерация PDF из JSON-паспорта
   Читает template.html, подставляет данные, рендерит через Puppeteer.
   ═══════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const OUTPUT_DIR    = path.join(__dirname, '..', 'output');

// Создаём output/, если нет
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Генерирует PDF из JSON-паспорта.
 * @param {string} orderId
 * @param {object} passportJson — объект passport из JSON-договора
 * @param {object} formData — данные формы (для мета-строки)
 * @returns {Promise<string>} — абсолютный путь к PDF-файлу
 */
async function generatePDF(orderId, passportJson, formData) {
  const puppeteer = require('puppeteer');

  // Читаем шаблон
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // Подставляем данные
  const owner = passportJson.owner || formData.name || 'Путешественник';

  const metaParts = [];
  if (formData.bdate) metaParts.push(`Дата рождения: ${formData.bdate}`);
  if (!formData.unknown && formData.btime) metaParts.push(`Время: ${formData.btime}`);
  if (formData.place) metaParts.push(`Место: ${formData.place}`);
  const metaLine = metaParts.join(' · ') || '';

  const today = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Генерируем HTML-блоки разделов
  const sectionsHtml = (passportJson.sections || [])
    .map(s => `
      <div class="section">
        <h2>${escapeHtml(s.heading)}</h2>
        <p>${escapeHtml(s.body)}</p>
      </div>
    `)
    .join('\n');

  html = html
    .replace('{{OWNER}}', escapeHtml(owner))
    .replace('{{META_LINE}}', escapeHtml(metaLine))
    .replace('{{DATE}}', escapeHtml(today))
    .replace('{{SECTIONS}}', sectionsHtml);

  // Рендерим PDF через Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(OUTPUT_DIR, `passport_${orderId}.pdf`);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    return pdfPath;
  } finally {
    await browser.close();
  }
}

/** Экранирование HTML-спецсимволов */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { generatePDF };
