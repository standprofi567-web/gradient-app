// Интерфейс помогатора. Один и тот же код рисует:
//  • боковую панель справа на сайте дневника (mode = 'drawer', внутри Shadow DOM);
//  • отдельную вкладку расширения (mode = 'page').
// Данные берутся из хранилища: фон обновляет их сам, интерфейс только показывает.

const PMG_DAY = 86400000;
const PMG_WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const PMG_WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const PMG_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const PMG_DEFAULT_SETTINGS = { threshold: 0.55, studentId: null, hwMode: 'assigned', notify: true, keepAlive: true, theme: 'auto', bg: 'glyphs', v: 2 };
const PMG_LOGO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M16.95 7.05A7 7 0 1 0 19 12h-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.95" cy="7.05" r="1.9" fill="currentColor"/></svg>';
const PMG_TABS = [['overview', 'Сводка'], ['pass', 'Pass'], ['friends', 'Друзья'], ['health', 'Здоровье'], ['calendar', 'Календарь'], ['day', 'Уроки'], ['homework', 'Домашка'], ['subjects', 'Предметы'], ['absences', 'Пропуски'], ['finals', 'Итоги']];

const pmg = {
  root: null, mode: 'drawer', data: null, status: null,
  settings: { ...PMG_DEFAULT_SETTINGS }, done: {}, overrides: {},
  tab: 'overview', periodId: null, subjectId: null, whatIf: {}, target: {},
  showPast: false, hwView: 'days', day: null, moving: null,
  open: false, wrote: false, loading: false,
  game: null, profile: null, groups: [], boards: {}
};

const pmgReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pmgQ = (sel) => pmg.root.querySelector(sel);

function pmgStorageGet(keys) { return new Promise((r) => chrome.storage.local.get(keys, r)); }
function pmgStorageSet(obj) { return new Promise((r) => chrome.storage.local.set(obj, r)); }

function pmgToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function pmgHumanDay(d) {
  const diff = Math.round((d - pmgToday()) / PMG_DAY);
  const base = d.getDate() + ' ' + PMG_MONTHS[d.getMonth()];
  if (diff === 0) return 'Сегодня, ' + base;
  if (diff === 1) return 'Завтра, ' + base;
  if (diff === -1) return 'Вчера, ' + base;
  const wd = PMG_WEEKDAYS[d.getDay()];
  return wd[0].toUpperCase() + wd.slice(1) + ', ' + base;
}

function pmgDayAcc(d) {
  const diff = Math.round((d - pmgToday()) / PMG_DAY);
  if (diff === 1) return 'завтра';
  return ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'][d.getDay()];
}

function pmgShort(d) { return PMG_WD_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + PMG_MONTHS[d.getMonth()].slice(0, 3); }

function pmgShortDate(s) {
  const d = pmgParseDate(s);
  return d ? d.getDate() + ' ' + PMG_MONTHS[d.getMonth()].slice(0, 3) : s;
}

function pmgTime(s) { const m = /\s(\d{2}:\d{2})/.exec(s || ''); return m ? m[1] : ''; }

