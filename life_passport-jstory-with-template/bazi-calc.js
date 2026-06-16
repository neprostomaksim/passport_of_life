'use strict';

const https = require('https');

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STEMS        = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const STEM_NAMES   = ['Ян-Дерево','Инь-Дерево','Ян-Огонь','Инь-Огонь','Ян-Земля',
                      'Инь-Земля','Ян-Металл','Инь-Металл','Ян-Вода','Инь-Вода'];
const BRANCHES     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const BRANCH_NAMES = ['Крыса','Бык','Тигр','Кролик','Дракон','Змея',
                      'Лошадь','Коза','Обезьяна','Петух','Собака','Свинья'];

const STEM_ELEMENT   = ['Дерево','Дерево','Огонь','Огонь','Земля',
                         'Земля','Металл','Металл','Вода','Вода'];
const BRANCH_ELEMENT = ['Вода','Земля','Дерево','Дерево','Земля','Огонь',
                         'Огонь','Земля','Металл','Металл','Земля','Вода'];

// Скрытые стволы каждой земной ветви [stemIdx, вес]
// Главная ци (主气), средняя ци (中气), остаточная ци (余气)
const BRANCH_HIDDEN = [
  [[8, 1.0]],                          // 子 Крыса:   癸Вода
  [[5, 0.6], [8, 0.3], [7, 0.1]],     // 丑 Бык:     己Земля, 癸Вода, 辛Металл
  [[0, 0.6], [2, 0.3], [4, 0.1]],     // 寅 Тигр:    甲Дерево, 丙Огонь, 戊Земля
  [[1, 1.0]],                          // 卯 Кролик:  乙Дерево
  [[4, 0.6], [1, 0.3], [8, 0.1]],     // 辰 Дракон:  戊Земля, 乙Дерево, 癸Вода
  [[2, 0.6], [6, 0.3], [4, 0.1]],     // 巳 Змея:    丙Огонь, 庚Металл, 戊Земля
  [[3, 0.6], [5, 0.4]],               // 午 Лошадь:  丁Огонь, 己Земля
  [[5, 0.6], [3, 0.3], [1, 0.1]],     // 未 Коза:    己Земля, 丁Огонь, 乙Дерево
  [[6, 0.6], [9, 0.3], [4, 0.1]],     // 申 Обезьяна:庚Металл, 壬Вода, 戊Земля
  [[7, 1.0]],                          // 酉 Петух:   辛Металл
  [[4, 0.6], [3, 0.3], [7, 0.1]],     // 戌 Собака:  戊Земля, 丁Огонь, 辛Металл
  [[9, 0.6], [0, 0.3]],               // 亥 Свинья:  壬Вода, 甲Дерево
];

// Ветви для каждого из 12 Ba-Zi месяцев (0=Тигр..11=Бык)
const JIE_BRANCH_IDX = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];

// Приблизительные даты 12 节 (Jie) термов, начинающих Ba-Zi месяцы
// Точность ±1 день для 1900–2100
// [calendarMonth, approxDay, название]
const JIE_APPROX = [
  [2,  4,  '立春'],  // Лиchun    → Тигр
  [3,  6,  '惊蛰'],  // Цзинчжэ  → Кролик
  [4,  5,  '清明'],  // Цинмин   → Дракон
  [5,  6,  '立夏'],  // Лися     → Змея
  [6,  6,  '芒种'],  // Манчжун  → Лошадь
  [7,  7,  '小暑'],  // Сяошу    → Коза
  [8,  7,  '立秋'],  // Лицю     → Обезьяна
  [9,  8,  '白露'],  // Байлу    → Петух
  [10, 8,  '寒露'],  // Ханьлу   → Собака
  [11, 7,  '立冬'],  // Лидун    → Свинья
  [12, 7,  '大雪'],  // Дасюэ    → Крыса
  [1,  6,  '小寒'],  // Сяохань  → Бык (январь СЛЕДУЮЩЕГО года)
];

// ═══════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════

// Юлианский день (проверено: toJDN(2000,1,1) = 2451545)
function toJDN(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day
    + Math.floor((153 * m + 2) / 5)
    + 365 * y
    + Math.floor(y / 4)
    - Math.floor(y / 100)
    + Math.floor(y / 400)
    - 32045;
}

function jdnToDate(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day:   e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year:  100 * b + d - 4800 + Math.floor(m / 10),
  };
}

