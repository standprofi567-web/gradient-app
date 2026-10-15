// Gradient Pass: сезоны, уровни, награды, достижения и задания. Только данные и чистые функции.

const PMG_SEASONS = [
  { id: 's0-test', name: 'Тестовый', theme: 'sticker', starts: '2026-10-14', ends: '2026-11-03', scale: 1, test: true,
    aura: 'Голограмма', album: 'Стикербомб' },
  { id: 's1-cosmos', name: 'Стикербомб', theme: 'sticker', starts: '2026-11-05', ends: '2026-12-30', scale: 1,
    aura: 'Голограмма', album: 'Стикербомб' },
  { id: 's2-deep', name: 'Пиксель', theme: 'pixel', starts: '2027-01-11', ends: '2027-03-26', scale: 1.375,
    aura: 'Пиксельный нимб', album: 'Пиксель' },
  { id: 's3-neon', name: 'Хром', theme: 'chrome', starts: '2027-04-05', ends: '2027-05-26', scale: 0.94,
    aura: 'Хромовая звезда', album: 'Хром' }
];

function pmgDateOf(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function pmgIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Сезон на дату: идущий; иначе последний закончившийся (фаза «Итоги» / межсезонье); иначе первый.
function pmgSeasonAt(now) {
  const t = pmgIso(now || new Date());
  const cur = PMG_SEASONS.find((s) => t >= s.starts && t <= s.ends);
  if (cur) return { ...cur, phase: pmgSeasonPhase(cur, t) };
  const next = PMG_SEASONS.find((s) => s.starts > t);
  const past = PMG_SEASONS.filter((s) => s.ends < t).pop();
  if (past) return { ...past, phase: 'over', next: next || null };
  return { ...PMG_SEASONS[0], phase: 'soon' };
}

function pmgSeasonPhase(s, t) {
  const start = pmgDateOf(s.starts), end = pmgDateOf(s.ends), d = pmgDateOf(t);
  if ((d - start) / 864e5 < 7) return 'warmup';
  if ((end - d) / 864e5 < 7) return 'final';
  return 'main';
}

function pmgSeasonDaysLeft(s, now) {
  const end = pmgDateOf(s.ends); const d = new Date(now || Date.now()); d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end - d) / 864e5));
}

// ---------- Уровни ----------
function pmgLevelCost(level, scale) {
  const base = level <= 10 ? 300 : level <= 25 ? 400 : level <= 40 ? 500 : 600;
  return Math.round(base * scale / 50) * 50;
}
function pmgStarCost(scale) { return Math.max(1, Math.round(1000 * scale / 50) * 50); }

// {level, stars, into, need} — сколько набрано внутри текущего уровня и сколько нужно до следующего.
function pmgLevelInfo(xp, scale) {
  let level = 1, left = xp;
  while (level < 50) {
    const need = pmgLevelCost(level, scale);
    if (left < need) return { level, stars: 0, into: left, need, xp };
    left -= need; level++;
  }
  const sc = pmgStarCost(scale);
  return { level: 50, stars: Math.floor(left / sc), into: left % sc, need: sc, xp };
}

function pmgXpForLevel(level, scale) {
  let s = 0; for (let l = 1; l < level; l++) s += pmgLevelCost(l, scale); return s;
}