function pmgLinkify(text) {
  return pmgEsc(text).replace(/https?:\/\/[^\s<а-яёА-ЯЁ]+/g, (u) => '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, '').slice(0, 38) + (u.length > 46 ? '…' : '') + '</a> ').replace(/\n/g, '<br>');
}

function pmgIsoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// ---------- Данные для вида ----------

function pmgPeriods() { return pmg.data ? pmg.data.periods : []; }

function pmgCurrentPeriod() {
  const ps = pmgPeriods();
  return ps.find((p) => p.id === pmg.periodId) || pmgPickPeriod(ps, new Date()) || null;
}

function pmgStats(period) { return pmgSubjectStats(pmg.data.marks, pmg.data.subjects, period, pmg.settings.threshold); }

function pmgDaysLeft(period) {
  if (!period) return null;
  const t = pmgToday();
  if (t > period.to || t < period.from) return null;
  return Math.round((period.to - t) / PMG_DAY) + 1;
}

function pmgHomework() {
  return pmgBuildHomework(pmg.data.lessons, { mode: pmg.settings.hwMode, done: pmg.done, overrides: pmg.overrides })
    .concat(typeof pmgOwnHwList === 'function' ? pmgOwnHwList(pmg.ownHw, pmg.done) : []);
}

function pmgPeriodName(period) {
  if (!period) return '';
  return period.kind === 'year' ? 'за год' : 'за ' + period.name;
}

function pmgMarkChip(v, title, extra) {
  return '<span class="mark ' + pmgMarkClass(v) + (extra ? ' ' + extra : '') + '"' + (title ? ' data-tip="' + pmgEsc(title) + '"' : '') + '>' + v + '</span>';
}

function pmgIcon(name) {
  const p = {
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    report: '<rect x="4" y="3" width="16" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 15l2.5-3 2 2L16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    sun: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    auto: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    left: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    right: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  }[name];
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' + p + '</svg>';
}

// ---------- Отрисовка ----------

// Фон: редкие контурные «учебные» значки, почти прозрачные, с лёгким параллаксом за мышкой.
const PMG_GLYPHS = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  open: '<path d="M2 5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
  pencil: '<path d="M16 3l5 5L8 21H3v-5zM13 6l5 5"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
  square: '<path d="M3 21V4l17 17zM7 17v-4l4 4z"/>',
  atom: '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3M7 15h10"/>',
  pi: '<text x="12" y="17" text-anchor="middle" font-size="17" font-family="serif" stroke-width=".6">π</text>',
  sigma: '<text x="12" y="17.5" text-anchor="middle" font-size="17" font-family="serif" stroke-width=".6">Σ</text>',
  x2: '<text x="11" y="17" text-anchor="middle" font-size="14" font-style="italic" font-family="serif" stroke-width=".5">x²</text>',
  five: '<text x="12" y="17.5" text-anchor="middle" font-size="16" font-weight="700" stroke-width=".4">5</text>',
  sqrt: '<path d="M3 13h3l3 7 5-16h7"/>',
  planet: '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12.5" rx="11" ry="3.2" transform="rotate(-18 12 12)"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  rocket: '<path d="M12 2c3 2.5 4 6.5 3 11H9c-1-4.5 0-8.5 3-11zM9 13l-3 4 3-1M15 13l3 4-3-1M11 17l1 4 1-4"/><circle cx="12" cy="8" r="1.5"/>',
  moon: '<path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z"/>',
  ufo: '<ellipse cx="12" cy="14" rx="10" ry="3.5"/><path d="M7 12.5a5 5 0 0 1 10 0M8 19l-1.5 2.5M16 19l1.5 2.5"/>',
  hex: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="3.5"/>',
  drop: '<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z"/>',
  tube: '<path d="M9 2h6M10 2v15a2 2 0 0 0 4 0V2M10 11h4"/>',
  integral: '<text x="12" y="18" text-anchor="middle" font-size="19" font-family="serif" stroke-width=".6">∫</text>',
  abc: '<text x="12" y="16" text-anchor="middle" font-size="9" font-style="italic" font-family="serif" stroke-width=".4">a²+b²</text>'
};
const PMG_BG_PACKS = {
  space: { book: 'planet', pi: 'star', pencil: 'rocket', atom: 'planet', x2: 'star', ruler: 'moon', five: 'star', globe: 'ufo', square: 'rocket', sigma: 'moon', flask: 'star', cap: 'planet', open: 'ufo', sqrt: 'star' },
  chem: { book: 'flask', pi: 'drop', pencil: 'tube', x2: 'hex', ruler: 'tube', five: 'drop', globe: 'atom', square: 'hex', sigma: 'drop', cap: 'flask', open: 'hex', sqrt: 'tube' },
  formulas: { book: 'sigma', pencil: 'integral', atom: 'abc', ruler: 'sqrt', five: 'x2', globe: 'pi', square: 'integral', flask: 'abc', cap: 'sqrt', open: 'sigma' }
};
// [значок, x%, y%, размер, поворот, глубина]
const PMG_GLYPH_LAYOUT = [
  ['book', 6, 14, 30, -12, .6], ['pi', 22, 6, 22, 8, .3], ['pencil', 40, 18, 26, 20, .8], ['atom', 63, 9, 30, 0, .4],
  ['x2', 84, 16, 22, -6, .7], ['ruler', 93, 38, 30, 15, .3], ['five', 74, 34, 20, 10, .9], ['globe', 52, 42, 28, 0, .5],
  ['square', 12, 44, 28, -8, .8], ['sigma', 30, 60, 22, -10, .4], ['flask', 8, 76, 28, 6, .5], ['cap', 46, 74, 32, -4, .7],
  ['open', 70, 64, 32, 6, .3], ['sqrt', 90, 82, 24, -12, .6], ['book', 60, 92, 24, 18, .9], ['pencil', 24, 90, 22, -30, .5],
  ['pi', 96, 58, 18, 0, .8], ['five', 36, 34, 16, -14, .3]
];
function pmgBgfx() {
  const pack = PMG_BG_PACKS[(pmg.profile && pmg.profile.equipped && pmg.profile.equipped.bgpack) || ''] || {};
  return '<div class="bg-fx" aria-hidden="true">' + PMG_GLYPH_LAYOUT.map(([g0, x, y, size, rot, depth], i) => {
    const g = pack[g0] || g0;
    return '<span class="glyph" style="left:' + x + '%;top:' + y + '%;--d:' + depth + ';--r:' + rot + 'deg;--fd:' + (11 + (i % 5) * 2.3).toFixed(1) + 's;--fdl:-' + (i * 1.7).toFixed(1) + 's">' +
      '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '">' + PMG_GLYPHS[g] + '</svg></span>';
  }).join('') + '</div>';
}

// quiet — перерисовка из-за фонового обновления: без анимаций появления.
function pmgRender(keepScroll, quiet) {
  const panel = pmgQ('.panel');
  if (!panel) return;
  const oldSheet = pmgQ('.sheet');
  const scroll = keepScroll && oldSheet ? oldSheet.scrollTop : 0;
  const keepModal = pmgQ('.report-modal');
  if (keepModal) keepModal.remove();
  const oldTab = pmgQ('.tab.on');
  if (oldTab) pmg.lastTabRect = { x: oldTab.offsetLeft, y: oldTab.offsetTop, w: oldTab.offsetWidth, h: oldTab.offsetHeight };
  if (!pmg.data) {
    panel.innerHTML = pmgBgfx() + pmgHeader(null) + '<div class="state">' + pmgEmptyState() + '</div>';
    return;
  }
  pmg.quietRender = !!quiet;
  const period = pmgCurrentPeriod();
  const views = { overview: pmgOverview, pass: pmgPassView, friends: pmgFriendsView, health: pmgHealthView, calendar: pmgCalendarView, day: pmgDayView, homework: pmgHomeworkView, subjects: pmgSubjectsView, absences: pmgAbsencesView, finals: pmgFinalsView };
  const body = (views[pmg.tab] || pmgOverview)(period);
  const overlays = [...panel.querySelectorAll('.lvl-up, .gains-card')];
  panel.innerHTML = pmgBgfx() + pmgHeader(period) + pmgXpLine() + pmgUpdateBar() +
    '<div class="layout"><nav class="tabs" role="tablist"><span class="tab-sel" aria-hidden="true"></span>' +
    PMG_TABS.map(([k, l]) => '<button role="tab" class="tab' + (pmg.tab === k ? ' on' : '') + '" aria-selected="' + (pmg.tab === k) + '" data-act="tab" data-tab="' + k + '">' + l + '</button>').join('') +
    '</nav><main class="sheet' + (quiet ? ' quiet' : '') + ' tab-' + pmg.tab + '" tabindex="-1">' + body + '</main></div>' + pmgCropModal() +
    (typeof pmgOwnHwForm === 'function' ? pmgOwnHwForm() + pmgPhotoViewer() : '');
  const sheet = pmgQ('.sheet');
  if (scroll) sheet.scrollTop = scroll;
  if (keepModal) panel.appendChild(keepModal);
  overlays.forEach((o) => panel.appendChild(o));
  pmgAfterRender(quiet);
}

// Полоска «Вышло обновление»: скачать zip → распаковать поверх папки → перезапустить.
function pmgUpdateBar() {
  const u = pmg.update;
  if (!u || !u.version) return '';
  return '<div class="upd-bar' + (pmg.updOpen ? ' open' : '') + '"><div class="upd-row"><span class="upd-dot"></span><b>Вышел Gradient ' + pmgEsc(u.version) + '</b>' +
    (u.notes ? '<span class="upd-notes">' + pmgEsc(u.notes) + '</span>' : '') +
    '<button class="btn small primary" data-act="upd-get">Обновить</button></div>' +
    (pmg.updOpen ? '<ol class="upd-steps"><li>Архив уже скачивается. Распакуй его <b>в ту же папку</b>, где лежит Gradient, с заменой файлов.</li>' +
      '<li>Нажми кнопку ниже — Gradient перезапустится уже новым.</li></ol>' +
      '<div class="upd-row"><button class="btn small primary" data-act="upd-reload">Я распаковал — перезапустить</button><button class="btn small" data-act="upd-get">Скачать ещё раз</button></div>' : '') + '</div>';
}

// Индикатор активной вкладки переезжает со старого места на новое.
function pmgTabSel() {
  const sel = pmgQ('.tab-sel'), on = pmgQ('.tab.on');
  if (!sel || !on) return;
  const to = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
  const from = pmg.lastTabRect;
  const put = (r) => { sel.style.width = r.w + 'px'; sel.style.height = r.h + 'px'; sel.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px)'; };
  sel.style.transition = 'none';
  put(from && !pmgReduced() ? from : to);
  sel.offsetWidth;
  sel.style.transition = '';
  put(to);
  on.classList.add('ink');
}

function pmgEmptyState() {
  if (pmg.loading) return '<div class="loader"><span></span><span></span><span></span></div><p>Собираю оценки и домашку…</p>';
  const st = pmg.status;
  if (st && !st.ok && st.error === 'auth') {
    return '<p class="lead">Нужно войти в дневник</p><p>Открой электронный дневник и войди. Дальше Gradient будет обновляться сам, даже когда сайт закрыт.</p>' +
      '<div class="row-btns"><a class="btn primary" href="' + PMG_ORIGIN + '/" target="_blank" rel="noopener">Открыть дневник</a><button class="btn" data-act="refresh">Проверить ещё раз</button></div>';
  }
  if (st && !st.ok) return '<p class="err">' + pmgEsc(st.error || 'Не получилось загрузить данные.') + '</p><button class="btn" data-act="refresh">Попробовать ещё раз</button>';
  return '<div class="loader"><span></span><span></span><span></span></div><p>Собираю оценки и домашку…</p>';
}

function pmgStatusText() {
  const st = pmg.status;
  if (pmg.loading) return 'Обновляю…';
  if (!st) return pmg.data ? 'Обновлено ' + new Date(pmg.data.loadedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
  const t = new Date(st.ok ? st.at : (pmg.data ? pmg.data.loadedAt : st.at));
  const time = t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const day = pmgToday() - new Date(t).setHours(0, 0, 0, 0) === 0 ? '' : ' ' + t.getDate() + ' ' + PMG_MONTHS[t.getMonth()].slice(0, 3);
  if (st.ok) return 'Обновлено в ' + time + day;
  return st.error === 'auth' ? 'Нужно войти в дневник' : 'Не обновилось, данные от ' + time + day;
}

function pmgHeader(period) {
  const d = pmg.data;
  const who = d ? '<span class="who-name">' + pmgEsc(d.student.name + ', ' + d.student.groupName) + '</span>' : '';
  let tools = '';
  if (d) {
    const opts = pmgPeriods().filter((p) => p.kind === 'term' || p.kind === 'year');
    tools += '<label class="period"><span class="sr">Период</span><select data-act="period">' +
      opts.map((p) => '<option value="' + p.id + '"' + (period && p.id === period.id ? ' selected' : '') + '>' + pmgEsc(p.kind === 'year' ? 'Весь год' : p.name) + '</option>').join('') + '</select></label>';
    if (d.students.length > 1) {
      tools += '<label class="period"><span class="sr">Ученик</span><select data-act="student">' + d.students.map((s) => '<option value="' + s.id + '"' + (s.id === d.student.id ? ' selected' : '') + '>' + pmgEsc(s.name) + '</option>').join('') + '</select></label>';
    }
  }
  const th = pmg.settings.theme || 'auto';
  const thName = { auto: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' }[th];
  if (pmg.data) tools += '<button class="icon-btn" data-act="report" data-tip="Отчёт для родителей" aria-label="Отчёт для родителей">' + pmgIcon('report') + '</button>';
  tools += '<button class="icon-btn" data-act="theme-cycle" data-tip="' + thName + '. Нажми, чтобы сменить" aria-label="' + thName + '">' + pmgIcon(th === 'auto' ? 'auto' : th === 'light' ? 'sun' : 'moon') + '</button>';
  tools += '<button class="icon-btn' + (pmg.loading ? ' spin' : '') + '" data-act="refresh" data-tip="Обновить сейчас" aria-label="Обновить данные">' + pmgIcon('refresh') + '</button>';
  if (pmg.mode === 'drawer') {
    tools += '<button class="icon-btn" data-act="open-app" data-tip="Открыть в отдельной вкладке" aria-label="Открыть в отдельной вкладке">' + pmgIcon('expand') + '</button>' +
      '<button class="icon-btn" data-act="close" aria-label="Закрыть панель">' + pmgIcon('close') + '</button>';
  }
  const st = pmg.status;
  return '<header class="head"><div class="brand"><span class="brand-mark">' + PMG_LOGO + '</span><div class="brand-text"><div class="brand-name">Gradient</div>' +
    '<div class="who">' + who + '<span class="status' + (st && !st.ok ? ' bad' : '') + '">' + pmgEsc(pmgStatusText()) + '</span></div></div></div>' +
    '<div class="head-tools">' + tools + '</div></header>';
}

// ---- Сводка ----
function pmgOverview(period) {
  const d = pmg.data;
  const stats = pmgStats(period).filter((s) => s.values.length);
  const marks = d.marks.filter((m) => !period || pmgInPeriod(m, period));
  const avg = pmgAvg(marks.map((m) => m.value));
  const daysLeft = pmgDaysLeft(period);
  const forecast = { 5: 0, 4: 0, 3: 0, 2: 0 };
  stats.forEach((s) => { forecast[Math.max(2, s.rounded)]++; });
  const tips = pmgTips(stats, period && period.kind === 'term' ? daysLeft : null).slice(0, 6);
  const weekAgo = pmgToday().getTime() - 6 * PMG_DAY;
  const fresh = d.marks.filter((m) => pmgParseDate(m.date) >= weekAgo).slice().reverse();
  const hw = pmgHomework();
  const next = pmgNextDayTodo(hw);
  const undone = next.items.filter((h) => !h.done);
  const checks = pmgUpcomingChecks(d.lessons, hw).slice(0, 5);
  const absN = d.absences.filter((a) => !period || pmgInPeriod(a, period)).length;

  const write = !pmg.quietRender && !pmgReduced();

  let h = '<section class="hero">' +
    '<div class="gauge-wrap">' + pmgGauge(avg, pmgRound(avg, pmg.settings.threshold), write) +
    '<div class="hero-avg' + (write ? ' count' : '') + '" data-from="2" data-to="' + (avg || 0) + '" aria-label="Средний балл ' + pmgFmtAvg(avg) + '">' + pmgFmtAvg(avg) + '</div><div class="hero-cap">средний балл</div></div>' +
    '<div class="hero-text"><p class="lead">Средний балл ' + pmgEsc(pmgPeriodName(period)) + ', ' + marks.length + ' ' + pmgPlural(marks.length, ['оценка', 'оценки', 'оценок']) + '.</p>' +
    (daysLeft != null && period.kind === 'term' ? '<p>До конца четверти ' + daysLeft + ' ' + pmgPlural(daysLeft, ['день', 'дня', 'дней']) + '.</p>' : '') +
    pmgCompareLine(period) +
    '<p class="forecast">Если бы четверть кончилась сегодня: ' +
    [5, 4, 3, 2].filter((k) => forecast[k]).map((k) => '<span class="fc">' + pmgMarkChip(k) + '<span class="times">× ' + forecast[k] + '</span></span>').join(' ') + '</p></div>' +
    '<div class="facts">' +
    '<button class="fact" data-act="tab" data-tab="homework">' + (next.day ? '<b data-count-int="' + undone.length + '">' + undone.length + '</b><span>' + (undone.length ? pmgPlural(undone.length, ['задание', 'задания', 'заданий']) + ' на ' + pmgDayAcc(next.day) : 'на ' + pmgDayAcc(next.day) + ' всё сделано') + '</span>' : '<span>Посмотреть домашку</span>') + '</button>' +
    '<button class="fact" data-act="tab" data-tab="absences"><b data-count-int="' + absN + '">' + absN + '</b><span>' + pmgPlural(absN, ['урок пропущен', 'урока пропущено', 'уроков пропущено']) + '</span></button>' +
    '<button class="fact report-fact" data-act="report"><i class="rf-ico">' + pmgIcon('report') + '</i><span>' + (daysLeft != null && daysLeft <= 7 && period.kind === 'term' ? 'Четверть заканчивается — сделай отчёт для родителей' : 'Отчёт для родителей') + '</span></button>' +
    '</div></section>';

  h += '<div class="two">';
  h += '<section><h2>На что обратить внимание</h2>' + (tips.length ? '<ul class="tips">' + tips.map((t, ti) =>
    '<li class="tip-' + t.kind + '" style="--i:' + ti + '"><button class="link" data-act="subject" data-id="' + t.id + '">' + pmgEsc(t.subject) + '</button>: ' + pmgEsc(t.text) + '</li>').join('') + '</ul>' : '<p class="muted">Всё спокойно: ни одна оценка не висит на волоске.</p>') + '</section>';
  h += '<section><h2>Скоро проверочные</h2>' + (checks.length ? pmgChecksList(checks) : '<p class="muted">В темах уроков и домашке контрольных пока не видно.</p>') + '</section>';
  h += '</div>';

  h += '<div class="two">';
  h += '<section><h2>Оценки за неделю</h2>' + (fresh.length ? '<ul class="fresh">' + fresh.slice(0, 8).map((m, fi) =>
    '<li style="--i:' + fi + '">' + pmgMarkChip(m.value) + '<span><button class="link" data-act="subject" data-id="' + m.subjectId + '">' + pmgEsc(m.subject) + '</button><small>' + pmgEsc(pmgShortDate(m.date) + ', ' + m.typeName.toLowerCase()) + '</small></span></li>').join('') + '</ul>' : '<p class="muted">За последние 7 дней новых оценок нет.</p>') + '</section>';
  h += '<section><h2>' + (next.day ? 'Домашка на ' + pmgEsc(pmgDayAcc(next.day)) : 'Домашка') + '</h2>' + (next.items.length ? '<ul class="hw-mini">' + next.items.map((i) =>
    '<li class="' + (i.done ? 'done' : '') + '"><b>' + pmgEsc(i.subject) + '</b><span>' + (i.text ? pmgEsc(i.text) : 'Задание во вложении') + '</span></li>').join('') + '</ul>' : '<p class="muted">Заданий на ближайшие дни нет.</p>') + '</section>';
  h += '</div>';

  const sorted = stats.slice().sort((a, b) => a.avg - b.avg);
  h += '<section><h2>Предметы, от слабых к сильным</h2><div class="subj-table">' + sorted.map((s, ri) =>
    '<button class="subj-row" data-act="subject" data-id="' + s.id + '" style="--i:' + ri + '">' +
    '<span class="subj-name">' + pmgEsc(s.name) + '</span>' +
    '<span class="strip">' + s.values.slice(-12).map((v) => '<span class="mark sm ' + pmgMarkClass(v) + '">' + v + '</span>').join('') + '</span>' +
    pmgRing(s.avg, s.rounded, 46) +
    (s.trend > 0.15 ? '<span class="trend up" data-tip="Последние оценки выше прежних">↗</span>' : s.trend < -0.15 ? '<span class="trend down" data-tip="Последние оценки ниже прежних">↘</span>' : '<span class="trend"></span>') +
    '<span class="will">выйдет ' + pmgMarkChip(s.rounded) + '</span></button>').join('') + '</div></section>';

  h += pmgSettingsBlock();
  return h;
}

function pmgCompareLine(period) {
  const cmp = pmgCompareRows(period);
  if (!cmp.length) return '';
  const better = cmp.filter((r) => r.s.rounded > r.last).length, worse = cmp.filter((r) => r.s.rounded < r.last).length;
  const parts = [];
  if (better) parts.push('<b class="m5">' + better + ' лучше</b>');
  if (worse) parts.push('<b class="m2">' + worse + ' хуже</b>');
  return '<p>По сравнению с годовыми за прошлый год: ' + (parts.length ? parts.join(', ') : 'всё на том же уровне') + (parts.length ? ', остальные так же' : '') + '. <button class="link" data-act="tab" data-tab="finals">Подробнее</button></p>';
}

function pmgChecksList(checks) {
  return '<ul class="checks">' + checks.map((c) => {
    const diff = Math.round((c.date - pmgToday()) / PMG_DAY);
    const when = diff === 0 ? 'сегодня' : diff === 1 ? 'завтра' : 'через ' + diff + ' ' + pmgPlural(diff, ['день', 'дня', 'дней']);
    return '<li><span class="check-date"><b>' + c.date.getDate() + '</b>' + PMG_MONTHS[c.date.getMonth()].slice(0, 3) + '</span><span><b>' + pmgEsc(c.kind) + '</b>, ' + pmgEsc(c.subject) + '<small>' + pmgEsc(when) + (c.from === 'topic' ? ' · по теме урока' : ' · по домашке') + '</small></span></li>';
  }).join('') + '</ul>';
}

function pmgSettingsBlock() {
  const th = pmg.settings.threshold;
  return '<section class="settings card"><h2>Настройки</h2>' +
    '<div class="seg-ctl" role="group" aria-label="Округление"><span>Пятёрка выходит от</span>' +
    [[0.5, '4,50'], [0.55, '4,55'], [0.6, '4,60']].map(([t, l]) => '<button class="' + (Math.abs(th - t) < 1e-6 ? 'on' : '') + '" data-act="threshold" data-v="' + t + '">' + l + '</button>').join('') + '</div>' +
    '<p class="muted">Так же и для других оценок: при 4,55 четвёрка выходит от 3,55, тройка от 2,55.</p>' +
    '<div class="seg-ctl" role="group" aria-label="Уведомления"><span>Уведомлять о новых оценках и домашке</span>' +
    [[true, 'Да'], [false, 'Нет']].map(([v, l]) => '<button class="' + (pmg.settings.notify === v ? 'on' : '') + '" data-act="notify" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    '<p class="muted">Gradient сам проверяет дневник каждые 30 минут, пока открыт браузер.</p>' +
    '<div class="seg-ctl" role="group" aria-label="Тема"><span>Тема</span>' +
    [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, l]) => '<button class="' + ((pmg.settings.theme || 'auto') === v ? 'on' : '') + '" data-act="theme" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    '<div class="seg-ctl" role="group" aria-label="Фон"><span>Фон</span>' +
    [['glyphs', 'Учебные значки'], ['none', 'Без фона']].map(([v, l]) => '<button class="' + ((pmg.settings.bg || 'glyphs') === v ? 'on' : '') + '" data-act="bg" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    '<div class="seg-ctl" role="group" aria-label="Не выходить из дневника"><span>Не выходить из дневника</span>' +
    [[true, 'Да'], [false, 'Нет']].map(([v, l]) => '<button class="' + (pmg.settings.keepAlive === v ? 'on' : '') + '" data-act="keepalive" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    '<p class="muted">Каждые 4 минуты Gradient тихо обращается к дневнику, чтобы вход не сбрасывался из-за бездействия.</p></section>';
}

// ---- Расписание дня ----
function pmgLessonDays() {
  const set = new Set((pmg.data.lessons || []).map((l) => pmgStartOfDay(pmgParseDate(l.from)).getTime()));
  return [...set].sort((a, b) => a - b);
}

function pmgDayView() {
  const days = pmgLessonDays();
  if (!days.length) return '<p class="muted">Расписание пока не загружено.</p>';
  const today = pmgToday().getTime();
  if (pmg.day == null || !days.includes(pmg.day)) {
    const now = new Date();
    // После уроков показываем следующий день
    const todays = pmg.data.lessons.filter((l) => pmgStartOfDay(pmgParseDate(l.from)).getTime() === today);
    const lastEnd = todays.length ? Math.max(...todays.map((l) => pmgParseDate(l.to || l.from).getTime())) : 0;
    pmg.day = days.find((d) => d > today || (d === today && now.getTime() < lastEnd)) || days[days.length - 1];
  }
  const idx = days.indexOf(pmg.day);
  const day = new Date(pmg.day);
  const lessons = pmg.data.lessons.filter((l) => pmgStartOfDay(pmgParseDate(l.from)).getTime() === pmg.day).sort((a, b) => pmgParseDate(a.from) - pmgParseDate(b.from));
  const hw = pmgHomework();
  const dueToday = hw.filter((i) => i.due && i.due.getTime() === pmg.day);
  const now = Date.now();

  let h = '<div class="day-nav"><button class="icon-btn" data-act="day" data-v="' + (days[idx - 1] || '') + '"' + (idx <= 0 ? ' disabled' : '') + ' aria-label="Предыдущий день">' + pmgIcon('left') + '</button>' +
    '<h2 class="day-title">' + pmgEsc(pmgHumanDay(day)) + '</h2>' +
    '<button class="icon-btn" data-act="day" data-v="' + (days[idx + 1] || '') + '"' + (idx >= days.length - 1 ? ' disabled' : '') + ' aria-label="Следующий день">' + pmgIcon('right') + '</button>' +
    (pmg.day !== today && days.includes(today) ? '<button class="link" data-act="day" data-v="' + today + '">Сегодня</button>' : '') + '</div>';

  h += '<ol class="lessons">' + lessons.map((l, li) => {
    const from = pmgParseDate(l.from).getTime(), to = pmgParseDate(l.to || l.from).getTime();
    const state = now >= from && now <= to ? ' now' : now > to ? ' over' : '';
    const due = dueToday.filter((i) => i.subjectId === l.subjectId);
    const given = hw.filter((i) => i.lessonId === l.id);
    return '<li class="lesson' + state + '" style="--i:' + li + '"><div class="l-time"><b>' + (l.number || '') + '</b><span>' + pmgTime(l.from) + '</span><span>' + pmgTime(l.to) + '</span></div>' +
      '<div class="l-body"><div class="l-head"><b>' + pmgEsc(l.subject) + '</b>' + (state === ' now' ? '<span class="pill">идёт сейчас</span>' : '') +
      (l.marks || []).filter((m) => m.value).map((m) => pmgMarkChip(m.value, m.typeName)).join('') + '</div>' +
      (l.topic ? '<p class="l-topic">' + pmgEsc(l.topic) + '</p>' : '') +
      (due.length ? '<div class="l-hw"><span class="l-label">К этому уроку</span>' + due.map((i) => pmgHwItem(i)).join('') + '</div>' : '') +
      (given.length ? '<div class="l-given"><span class="l-label">Задали</span>' + given.map((i) => '<p>' + (i.text ? pmgLinkify(i.text) : 'Задание во вложении') + (i.due ? ' <small>→ ' + pmgEsc(pmgShort(i.due)) + '</small>' : '') + '</p>').join('') + '</div>' : '') +
      '</div></li>';
  }).join('') + '</ol>';
  return h;
}

// ---- Календарь оценок ----
const PMG_MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const PMG_MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

// Всё, что было в каждый день: оценки, пропуски, замечания, сдача домашки.
function pmgCalIndex() {
  const idx = new Map();
  const get = (t) => { if (!idx.has(t)) idx.set(t, { marks: [], abs: [], notes: [], finals: [], hw: [] }); return idx.get(t); };
  const day = (s) => pmgStartOfDay(pmgParseDate(s)).getTime();
  pmg.data.marks.forEach((m) => get(day(m.date)).marks.push(m));
  pmg.data.absences.forEach((a) => get(day(a.date)).abs.push(a));
  (pmg.data.notes || []).forEach((n) => get(day(n.date)).notes.push(n));
  pmg.data.finals.forEach((f) => { if (f.value != null) get(day(f.date)).finals.push(f); });
  pmgHomework().forEach((h) => { if (h.due) get(h.due.getTime()).hw.push(h); });
  return idx;
}

function pmgCalHoliday(t) {
  return pmgPeriods().some((p) => p.kind === 'holiday' && t >= p.from.getTime() && t <= p.to.getTime());
}

function pmgCalendarView() {
  const idx = pmgCalIndex();
  const today = pmgToday().getTime();
  if (!pmg.calMonth) { const d = pmgToday(); pmg.calMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  const m0 = new Date(pmg.calMonth);
  const y = m0.getFullYear(), mo = m0.getMonth();
  const daysIn = new Date(y, mo + 1, 0).getDate();
  const lead = (m0.getDay() + 6) % 7; // понедельник первым
  const inMonth = (t) => { const d = new Date(t); return d.getFullYear() === y && d.getMonth() === mo; };
  if (pmg.calDay == null || !inMonth(pmg.calDay)) {
    const withMarks = [...idx.keys()].filter((t) => inMonth(t) && t <= today && idx.get(t).marks.length).sort((a, b) => b - a);
    pmg.calDay = inMonth(today) ? today : (withMarks[0] || new Date(y, mo, 1).getTime());
  }

  // Итоги месяца
  const monthMarks = pmg.data.marks.filter((m) => inMonth(pmgStartOfDay(pmgParseDate(m.date)).getTime()));
  const mAvg = pmgAvg(monthMarks.map((m) => m.value));
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0 };
  monthMarks.forEach((m) => { dist[Math.max(2, m.value)]++; });

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cal-cell blank" aria-hidden="true"></span>';
  for (let d = 1; d <= daysIn; d++) {
    const t = new Date(y, mo, d).getTime();
    const e = idx.get(t);
    const wd = new Date(t).getDay();
    const cls = ['cal-cell'];
    if (t === today) cls.push('today');
    if (wd === 0 || wd === 6) cls.push('weekend');
    if (pmgCalHoliday(t)) cls.push('holiday');
    if (t > today) cls.push('future');
    if (e && e.marks.length) cls.push('has');
    const dots = e ? e.marks.slice(0, 4).map((m) => '<i class="dot ' + pmgMarkClass(m.value) + '"></i>').join('') + (e.marks.length > 4 ? '<i class="more">+' + (e.marks.length - 4) + '</i>' : '') : '';
    const flags = e ? (e.abs.length ? '<i class="abs-mark"></i>' : '') + (e.notes.some((n) => /замечан/i.test(n.name)) ? '<i class="note-mark"></i>' : '') : '';
    const extra = e && e.finals.length ? '<i class="final-mark"></i>' : '';
    const label = d + ' ' + PMG_MONTHS[mo] + (e && e.marks.length ? ', оценки: ' + e.marks.map((m) => m.value).join(', ') : '');
    cells += '<button class="' + cls.join(' ') + '" data-act="cal-day" data-v="' + t + '" role="gridcell" aria-selected="' + (t === pmg.calDay) + '" aria-label="' + pmgEsc(label) + '" tabindex="' + (t === pmg.calDay ? 0 : -1) + '">' +
      '<span class="cal-num">' + d + '</span><span class="cal-dots">' + dots + flags + '</span>' + extra + '</button>';
  }

  const dir = pmg.calDir || '';
  pmg.calDir = '';
  let h = '<div class="cal-wrap"><section class="cal card">' +
    '<div class="cal-head"><button class="icon-btn" data-act="cal-month" data-v="-1" aria-label="Предыдущий месяц">' + pmgIcon('left') + '</button>' +
    '<h2 class="cal-title"><span class="cal-mon">' + PMG_MONTHS_NOM[mo] + '</span> <span class="cal-year">' + y + '</span></h2>' +
    '<button class="icon-btn" data-act="cal-month" data-v="1" aria-label="Следующий месяц">' + pmgIcon('right') + '</button>' +
    (inMonth(today) ? '' : '<button class="link" data-act="cal-today">Сегодня</button>') + '</div>' +
    '<div class="cal-sum">' + (monthMarks.length
      ? '<span>В ' + PMG_MONTHS_PREP[mo] + ' <b>' + monthMarks.length + '</b> ' + pmgPlural(monthMarks.length, ['оценка', 'оценки', 'оценок']) + ', средний <b>' + pmgFmtAvg(mAvg) + '</b></span><span class="cal-dist">' + [5, 4, 3, 2].filter((k) => dist[k]).map((k) => '<span><i class="dot ' + pmgMarkClass(k) + '"></i>' + dist[k] + '</span>').join('') + '</span>'
      : '<span>В ' + PMG_MONTHS_PREP[mo] + ' оценок нет</span>') + '</div>' +
    '<div class="cal-wd" aria-hidden="true">' + ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w) => '<span>' + w + '</span>').join('') + '</div>' +
    '<div class="cal-grid ' + dir + '" role="grid" aria-label="' + PMG_MONTHS_NOM[mo] + ' ' + y + '"><span class="cal-sel" aria-hidden="true"></span>' + cells + '</div>' +
    '<div class="cal-legend"><span><i class="dot m5"></i>оценка</span><span><i class="abs-mark"></i>пропуск</span><span><i class="note-mark"></i>замечание</span><span><i class="final-mark"></i>итоговая</span><span><i class="hol-sw"></i>каникулы</span></div>' +
    '</section>';
  h += '<section class="cal-details card" aria-live="polite">' + pmgCalDetails(pmg.calDay, idx) + '</section></div>';
  return h;
}

function pmgCalDetails(t, idx) {
  const e = (idx || pmgCalIndex()).get(t) || { marks: [], abs: [], notes: [], finals: [], hw: [] };
  const d = new Date(t);
  const title = pmgHumanDay(d);
  const empty = !e.marks.length && !e.abs.length && !e.notes.length && !e.finals.length && !e.hw.length;
  let h = '<div class="cd-inner"><h2>' + pmgEsc(title) + '</h2>';
  if (empty) {
    h += '<p class="muted">' + (pmgCalHoliday(t) ? 'Каникулы.' : d.getDay() === 0 || d.getDay() === 6 ? 'Выходной.' : t > pmgToday().getTime() ? 'Пока ничего не запланировано.' : 'В этот день оценок не было.') + '</p></div>';
    return h;
  }
  if (e.marks.length) {
    const avg = pmgAvg(e.marks.map((m) => m.value));
    h += '<p class="cd-sub">' + e.marks.length + ' ' + pmgPlural(e.marks.length, ['оценка', 'оценки', 'оценок']) + ', средний за день ' + pmgFmtAvg(avg) + '</p><ul class="cd-list">' +
      e.marks.map((m, i) => '<li style="--i:' + i + '">' + pmgMarkChip(m.value) + '<span><button class="link plain" data-act="subject" data-id="' + m.subjectId + '">' + pmgEsc(m.subject) + '</button><small>' + pmgEsc(m.typeName) + (m.comment ? ' · ' + pmgEsc(m.comment) : '') + '</small></span></li>').join('') + '</ul>';
  }
  if (e.finals.length) {
    h += '<p class="cd-label">Итоговые</p><ul class="cd-list">' + e.finals.map((f, i) => '<li style="--i:' + (e.marks.length + i) + '">' + pmgMarkChip(f.value) + '<span>' + pmgEsc(f.subject) + '<small>' + pmgEsc(f.typeName) + '</small></span></li>').join('') + '</ul>';
  }
  if (e.notes.length) {
    h += '<p class="cd-label">Отметки без балла</p><ul class="cd-list">' + e.notes.map((n) => '<li><span class="word-chip' + (/замечан/i.test(n.name) ? ' warn' : '') + '">' + pmgEsc(n.name) + '</span><span>' + pmgEsc(n.subject) + (n.comment ? '<small>' + pmgEsc(n.comment) + '</small>' : '') + '</span></li>').join('') + '</ul>';
  }
  if (e.abs.length) {
    const r = e.abs[0].name;
    h += '<p class="cd-label">Пропуски</p><p class="cd-abs"><i class="reason ' + (r === 'по болезни' ? 'r-ill' : r === 'уважительная' ? 'r-ok' : 'r-unk') + '">' + pmgEsc(r === 'неизвестная' ? 'без причины' : r) + '</i> ' +
      e.abs.length + ' ' + pmgPlural(e.abs.length, ['урок', 'урока', 'уроков']) + ': ' + pmgEsc(e.abs.map((a) => a.subject).join(', ')) + '</p>';
  }
  if (e.hw.length) {
    const left = e.hw.filter((x) => !x.done).length;
    h += '<p class="cd-label">Домашка к этому дню</p><p class="cd-hw">' + pmgEsc(e.hw.map((x) => x.subject).filter((v, i, a) => a.indexOf(v) === i).join(', ')) +
      '. ' + (left ? 'Не сделано: ' + left + '. ' : 'Всё сделано. ') + '<button class="link" data-act="tab" data-tab="homework">Открыть</button></p>';
  }
  return h + '</div>';
}

// Плавно переносит подсветку на выбранный день и обновляет подробности без перерисовки всей вкладки.
function pmgCalPlace(animate) {
  const grid = pmgQ('.cal-grid');
  if (!grid) return;
  const sel = grid.querySelector('.cal-sel');
  const cell = grid.querySelector('.cal-cell[aria-selected="true"]');
  if (!sel || !cell) { if (sel) sel.style.opacity = 0; return; }
  sel.style.transition = animate && !pmgReduced() ? '' : 'none';
  sel.style.width = cell.offsetWidth + 'px';
  sel.style.height = cell.offsetHeight + 'px';
  sel.style.transform = 'translate(' + cell.offsetLeft + 'px,' + cell.offsetTop + 'px)';
  sel.style.opacity = 1;
  if (!animate) { sel.offsetWidth; sel.style.transition = ''; }
}

function pmgCalSelect(t, focus) {
  pmg.calDay = t;
  const grid = pmgQ('.cal-grid');
  if (!grid) return;
  grid.querySelectorAll('.cal-cell[data-v]').forEach((c) => {
    const on = +c.dataset.v === t;
    c.setAttribute('aria-selected', on);
    c.tabIndex = on ? 0 : -1;
    if (on && focus) c.focus({ preventScroll: true });
  });
  pmgCalPlace(true);
  const box = pmgQ('.cal-details');
  if (box) {
    box.innerHTML = pmgCalDetails(t);
    if (!pmgReduced()) { box.classList.remove('swap'); box.offsetWidth; box.classList.add('swap'); }
  }
}

function pmgCalShiftMonth(n) {
  const m = new Date(pmg.calMonth);
  pmg.calMonth = new Date(m.getFullYear(), m.getMonth() + n, 1).getTime();
  pmg.calDir = n > 0 ? 'from-right' : 'from-left';
  pmg.calDay = null;
  pmgRender(true);
}

// Стрелки на клавиатуре двигают выбор по календарю.
function pmgCalKeys(e) {
  const cell = e.target.closest && e.target.closest('.cal-cell[data-v]');
  if (!cell) return;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (!step) return;
  e.preventDefault();
  const d = new Date(+cell.dataset.v); d.setDate(d.getDate() + step);
  const m = new Date(pmg.calMonth);
  if (d.getMonth() !== m.getMonth()) { pmgCalShiftMonth(step > 0 ? 1 : -1); pmgCalSelect(d.getTime(), true); }
  else pmgCalSelect(d.getTime(), true);
}

// ---- Домашка ----
function pmgHwSourceText(i) {
  if (i.source === 'manual') return 'перенесено вручную';
  if (i.source === 'text') return 'срок указан в задании: «' + i.phrase + '»';
  if (i.source === 'next') return 'к следующему уроку';
  if (i.source === 'guess') return 'к следующему уроку по расписанию (примерно)';
  if (i.source === 'lesson') return 'срок из дневника';
  if (i.source === 'own') return 'своё задание';
  return 'срок не понятен';
}

const PMG_TICK = '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" pathLength="1"/></svg>';

// Короткая строка задания — для вкладки «Уроки».
function pmgHwItem(i) {
  return '<div class="hwc compact' + (i.done ? ' done' : '') + '" data-key="' + pmgEsc(i.key) + '">' +
    '<label class="hw-check"><input type="checkbox" data-act="done" data-key="' + pmgEsc(i.key) + '"' + (i.done ? ' checked' : '') + '><span class="check">' + PMG_TICK + '</span><span class="sr">Сделано</span></label>' +
    '<p class="hwc-task"><span class="strike">' + (i.text ? pmgLinkify(i.text) : 'Задание во вложении') + '</span></p></div>';
}

// Карточка задания: шапка (предмет и когда сдавать), само задание, метки, справка «тема / задали / срок».
function pmgHwCard(i, view, n) {
  const today = pmgToday().getTime();
  const overdue = !i.done && i.due && i.due.getTime() < today;
  const moving = pmg.moving === i.key;
  const when = view === 'subjects' || view === 'overdue'
    ? (i.due ? (i.due.getTime() === today + PMG_DAY ? 'на завтра' : 'к ' + pmgShort(i.due)) : 'срок не понятен')
    : (i.dueNumber ? i.dueNumber + '-й урок' + (i.dueTime ? ', ' + i.dueTime : '') : '');
  const tags = (i.own ? '<span class="tag t-own">своё</span>' : '') + (i.check ? '<span class="tag t-check">' + pmgEsc(i.check) + '</span>' : '') +
    i.tags.filter((t) => !(i.check && t.k === 'check')).map((t) => '<span class="tag t-' + t.k + '">' + pmgEsc(t.l) + '</span>').join('');
  return '<article class="hwc' + (i.done ? ' done' : '') + (overdue ? ' overdue' : '') + '" data-key="' + pmgEsc(i.key) + '" data-order="' + n + '" style="--i:' + n + '">' +
    '<label class="hw-check"><input type="checkbox" data-act="done" data-key="' + pmgEsc(i.key) + '"' + (i.done ? ' checked' : '') + '><span class="check">' + PMG_TICK + '</span><span class="sr">Сделано: ' + pmgEsc(i.subject) + '</span></label>' +
    '<div class="hwc-main">' +
      '<header class="hwc-head"><b class="hwc-subj">' + pmgEsc(view === 'subjects' ? (i.due ? pmgHumanDay(i.due) : 'Без срока') : i.subject) + '</b>' + (when ? '<span class="hwc-when' + (overdue ? ' late' : '') + '">' + pmgEsc(when) + '</span>' : '') +
        (pmg.settings.cloud ? '<label class="hwc-cam" data-tip="Прикрепить фото"><input type="file" accept="image/*" data-act="ph-file" data-key="' + pmgEsc(i.key) + '" hidden>' + (pmg.phBusy === i.key ? '<span class="ph-spin"></span>' : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.6A1 1 0 0 1 10 4h4a1 1 0 0 1 .8.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12.3" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>') + '</label>' : '') + '</header>' +
      '<p class="hwc-task"><span class="strike">' + (i.text ? pmgLinkify(i.text) : 'Задание во вложении') + '</span></p>' +
      (typeof pmgPhotoStrip === 'function' ? pmgPhotoStrip(i.key, {}) : '') +
      (i.files.length ? '<div class="files">' + i.files.map((f) => '<span class="file">' + pmgEsc(f) + '</span>').join('') + '</div>' : '') +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '<dl class="hwc-meta">' +
        (i.topic ? '<div class="m-topic"><dt>Тема урока</dt><dd>' + pmgEsc(i.topic) + '</dd></div>' : '') +
        (i.assigned ? '<div><dt>Задали</dt><dd>' + pmgEsc(pmgShort(i.assigned)) + '</dd></div>' : '') +
        '<div class="m-due"><dt>Срок</dt><dd>' + pmgEsc(pmgHwSourceText(i)) +
          (i.own ? '<button class="link sm move-btn" data-act="own-edit" data-v="' + pmgEsc(i.id) + '">изменить</button>' : moving
            ? '<span class="move-box"><input type="date" class="date-in" data-act="move-date" data-key="' + pmgEsc(i.key) + '" value="' + (i.due ? pmgIsoDate(i.due) : '') + '" aria-label="Новая дата сдачи">' +
              (i.source === 'manual' ? '<button class="link sm" data-act="move-reset" data-key="' + pmgEsc(i.key) + '">вернуть</button>' : '') + '<button class="link sm" data-act="move" data-key="">отмена</button></span>'
            : '<button class="link sm move-btn" data-act="move" data-key="' + pmgEsc(i.key) + '">перенести</button>') +
        '</dd></div>' +
      '</dl>' +
    '</div></article>';
}

function pmgHwGroupHead(title, list, opts) {
  const done = list.filter((i) => i.done).length;
  const pct = list.length ? Math.round(done / list.length * 100) : 0;
  return '<header class="hwg-head"><h2>' + pmgEsc(title) + (opts && opts.sub ? '<small>' + pmgEsc(opts.sub) + '</small>' : '') + '</h2>' +
    '<span class="hwg-count"><b class="hwg-done">' + done + '</b> из <span class="hwg-total">' + list.length + '</span></span>' +
    '<span class="hwg-bar"><i style="width:' + pct + '%"></i></span></header>';
}

function pmgHomeworkView() {
  const items = pmgHomework();
  const today = pmgToday().getTime();
  const weekAgo = today - 7 * PMG_DAY;
  const upcoming = items.filter((i) => i.due && i.due.getTime() >= today);
  const overdue = items.filter((i) => !i.done && i.due && i.due.getTime() < today && i.due.getTime() >= weekAgo);
  const past = items.filter((i) => i.due && i.due.getTime() < today);
  const noDue = items.filter((i) => !i.due);
  const left = upcoming.filter((i) => !i.done).length;
  const doneN = upcoming.length - left;
  const pct = upcoming.length ? doneN / upcoming.length : 0;
  const checks = pmgUpcomingChecks(pmg.data.lessons, items);
  const sortInGroup = (a, b) => (a.done - b.done) || ((a.dueNumber || 99) - (b.dueNumber || 99)) || a.subject.localeCompare(b.subject, 'ru');

  const enter = pmg.hwAnimate && !pmgReduced();
  pmg.hwAnimate = false;
  // Сводка сверху: кольцо прогресса + переключатели
  const R = 22, C = 2 * Math.PI * R;
  let h = '<div class="hw-root' + (enter ? ' hw-enter' : '') + '"><section class="hw-hero">' +
    '<svg class="hw-ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="ring-track" cx="28" cy="28" r="' + R + '"/><circle class="hw-ring-arc" cx="28" cy="28" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" style="--c:' + C.toFixed(1) + ';--off:' + (C * (1 - pct)).toFixed(1) + '" transform="rotate(-90 28 28)"/></svg>' +
    '<div class="hw-hero-text"><p class="lead">' + (left ? 'Осталось сделать <b class="hw-left" data-count-int="' + left + '">' + left + '</b> ' + pmgPlural(left, ['задание', 'задания', 'заданий']) : 'Всё сделано. Можно отдыхать.') + '</p>' +
    '<p class="muted">Сделано ' + doneN + ' из ' + upcoming.length + ' на ближайшие недели' + (overdue.length ? ', ещё ' + overdue.length + ' ' + pmgPlural(overdue.length, ['просрочено', 'просрочено', 'просрочено']) : '') + '</p></div>' +
    '<div class="hw-tools"><button class="btn small primary own-add" data-act="own-new">+ Своё задание</button><div class="seg-ctl sm" role="group" aria-label="Группировка">' + [['days', 'По дням'], ['subjects', 'По предметам']].map(([v, l]) => '<button class="' + (pmg.hwView === v ? 'on' : '') + '" data-act="hwview" data-v="' + v + '">' + l + '</button>').join('') + '</div></div></section>';

  // Лента дней: куда сдавать и сколько осталось
  if (pmg.hwView === 'days') {
    const days = [...new Set(upcoming.map((i) => i.due.getTime()))].sort((a, b) => a - b).slice(0, 10);
    if (days.length || overdue.length) {
      h += '<nav class="day-strip" aria-label="Дни сдачи"><span class="strip-sel" aria-hidden="true"></span>' +
        (overdue.length ? '<button class="ds-day late" data-act="hw-jump" data-v="overdue"><span class="ds-wd">долги</span><b>!</b><span class="ds-n">' + overdue.length + '</span></button>' : '') +
        days.map((t) => {
          const d = new Date(t), n = upcoming.filter((i) => i.due.getTime() === t && !i.done).length;
          const label = t === today ? 'сег' : t === today + PMG_DAY ? 'завтра' : PMG_WD_SHORT[d.getDay()];
          return '<button class="ds-day' + (n ? '' : ' clear') + '" data-act="hw-jump" data-v="' + t + '"><span class="ds-wd">' + label + '</span><b>' + d.getDate() + '</b><span class="ds-n">' + (n || '✓') + '</span></button>';
        }).join('') + '</nav>';
    }
  }

  if (checks.length) h += '<section class="card hw-checks"><h2>Скоро проверочные</h2>' + pmgChecksList(checks.slice(0, 4)) + '</section>';

  let n = 0;
  const group = (id, title, list, opts) => '<section class="hwg' + (opts && opts.cls ? ' ' + opts.cls : '') + '" id="hwg-' + id + '" data-group="' + id + '">' + pmgHwGroupHead(title, list, opts) +
    '<div class="hwg-list">' + list.sort(sortInGroup).map((i) => pmgHwCard(i, pmg.hwView, n++)).join('') + '</div></section>';

  if (pmg.hwView === 'subjects') {
    const bySubj = new Map();
    upcoming.concat(noDue, pmg.showPast ? past : overdue).forEach((i) => { if (!bySubj.has(i.subject)) bySubj.set(i.subject, []); bySubj.get(i.subject).push(i); });
    const subjSort = (a, b) => (a.done - b.done) || ((a.due || 0) - (b.due || 0));
    [...bySubj.keys()].sort((a, b) => a.localeCompare(b, 'ru')).forEach((s, gi) => {
      const list = bySubj.get(s).sort(subjSort);
      h += '<section class="hwg" id="hwg-s' + gi + '">' + pmgHwGroupHead(s, list) + '<div class="hwg-list">' + list.map((i) => pmgHwCard(i, 'subjects', n++)).join('') + '</div></section>';
    });
    if (!bySubj.size) h += '<p class="muted">Домашки на ближайшие недели не задано.</p>';
  } else {
    if (overdue.length) {
      h += '<section class="hwg overdue-group' + (pmg.showOverdue ? ' open' : '') + '" id="hwg-overdue" data-group="overdue">' +
        '<button class="hwg-toggle" data-act="overdue-toggle" aria-expanded="' + !!pmg.showOverdue + '"><span class="od-dot"></span><b>Просрочено за неделю: ' + overdue.length + '</b><span class="muted">Отметь сделанное или перенеси</span><svg class="chev" viewBox="0 0 24 24" width="18" height="18"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
        '<div class="collapse"><div class="collapse-in"><div class="hwg-list">' + overdue.sort((a, b) => b.due - a.due).map((i) => pmgHwCard(i, 'overdue', n++)).join('') + '</div></div></div></section>';
    }
    const days = [...new Set(upcoming.map((i) => i.due.getTime()))].sort((a, b) => a - b);
    days.forEach((t) => {
      const list = upcoming.filter((i) => i.due.getTime() === t);
      const d = new Date(t);
      const title = t === today ? 'Сегодня' : t === today + PMG_DAY ? 'Завтра' : PMG_WEEKDAYS[d.getDay()][0].toUpperCase() + PMG_WEEKDAYS[d.getDay()].slice(1);
      h += group(t, title, list, { sub: d.getDate() + ' ' + PMG_MONTHS[d.getMonth()], cls: t === today + PMG_DAY ? 'soon' : '' });
    });
    if (noDue.length) h += group('none', 'Срок не понятен', noDue, { sub: 'перенеси на нужный день' });
    if (pmg.showPast && past.length) {
      const pd = [...new Set(past.map((i) => i.due.getTime()))].sort((a, b) => b - a);
      pd.forEach((t) => { const d = new Date(t); h += group('p' + t, pmgShort(d), past.filter((i) => i.due.getTime() === t), { cls: 'past' }); });
    }
    if (!days.length && !noDue.length && !overdue.length) h += '<p class="muted">Домашки на ближайшие недели не задано.</p>';
  }

  h += '<div class="hw-foot"><button class="link" data-act="past">' + (pmg.showPast ? 'Скрыть прошедшие' : 'Показать прошедшие') + '</button></div>';
  h += '<section class="settings card"><div class="seg-ctl" role="group" aria-label="Как указана домашка"><span>В дневнике задание стоит на уроке,</span>' +
    [['assigned', 'где задали'], ['due', 'к которому сделать']].map(([v, l]) => '<button class="' + (pmg.settings.hwMode === v ? 'on' : '') + '" data-act="hwmode" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    '<p class="muted">Срок, написанный в самом задании («до 20 октября», «к пятнице», «к 23.10»), важнее этой настройки. Любое задание можно перенести.</p></section></div>';
  return h;
}

// ---- Анимации домашки ----

// Отметка «сделано»: карточка уезжает вниз группы, счётчики и полоски обновляются плавно.
function pmgHwAfterToggle(key, checked) {
  const root = pmgQ('.hw-root');
  if (root) root.classList.remove('hw-enter'); // иначе перестановка карточек перезапустит анимацию появления
  const card = pmg.root.querySelector('.hwg-list .hwc[data-key="' + CSS.escape(key) + '"]');
  if (!card) return;
  const list = card.parentElement;
  const cards = [...list.children];
  const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
  cards.sort((a, b) => (a.classList.contains('done') - b.classList.contains('done')) || (+a.dataset.order - +b.dataset.order)).forEach((c) => list.appendChild(c));
  if (!pmgReduced()) {
    cards.forEach((c) => {
      const a = before.get(c), b = c.getBoundingClientRect();
      const dy = a.top - b.top;
      if (Math.abs(dy) > 1) c.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    if (checked) card.animate([{ transform: 'scale(1)' }, { transform: 'scale(.985)' }, { transform: 'scale(1)' }], { duration: 300 });
  }
  pmgHwRefreshCounters();
}

function pmgHwRefreshCounters() {
  pmg.root.querySelectorAll('.hwg').forEach((g) => {
    const all = g.querySelectorAll('.hwg-list .hwc'), done = g.querySelectorAll('.hwg-list .hwc.done');
    const d = g.querySelector('.hwg-done'), bar = g.querySelector('.hwg-bar i');
    if (d) d.textContent = done.length;
    if (bar) bar.style.width = (all.length ? done.length / all.length * 100 : 0) + '%';
  });
  // Общий прогресс и лента дней — пересчитываем из данных
  const items = pmgHomework(), today = pmgToday().getTime();
  const up = items.filter((i) => i.due && i.due.getTime() >= today), left = up.filter((i) => !i.done).length;
  const arc = pmgQ('.hw-ring-arc');
  if (arc) { const C = parseFloat(arc.style.getPropertyValue('--c')); arc.style.setProperty('--off', (C * (1 - (up.length ? (up.length - left) / up.length : 0))).toFixed(1)); }
  const sub = pmgQ('.hw-hero .muted');
  if (sub) sub.textContent = sub.textContent.replace(/Сделано \d+ из \d+/, 'Сделано ' + (up.length - left) + ' из ' + up.length);
  const lead = pmgQ('.hw-hero .lead');
  if (lead) lead.innerHTML = left ? 'Осталось сделать <b class="hw-left">' + left + '</b> ' + pmgPlural(left, ['задание', 'задания', 'заданий']) : 'Всё сделано. Можно отдыхать.';
  pmg.root.querySelectorAll('.ds-day[data-v]').forEach((b) => {
    if (b.dataset.v === 'overdue') return;
    const n = up.filter((i) => i.due.getTime() === +b.dataset.v && !i.done).length;
    b.classList.toggle('clear', !n);
    b.querySelector('.ds-n').textContent = n || '✓';
  });
}

// Подсветка в ленте дней следует за прокруткой.
function pmgHwStripSync(animate) {
  const sheet = pmgQ('.sheet'), strip = pmgQ('.day-strip');
  if (!sheet || !strip) return;
  const groups = [...pmg.root.querySelectorAll('.hwg[data-group]')];
  const top = sheet.getBoundingClientRect().top + strip.offsetHeight + 24;
  let cur = groups[0];
  for (const g of groups) { if (g.getBoundingClientRect().top <= top) cur = g; }
  const id = cur ? cur.dataset.group : null;
  const btn = strip.querySelector('.ds-day[data-v="' + id + '"]') || strip.querySelector('.ds-day[data-v]');
  strip.querySelectorAll('.ds-day').forEach((b) => b.classList.toggle('on', b === btn));
  const sel = strip.querySelector('.strip-sel');
  if (!btn || !sel) return;
  sel.style.transition = animate && !pmgReduced() ? '' : 'none';
  sel.style.width = btn.offsetWidth + 'px';
  sel.style.height = btn.offsetHeight + 'px';
  sel.style.transform = 'translate(' + btn.offsetLeft + 'px,' + btn.offsetTop + 'px)';
  sel.style.opacity = 1;
}

// ---- Предметы ----
function pmgSubjectsView(period) {
  const stats = pmgStats(period).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (!pmg.subjectId || !stats.find((s) => s.id === pmg.subjectId)) {
    const withMarks = stats.filter((s) => s.values.length);
    pmg.subjectId = (withMarks[0] || stats[0] || {}).id;
  }
  const s = stats.find((x) => x.id === pmg.subjectId);
  let h = '<div class="subj-layout"><div class="subj-list" aria-label="Предметы">' + stats.map((x) =>
    '<button class="subj-item' + (x.id === pmg.subjectId ? ' on' : '') + '" data-act="pick" data-id="' + x.id + '"><span>' + pmgEsc(x.name) + '</span><b class="' + pmgMarkClass(x.rounded) + '">' + pmgFmtAvg(x.avg) + '</b></button>').join('') + '</div>';
  h += '<label class="subj-select"><span class="sr">Предмет</span><select data-act="pick-sel">' + stats.map((x) => '<option value="' + x.id + '"' + (x.id === pmg.subjectId ? ' selected' : '') + '>' + pmgEsc(x.name) + ' — ' + pmgFmtAvg(x.avg) + '</option>').join('') + '</select></label>';
  h += '<div class="subj-detail">' + (s ? pmgSubjectDetail(s, period) : '<p class="muted">Выбери предмет.</p>') + '</div></div>';
  return h;
}

function pmgSubjectDetail(s, period) {
  const th = pmg.settings.threshold;
  const extra = pmg.whatIf[s.id] || [];
  const newAvg = pmgAvg(s.values.concat(extra));
  const newRound = pmgRound(newAvg, th);
  const target = pmg.target[s.id] || (s.rounded && s.rounded < 5 ? s.rounded + 1 : 5);

  let h = '<div class="detail-head">' + pmgRing(s.avg, s.rounded, 76) +
    '<div><h2 class="detail-title">' + pmgEsc(s.name) + '</h2><p>' + (s.values.length ? s.values.length + ' ' + pmgPlural(s.values.length, ['оценка', 'оценки', 'оценок']) + ' ' + pmgEsc(pmgPeriodName(period)) + ', выходит ' + pmgMarkChip(s.rounded) : 'Оценок ' + pmgEsc(pmgPeriodName(period)) + ' пока нет') + '</p></div></div>';

  const prev = pmgPrevYear().get(s.id, s.name);
  if (prev && (prev.annual != null || Object.keys(prev.terms).length)) {
    const termsLine = Object.entries(prev.terms).filter(([k]) => +k >= 3002 && +k <= 3010).sort().map(([k, v]) => pmgMarkChip(v, (+k <= 3005 ? (+k - 3001) + ' четверть' : 'период'))).join('');
    h += '<div class="prev-year"><span>Прошлый год:</span>' + (termsLine ? '<span class="pv">четверти ' + termsLine + '</span>' : '') + (prev.annual != null ? '<span class="pv">годовая ' + pmgMarkChip(prev.annual) + '</span>' : '') +
      (prev.annual != null && s.rounded ? '<span class="pv-delta ' + (s.rounded > prev.annual ? 'm5' : s.rounded < prev.annual ? 'm2' : '') + '">' + (s.rounded > prev.annual ? 'сейчас выходит выше' : s.rounded < prev.annual ? 'сейчас выходит ниже' : 'сейчас на том же уровне') + '</span>' : '') + '</div>';
  }
  h += '<section class="chart-box"><h3>Как менялся средний</h3>' + (pmg.mode === 'drawer' ? pmgLineChart(s.marks, extra, th, 520, 250) : pmgLineChart(s.marks, extra, th)) + '</section>';

  h += '<div class="two">';
  h += '<section class="calc"><h3>Сколько нужно</h3><div class="seg-ctl" role="group" aria-label="Хочу оценку"><span>Хочу</span>' +
    [3, 4, 5].map((t) => '<button class="' + (t === target ? 'on' : '') + '" data-act="target" data-v="' + t + '">' + t + '</button>').join('') + '</div>' +
    '<p class="muted">Нужен средний от ' + pmgFmtAvg(target - 1 + th) + '.</p>';
  if (!s.values.length) {
    h += '<p class="muted">Нужна хотя бы одна оценка, чтобы что-то посчитать.</p>';
  } else if (pmgNeed(s.values, target, th, 5) === 0) {
    const r = [4, 3, 2].filter((m) => m < target || target === 5).map((m) => {
      const n = pmgReserve(s.values, target, th, m);
      return n === Infinity ? null : '<li>' + pmgMarkChip(m) + (n === 0 ? 'одна такая — и уже не «' + target + '»' : 'можно получить до ' + pmgCountWord(n, m)) + '</li>';
    }).filter(Boolean);
    h += '<p class="ok">«' + target + '» уже выходит.</p>' + (r.length ? '<p>Запас:</p><ul class="calc-list">' + r.join('') + '</ul>' : '');
  } else {
    const opts = [5, 4].map((m) => {
      const n = pmgNeed(s.values, target, th, m);
      return n === Infinity ? null : '<li>' + pmgMarkChip(m) + 'ещё ' + pmgCountWord(n, m) + '</li>';
    }).filter(Boolean);
    h += opts.length ? '<p>Чтобы вышло «' + target + '», нужно получить:</p><ul class="calc-list">' + opts.join('<li class="or">или</li>') + '</ul>' : '<p class="muted">Только пятёрками до «' + target + '» не дотянуть.</p>';
  }
  h += '</section>';

  h += '<section class="whatif"><h3>Что если получить</h3><div class="add-row">' +
    [5, 4, 3, 2].map((m) => '<button class="add ' + pmgMarkClass(m) + '" data-act="add" data-v="' + m + '" aria-label="Добавить оценку ' + m + '">+' + m + '</button>').join('') + '</div>' +
    (extra.length ? '<div class="hyp-marks">' + extra.map((v, i) => '<button class="mark hypo ' + pmgMarkClass(v) + '" data-act="rm" data-i="' + i + '" aria-label="Убрать ' + v + '" data-tip="Убрать">' + v + '</button>').join('') +
      '<button class="link" data-act="reset">сбросить</button></div>' +
      '<p class="whatif-res">Средний станет <b class="count" data-from="' + (s.avg || 0) + '" data-to="' + newAvg + '">' + pmgFmtAvg(newAvg) + '</b>, выйдет ' + pmgMarkChip(newRound, null, 'pop') + '</p>'
      : '<p class="muted">Нажми на оценку, и я покажу, как изменится средний.</p>') + '</section>';
  h += '</div>';

  h += '<div class="two"><section><h3>Какие оценки</h3>' + pmgDistBars(s.dist) + '</section>';
  h += '<section><h3>Все оценки</h3>' + (s.marks.length ? '<ul class="mark-list">' + s.marks.slice().reverse().map((m) =>
    '<li>' + pmgMarkChip(m.value) + '<span>' + pmgEsc(m.typeName) + (m.comment ? '<small>' + pmgEsc(m.comment) + '</small>' : '') + '</span><time>' + pmgEsc(pmgShortDate(m.date)) + '</time></li>').join('') + '</ul>' : '<p class="muted">Пусто.</p>') + '</section></div>';
  return h;
}

function pmgCompareList(cmp) {
  const order = cmp.slice().sort((a, b) => (a.s.rounded - a.last) - (b.s.rounded - b.last) || a.s.name.localeCompare(b.s.name, 'ru'));
  return '<ul class="cmp">' + order.map(({ s, last }) => {
    const diff = s.rounded - last;
    return '<li class="' + (diff > 0 ? 'better' : diff < 0 ? 'worse' : 'same') + '"><button class="link plain" data-act="subject" data-id="' + s.id + '">' + pmgEsc(s.name) + '</button>' +
      '<span class="cmp-marks">' + pmgMarkChip(last, 'Годовая за прошлый год') + '<i aria-hidden="true">→</i>' + pmgMarkChip(s.rounded, 'Выходит сейчас по среднему ' + pmgFmtAvg(s.avg), 'ghost') + '</span>' +
      '<span class="cmp-delta">' + (diff > 0 ? 'лучше' : diff < 0 ? 'хуже' : 'так же') + '</span></li>';
  }).join('') + '</ul>';
}

// ---- Пропуски ----
function pmgAbsencesView(period) {
  const abs = pmg.data.absences.filter((a) => !period || pmgInPeriod(a, period));
  if (!abs.length) { const n = pmgPeriodName(period); return '<p class="lead">' + pmgEsc(n[0].toUpperCase() + n.slice(1)) + ' ни одного пропуска.</p>'; }
  const reasons = { 'по болезни': 0, 'уважительная': 0, 'неизвестная': 0 };
  const other = {};
  abs.forEach((a) => { if (a.name in reasons) reasons[a.name]++; else other[a.name] = (other[a.name] || 0) + 1; });
  const parts = [
    { label: 'По болезни', value: reasons['по болезни'], cls: 'r-ill' },
    { label: 'Уважительная причина', value: reasons['уважительная'], cls: 'r-ok' },
    { label: 'Причина не указана', value: reasons['неизвестная'], cls: 'r-unk' }
  ].concat(Object.entries(other).map(([k, v]) => ({ label: k, value: v, cls: 'r-other' })));
  const days = new Map();
  abs.forEach((a) => { if (!days.has(a.date)) days.set(a.date, []); days.get(a.date).push(a); });
  const bySubj = {};
  abs.forEach((a) => { bySubj[a.subject] = (bySubj[a.subject] || 0) + 1; });
  const subjRows = Object.entries(bySubj).sort((a, b) => b[1] - a[1]);
  const max = subjRows[0][1];

  let h = '<section class="abs-hero"><p class="lead"><b class="big" data-count-int="' + abs.length + '">' + abs.length + '</b> ' + pmgPlural(abs.length, ['урок пропущен', 'урока пропущено', 'уроков пропущено']) + ' ' + pmgEsc(pmgPeriodName(period)) + ', это ' + days.size + ' ' + pmgPlural(days.size, ['день', 'дня', 'дней']) + '.</p>' + pmgStacked(parts) + '</section>';
  h += '<div class="two"><section><h2>По предметам</h2><div class="hbars">' + subjRows.map(([n, v], i) =>
    '<div class="hbar"><span class="hbar-name">' + pmgEsc(n) + '</span><span class="dist-track"><span class="dist-bar r-bar" style="--w:' + (v / max * 100).toFixed(1) + '%;--d:' + i * 40 + 'ms"></span></span><span class="dist-n">' + v + '</span></div>').join('') + '</div></section>';
  h += '<section><h2>По дням</h2><ul class="abs-days">' + [...days.entries()].reverse().map(([d, list]) => {
    const r = list[0].name;
    return '<li><time>' + pmgEsc(pmgShortDate(d)) + '</time><span>' + list.length + ' ' + pmgPlural(list.length, ['урок', 'урока', 'уроков']) + '<small>' + pmgEsc(list.map((a) => a.subject).join(', ')) + '</small></span><i class="reason ' + (r === 'по болезни' ? 'r-ill' : r === 'уважительная' ? 'r-ok' : 'r-unk') + '">' + pmgEsc(r === 'неизвестная' ? 'без причины' : r) + '</i></li>';
  }).join('') + '</ul></section></div>';
  return h;
}

// ---- Итоговые ----
function pmgFinalsView() {
  const d = pmg.data;
  const ps = pmgPeriods();
  const year = ps.find((p) => p.kind === 'year');
  const terms = ps.filter((p) => p.kind === 'term');
  const inYear = (f) => { const t = pmgParseDate(f.date); return year && t >= year.from && t <= year.to; };
  const termCode = (p, i) => (/триместр/i.test(p.name) ? 3006 : /полугодие/i.test(p.name) ? 3009 : 3002) + i;
  const cols = terms.map((p, i) => ({ key: String(termCode(p, i)), label: p.name, period: p }));
  cols.push({ key: '3011', label: 'Год' });
  if (d.finals.some((f) => inYear(f) && f.type === '3012')) cols.push({ key: '3012', label: 'Экзамен' });
  const schoolYear = (f) => { const t = pmgParseDate(f.date); const y = t.getMonth() >= 8 ? t.getFullYear() : t.getFullYear() - 1; return y + '/' + String(y + 1).slice(2); };
  const pastYears = [...new Set(d.finals.filter((f) => f.type === '3011' && !inYear(f)).map(schoolYear))].sort().reverse();
  const subjects = new Map();
  d.subjects.forEach((s) => subjects.set(s.id, s.name));
  d.finals.forEach((f) => { if (!subjects.has(f.subjectId)) subjects.set(f.subjectId, f.subject); });
  const cur = pmgPickPeriod(ps, new Date());
  const curStats = new Map(pmgStats(cur).map((s) => [s.id, s]));
  const cell = (f) => f.value != null ? pmgMarkChip(f.value) : '<span class="word">' + pmgEsc(f.name) + '</span>';
  const rows = [...subjects.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru')).map(([id, name]) => {
    const cells = cols.map((c) => {
      const f = d.finals.find((x) => x.subjectId === id && x.type === c.key && inYear(x));
      if (f) return '<td>' + cell(f) + '</td>';
      if (c.period && cur && c.period.id === cur.id) {
        const s = curStats.get(id);
        return '<td>' + (s && s.rounded ? pmgMarkChip(s.rounded, 'Прогноз по текущему среднему ' + pmgFmtAvg(s.avg), 'ghost') : '') + '</td>';
      }
      return '<td></td>';
    }).join('');
    const past = pastYears.map((y) => {
      const f = d.finals.find((x) => x.subjectId === id && x.type === '3011' && schoolYear(x) === y);
      return '<td class="past">' + (f ? cell(f) : '') + '</td>';
    }).join('');
    return '<tr><th scope="row">' + pmgEsc(name) + '</th>' + cells + past + '</tr>';
  });
  const pts = pmgYearsPoints();
  const cmp = pmgCompareRows(cur);
  const prevY = pmgPrevYear().year;
  let top = '';
  if (pts.length > 1 || cmp.length) {
    top = '<div class="two">';
    top += '<section><h2>Средняя годовая по годам</h2>' + (pts.length ? pmgYearsChart(pts) : '<p class="muted">Годовых оценок за прошлые годы нет.</p>') + '<p class="muted">«Сейчас» — средняя из оценок, которые выходят по текущему среднему.</p></section>';
    top += '<section><h2>Этот год против ' + pmgYearLabel(prevY) + '</h2>' + (cmp.length ? pmgCompareList(cmp) : '<p class="muted">Годовых за прошлый год не нашлось.</p>') + '</section>';
    top += '</div>';
  }
  top = '<div class="report-cta"><div><b>Отчёт для родителей</b><span class="muted">Красивая картинка с итогами четверти или года: можно скачать или сразу отправить в мессенджер.</span></div><button class="btn primary" data-act="report">Сделать отчёт</button></div>' + top;
  return top + '<h2>Все итоговые</h2><p class="muted">Итоговые оценки этого года и годовые за прошлые годы. Контуром — прогноз на текущую четверть.</p>' +
    '<div class="table-wrap"><table class="finals"><thead><tr><th></th>' + cols.map((c) => '<th scope="col">' + pmgEsc(c.label) + '</th>').join('') +
    pastYears.map((y) => '<th scope="col" class="past">' + y + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}


// ---------- Сравнение с прошлыми годами ----------

function pmgSchoolYear(dateStr) {
  const t = pmgParseDate(dateStr);
  return t.getMonth() >= 8 ? t.getFullYear() : t.getFullYear() - 1;
}
function pmgYearLabel(y) { return y + '/' + String(y + 1).slice(2); }
function pmgNormName(n) { return (n || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^а-яёa-z ]/g, '').trim(); }

// Итоговые прошлого учебного года по предмету: { annual, terms: {code: value} }
function pmgPrevYear() {
  const d = pmg.data;
  const year = pmgPeriods().find((p) => p.kind === 'year');
  const cur = year ? year.from.getFullYear() : (new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  const prev = cur - 1;
  const byId = new Map(), byName = new Map();
  for (const f of d.finals) {
    if (f.value == null || pmgSchoolYear(f.date) !== prev) continue;
    for (const [map, k] of [[byId, f.subjectId], [byName, pmgNormName(f.subject)]]) {
      if (!map.has(k)) map.set(k, { annual: null, terms: {} });
      const e = map.get(k);
      if (f.type === '3011') e.annual = f.value; else e.terms[f.type] = f.value;
    }
  }
  return { year: prev, get: (id, name) => byId.get(id) || byName.get(pmgNormName(name)) || null };
}

// Средняя годовая по годам + прогноз на этот год.
function pmgYearsPoints() {
  const d = pmg.data;
  const by = new Map();
  for (const f of d.finals) {
    if (f.type !== '3011' || f.value == null) continue;
    const y = pmgSchoolYear(f.date);
    if (!by.has(y)) by.set(y, []);
    by.get(y).push(f.value);
  }
  const year = pmgPeriods().find((p) => p.kind === 'year');
  const curY = year ? year.from.getFullYear() : null;
  const pts = [...by.entries()].filter(([y]) => y !== curY).sort((a, b) => a[0] - b[0]).slice(-5)
    .map(([y, v]) => ({ label: pmgYearLabel(y), avg: pmgAvg(v), count: v.length }));
  const st = pmgStats(year || null).filter((s) => s.values.length);
  if (st.length) pts.push({ label: 'Сейчас', avg: pmgAvg(st.map((s) => s.rounded)), count: st.length, current: true });
  return pts;
}

// По каждому предмету: прошлогодняя годовая и что выходит сейчас.
function pmgCompareRows(period) {
  const prev = pmgPrevYear();
  return pmgStats(period).filter((s) => s.values.length).map((s) => {
    const p = prev.get(s.id, s.name);
    return { s, last: p ? p.annual : null };
  }).filter((r) => r.last != null);
}

// ---------- Анимации ----------

function pmgAfterRender(quiet) {
  pmgPassAfterRender();
  pmgCalPlace(false);
  pmgHwStripSync(false);
  pmgTabSel();
  requestAnimationFrame(pmgFxLoop);
  if (!quiet && !pmgReduced()) {
    pmg.root.querySelectorAll('[data-count-int]').forEach((el) => {
      const to = +el.dataset.countInt;
      if (!to) return;
      const t0 = performance.now(), dur = Math.min(900, 300 + to * 25);
      const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
      el.textContent = 0;
      requestAnimationFrame(step);
    });
  }
  if (pmgReduced()) return;
  pmg.root.querySelectorAll('.count').forEach((el) => {
    const from = parseFloat(el.dataset.from), to = parseFloat(el.dataset.to);
    if (!isFinite(from) || !isFinite(to) || from === to) return;
    el.classList.remove('count');
    const t0 = performance.now(), dur = el.classList.contains('hero-avg') ? 1100 : 450;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pmgFmtAvg(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}


// ---------- Живые эффекты ----------
// Фон: два мягких пятна света плывут за курсором с запаздыванием, плюс «прожектор» под курсором.
const pmgFxState = { tx: .5, ty: .5, x: .5, y: .5, raf: 0, active: false };

function pmgFxLoop() {
  const fx = pmgQ('.bg-fx');
  const st = pmgFxState;
  st.x += (st.tx - st.x) * 0.06;
  st.y += (st.ty - st.y) * 0.06;
  if (fx) { fx.style.setProperty('--px', (st.x - 0.5).toFixed(4)); fx.style.setProperty('--py', (st.y - 0.5).toFixed(4)); }
  if (Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.001) st.raf = requestAnimationFrame(pmgFxLoop);
  else st.raf = 0;
}

const PMG_GLARE = '.hero, .hw-hero, .abs-hero, .two > section, .card, .chart-box, .hwc, .lesson, .fact, .subj-row, .subj-list, .table-wrap, .day-strip';
const PMG_TILT = '.fact, .hero, .hw-hero, .abs-hero';

function pmgFxMove(e) {
  if (pmgReduced()) return;
  const panel = pmgQ('.panel');
  if (!panel) return;
  const r = panel.getBoundingClientRect();
  if (!r.width) return;
  pmgFxState.tx = (e.clientX - r.left) / r.width;
  pmgFxState.ty = (e.clientY - r.top) / r.height;
  if (!pmgFxState.raf) pmgFxState.raf = requestAnimationFrame(pmgFxLoop);

  // Блик на карточке под курсором и лёгкий наклон
  const target = e.target.closest ? e.target.closest(PMG_GLARE) : null;
  if (pmgFxState.card && pmgFxState.card !== target) { pmgFxState.card.style.removeProperty('--rx'); pmgFxState.card.style.removeProperty('--ry'); }
  pmgFxState.card = target;
  if (!target) return;
  const b = target.getBoundingClientRect();
  const px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
  target.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
  target.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  if (target.matches(PMG_TILT)) {
    const k = target.classList.contains('fact') ? 6 : 2.2;
    target.style.setProperty('--rx', ((0.5 - py) * k).toFixed(2) + 'deg');
    target.style.setProperty('--ry', ((px - 0.5) * k).toFixed(2) + 'deg');
  }
}

function pmgFxLeave() {
  pmgFxState.tx = .5; pmgFxState.ty = .5;
  if (!pmgFxState.raf) pmgFxState.raf = requestAnimationFrame(pmgFxLoop);
  if (pmgFxState.card) { pmgFxState.card.style.removeProperty('--rx'); pmgFxState.card.style.removeProperty('--ry'); pmgFxState.card = null; }
}

function pmgFxBind() {
  pmg.root.addEventListener('pointermove', pmgFxMove, { passive: true });
  pmg.root.addEventListener('pointerleave', pmgFxLeave, true);
  if (pmg.mode === 'page') document.addEventListener('pointerleave', pmgFxLeave);
}

// ---------- Действия ----------

// Действия, за которые даются задания дня
function pmgNoteNeed() {
  const G = pmg.game && pmg.game.view;
  if (G && G.weak && G.weak.id === pmg.subjectId) pmgGameMsg('action', { key: 'need:' + pmgIso(new Date()) });
}
function pmgNoteTab() {
  if (pmg.tab === 'day') pmgGameMsg('action', { key: 'sched:' + pmgIso(new Date()) });
}
function pmgXpLineUpdate() {
  const el = pmgQ('.xpline'), G = pmg.game && pmg.game.view;
  if (!el || !G) { if (!el && G && pmgQ('.head')) pmgQ('.head').insertAdjacentHTML('afterend', pmgXpLine()); return; }
  el.querySelector('.xpl-lv').textContent = G.level.level;
  el.querySelector('i').style.width = (G.level.need ? G.level.into / G.level.need * 100 : 100).toFixed(1) + '%';
  el.dataset.tip = 'Уровень ' + G.level.level + ' · ' + G.level.into + ' из ' + G.level.need + ' XP';
}

async function pmgSaveSettings() { await pmgStorageSet({ pmg_settings: pmg.settings }); }

async function pmgRefresh() {
  if (pmg.loading) return;
  pmg.loading = true;
  pmgRender(true);
  try {
    const r = await chrome.runtime.sendMessage({ kind: 'pmg-sync' });
    if (r && !r.ok && pmg.mode === 'drawer') {
      // Фон не смог — пробуем прямо со страницы дневника
      try {
        const data = await pmgLoadAll(pmg.settings.studentId);
        await pmgStorageSet({ pmg_cache: data, pmg_status: { ok: true, at: Date.now(), via: 'page' } });
      } catch (e) { /* статус уже записан фоном */ }
    }
  } catch (e) { /* фон перезапускается — данные придут позже */ }
  pmg.loading = false;
  const s = await pmgStorageGet(['pmg_cache', 'pmg_status']);
  if (s.pmg_cache) pmg.data = pmgRevive(s.pmg_cache);
  pmg.status = s.pmg_status || null;
  pmgRender(true);
  pmgLauncherUpdate();
}

function pmgBind() {
  const r = pmg.root;
  pmgFxBind();
  r.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
    const act = t.dataset.act, v = t.dataset.v;
    if (act === 'launch') return pmg.open ? pmgClose() : pmgOpen();
    if (act === 'close') return pmgClose();
    if (act === 'report') return pmgOpenReport();
    if (act === 'report-kind') return pmgOpenReport(v);
    if (act === 'report-close') return pmgCloseReport();
    if (act === 'report-save') return pmgSaveReport();
    if (act === 'report-copy') return pmgCopyReport();
    if (act === 'refresh') return pmgRefresh();
    if (act === 'upd-get') { chrome.runtime.sendMessage({ kind: 'pmg-update-download' }); pmg.updOpen = true; pmgRender(true, true); return; }
    if (act === 'upd-reload') { chrome.runtime.sendMessage({ kind: 'pmg-reload' }); t.disabled = true; t.textContent = 'Перезапускаю…'; setTimeout(() => location.reload(), 1500); return; }
    if (act === 'open-app') { chrome.runtime.sendMessage({ kind: 'pmg-open-app', tab: pmg.tab }); return; }
    if (act === 'tab') { pmg.tab = t.dataset.tab; if (pmg.tab === 'homework') pmg.hwAnimate = true; pmgNoteTab(); pmgRender(); if (pmg.mode === 'page') history.replaceState(null, '', '#' + pmg.tab); return; }
    if (act === 'subject') { pmg.tab = 'subjects'; pmg.subjectId = +t.dataset.id; pmgNoteNeed(); pmgRender(); return; }
    if (act === 'pick') { pmg.subjectId = +t.dataset.id; pmgNoteNeed(); pmgRender(true); return; }
    if (act === 'target') { pmg.target[pmg.subjectId] = +v; pmgRender(true); return; }
    if (act === 'add') { (pmg.whatIf[pmg.subjectId] = pmg.whatIf[pmg.subjectId] || []).push(+v); pmgRender(true); return; }
    if (act === 'rm') { pmg.whatIf[pmg.subjectId].splice(+t.dataset.i, 1); pmgRender(true); return; }
    if (act === 'reset') { pmg.whatIf[pmg.subjectId] = []; pmgRender(true); return; }
    if (act === 'past') { pmg.showPast = !pmg.showPast; pmgRender(true); return; }
    if (act === 'overdue-toggle') { pmg.showOverdue = !pmg.showOverdue; const g = t.closest('.hwg'); g.classList.toggle('open', pmg.showOverdue); t.setAttribute('aria-expanded', pmg.showOverdue); return; }
    if (act === 'hw-jump') {
      const g = pmgQ('#hwg-' + v), sheet = pmgQ('.sheet'), strip = pmgQ('.day-strip');
      if (v === 'overdue' && !pmg.showOverdue) { pmg.showOverdue = true; g.classList.add('open'); }
      if (g && sheet) sheet.scrollTo({ top: g.offsetTop - (strip ? strip.offsetHeight + 12 : 0), behavior: pmgReduced() ? 'auto' : 'smooth' });
      return;
    }
    if (act === 'hwview') { pmg.hwView = v; pmg.hwAnimate = true; pmgRender(true); return; }
    if (act === 'day') { if (v) { pmg.day = +v; pmgRender(); } return; }
    if (act === 'cal-day') { pmgCalSelect(+v); return; }
    if (act === 'cal-month') { pmgCalShiftMonth(+v); return; }
    if (act === 'cal-today') { const d = pmgToday(); pmg.calMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); pmg.calDay = d.getTime(); pmg.calDir = d.getTime() > pmg.calMonth ? 'from-right' : 'from-left'; pmgRender(true); return; }
    if (act === 'move') { pmg.moving = t.dataset.key || null; pmgRender(true); const inp = pmgQ('.date-in'); if (inp) inp.focus(); return; }
    if (act === 'move-reset') { delete pmg.overrides[t.dataset.key]; pmg.moving = null; await pmgStorageSet({ pmg_hw_due: pmg.overrides }); return; }
    if (act === 'threshold') { pmg.settings.threshold = +v; await pmgSaveSettings(); return; }
    if (act === 'theme') { pmg.settings.theme = v; pmgApplyTheme(); await pmgSaveSettings(); return; }
    if (act === 'theme-cycle') { const order = ['auto', 'light', 'dark']; pmg.settings.theme = order[(order.indexOf(pmg.settings.theme || 'auto') + 1) % 3]; pmgApplyTheme(); await pmgSaveSettings(); return; }
    if (act === 'bg') { pmg.settings.bg = v; pmgApplyTheme(); await pmgSaveSettings(); return; }
    if (act === 'keepalive') { pmg.settings.keepAlive = v === 'true'; await pmgSaveSettings(); return; }
    if (act === 'notify') { pmg.settings.notify = v === 'true'; await pmgSaveSettings(); return; }
    if (act === 'hwmode') { pmg.settings.hwMode = v; await pmgSaveSettings(); return; }
    if (await pmgOwnHwAct(act, t)) return;
    if (await pmgHealthAct(act, t)) return;
    await pmgPassAct(act, t);
  });
  r.addEventListener('input', pmgPassInput);
  r.addEventListener('keydown', pmgCalKeys);
  r.addEventListener('scroll', (e) => { if (e.target.classList && e.target.classList.contains('sheet') && pmg.tab === 'homework') pmgHwStripSync(true); }, true);
  window.addEventListener('resize', () => pmgCalPlace(false));
  r.addEventListener('change', async (e) => {
    const t = e.target, act = t.dataset.act;
    if (await pmgPassChange(e)) return;
    if (await pmgOwnHwChange(e)) return;
    if (act === 'period') { pmg.periodId = +t.value; pmgRender(); }
    if (act === 'pick-sel') { pmg.subjectId = +t.value; pmgRender(true); }
    if (act === 'student') { pmg.settings.studentId = +t.value; await pmgSaveSettings(); pmg.data = null; pmgRender(); pmgRefresh(); }
    if (act === 'done') {
      if (t.checked) pmg.done[t.dataset.key] = Date.now(); else delete pmg.done[t.dataset.key];
      pmg.root.querySelectorAll('input[data-act="done"]').forEach((x) => { if (x.dataset.key === t.dataset.key) { x.checked = t.checked; const c = x.closest('.hwc, .hw'); if (c) c.classList.toggle('done', t.checked); } });
      pmg.skipRender = true;
      if (pmg.tab === 'homework') pmgHwAfterToggle(t.dataset.key, t.checked);
      await pmgStorageSet({ pmg_done: pmg.done });
    }
    if (act === 'move-date' && t.value) {
      const [y, m, d] = t.value.split('-').map(Number);
      pmg.overrides[t.dataset.key] = new Date(y, m - 1, d).getTime();
      pmg.moving = null;
      await pmgStorageSet({ pmg_hw_due: pmg.overrides });
    }
  });
  // Подсказки
  const tip = pmgQ('.tip');
  r.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip;
    tip.hidden = false;
    const b = t.getBoundingClientRect(), tw = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, b.left + b.width / 2 - tw / 2)) + 'px';
    tip.style.top = (b.top - tip.offsetHeight - 8 < 8 ? b.bottom + 8 : b.top - tip.offsetHeight - 8) + 'px';
  });
  r.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-tip]')) tip.hidden = true; });

  // Фон обновил данные или поменялись настройки — перерисовываем
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    let changed = false;
    if (c.pmg_cache && c.pmg_cache.newValue) { pmg.data = pmgRevive(c.pmg_cache.newValue); changed = true; }
    if (c.pmg_status) { pmg.status = c.pmg_status.newValue; changed = true; }
    if (c.pmg_update) { pmg.update = c.pmg_update.newValue || null; changed = true; }
    if (c.pmg_health) { pmg.health = c.pmg_health.newValue || null; if (pmg.tab === 'health') changed = true; }
    if (c.pmg_cloud_at) { pmg.cloudAt = c.pmg_cloud_at.newValue || null; }
    if (c.pmg_own_hw) { pmg.ownHw = c.pmg_own_hw.newValue || {}; if (pmg.tab === 'homework' || pmg.tab === 'overview' || pmg.tab === 'day') changed = true; }
    if (c.pmg_hw_photos) { pmg.hwPhotos = c.pmg_hw_photos.newValue || {}; if (pmg.tab === 'homework' || pmg.tab === 'day') changed = true; }
    if (c.pmg_settings) { pmg.settings = { ...PMG_DEFAULT_SETTINGS, ...c.pmg_settings.newValue }; pmgApplyTheme(); changed = true; }
    if (c.pmg_hw_due) { pmg.overrides = c.pmg_hw_due.newValue || {}; changed = true; }
    if (c.pmg_done) {
      pmg.done = c.pmg_done.newValue || {};
      if (pmg.skipRender) pmg.skipRender = false; else changed = true;
    }
    if (c.pmg_profile) { pmg.profile = c.pmg_profile.newValue || {}; if (pmg.tab === 'pass' || pmg.tab === 'friends') changed = true; pmgApplyTheme(); }
    if (c.pmg_groups) { pmg.groups = c.pmg_groups.newValue || []; if (pmg.tab === 'friends' || pmg.tab === 'pass') changed = true; }
    if (c.pmg_boards) { pmg.boards = c.pmg_boards.newValue || {}; if (pmg.tab === 'pass') changed = true; }
    if (c.pmg_game) {
      const old = pmg.game; pmg.game = c.pmg_game.newValue || null;
      const vOld = old && old.view, vNew = pmg.game && pmg.game.view;
      const visual = !vOld || !vNew || vOld.xp !== vNew.xp || vOld.level.level !== vNew.level.level || JSON.stringify(vOld.quests) !== JSON.stringify(vNew.quests) || vOld.streak.days !== vNew.streak.days || JSON.stringify(old.achAll) !== JSON.stringify(pmg.game.achAll);
      if (visual && (pmg.tab === 'pass' || pmg.tab === 'friends')) changed = true;
      else if (visual) { pmgXpLineUpdate(); pmgPlayGains(); }
    }
    if (changed && (pmg.open || pmg.mode === 'page')) pmgRender(true, true);
    if (changed) pmgLauncherUpdate();
  });
}

// ---------- Панель справа на сайте ----------

function pmgOpen() {
  pmg.open = true;
  pmg.hwAnimate = true;
  pmgQ('.panel').hidden = false;
  pmgQ('.launcher').setAttribute('aria-expanded', 'true');
  pmgQ('.launcher').classList.add('hide');
  document.documentElement.classList.add('pmg-docked');
  pmgRender();
  pmgStorageSet({ pmg_drawer: true });
  pmgGameMsg('login');
  pmgPassPoll();
}

function pmgClose() {
  pmg.open = false;
  pmgQ('.panel').hidden = true;
  pmgQ('.tip').hidden = true;
  pmgQ('.launcher').setAttribute('aria-expanded', 'false');
  pmgQ('.launcher').classList.remove('hide');
  document.documentElement.classList.remove('pmg-docked');
  pmgStorageSet({ pmg_drawer: false });
}

function pmgLauncherUpdate() {
  const l = pmgQ('.launcher');
  if (!l || !pmg.data) return;
  const per = pmgCurrentPeriod();
  const avg = pmgAvg(pmg.data.marks.filter((m) => !per || pmgInPeriod(m, per)).map((m) => m.value));
  pmgQ('.launcher-avg').textContent = avg == null ? '' : pmgFmtAvg(avg);
  const n = pmgNextDayTodo(pmgHomework()).items.filter((i) => !i.done).length;
  const b = pmgQ('.launcher-badge');
  b.textContent = n; b.hidden = !n;
}

function pmgApplyTheme() {
  const el = pmg.mode === 'drawer' ? document.getElementById('pmg-host') : document.body;
  if (!el) return;
  const t = pmg.settings.theme || 'auto';
  if (t === 'auto') delete el.dataset.theme; else el.dataset.theme = t;
  el.dataset.bg = pmg.settings.bg || 'glyphs';
  const eq = (pmg.profile && pmg.profile.equipped) || {};
  if (eq.theme && eq.theme !== 'default') el.dataset.accent = eq.theme; else delete el.dataset.accent;
}

async function pmgLoadState() {
  const s = await pmgStorageGet(['pmg_cache', 'pmg_settings', 'pmg_done', 'pmg_hw_due', 'pmg_status', 'pmg_drawer', 'pmg_game', 'pmg_profile', 'pmg_groups', 'pmg_boards', 'pmg_update', 'pmg_health', 'pmg_cloud_at', 'pmg_own_hw', 'pmg_hw_photos']);
  pmg.ownHw = s.pmg_own_hw || {};
  pmg.hwPhotos = s.pmg_hw_photos || {};
  pmg.update = s.pmg_update || null;
  pmg.health = s.pmg_health || null;
  pmg.cloudAt = s.pmg_cloud_at || null;
  pmg.game = s.pmg_game || null; pmg.profile = s.pmg_profile || {}; pmg.groups = s.pmg_groups || []; pmg.boards = s.pmg_boards || {};
  if (pmg.game) pmg.gainsSeen = 0;
  pmg.settings = { ...PMG_DEFAULT_SETTINGS, ...(s.pmg_settings || {}) };
  if (!s.pmg_settings || s.pmg_settings.v !== 2) { pmg.settings.threshold = 0.55; pmg.settings.notify = true; pmg.settings.v = 2; }
  pmg.done = s.pmg_done || {};
  pmg.overrides = s.pmg_hw_due || {};
  pmg.status = s.pmg_status || null;
  if (s.pmg_cache && s.pmg_cache.student) pmg.data = pmgRevive(s.pmg_cache);
  pmgApplyTheme();
  return s;
}

function pmgFontsCss() {
  const f = (file, w, range) => '@font-face{font-family:"PMG Onest";src:url(' + chrome.runtime.getURL('fonts/' + file) + ') format("woff2");font-weight:' + w + ';font-display:swap;unicode-range:' + range + '}';
  const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
  const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  return [400, 600, 700].map((w) => f('onest-cyrillic-' + w + '.woff2', w, CYR) + f('onest-latin-' + w + '.woff2', w, LAT)).join('');
}

// Боковая панель на сайте дневника.
async function pmgMountDrawer() {
  if (document.getElementById('pmg-host')) return;
  const style = document.createElement('style');
  style.textContent = pmgFontsCss() +
    'html.pmg-docked{margin-right:min(580px,100vw)!important;transition:margin-right .25s ease}' +
    '@media (max-width:1100px){html.pmg-docked{margin-right:0!important}}';
  (document.head || document.documentElement).appendChild(style);

  const host = document.createElement('div');
  host.id = 'pmg-host';
  host.style.cssText = 'position:fixed;inset:auto;z-index:2147483646;';
  document.documentElement.appendChild(host);
  const sh = host.attachShadow({ mode: 'open' });
  pmg.root = sh;
  pmg.mode = 'drawer';
  sh.innerHTML = '<link rel="stylesheet" href="' + chrome.runtime.getURL('ui.css') + '"><link rel="stylesheet" href="' + chrome.runtime.getURL('pass.css') + '">' +
    '<button class="launcher" data-act="launch" aria-expanded="false" aria-controls="pmg-panel"><span class="launcher-mark" aria-hidden="true">' + PMG_LOGO + '</span><span class="launcher-text">Gradient</span><span class="launcher-avg"></span><span class="launcher-badge" hidden></span></button>' +
    '<aside class="panel drawer" id="pmg-panel" aria-label="Gradient" hidden></aside><div class="tip" role="tooltip" hidden></div>';
  pmgBind();
  const s = await pmgLoadState();
  pmgLauncherUpdate();
  if (s.pmg_drawer) pmgOpen();
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !pmg.open || !e.composedPath().includes(host)) return;
    if (pmgQ('.lvl-up')) pmgLevelClose(); else if (pmgQ('.gains-card')) pmgGainsClose(); else if (pmg.crop) { pmg.crop = null; pmgRender(true, true); }
    else if (pmgQ('.report-modal')) pmgCloseReport(); else pmgClose();
  });
}