function makePillar(stemIdx, branchIdx) {
  stemIdx   = ((stemIdx   % 10) + 10) % 10;
  branchIdx = ((branchIdx % 12) + 12) % 12;
  return {
    stemIdx, branchIdx,
    stem:          STEMS[stemIdx],
    branch:        BRANCHES[branchIdx],
    stemName:      STEM_NAMES[stemIdx],
    branchName:    BRANCH_NAMES[branchIdx],
    stemElement:   STEM_ELEMENT[stemIdx],
    branchElement: BRANCH_ELEMENT[branchIdx],
    ganzhi:        `${STEMS[stemIdx]}${BRANCHES[branchIdx]}`,
  };
}

function ganzhiLabel(p) {
  return `${p.ganzhi} (${p.stemName} / ${p.branchName})`;
}

// 流年 — столп конкретного года (after 立春 ~Feb 4)
function getAnnualPillar(year) {
  const stemIdx   = ((year - 4) % 10 + 10) % 10;
  const branchIdx = ((year - 4) % 12 + 12) % 12;
  return makePillar(stemIdx, branchIdx);
}

// Список годовых столпов от (birthYear + 14) до endYear включительно
function getAnnualPillars(birthYear, endYear) {
  const result = [];
  for (let y = birthYear + 14; y <= endYear; y++) {
    const p = getAnnualPillar(y);
    result.push({ year: y, age: y - birthYear, ...p });
  }
  return result;
}

function formatMinutes(mins) {
  const n = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// СОЛНЕЧНЫЕ ТЕРМИНЫ (节气)
// ═══════════════════════════════════════════════════════════════

// JDN для Jie-терма по индексу (0–11) для китайского года chineseYear
// Для 小寒 (индекс 11) дата приходится на январь следующего календарного года
function jieTermJDN(jieIdx, chineseYear) {
  const [calMonth, approxDay] = JIE_APPROX[jieIdx];
  const calYear = (jieIdx === 11) ? chineseYear + 1 : chineseYear;
  return toJDN(calYear, calMonth, approxDay);
}

// Определяет китайский год по дате (меняется в 立春 ~4 февраля)
function getChineseYear(year, month, day) {
  const birthJDN  = toJDN(year, month, day);
  const liChunJDN = jieTermJDN(0, year);
  return (birthJDN >= liChunJDN) ? year : year - 1;
}

// Индекс Ba-Zi месяца (0=Тигр … 11=Бык) для данной даты
function getBaZiMonthIdx(year, month, day) {
  const birthJDN    = toJDN(year, month, day);
  const chineseYear = getChineseYear(year, month, day);

  // Ищем последний термин ≤ дате рождения (от 大雪 до 立春)
  let monthIdx = 0; // дефолт: Тигр
  for (let i = 10; i >= 0; i--) {
    if (birthJDN >= jieTermJDN(i, chineseYear)) {
      monthIdx = i;
      break;
    }
  }
  // Отдельно проверяем 小寒 (январь следующего года)
  if (birthJDN >= jieTermJDN(11, chineseYear)) {
    monthIdx = 11;
  }
  return monthIdx;
}

// ═══════════════════════════════════════════════════════════════
// СТОЛПЫ
// ═══════════════════════════════════════════════════════════════

function getYearPillar(year, month, day) {
  const cy       = getChineseYear(year, month, day);
  const stemIdx  = ((cy - 4) % 10 + 10) % 10;
  const branchIdx = ((cy - 4) % 12 + 12) % 12;
  return makePillar(stemIdx, branchIdx);
}

function getMonthPillar(year, month, day, yearStemIdx) {
  const monthIdx  = getBaZiMonthIdx(year, month, day);
  const branchIdx = JIE_BRANCH_IDX[monthIdx];

  // Таблица 五虎遁年: стволы месяца Тигра в зависимости от ствола года
  // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  const tigerStemStarts = [2, 4, 6, 8, 0];
  const tigerStem = tigerStemStarts[yearStemIdx % 5];
  const stemIdx   = (tigerStem + monthIdx) % 10;

  return makePillar(stemIdx, branchIdx);
}

function getDayPillar(jdn) {
  // Формула проверена: JDN 2451545 (01.01.2000) = 戊午 (ствол 4, ветвь 6)
  // (2451545 + 9) % 10 = 4 = 戊 ✓
  // (2451545 + 1) % 12 = 6 = 午 ✓
  return makePillar((jdn + 9) % 10, (jdn + 1) % 12);
}

function getHourPillar(solarMinutes, dayStemIdx) {
  // Определяем ветвь часа
  const t = ((Math.round(solarMinutes) % 1440) + 1440) % 1440;
  const h = t / 60;
  let branchIdx;
  if (h >= 23 || h < 1) {
    branchIdx = 0; // 子 Крыса 23:00–01:00
  } else {
    branchIdx = Math.floor((h + 1) / 2); // 丑=1 … 亥=11
  }

  // Таблица 五鼠遁日: ствол часа Крысы в зависимости от ствола дня
  // 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬
  const ratStemStarts = [0, 2, 4, 6, 8];
  const ratStem = ratStemStarts[dayStemIdx % 5];
  const stemIdx = (ratStem + branchIdx) % 10;

  return makePillar(stemIdx, branchIdx);
}

// ═══════════════════════════════════════════════════════════════
// ВЗАИМОДЕЙСТВИЕ ЭЛЕМЕНТОВ (五行关系) — вспомогательные функции
// ═══════════════════════════════════════════════════════════════

const ELEM_ORDER_RU = ['Дерево', 'Огонь', 'Земля', 'Металл', 'Вода'];
const ELEM_IDX_MAP  = { 'Дерево': 0, 'Огонь': 1, 'Земля': 2, 'Металл': 3, 'Вода': 4 };

function elemProduces(a, b) { return (ELEM_IDX_MAP[a] + 1) % 5 === ELEM_IDX_MAP[b]; }
function elemControls(a, b) { return (ELEM_IDX_MAP[a] + 2) % 5 === ELEM_IDX_MAP[b]; }
function producerOf(elem)   { return ELEM_ORDER_RU[(ELEM_IDX_MAP[elem] + 4) % 5]; }
function producedBy(elem)   { return ELEM_ORDER_RU[(ELEM_IDX_MAP[elem] + 1) % 5]; }
function controllerOf(elem) { return ELEM_ORDER_RU[(ELEM_IDX_MAP[elem] + 3) % 5]; }
function controlledBy(elem) { return ELEM_ORDER_RU[(ELEM_IDX_MAP[elem] + 2) % 5]; }

// ═══════════════════════════════════════════════════════════════
// БАЛАНС ЭЛЕМЕНТОВ
// ═══════════════════════════════════════════════════════════════

function calcElementBalance(pillars) {
  const elems = { Дерево: 0, Огонь: 0, Земля: 0, Металл: 0, Вода: 0 };
  pillars.forEach(({ stemIdx, branchIdx }) => {
    // Ствол: вес 1.5
    elems[STEM_ELEMENT[stemIdx]] += 1.5;
    // Скрытые стволы ветви
    BRANCH_HIDDEN[branchIdx].forEach(([hStem, w]) => {
      elems[STEM_ELEMENT[hStem]] += w;
    });
  });
  const total = Object.values(elems).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries(elems).map(([k, v]) => [k, Math.round(v / total * 100)])
  );
}

