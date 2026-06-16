require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs   = require('fs');
const path = require('path');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const FEEDBACK_DIR = path.join(__dirname, 'feedback');

if (!BOT_TOKEN) {
  console.error('Нет TELEGRAM_BOT_TOKEN в .env');
  process.exit(1);
}

if (!fs.existsSync(FEEDBACK_DIR)) fs.mkdirSync(FEEDBACK_DIR, { recursive: true });

const bot = new Telegraf(BOT_TOKEN);

const sessions = {};

function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = { step: null, data: {} };
  return sessions[userId];
}

function clearSession(userId) {
  delete sessions[userId];
}

// ─── Сохранение ───────────────────────────────────────────────────────────────

function saveFeedback(userId, username, firstName, data) {
  const now = new Date();
  const ts  = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  const safe = (username || `user_${userId}`).replace(/[^a-z0-9_а-яё]/gi, '_');
  const filepath = path.join(FEEDBACK_DIR, `${ts}__${safe}.md`);

  const lines = [
    `# Фидбек — ${firstName || ''} @${username || userId}`,
    ``,
    `| Поле | Значение |`,
    `|------|----------|`,
    `| **Telegram ID**    | ${userId} |`,
    `| **Username**       | @${username || '—'} |`,
    `| **Имя**            | ${firstName || '—'} |`,
    `| **Дата**           | ${now.toLocaleString('ru-RU')} |`,
    ``,
    `---`,
    ``,
    `**1. Дочитал до конца?** ${data.readall ?? '—'}`,
    ``,
    `**2. Что почувствовал во время чтения?** ${data.emotion ?? '—'}`,
    ``,
    `**3. Точность описания (1–5):** ${data.rating ?? '—'}`,
    ``,
    `**4. Самый точный раздел:** ${data.best_section ?? '—'}`,
    ``,
    `**5. Зачем пришёл?** ${data.motivation ?? '—'}`,
    ``,
    `**6. Что не зашло / показалось общим:**`,
    data.miss || '—',
    ``,
    `**7. Доверяешь результату?** ${data.trust ?? '—'}`,
    ``,
    `**8. Важно понимать основу анализа?** ${data.transparency ?? '—'}`,
    ``,
    `**9. Отправил бы другу?** ${data.share ?? '—'}`,
    ``,
    `**10. Купил бы такой анализ?** ${data.price ?? '—'}`,
    ``,
    `**11. Пользовался раньше чем-то похожим?** ${data.prior_tools ?? '—'}`,
    ``,
    `**12. Доп. мысли:**`,
    data.extra || '—',
  ].join('\n');

  fs.writeFileSync(filepath, lines, 'utf-8');
  return path.basename(filepath);
}

function formatForAdmin(firstName, username, data) {
  const name = firstName ? `${firstName} (@${username || '—'})` : `@${username || '—'}`;
  return [
    `📋 *Новый фидбек* — ${name}`,
    ``,
    `📖 Дочитал: *${data.readall ?? '—'}*`,
    `💡 Эмоция: *${data.emotion ?? '—'}*`,
    `⭐ Точность: *${data.rating ?? '—'}/5*`,
    `🏆 Лучший раздел: *${data.best_section ?? '—'}*`,
    `🎯 Зачем пришёл: *${data.motivation ?? '—'}*`,
    `😕 Не зашло: ${data.miss || '—'}`,
    `🤝 Доверие: *${data.trust ?? '—'}*`,
    `🔍 Важна прозрачность: *${data.transparency ?? '—'}*`,
    `📣 Поделился бы: *${data.share ?? '—'}*`,
    `💰 Купил бы: *${data.price ?? '—'}*`,
    `🗂 Опыт с похожим: *${data.prior_tools ?? '—'}*`,
    `💬 Доп: ${data.extra || '—'}`,
  ].join('\n');
}

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function startFlow(ctx) {
  clearSession(ctx.from.id);
  const session = getSession(ctx.from.id);
  session.step = 'readall';
  ctx.reply(
    `Ты дочитал результат до конца?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Да, всё прочитал', 'readall_yes')],
      [Markup.button.callback('Частично', 'readall_partial')],
      [Markup.button.callback('Нет, бросил на середине', 'readall_no')],
    ])
  );
}

function askEmotion(ctx) {
  return ctx.reply(
    `Что ты *почувствовал* во время чтения?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Узнавание — "это точно я"', 'emotion_recognition')],
        [Markup.button.callback('Удивление', 'emotion_surprise')],
        [Markup.button.callback('Скорее скепсис', 'emotion_skeptic')],
        [Markup.button.callback('Смешанное', 'emotion_mixed')],
      ]),
    }
  );
}