// ---------- Награды ----------
// kind: frame | title | theme | bgpack | skin | reaction | freeze | aura | badge | avatar | anim | sticker
const PMG_REWARDS = {
  1: [{ kind: 'frame', id: 'novice', name: 'Рамка «Новичок»' }, { kind: 'avatar', id: 'planet-1', name: 'Первый аватар' }],
  3: [{ kind: 'reaction', id: 'clap', name: 'Реакция «Хлопки»' }],
  5: [{ kind: 'theme', id: 'mint', name: 'Тема «Мята»' }],
  8: [{ kind: 'freeze', id: 'freeze', name: 'Заморозка' }],
  10: [{ kind: 'frame', id: 'bronze', name: 'Рамка «Бронза»' }, { kind: 'title', id: 'in', name: 'Титул «В деле»' }, { kind: 'badge', id: 'b10', name: 'Бронзовый значок сезона' }],
  12: [{ kind: 'bgpack', id: 'space', name: 'Пак фона «Стикеры»' }],
  15: [{ kind: 'theme', id: 'sunset', name: 'Тема «Закат»' }, { kind: 'reaction', id: 'rocket', name: 'Реакция «Ракета»' }],
  18: [{ kind: 'freeze', id: 'freeze', name: 'Заморозка' }],
  20: [{ kind: 'frame', id: 'silver', name: 'Рамка «Серебро»' }, { kind: 'title', id: 'stubborn', name: 'Титул «Упорный»' }],
  23: [{ kind: 'skin', id: 'notebook', name: 'Скин карточки «Тетрадь»' }],
  25: [{ kind: 'frame', id: 'wave', name: 'Рамка «Волна»' }, { kind: 'theme', id: 'midnight', name: 'Тема «Полночь»' }, { kind: 'aura', id: 'glow', name: 'Аура «Свечение»' }, { kind: 'badge', id: 'b25', name: 'Серебряный значок сезона' }],
  28: [{ kind: 'freeze', id: 'freeze', name: 'Заморозка' }],
  30: [{ kind: 'frame', id: 'gold', name: 'Рамка «Золото»' }, { kind: 'title', id: 'unstoppable', name: 'Титул «Неудержимый»' }],
  33: [{ kind: 'bgpack', id: 'chem', name: 'Пак фона «Химия»' }],
  35: [{ kind: 'reaction', id: 'crown', name: 'Реакция «Корона»' }],
  38: [{ kind: 'freeze', id: 'freeze', name: 'Заморозка' }],
  40: [{ kind: 'frame', id: 'platinum', name: 'Рамка «Платина»' }, { kind: 'anim', id: 'starfall', name: 'Анимация «Звездопад»' }, { kind: 'aura', id: 'orbit', name: 'Аура «Орбита»' }, { kind: 'badge', id: 'b40', name: 'Золотой значок сезона' }],
  43: [{ kind: 'skin', id: 'holo', name: 'Скин карточки «Голограмма»' }],
  45: [{ kind: 'theme', id: 'aurora', name: 'Тема «Аврора»' }],
  48: [{ kind: 'bgpack', id: 'formulas', name: 'Пак фона «Формулы»' }],
  50: [{ kind: 'frame', id: 'gradient', name: 'Рамка «Gradient»' }, { kind: 'title', id: 'legend', name: 'Титул «Легенда сезона»' }, { kind: 'badge', id: 'b50', name: 'Градиентный значок сезона' }, { kind: 'aura', id: 'season', name: 'Сезонная аура' }]
};

// 29 наклеек альбома «Космос» — на всех уровнях без крупной награды.
const PMG_STICKER_LEVELS = [];
for (let l = 1; l <= 50; l++) if (!PMG_REWARDS[l]) PMG_STICKER_LEVELS.push(l);
// Имена наклеек: 10 рисунков (как в gfx.js) × обычная / с блёстками / голо.
const PMG_STICKER_BASE = ['Смайлик', 'Звёздочка', 'Бабочка', 'Раскладушка', 'Диск', 'Сердечко', 'Молния', 'Карандаш', 'Линейка', 'Пятёрка'];
function pmgStickerNames(prefix) {
  const out = [];
  for (let i = 0; i < 29; i++) {
    const b = PMG_STICKER_BASE[i % 10], t = Math.floor(i / 10);
    out.push((prefix ? prefix + ' ' + b.toLowerCase() : b) + (t === 1 ? ' с блёстками' : t === 2 ? ' голо' : ''));
  }
  return out;
}
const PMG_STICKERS = { sticker: pmgStickerNames(''), pixel: pmgStickerNames('Пиксельный').map((x) => x.replace('Пиксельный звёздочка', 'Пиксельная звёздочка').replace('Пиксельный бабочка', 'Пиксельная бабочка').replace('Пиксельный раскладушка', 'Пиксельная раскладушка').replace('Пиксельный молния', 'Пиксельная молния').replace('Пиксельный линейка', 'Пиксельная линейка').replace('Пиксельный пятёрка', 'Пиксельная пятёрка')), chrome: pmgStickerNames('Хром:') };
PMG_STICKERS.cosmos = PMG_STICKERS.sticker;

