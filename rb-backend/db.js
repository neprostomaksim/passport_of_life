/* ═══════════════════════════════════════════════════════════════
   db.js — SQLite: хранилище заказов
   ═══════════════════════════════════════════════════════════════ */

const path    = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'orders.db');

// Создаём папку data/, если её нет
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Включаем WAL-режим (быстрее для параллельных чтений)
db.pragma('journal_mode = WAL');

// ── Создаём таблицу orders ────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    form_data   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'processing',
    passport_json TEXT,
    pdf_path    TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ── Подготовленные запросы (работают быстрее) ─────────────────

const stmts = {
  insert: db.prepare(`
    INSERT INTO orders (id, form_data, status)
    VALUES (@id, @form_data, 'processing')
  `),

  getById: db.prepare(`
    SELECT * FROM orders WHERE id = ?
  `),

  updateSuccess: db.prepare(`
    UPDATE orders
    SET status = 'success',
        passport_json = @passport_json,
        pdf_path = @pdf_path,
        updated_at = datetime('now')
    WHERE id = @id
  `),

  updateFail: db.prepare(`
    UPDATE orders
    SET status = 'fail',
        error = @error,
        updated_at = datetime('now')
    WHERE id = @id
  `),
};

// ── Публичный API базы ────────────────────────────────────────

/** Создать заказ. Возвращает id. */
function createOrder(id, formData) {
  stmts.insert.run({ id, form_data: JSON.stringify(formData) });
  return id;
}

/** Получить заказ по id. */
function getOrder(id) {
  return stmts.getById.get(id);
}

/** Пометить заказ как успешный. */
function markSuccess(id, passportJson, pdfPath) {
  stmts.updateSuccess.run({
    id,
    passport_json: JSON.stringify(passportJson),
    pdf_path: pdfPath,
  });
}

/** Пометить заказ как неудачный. */
function markFail(id, errorText) {
  stmts.updateFail.run({ id, error: errorText });
}

module.exports = { createOrder, getOrder, markSuccess, markFail };