function askRating(ctx) {
  return ctx.reply(
    `Насколько *точно* описание тебя?\n\n1 — совсем не похоже, 5 — очень точно`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        ['1', '2', '3', '4', '5'].map(n => Markup.button.callback(n, `rating_${n}`)),
      ]),
    }
  );
}

function askBestSection(ctx) {
  return ctx.reply(
    `Какой раздел описал тебя *точнее всего*?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Портрет личности', 'section_personality')],
        [Markup.button.callback('Как ты любишь / паттерны в любви', 'section_love')],
        [Markup.button.callback('Деньги и карьера', 'section_money')],
        [Markup.button.callback('Семья', 'section_family')],
        [Markup.button.callback('7-летние циклы жизни', 'section_cycles')],
        [Markup.button.callback('Судьба и предназначение', 'section_destiny')],
      ]),
    }
  );
}

function askMotivation(ctx) {
  return ctx.reply(
    `*Зачем* ты пришёл к этому сервису?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Просто интересно', 'motiv_curious')],
        [Markup.button.callback('Хотел лучше понять себя', 'motiv_self')],
        [Markup.button.callback('Есть конкретный вопрос', 'motiv_question')],
        [Markup.button.callback('Посоветовали', 'motiv_recommend')],
      ]),
    }
  );
}

function askTrust(ctx) {
  return ctx.reply(
    `Ты *доверяешь* результату?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Да, верю', 'trust_yes')],
        [Markup.button.callback('Скорее да', 'trust_mostly')],
        [Markup.button.callback('Скорее нет', 'trust_mostly_no')],
        [Markup.button.callback('Нет', 'trust_no')],
      ]),
    }
  );
}

function askTransparency(ctx) {
  return ctx.reply(
    `Важно ли тебе понимать, *на основе чего* строится анализ?\n\nХочешь ли знать метод и логику — или достаточно просто результата?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Да, хочу понимать метод', 'transp_yes')],
        [Markup.button.callback('Нет, мне важен результат', 'transp_no')],
        [Markup.button.callback('Не думал об этом', 'transp_neutral')],
      ]),
    }
  );
}

function askShare(ctx) {
  return ctx.reply(
    `Ты бы *отправил* свой результат другу?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Да, уже отправил / отправлю', 'share_yes')],
        [Markup.button.callback('Зависит от того, что там', 'share_maybe')],
        [Markup.button.callback('Нет', 'share_no')],
      ]),
    }
  );
}

function askPrice(ctx) {
  return ctx.reply(
    `Ты бы *купил* такой анализ?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Да, купил бы', 'price_yes')],
        [Markup.button.callback('Скорее да', 'price_maybe')],
        [Markup.button.callback('Скорее нет', 'price_probably_no')],
        [Markup.button.callback('Нет', 'price_no')],
      ]),
    }
  );
}

function askPriorTools(ctx) {
  return ctx.reply(
    `Пользовался раньше чем-то *похожим*?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('MBTI / Gallup / Strengths', 'prior_mbti')],
        [Markup.button.callback('Астрология', 'prior_astro')],
        [Markup.button.callback('Нумерология', 'prior_num')],
        [Markup.button.callback('Ничего похожего', 'prior_none')],
        [Markup.button.callback('Несколько из этого', 'prior_many')],
      ]),
    }
  );
}

// ─── Команды ─────────────────────────────────────────────────────────────────

bot.start((ctx) => {
  clearSession(ctx.from.id);
  ctx.reply(
    `Привет, ${ctx.from.first_name}! 👋\n\n` +
    `Это форма обратной связи для тестовой группы *Паспорта Жизни*.\n\n` +
    `11 коротких вопросов — займёт около 3 минут. Поможет сделать сервис лучше.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('Начать ✍️', 'start_feedback'),
      ]),
    }
  );
});