function pmgRewardsAt(level, season) {
  if (PMG_REWARDS[level]) {
    return PMG_REWARDS[level].map((r) => r.kind === 'aura' && r.id === 'season' ? { ...r, name: 'Аура «' + season.aura + '»' } : r);
  }
  const i = PMG_STICKER_LEVELS.indexOf(level);
  const names = PMG_STICKERS[season.theme] || PMG_STICKERS.sticker;
  return [{ kind: 'sticker', id: 'st' + i, n: i, theme: season.theme, name: 'Наклейка «' + names[i] + '»' }];
}

// Что из наград уже открыто (по уровню текущего сезона и сохранённому навсегда).
function pmgUnlocked(level) {
  const out = { frame: ['none'], title: ['none'], theme: ['default'], bgpack: ['glyphs'], skin: ['default'], reaction: ['fire', 'power', 'wow'], aura: ['none'] };
  for (let l = 1; l <= level; l++) (PMG_REWARDS[l] || []).forEach((r) => { if (out[r.kind] && !out[r.kind].includes(r.id)) out[r.kind].push(r.id); });
  return out;
}

const PMG_FRAME_NAMES = { none: 'Без рамки', novice: 'Новичок', bronze: 'Бронза', silver: 'Серебро', wave: 'Волна', gold: 'Золото', platinum: 'Платина', gradient: 'Gradient' };
const PMG_TITLE_NAMES = { none: 'Без титула', in: 'В деле', stubborn: 'Упорный', unstoppable: 'Неудержимый', legend: 'Легенда сезона' };
const PMG_REACTIONS = { fire: 'Огонь', power: 'Сила', wow: 'Вау', clap: 'Хлопки', rocket: 'Ракета', crown: 'Корона' };

// ---------- Достижения ----------
const PMG_ACHIEVEMENTS = [
  { code: 'first', name: 'Старт', desc: 'первая оценка сезона', rarity: 'common', icon: 'flag' },
  { code: 'hattrick', name: 'Хет-трик', desc: '3 пятёрки за один день', rarity: 'common', icon: 'three' },
  { code: 'order', name: 'Порядок', desc: 'вся домашка недели сделана вовремя', rarity: 'common', icon: 'check' },
  { code: 'clean', name: 'Чистый лист', desc: 'неделя без пропусков', rarity: 'common', icon: 'page' },
  { code: 'team', name: 'Командный игрок', desc: 'группа выполнила общую цель, и ты в ней участвовал', rarity: 'common', icon: 'team' },
  { code: 'comeback3', name: 'Камбэк', desc: '3 камбэка за сезон', rarity: 'rare', icon: 'up' },
  { code: 'prepared', name: 'Подготовился', desc: 'задание «К проверочной» сделано, а за проверочную 5', rarity: 'rare', icon: 'book' },
  { code: 'polyglot', name: 'Полиглот', desc: 'оценки по 8 разным предметам за неделю', rarity: 'rare', icon: 'grid' },
  { code: 'iron', name: 'Железная серия', desc: 'огонёк 14 учебных дней', rarity: 'rare', icon: 'flame' },
  { code: 'five5', name: 'Пять из пяти', desc: '5 пятёрок подряд', rarity: 'rare', icon: 'five' },
  { code: 'above', name: 'Выше прошлого', desc: 'итоговая по предмету выше, чем в прошлой четверти', rarity: 'rare', icon: 'stairs' },
  { code: 'early', name: 'Ранняя пташка', desc: 'вся домашка на завтра отмечена до 18:00 пять учебных дней подряд', rarity: 'rare', icon: 'sun', secret: true },
  { code: 'week5', name: 'Неделя пятёрок', desc: 'за неделю только пятёрки, минимум 5 оценок', rarity: 'epic', icon: 'star' },
  { code: 'season_fire', name: 'Огонь сезона', desc: 'огонёк не гас весь сезон', rarity: 'epic', icon: 'flame2' },
  { code: 'no3', name: 'Без троек', desc: 'четверть без троек и двоек, минимум 15 оценок', rarity: 'epic', icon: 'shield' },
  { code: 'legend', name: 'Легенда', desc: '50-й уровень сезона', rarity: 'epic', icon: 'crown' }
];
const PMG_ACH_XP = { common: 50, rare: 150, epic: 300 };