// Отдельная вкладка расширения.
async function pmgMountPage(container) {
  const style = document.createElement('style');
  style.textContent = pmgFontsCss();
  document.head.appendChild(style);
  pmg.root = container;
  pmg.mode = 'page';
  pmg.open = true;
  pmg.hwAnimate = true;
  container.innerHTML = '<div class="panel page" aria-label="Gradient"></div><div class="tip" role="tooltip" hidden></div>';
  const fromHash = location.hash.slice(1);
  if (PMG_TABS.some(([k]) => k === fromHash)) pmg.tab = fromHash;
  if (fromHash === 'report') { pmg.tab = 'finals'; pmg.openReportOnLoad = true; }
  pmgBind();
  await pmgLoadState();
  pmgRender();
  pmgGameMsg('login');
  pmgPassPoll();
  if (pmg.tab === 'day') pmgNoteTab();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (pmgQ('.lvl-up')) pmgLevelClose(); else if (pmgQ('.gains-card')) pmgGainsClose(); else if (pmg.crop) { pmg.crop = null; pmgRender(true, true); } } });
  if (pmg.openReportOnLoad && pmg.data) pmgOpenReport('term');
  window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (PMG_TABS.some(([x]) => x === k) && k !== pmg.tab) { pmg.tab = k; pmgRender(); } });
  // Если данных нет или они старые — просим фон обновить
  if (!pmg.data || !pmg.status || Date.now() - (pmg.status.at || 0) > 10 * 60 * 1000) pmgRefresh();
}