bot.command('feedback', (ctx) => startFlow(ctx));

// ─── Старт флоу ──────────────────────────────────────────────────────────────

bot.action('start_feedback', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText(
    `Привет, ${ctx.from.first_name}! 👋\n\nОтлично, начинаем.`,
    { parse_mode: 'Markdown' }
  );
  startFlow(ctx);
});

// ─── 1. Дочитал до конца? ─────────────────────────────────────────────────────

const readallLabels = {
  readall_yes:     'Да, всё прочитал',
  readall_partial: 'Частично',
  readall_no:      'Нет, бросил на середине',
};

for (const [action, label] of Object.entries(readallLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.readall = label;
    session.step = 'emotion';
    ctx.editMessageText(`Дочитал до конца?\n✅ ${label}`);
    askEmotion(ctx);
  });
}

// ─── 2. Что почувствовал? ─────────────────────────────────────────────────────

const emotionLabels = {
  emotion_recognition: 'Узнавание — "это точно я"',
  emotion_surprise:    'Удивление',
  emotion_skeptic:     'Скорее скепсис',
  emotion_mixed:       'Смешанное',
};

for (const [action, label] of Object.entries(emotionLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.emotion = label;
    session.step = 'rating';
    ctx.editMessageText(`Что почувствовал?\n✅ ${label}`);
    askRating(ctx);
  });
}

// ─── 3. Точность (1–5) ───────────────────────────────────────────────────────

for (let i = 1; i <= 5; i++) {
  bot.action(`rating_${i}`, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.rating = i;
    session.step = 'best_section';
    ctx.editMessageText(`Точность описания?\n⭐ ${i}/5`);
    askBestSection(ctx);
  });
}

// ─── 4. Лучший раздел ────────────────────────────────────────────────────────

const sectionLabels = {
  section_personality: 'Портрет личности',
  section_love:        'Как ты любишь / паттерны в любви',
  section_money:       'Деньги и карьера',
  section_family:      'Семья',
  section_cycles:      '7-летние циклы жизни',
  section_destiny:     'Судьба и предназначение',
};

for (const [action, label] of Object.entries(sectionLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.best_section = label;
    session.step = 'motivation';
    ctx.editMessageText(`Самый точный раздел?\n✅ ${label}`);
    askMotivation(ctx);
  });
}

// ─── 5. Зачем пришёл? ────────────────────────────────────────────────────────

const motivLabels = {
  motiv_curious:   'Просто интересно',
  motiv_self:      'Хотел лучше понять себя',
  motiv_question:  'Есть конкретный вопрос',
  motiv_recommend: 'Посоветовали',
};

for (const [action, label] of Object.entries(motivLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.motivation = label;
    session.step = 'miss';
    ctx.editMessageText(`Зачем пришёл?\n✅ ${label}`);
    ctx.reply(
      `А что *не зашло* или показалось слишком общим, банальным, "не про тебя"?\n\nНапиши в свободной форме.`,
      { parse_mode: 'Markdown' }
    );
  });
}

// ─── 7. Доверие ──────────────────────────────────────────────────────────────

const trustLabels = {
  trust_yes:       'Да, верю',
  trust_mostly:    'Скорее да',
  trust_mostly_no: 'Скорее нет',
  trust_no:        'Нет',
};

for (const [action, label] of Object.entries(trustLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.trust = label;
    session.step = 'transparency';
    ctx.editMessageText(`Доверяешь результату?\n✅ ${label}`);
    askTransparency(ctx);
  });
}

// ─── 8. Прозрачность метода ──────────────────────────────────────────────────