// ---------- Задания ----------
const PMG_DAILY = {
  study: [
    { id: 's_any45', text: 'Получи любую оценку 4 или 5', xp: 40 },
    { id: 's_weak', text: 'Получи оценку по слабому предмету', xp: 60 },
    { id: 's_two', text: 'Получи две оценки за день', xp: 50 },
    { id: 's_five_low', text: 'Получи пятёрку там, где средний ниже 4,5', xp: 70 }
  ],
  hw: [
    { id: 'h_tomorrow', text: 'Отметь всю домашку на завтра до 22:00', xp: 50 },
    { id: 'h_overdue', text: 'Закрой одно просроченное задание', xp: 50 },
    { id: 'h_learn', text: 'Сделай задание «Выучить» или «К проверочной»', xp: 50 }
  ],
  easy: [
    { id: 'e_need', text: 'Посмотри, сколько пятёрок нужно по слабому предмету', xp: 40 },
    { id: 'e_cheer', text: 'Подбодри друга реакцией', xp: 40 },
    { id: 'e_sched', text: 'Открой расписание на завтра до 21:00', xp: 40 }
  ]
};
const PMG_WEEKLY = {
  easy: [
    { id: 'w_login4', text: 'Заходи в Gradient 4 учебных дня из 5', xp: 200, goal: 4 },
    { id: 'w_8daily', text: 'Выполни 8 заданий дня', xp: 200, goal: 8 }
  ],
  mid: [
    { id: 'w_hw_all', text: 'Сделай всю домашку недели вовремя', xp: 280 },
    { id: 'w_noabs', text: 'Неделя без пропусков', xp: 250 },
    { id: 'w_6subj', text: 'Получи оценки по 6 разным предметам', xp: 280, goal: 6 }
  ],
  hard: [
    { id: 'w_raise', text: 'Подними средний по слабому предмету на 0,15', xp: 350 },
    { id: 'w_5fives', text: 'Собери 5 пятёрок за неделю', xp: 350, goal: 5 },
    { id: 'w_test45', text: 'Напиши проверочную на 4 или 5', xp: 350, goal: 1 }
  ]
};
const PMG_QUEST_BY_ID = {};
[PMG_DAILY, PMG_WEEKLY].forEach((g) => Object.values(g).forEach((list) => list.forEach((q) => { PMG_QUEST_BY_ID[q.id] = q; })));

function pmgStreakMult(days) { return days >= 21 ? 1.4 : days >= 14 ? 1.3 : days >= 7 ? 1.2 : days >= 3 ? 1.1 : 1; }

if (typeof module !== 'undefined') {
  module.exports = { PMG_SEASONS, pmgSeasonAt, pmgLevelInfo, pmgLevelCost, pmgXpForLevel, pmgRewardsAt, pmgUnlocked, PMG_REWARDS, PMG_ACHIEVEMENTS, PMG_DAILY, PMG_WEEKLY, pmgStreakMult, pmgIso, pmgDateOf, PMG_STICKER_LEVELS };
}