// ═══════════════════════════════════════════════════════════════
// СИЛА ГОСПОДИНА ДНЯ (旺弱)
// ═══════════════════════════════════════════════════════════════

// pillars = [yearPillar, monthPillar, dayPillar, hourPillar]
function calcDayMasterStrength(pillars) {
  const dmElem         = STEM_ELEMENT[pillars[2].stemIdx];
  const monthBranchIdx = pillars[1].branchIdx;

  // Основная ци месячной ветви → сезонный элемент
  const seasonStemIdx = BRANCH_HIDDEN[monthBranchIdx][0][0];
  const seasonElem    = STEM_ELEMENT[seasonStemIdx];

  // Статус ГД в текущем сезоне (旺相休囚死)
  let monthStatus;
  if (seasonElem === dmElem)                monthStatus = '旺';
  else if (elemProduces(seasonElem, dmElem)) monthStatus = '相';
  else if (elemProduces(dmElem, seasonElem)) monthStatus = '休';
  else if (elemControls(dmElem, seasonElem)) monthStatus = '囚';
  else                                       monthStatus = '死';

  const BASE = { '旺': 3, '相': 2, '休': 0, '囚': -1, '死': -2 };
  let score  = BASE[monthStatus];

  // Стволы остальных трёх столпов
  [0, 1, 3].forEach(i => {
    const e = STEM_ELEMENT[pillars[i].stemIdx];
    if (e === dmElem)                score += 1.0;   // 比劫
    else if (elemProduces(e, dmElem)) score += 1.0;   // 印
    else if (elemControls(e, dmElem)) score -= 1.0;   // 官杀
  });

  // Скрытые стволы всех четырёх ветвей (сниженный вес)
  pillars.forEach((p, i) => {
    const w = (i === 1) ? 0.3 : 0.5; // месячная ветвь уже частично учтена
    BRANCH_HIDDEN[p.branchIdx].forEach(([si, hw]) => {
      const e = STEM_ELEMENT[si];
      if (e === dmElem)                score += hw * w;
      else if (elemProduces(e, dmElem)) score += hw * w;
      else if (elemControls(e, dmElem)) score -= hw * w;
    });
  });

  const rounded = Math.round(score * 10) / 10;
  let strength, label;
  if      (rounded >= 3.5)  { strength = 'strong';         label = 'Сильный'; }
  else if (rounded >= 1.0)  { strength = 'moderate-strong'; label = 'Умеренно сильный'; }
  else if (rounded >= -1.0) { strength = 'moderate-weak';   label = 'Умеренно слабый'; }
  else                      { strength = 'weak';            label = 'Слабый'; }

  const isStrong = strength === 'strong' || strength === 'moderate-strong';

  // Благоприятные (用神) и неблагоприятные (忌神) элементы
  const favorable   = isStrong
    ? [producedBy(dmElem), controlledBy(dmElem), controllerOf(dmElem)]
    : [producerOf(dmElem), dmElem];
  const unfavorable = isStrong
    ? [producerOf(dmElem), dmElem]
    : [controllerOf(dmElem), controlledBy(dmElem)];

  return { score: rounded, strength, label, monthStatus, seasonElem, favorable, unfavorable };
}