const transpLabels = {
  transp_yes:     'Да, хочу понимать метод',
  transp_no:      'Нет, мне важен результат',
  transp_neutral: 'Не думал об этом',
};

for (const [action, label] of Object.entries(transpLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.transparency = label;
    session.step = 'share';
    ctx.editMessageText(`Важно ли понимать основу анализа?\n✅ ${label}`);
    askShare(ctx);
  });
}

// ─── 9. Поделился бы ─────────────────────────────────────────────────────────

const shareLabels = {
  share_yes:   'Да, уже отправил / отправлю',
  share_maybe: 'Зависит от того, что там',
  share_no:    'Нет',
};

for (const [action, label] of Object.entries(shareLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.share = label;
    session.step = 'price';
    ctx.editMessageText(`Отправил бы другу?\n✅ ${label}`);
    askPrice(ctx);
  });
}

// ─── 10. Цена ────────────────────────────────────────────────────────────────

const priceLabels = {
  price_yes:        'Да, купил бы',
  price_maybe:      'Скорее да',
  price_probably_no:'Скорее нет',
  price_no:         'Нет',
};

for (const [action, label] of Object.entries(priceLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.price = label;
    session.step = 'prior_tools';
    ctx.editMessageText(`Готов заплатить?\n✅ ${label}`);
    askPriorTools(ctx);
  });
}

// ─── 11. Опыт с похожим ──────────────────────────────────────────────────────

const priorLabels = {
  prior_mbti:  'MBTI / Gallup / Strengths',
  prior_astro: 'Астрология',
  prior_num:   'Нумерология',
  prior_none:  'Ничего похожего',
  prior_many:  'Несколько из этого',
};

for (const [action, label] of Object.entries(priorLabels)) {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.data.prior_tools = label;
    session.step = 'extra';
    ctx.editMessageText(`Опыт с похожим?\n✅ ${label}`);
    ctx.reply(
      `Последнее — есть *что-то ещё*, что хочется сказать? Мысли, пожелания, вопросы.\n\nЕсли нет — нажми «Готово».`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('Всё сказал, готово ✓', 'skip_extra'),
        ]),
      }
    );
  });
}

bot.action('skip_extra', (ctx) => {
  ctx.answerCbQuery();
  const session = getSession(ctx.from.id);
  session.data.extra = '';
  finalizeFeedback(ctx, session);
});

// ─── Текстовые ответы ─────────────────────────────────────────────────────────

bot.on('text', (ctx) => {
  const session = getSession(ctx.from.id);
  const text = ctx.message.text.trim();

  if (!session.step) {
    ctx.reply(`Чтобы оставить фидбек, нажми /feedback`);
    return;
  }

  switch (session.step) {
    case 'miss': {
      session.data.miss = text;
      session.step = 'trust';
      askTrust(ctx);
      break;
    }
    case 'extra': {
      session.data.extra = text;
      finalizeFeedback(ctx, session);
      break;
    }
    default:
      break;
  }
});

// ─── Финал ───────────────────────────────────────────────────────────────────

function finalizeFeedback(ctx, session) {
  const { id: userId, username, first_name } = ctx.from;
  const filename = saveFeedback(userId, username, first_name, session.data);

  ctx.reply(
    `Огромное спасибо! 🙏\n\nТвой фидбек сохранён.\n\nЕсли появятся ещё мысли — просто напиши /feedback.`,
    { parse_mode: 'Markdown' }
  );

  if (ADMIN_CHAT) {
    bot.telegram
      .sendMessage(ADMIN_CHAT, formatForAdmin(first_name, username, session.data), { parse_mode: 'Markdown' })
      .catch(err => console.error('[BOT] Ошибка пересылки:', err.message));
  }

  console.log(`[FEEDBACK] ${filename}`);
  clearSession(userId);
}

// ─── Запуск ──────────────────────────────────────────────────────────────────

bot.launch()
  .then(() => console.log('[BOT] Telegram feedback bot запущен'))
  .catch(err => {
    console.error('[BOT] Ошибка запуска:', err.message);
    process.exit(1);
  });

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