// ═══════════════════════════════════════════════════════════════
// СПЕЦИАЛЬНЫЕ ЗВЁЗДЫ (神煞)
// ═══════════════════════════════════════════════════════════════

// 桃花 / 咸池 (Цветок персика) — по годовой и дневной ветви
const PEACH_BLOSSOM = {
   2: 3,  6: 3, 10: 3,   // 寅午戌 → 卯(3)
   8: 9,  0: 9,  4: 9,   // 申子辰 → 酉(9)
   5: 6,  9: 6,  1: 6,   // 巳酉丑 → 午(6)
  11: 0,  3: 0,  7: 0,   // 亥卯未 → 子(0)
};

// 天乙贵人 (Небесный благодетель) — по дневному стволу
const NOBLE_STAR = {
  0: [1, 7], 4: [1, 7], 6: [1, 7],  // 甲戊庚 → 丑(1)未(7)
  1: [0, 8], 5: [0, 8],              // 乙己   → 子(0)申(8)
  2: [11, 9], 3: [11, 9],            // 丙丁   → 亥(11)酉(9)
  8: [3, 5],  9: [3, 5],             // 壬癸   → 卯(3)巳(5)
  7: [6, 2],                         // 辛     → 午(6)寅(2)
};

// 驿马 (Конь странника) — по годовой и дневной ветви
const TRAVEL_HORSE = {
   8: 2,  0: 2,  4: 2,   // 申子辰 → 寅(2)
   2: 8,  6: 8, 10: 8,   // 寅午戌 → 申(8)
   5: 11, 9: 11, 1: 11,  // 巳酉丑 → 亥(11)
  11: 5,  3: 5,  7: 5,   // 亥卯未 → 巳(5)
};

// 华盖 (Артистический навес / одиночество) — по годовой и дневной ветви
const ART_CANOPY = {
   8: 4,  0: 4,  4: 4,   // 申子辰 → 辰(4)
   2: 10, 6: 10, 10: 10, // 寅午戌 → 戌(10)
   5: 1,  9: 1,  1: 1,   // 巳酉丑 → 丑(1)
  11: 7,  3: 7,  7: 7,   // 亥卯未 → 未(7)
};

// 羊刃 (Клинок) — по дневному стволу (только Ян-стволы)
const GOAT_BLADE = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 甲→卯 丙→午 戊→午 庚→酉 壬→子

const P_NAMES = ['Годовом', 'Месячном', 'Дневном', 'Часовом'];

function calcSpecialStars(pillars) {
  const branchIdxs = pillars.map(p => p.branchIdx);
  const yearBranch = pillars[0].branchIdx;
  const dayBranch  = pillars[2].branchIdx;
  const dayStem    = pillars[2].stemIdx;
  const stars      = [];

  function findInChart(targetBranches) {
    return targetBranches
      .filter(b => branchIdxs.includes(b))
      .map(b => P_NAMES[branchIdxs.indexOf(b)]);
  }

  // 桃花 ─────────────────────────────────────────────────────
  const pbBranches = [...new Set([PEACH_BLOSSOM[yearBranch], PEACH_BLOSSOM[dayBranch]].filter(x => x != null))];
  const pbIn = findInChart(pbBranches);
  if (pbIn.length) {
    stars.push({
      name: '桃花 (Цветок персика)', key: 'peach_blossom',
      pillars: pbIn,
      meaning: 'Природная привлекательность и харизма. Яркая романтическая энергия — притяжение к людям и от людей. Может означать романтическую удачу или рассеянность чувств.',
    });
  }

  // 天乙贵人 ──────────────────────────────────────────────────
  const nsIn = findInChart(NOBLE_STAR[dayStem] || []);
  if (nsIn.length) {
    stars.push({
      name: '天乙贵人 (Небесный благодетель)', key: 'noble_star',
      pillars: nsIn,
      meaning: 'Помощь от авторитетных людей в нужный момент. Наставники, покровители, защита в трудностях. Чем больше в карте — тем сильнее поддержка судьбы.',
    });
  }

  // 驿马 ──────────────────────────────────────────────────────
  const thBranches = [...new Set([TRAVEL_HORSE[yearBranch], TRAVEL_HORSE[dayBranch]].filter(x => x != null))];
  const thIn = findInChart(thBranches);
  if (thIn.length) {
    stars.push({
      name: '驿马 (Конь странника)', key: 'travel_horse',
      pillars: thIn,
      meaning: 'Энергия движения, перемен и путешествий. Успех через смену места, работу с иностранцами, частые поездки. Трудно оставаться на одном месте — это норма, а не недостаток.',
    });
  }

  // 华盖 ──────────────────────────────────────────────────────
  const acBranches = [...new Set([ART_CANOPY[yearBranch], ART_CANOPY[dayBranch]].filter(x => x != null))];
  const acIn = findInChart(acBranches);
  if (acIn.length) {
    stars.push({
      name: '华盖 (Артистический навес)', key: 'art_canopy',
      pillars: acIn,
      meaning: 'Художественный дар, склонность к уединению, духовности и глубокому творчеству. Уникальный внутренний мир. Может давать периоды одиночества как необходимое условие роста.',
    });
  }

  // 羊刃 ──────────────────────────────────────────────────────
  const gbBranch = GOAT_BLADE[dayStem];
  if (gbBranch != null && branchIdxs.includes(gbBranch)) {
    const gbIn = findInChart([gbBranch]);
    stars.push({
      name: '羊刃 (Клинок)', key: 'goat_blade',
      pillars: gbIn,
      meaning: 'Острая и интенсивная личная энергия. Решительность, мужество, склонность к риску. При грамотном использовании — большая сила; без контроля — резкость и конфликтность.',
    });
  }

  return stars;
}

// ═══════════════════════════════════════════════════════════════
// ВЗАИМОДЕЙСТВИЯ СТОЛПОВ (合冲刑)
// ═══════════════════════════════════════════════════════════════

// 天干五合
const STEM_COMBO_MAP = {
  '0-5': 'Земля', '1-6': 'Металл', '2-7': 'Вода', '3-8': 'Дерево', '4-9': 'Огонь',
};

// 地支六合
const BRANCH_SIX_HARMONY = {
  '0-1':  'Земля',   // 子丑
  '2-11': 'Дерево',  // 寅亥
  '3-10': 'Огонь',   // 卯戌
  '4-9':  'Металл',  // 辰酉
  '5-8':  'Вода',    // 巳申
  '6-7':  'Огонь',   // 午未
};

// 地支三合
const BRANCH_THREE_HARMONY = [
  { branches: [8, 0, 4],   elem: 'Вода',   name: '申子辰' },
  { branches: [2, 6, 10],  elem: 'Огонь',  name: '寅午戌' },
  { branches: [5, 9, 1],   elem: 'Металл', name: '巳酉丑' },
  { branches: [11, 3, 7],  elem: 'Дерево', name: '亥卯未' },
];

// 地支六冲
const BRANCH_SIX_CONFLICT = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];

// 地支相刑
const BRANCH_PUNISHMENT = [
  { branches: [2, 5, 8],  name: '寅巳申 тройное наказание',  severity: 'severe' },
  { branches: [1, 7, 10], name: '丑未戌 тройное наказание',  severity: 'severe' },
  { branches: [0, 3],     name: '子卯 взаимное наказание',    severity: 'moderate' },
];

function calcInteractions(pillars) {
  const pn = ['Год', 'Месяц', 'День', 'Час'];
  const bi = pillars.map(p => p.branchIdx);
  const result = { stemCombos: [], branchHarmonies: [], branchConflicts: [], branchPunishments: [] };

  // Стволы: 五合
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = pillars[i].stemIdx, b = pillars[j].stemIdx;
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (STEM_COMBO_MAP[key]) {
        result.stemCombos.push({
          pillars: [pn[i], pn[j]],
          stems:   [pillars[i].stemName, pillars[j].stemName],
          element: STEM_COMBO_MAP[key],
        });
      }
    }
  }

  // Ветви: 六合
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const key = `${Math.min(bi[i], bi[j])}-${Math.max(bi[i], bi[j])}`;
      if (BRANCH_SIX_HARMONY[key]) {
        result.branchHarmonies.push({
          type: '六合', pillars: [pn[i], pn[j]],
          branches: [pillars[i].branchName, pillars[j].branchName],
          element: BRANCH_SIX_HARMONY[key],
        });
      }
    }
  }

  // Ветви: 三合 / 半合
  BRANCH_THREE_HARMONY.forEach(({ branches, elem, name }) => {
    const present = branches.filter(b => bi.includes(b));
    if (present.length >= 2) {
      result.branchHarmonies.push({
        type: present.length === 3 ? '三合' : '半合',
        pillars: present.map(b => `${pn[bi.indexOf(b)]}(${BRANCH_NAMES[b]})`),
        element: elem,
        name,
      });
    }
  });

  // Ветви: 六冲
  BRANCH_SIX_CONFLICT.forEach(([a, b]) => {
    const ai = bi.indexOf(a), bj = bi.indexOf(b);
    if (ai !== -1 && bj !== -1) {
      result.branchConflicts.push({
        pillars:  [pn[ai], pn[bj]],
        branches: [BRANCH_NAMES[a], BRANCH_NAMES[b]],
      });
    }
  });

  // Ветви: 刑
  BRANCH_PUNISHMENT.forEach(({ branches, name, severity }) => {
    const present = branches.filter(b => bi.includes(b));
    if (present.length >= 2) {
      result.branchPunishments.push({
        pillars:  present.map(b => `${pn[bi.indexOf(b)]}(${BRANCH_NAMES[b]})`),
        name, severity,
      });
    }
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════
// ТАКТЫ УДАЧИ (大运)
// ═══════════════════════════════════════════════════════════════

function getLuckyPillars(yearStemIdx, monthStemIdx, monthBranchIdx, gender, year, month, day) {
  // Направление: янь-год + мужчина OR инь-год + женщина → вперёд (顺)
  const yearIsYang = yearStemIdx % 2 === 0;
  const forward    = (yearIsYang && gender === 'male') || (!yearIsYang && gender === 'female');

  const currentMonthIdx = JIE_BRANCH_IDX.indexOf(monthBranchIdx);
  const birthJDN        = toJDN(year, month, day);
  const chineseYear     = getChineseYear(year, month, day);

  // Находим JDN ближайшего терма для расчёта возраста старта
  let targetJDN;
  if (forward) {
    const nextIdx = (currentMonthIdx + 1) % 12;
    if (nextIdx === 0) {
      targetJDN = jieTermJDN(0, chineseYear + 1); // следующая 立春
    } else if (currentMonthIdx === 10) {
      targetJDN = jieTermJDN(11, chineseYear);     // 大雪→小寒
    } else {
      targetJDN = jieTermJDN(nextIdx, chineseYear);
    }
  } else {
    // Назад: начало текущего месяца
    if (currentMonthIdx === 0) {
      targetJDN = jieTermJDN(0, chineseYear);      // текущая 立春
    } else if (currentMonthIdx === 11) {
      targetJDN = jieTermJDN(11, chineseYear - 1); // 小寒 предыдущего года
    } else {
      targetJDN = jieTermJDN(currentMonthIdx, chineseYear);
    }
  }

  const daysDiff    = Math.abs(targetJDN - birthJDN);
  const startYears  = daysDiff / 3;
  const startAge    = Math.floor(startYears);
  const startMonths = Math.round((startYears - startAge) * 12);

  // Генерируем 8 тактов
  const pillars = [];
  for (let i = 1; i <= 8; i++) {
    const offset    = forward ? i : -i;
    const stemIdx   = ((monthStemIdx + offset) % 10 + 10) % 10;
    const mIdx      = ((currentMonthIdx + offset) % 12 + 12) % 12;
    const branchIdx = JIE_BRANCH_IDX[mIdx];
    const sa        = startAge + (i - 1) * 10;
    pillars.push({
      ...makePillar(stemIdx, branchIdx),
      startAge:  sa,
      endAge:    sa + 9,
      startYear: year + sa,
    });
  }

  return { startAge, startMonths, forward, pillars };
}

// ═══════════════════════════════════════════════════════════════
// ГЕОКОДИРОВАНИЕ
// ═══════════════════════════════════════════════════════════════

async function geocodeCity(cityName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path:     `/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`,
      headers:  { 'User-Agent': 'BaZiCalc/1.0' },
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0) {
            resolve({ lon: parseFloat(json[0].lon), lat: parseFloat(json[0].lat) });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

// ═══════════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════════════════

async function calculateBaZi({ name, birthdate, birthtime, birthplace, gender, tzOffset }) {
  const [year, month, day] = birthdate.split('-').map(Number);
  const [hours, minutes]   = birthtime.split(':').map(Number);

  // Геокодируем город → долгота
  const geo = await geocodeCity(birthplace);
  const lon = geo ? geo.lon : null;

  // Часовой пояс: явный → из долготы → 0
  const tz = (tzOffset != null)
    ? Number(tzOffset)
    : (lon != null ? Math.round(lon / 15) : 0);

  // Истинное солнечное время
  const solarMins = lon != null
    ? hours * 60 + minutes + (lon - tz * 15) * 4
    : hours * 60 + minutes;

  // Если солнечное время переходит через полночь — корректируем дату
  let adjJDN = toJDN(year, month, day);
  if (solarMins < 0)    adjJDN -= 1;
  if (solarMins >= 1440) adjJDN += 1;

  // Четыре столпа
  const yearPillar  = getYearPillar(year, month, day);
  const monthPillar = getMonthPillar(year, month, day, yearPillar.stemIdx);
  const dayPillar   = getDayPillar(adjJDN);
  const hourPillar  = getHourPillar(solarMins, dayPillar.stemIdx);
  const pillars     = [yearPillar, monthPillar, dayPillar, hourPillar];

  // Баланс элементов
  const elementBalance = calcElementBalance(pillars);

  // Сила Господина дня
  const dayMasterStrength = calcDayMasterStrength(pillars);

  // Специальные звёзды
  const specialStars = calcSpecialStars(pillars);

  // Взаимодействия столпов
  const interactions = calcInteractions(pillars);

  // Такты удачи
  const luckyData  = getLuckyPillars(
    yearPillar.stemIdx, monthPillar.stemIdx, monthPillar.branchIdx,
    gender, year, month, day
  );

  // Текущий год и возраст
  const currentYear = new Date().getFullYear();
  const currentAge  = currentYear - year;
  const currentLP   = luckyData.pillars.find(p => currentAge >= p.startAge && currentAge < p.startAge + 10);

  // Столп текущего года (после 立春)
  const currentYearPillar = getYearPillar(currentYear, 2, 5);

  return {
    name, birthdate, birthtime, birthplace, gender,
    lon, tz,
    solarTime:           formatMinutes(solarMins),
    tzWarning:           lon != null && Math.abs(lon / 15 - tz) > 1,
    year:                yearPillar,
    month:               monthPillar,
    day:                 dayPillar,
    hour:                hourPillar,
    dayMaster:           { stemIdx: dayPillar.stemIdx, stem: dayPillar.stem,
                           name: dayPillar.stemName,  element: dayPillar.stemElement },
    elementBalance,
    dayMasterStrength,
    specialStars,
    interactions,
    luckyPillars:        luckyData,
    currentAge,
    currentLuckyPillar:  currentLP || null,
    currentYearPillar,
    currentYear,
  };
}

// ═══════════════════════════════════════════════════════════════
// ФОРМАТИРОВАНИЕ В ТЕКСТ ДЛЯ ПРОМПТА
// ═══════════════════════════════════════════════════════════════

function formatChart(chart) {
  const {
    name, birthdate, birthtime, birthplace, gender,
    lon, tz, solarTime, tzWarning,
    year, month, day, hour, dayMaster,
    elementBalance, dayMasterStrength, specialStars, interactions,
    luckyPillars, currentAge, currentLuckyPillar, currentYearPillar, currentYear,
  } = chart;

  const lines = [];
  lines.push(`════════════════════════════════════`);
  lines.push(`РАССЧИТАННАЯ КАРТА БА-ЦЗЫ`);
  lines.push(`════════════════════════════════════`);
  lines.push(`Имя:              ${name}`);
  lines.push(`Дата рождения:    ${birthdate}`);
  lines.push(`Время (гражд.):   ${birthtime}`);
  lines.push(`Место:            ${birthplace}`);
  lines.push(`Пол:              ${gender === 'female' ? 'Женский' : 'Мужской'}`);
  if (lon != null) {
    lines.push(`Долгота:          ${lon.toFixed(2)}° (UTC${tz >= 0 ? '+' : ''}${tz})`);
    lines.push(`Солнечное время:  ${solarTime}`);
    if (tzWarning) {
      lines.push(`⚠ Часовой пояс оценён автоматически. Если место использовало нестандартный ЧП — уточните вручную.`);
    }
  }
  lines.push(``);
  lines.push(`ЧЕТЫРЕ СТОЛПА:`);
  lines.push(`  Годовой:    ${ganzhiLabel(year)}    [род, социальный образ]`);
  lines.push(`  Месячный:   ${ganzhiLabel(month)}   [среда, карьера]`);
  lines.push(`  Дневной:    ${ganzhiLabel(day)}    [личность, партнёрство]`);
  lines.push(`  Часовой:    ${ganzhiLabel(hour)}   [внутренний мир, потенциал]`);
  lines.push(``);
  lines.push(`ГОСПОДИН ДНЯ (Day Master): ${dayMaster.stem} — ${dayMaster.name}`);
  lines.push(`Это фундаментальная природа человека.`);
  lines.push(``);
  lines.push(`БАЛАНС ПЯТИ ЭЛЕМЕНТОВ:`);
  const elemOrder = ['Дерево','Огонь','Земля','Металл','Вода'];
  elemOrder.forEach(elem => {
    const pct = elementBalance[elem] ?? 0;
    lines.push(`  ${elem}:  ${pct}%`);
  });
  lines.push(``);
  lines.push(`ДЕСЯТИЛЕТНИЕ ТАКТЫ УДАЧИ`);
  lines.push(`  Направление: ${luckyPillars.forward ? 'вперёд (顺)' : 'назад (逆)'}`);
  lines.push(`  Старт первого такта: ~${luckyPillars.startAge} лет ${luckyPillars.startMonths} мес.`);
  luckyPillars.pillars.forEach(p => {
    const mark = (currentLuckyPillar && p.startAge === currentLuckyPillar.startAge) ? ' ← ТЕКУЩИЙ' : '';
    lines.push(`  ${String(p.startAge).padStart(2)}–${p.endAge}  (${p.startYear}–${p.startYear + 9})   ${ganzhiLabel(p)}${mark}`);
  });
  lines.push(``);
  if (currentLuckyPillar) {
    lines.push(`ТЕКУЩИЙ ТАКТ УДАЧИ (${currentYear}, возраст ${currentAge}):`);
    lines.push(`  ${ganzhiLabel(currentLuckyPillar)}`);
  }
  lines.push(``);
  lines.push(`ВЛИЯНИЕ ТЕКУЩЕГО ГОДА ${currentYear}:`);
  lines.push(`  ${ganzhiLabel(currentYearPillar)}`);

  // ── Сила Господина дня ──────────────────────────────────
  if (dayMasterStrength) {
    lines.push(``);
    lines.push(`СИЛА ГОСПОДИНА ДНЯ (旺弱):`);
    lines.push(`  Статус: ${dayMasterStrength.label} (балл: ${dayMasterStrength.score})`);
    lines.push(`  Сезон: ${dayMasterStrength.seasonElem} → состояние ${dayMasterStrength.monthStatus}`);
    lines.push(`  Благоприятные элементы (用神): ${dayMasterStrength.favorable.join(', ')}`);
    lines.push(`  Неблагоприятные элементы (忌神): ${dayMasterStrength.unfavorable.join(', ')}`);
  }

  // ── Специальные звёзды ──────────────────────────────────
  if (specialStars && specialStars.length > 0) {
    lines.push(``);
    lines.push(`СПЕЦИАЛЬНЫЕ ЗВЁЗДЫ (神煞):`);
    specialStars.forEach(star => {
      lines.push(`  ${star.name} — в ${star.pillars.join(', ')} столпе`);
      lines.push(`    ${star.meaning}`);
    });
  }

  // ── Взаимодействия столпов ──────────────────────────────
  if (interactions) {
    const hasAny = interactions.stemCombos.length
      || interactions.branchHarmonies.length
      || interactions.branchConflicts.length
      || interactions.branchPunishments.length;

    if (hasAny) {
      lines.push(``);
      lines.push(`ВЗАИМОДЕЙСТВИЯ СТОЛПОВ (合冲刑):`);

      if (interactions.stemCombos.length) {
        lines.push(`  天干五合 (Гармония стволов):`);
        interactions.stemCombos.forEach(c =>
          lines.push(`    ${c.pillars[0]}+${c.pillars[1]}: ${c.stems.join('+')} → усиление ${c.element}`)
        );
      }

      if (interactions.branchHarmonies.length) {
        lines.push(`  地支合 (Гармония ветвей):`);
        interactions.branchHarmonies.forEach(h => {
          const ps = Array.isArray(h.pillars) ? h.pillars.join('+') : h.pillars;
          lines.push(`    ${h.type}: ${ps} → ${h.element}`);
        });
      }

      if (interactions.branchConflicts.length) {
        lines.push(`  六冲 (Конфликты ветвей):`);
        interactions.branchConflicts.forEach(c =>
          lines.push(`    ${c.pillars[0]}-${c.pillars[1]}: ${c.branches.join(' ↔ ')} — напряжение, резкие перемены`)
        );
      }

      if (interactions.branchPunishments.length) {
        lines.push(`  刑 (Наказания):`);
        interactions.branchPunishments.forEach(p =>
          lines.push(`    ${p.name} (${p.pillars.join(', ')}) — ${p.severity === 'severe' ? 'сильная' : 'умеренная'}刑`)
        );
      }
    }
  }

  lines.push(`════════════════════════════════════`);

  return lines.join('\n');
}

module.exports = { calculateBaZi, formatChart, getAnnualPillars, ganzhiLabel };
