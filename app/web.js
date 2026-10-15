// Gradient на телефоне: главное из расширения — оценки, домашка (в том числе своя, с фото), здоровье и отчёты.
// Данные приходят с сервера: снимок дневника присылает расширение, шаги — Команда на iPhone.

const PMG_WEB_TABS = [
  ['home', 'Главная', '<path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>'],
  ['homework', 'Домашка', '<path d="M6 3.5h9.5L19 7v13.5H6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 11.5l2 2 4-4.2M9 17h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['grades', 'Оценки', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'],
  ['health', 'Здоровье', '<path d="M3 12h4l2.5-6 4 12 2.5-6H21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['reports', 'Отчёты', '<rect x="4" y="3" width="16" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8 15l2.5-3 2 2L16 9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>']
];
const PMG_WEB_KEYS = ['pmg_auth', 'pmg_cache', 'pmg_status', 'pmg_settings', 'pmg_done', 'pmg_hw_due', 'pmg_own_hw', 'pmg_hw_photos', 'pmg_health', 'pmg_cloud_at', 'pmg_mark_seen', 'pmg_game', 'pmg_profile'];
const PMG_WEB_SYNCED = ['pmg_done', 'pmg_hw_due', 'pmg_own_hw', 'pmg_hw_photos', 'pmg_settings', 'pmg_logins'];

const web = { authed: false, tab: 'home', syncing: false, syncErr: null, applying: false, lastSync: 0, pairErr: null, pairing: false, gradeSubj: null, hwView: 'days', showPast: false, enter: true };
pmg.mode = 'page';
pmg.open = true;

// ---------- «Фон» приложения: ответы на сообщения общего кода ----------
async function pmgWebMessage(msg) {
  if (!msg) return { ok: false };
  if (msg.kind === 'pmg-sync') { await pmgWebSync(); return { ok: !web.syncErr }; }
  if (msg.kind !== 'pmg-game') return { ok: true };
  switch (msg.op) {
    case 'login': return { ok: true };
    case 'health-key': return pmgHealthNewKey();
    case 'health-pull': return pmgHealthPull();
    case 'cloud-sync': await pmgWebSync(); return { ok: true };
    case 'hw-photo-upload': return { ok: true, path: await pmgHwPhotoUpload(msg.dataUrl) };
    case 'hw-photo-urls': return { ok: true, urls: await pmgHwPhotoUrls(msg.paths || [], false) };
  }
  return { ok: false, error: 'unknown_op' };
}
window.pmgWebMessage = pmgWebMessage;

// ---------- Состояние ----------
async function pmgWebLoad() {
  const s = await pmgStorageGet(PMG_WEB_KEYS);
  web.authed = !!(s.pmg_auth && s.pmg_auth.refresh_token);
  pmg.settings = { ...PMG_DEFAULT_SETTINGS, ...(s.pmg_settings || {}) };
  pmg.data = s.pmg_cache && s.pmg_cache.student ? pmgRevive(s.pmg_cache) : null;
  pmg.status = s.pmg_status || null;
  pmg.done = s.pmg_done || {};
  pmg.overrides = s.pmg_hw_due || {};
  pmg.ownHw = s.pmg_own_hw || {};
  pmg.hwPhotos = s.pmg_hw_photos || {};
  pmg.health = s.pmg_health || null;
  pmg.cloudAt = s.pmg_cloud_at || null;
  pmg.seen = s.pmg_mark_seen || {};
  pmg.game = s.pmg_game || null;
  pmg.profile = s.pmg_profile || {};
  pmgApplyTheme();
}

async function pmgWebSync() {
  if (!web.authed || web.syncing) return;
  web.syncing = true; web.syncErr = null; pmgWebRender(true);
  web.applying = true;
  try {
    const r = await pmgCloudAll({ pull: true });
    if (r.pull && !r.pull.ok && r.pull.error !== 'no_snapshot') web.syncErr = r.pull.error;
    if (r.pull && r.pull.error === 'no_snapshot') web.noSnapshot = true; else if (r.pull && r.pull.ok) web.noSnapshot = false;
    if (r.state && r.state.ok === false) web.syncErr = r.state.error;
  } catch (e) { web.syncErr = String(e.message || e); }
  if (/signed_out|invalid|refresh/i.test(web.syncErr || '')) { await pmgWebSignOut(true); return; }
  await pmgWebLoad();
  web.applying = false; web.syncing = false; web.lastSync = Date.now();
  pmgWebRender(true);
}

let pmgWebPushTimer = null;
chrome.storage.onChanged.addListener((c) => {
  if (web.applying) return;
  if (PMG_WEB_SYNCED.some((k) => c[k])) {
    clearTimeout(pmgWebPushTimer);
    pmgWebPushTimer = setTimeout(async () => { web.applying = true; try { await pmgCloudSync(); } catch (_) { /* в следующий раз */ } web.applying = false; }, 2500);
  }
});

async function pmgWebSignOut(lost) {
  const keep = (await pmgStorageGet('pmg_settings')).pmg_settings;
  await chrome.storage.local.clear();
  if (keep) await pmgStorageSet({ pmg_settings: { theme: keep.theme, stepGoal: keep.stepGoal } });
  web.authed = false; web.pairErr = lost ? 'Вход на этом телефоне потерялся. Подключи телефон заново кодом с компьютера.' : null;
  pmg.data = null;
  location.hash = '';
  pmgWebRender();
}
window.pmgWebSignOut = pmgWebSignOut;

async function pmgWebClaim(code) {
  web.pairing = true; web.pairErr = null; pmgWebRender();
  const r = await pmgPairClaim(code).catch((e) => ({ ok: false, error: String(e.message || e) }));
  web.pairing = false;
  if (!r.ok) {
    web.pairErr = r.error === 'bad_code' ? 'Код не подошёл: он одноразовый и живёт 10 минут. Возьми новый на компьютере.' : 'Не получилось подключиться: ' + r.error;
    pmgWebRender(); return;
  }
  history.replaceState(null, '', location.pathname);
  web.authed = true; web.tab = 'home';
  await pmgStorageSet({ pmg_logins: { [pmgIso(new Date())]: Date.now() } });
  await pmgWebSync();
}

// ---------- Отрисовка ----------
function pmgWebRender(keep) {
  const root = document.getElementById('app');
  const y = window.scrollY;
  if (!web.authed) { root.innerHTML = '<div class="panel web">' + pmgPairScreen() + '</div>'; return; }
  const views = { home: pmgWebHome, homework: pmgWebHomework, grades: pmgWebGrades, health: pmgWebHealth, reports: pmgWebReports };
  let body;
  if (!pmg.data && web.tab !== 'health') body = pmgWebNoData();
  else {
    try { body = (views[web.tab] || pmgWebHome)(); }
    catch (e) { console.error(e); body = '<section class="card"><p class="err">Что-то сломалось при отрисовке: ' + pmgEsc(e.message) + '</p></section>'; }
  }
  const keepModal = root.querySelector('.report-modal');
  root.innerHTML = '<div class="panel web">' + pmgWebHeader() +
    '<main class="w-main' + (web.enter ? ' enter' : '') + '" id="w-main">' + body + '</main>' +
    (web.tab === 'homework' && pmg.data ? '<button class="w-fab" data-act="own-new" aria-label="Добавить своё задание"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>' : '') +
    pmgWebNav() + pmgOwnHwForm() + pmgPhotoViewer() + '</div>';
  if (keepModal) root.querySelector('.panel').appendChild(keepModal);
  web.enter = false;
  if (keep) window.scrollTo(0, y);
  pmgWebAfter();
}
// Общий код зовёт pmgRender — направляем его сюда.
pmgRender = function (keepScroll) { pmgWebRender(keepScroll !== false); };

function pmgWebAfter() {
  // Плавный счёт чисел, как в расширении
  if (pmgReduced()) return;
  document.querySelectorAll('[data-count-int]').forEach((el) => {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    const to = +el.dataset.countInt, t0 = performance.now(), fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (!to) return;
    const step = (t) => { const k = Math.min(1, (t - t0) / 700); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

function pmgWebHeader() {
  const st = pmg.status;
  const t = pmg.settings.theme || 'auto';
  const when = st && st.at ? (() => { const d = new Date(st.at); const today = pmgToday(); const dd = new Date(d); dd.setHours(0, 0, 0, 0); return (dd.getTime() === today.getTime() ? 'сегодня' : pmgAgo(d)) + ' в ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); })() : '';
  const stale = st && st.at && Date.now() - st.at > 26 * 3600e3;
  return '<header class="w-head"><div class="brand"><span class="brand-mark">' + PMG_LOGO + '</span><div><span class="brand-name">Gradient</span>' +
    '<div class="who">' + (web.syncing ? 'обновляю…' : web.syncErr ? '<span class="err">нет связи</span>' : when ? '<span class="' + (stale ? 'stale' : '') + '">дневник ' + when + '</span>' : '') + '</div></div></div>' +
    '<div class="head-tools"><button class="icon-btn" data-act="w-theme" aria-label="Тема">' + pmgIcon(t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'auto') + '</button>' +
    '<button class="icon-btn' + (web.syncing ? ' spin' : '') + '" data-act="w-sync" aria-label="Обновить">' + pmgIcon('refresh') + '</button></div></header>';
}

function pmgWebNav() {
  return '<nav class="w-nav" aria-label="Разделы">' + PMG_WEB_TABS.map(([k, l, ic]) => '<button class="w-tab' + (web.tab === k ? ' on' : '') + '" data-act="w-tab" data-v="' + k + '" aria-current="' + (web.tab === k ? 'page' : 'false') + '"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' + ic + '</svg><span>' + l + '</span></button>').join('') + '</nav>';
}

function pmgWebNoData() {
  return '<section class="card w-empty"><div class="hl-empty-art">' + PMG_LOGO.replace('width="18" height="18"', 'width="44" height="44"') + '</div><h2>' + (web.syncing ? 'Загружаю дневник…' : 'Жду дневник с компьютера') + '</h2>' +
    '<p class="muted">Оценки и домашку присылает расширение Gradient на компьютере — после каждого обновления дневника. Открой там дневник или нажми «Обновить» в Gradient, и всё появится здесь.</p>' +
    '<button class="btn" data-act="w-sync">Проверить ещё раз</button></section>';
}

// ---------- Вход ----------
function pmgPairScreen() {
  return '<div class="w-pair"><div class="w-pair-logo"><span class="brand-mark big">' + PMG_LOGO.replace('width="18" height="18"', 'width="34" height="34"') + '</span></div>' +
    '<h1>Gradient</h1><p class="muted">Оценки, домашка, шаги и отчёты — на телефоне.</p>' +
    '<section class="card"><h3>Подключи телефон</h3><ol class="w-steps"><li>На компьютере открой Gradient → вкладка <b>«Здоровье»</b>.</li><li>Нажми <b>«Подключить телефон»</b>.</li><li>Наведи камеру iPhone на QR-код — или введи код ниже.</li></ol>' +
    '<input class="in w-code" data-act="w-code" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" maxlength="9" placeholder="ABCD-1234">' +
    (web.pairErr ? '<p class="err">' + pmgEsc(web.pairErr) + '</p>' : '') +
    '<button class="btn primary big" data-act="w-claim"' + (web.pairing ? ' disabled' : '') + '>' + (web.pairing ? 'Подключаю…' : 'Подключить') + '</button></section>' +
    '<p class="muted small w-foot">Пароль не нужен: телефон получает доступ только к твоему аккаунту Gradient. Выйти можно во вкладке «Здоровье».</p></div>';
}

// ---------- Главная ----------
function pmgWebHome() {
  const name = pmg.data.student && pmg.data.student.name ? pmg.data.student.name.split(/\s+/)[0] : '';
  const h = new Date().getHours();
  const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const today = pmgToday(), tom = new Date(today.getTime() + PMG_DAY);
  const items = pmgHomework();
  const next = (() => { for (let i = 1; i <= 7; i++) { const d = new Date(today.getTime() + i * PMG_DAY); const list = items.filter((x) => x.due && x.due.getTime() === d.getTime()); if (list.length) return { d, list }; } return null; })();
  let out = '<div class="w-hello"><h1>' + hi + (name ? ', ' + pmgEsc(name) : '') + '</h1><p class="muted">' + pmgHumanDay(today) + '</p></div>';
  if (web.noSnapshot === false && pmg.status && Date.now() - pmg.status.at > 26 * 3600e3) out += '<div class="w-note">Дневник обновлялся ' + pmgAgo(pmg.status.at) + '. Свежие оценки придут, когда на компьютере будет открыт браузер с Gradient.</div>';

  // Домашка на ближайший учебный день
  if (next) {
    const left = next.list.filter((x) => !x.done).length;
    out += '<section class="card w-next"><div class="card-head"><h3>' + (next.d.getTime() === tom.getTime() ? 'На завтра' : pmgHumanDay(next.d)) + '</h3><span class="w-pill' + (left ? '' : ' ok') + '">' + (left ? 'осталось ' + left : 'всё готово') + '</span></div>' +
      next.list.sort((a, b) => a.done - b.done || (a.dueNumber || 99) - (b.dueNumber || 99)).map((i) => pmgWebHwRow(i)).join('') +
      '<button class="link w-more" data-act="w-tab" data-v="homework">Вся домашка →</button></section>';
  }

  // Новые оценки
  const marks = pmg.data.marks.slice().map((m) => ({ ...m, g: pmg.seen[m.id] || pmgIso(pmgParseDate(m.date)) })).sort((a, b) => (b.g > a.g ? 1 : b.g < a.g ? -1 : b.id - a.id)).slice(0, 8);
  if (marks.length) {
    out += '<section class="card w-marks"><div class="card-head"><h3>Последние оценки</h3><button class="link" data-act="w-tab" data-v="grades">Все →</button></div><ul class="w-mlist">' +
      marks.map((m, i) => '<li style="--i:' + i + '">' + pmgMarkChip(m.value) + '<span class="w-ms">' + pmgEsc(m.subject) + '<small>' + pmgEsc((m.typeName || '').toLowerCase()) + '</small></span><span class="muted small">' + pmgShortIso(m.g) + '</span></li>').join('') + '</ul></section>';
  }

  // Четверть
  const period = pmgCurrentPeriod();
  if (period) {
    const stats = pmgStats(period).filter((s) => s.values.length);
    const all = stats.flatMap((s) => s.values), avg = pmgAvg(all);
    const fc = { 5: 0, 4: 0, 3: 0, 2: 0 }; stats.forEach((s) => { if (fc[s.rounded] != null) fc[s.rounded]++; });
    const left = pmgDaysLeft(period);
    const risky = stats.filter((s) => s.up === 1).slice(0, 3);
    out += '<section class="card w-term"><div class="w-term-row">' + pmgRing(avg, pmgRound(avg, pmg.settings.threshold), 86) +
      '<div><h3>' + pmgEsc(period.name) + '</h3><p class="muted">' + all.length + ' ' + pmgPlural(all.length, ['оценка', 'оценки', 'оценок']) + (left ? ' · до конца ' + left + ' ' + pmgPlural(left, ['день', 'дня', 'дней']) : '') + '</p>' +
      '<div class="w-fc">' + [5, 4, 3, 2].filter((k) => fc[k]).map((k) => pmgMarkChip(k) + '<span>×' + fc[k] + '</span>').join('') + '</div></div></div>' +
      (risky.length ? '<div class="w-close">' + risky.map((s) => '<button class="w-chipbtn" data-act="w-subj" data-v="' + s.id + '">' + pmgEsc(s.name) + ': одна пятёрка до «' + (s.rounded + 1) + '»</button>').join('') + '</div>' : '') + '</section>';
  }

  // Шаги
  const hd = pmg.health && pmg.health.days ? pmg.health.days : [];
  const tr = hd.find((r) => r.day === pmgIso(today));
  if (hd.length) {
    const goal = pmgHealthGoal(), st = tr && tr.steps != null ? tr.steps : 0;
    out += '<button class="card w-steps-card" data-act="w-tab" data-v="health"><div class="w-steps-top"><span>Шаги сегодня</span><b data-count-int="' + st + '">' + pmgFmtInt(st) + '</b></div>' +
      '<div class="xpbar"><i style="width:' + Math.min(100, st / goal * 100).toFixed(1) + '%"></i></div><small class="muted">цель ' + pmgFmtInt(goal) + (tr && tr.floors != null ? ' · ' + tr.floors + ' ' + pmgPlural(tr.floors, ['этаж', 'этажа', 'этажей']) : '') + '</small></button>';
  } else {
    out += '<button class="card w-steps-card" data-act="w-tab" data-v="health"><div class="w-steps-top"><span>Шаги и этажи</span><b>＋</b></div><small class="muted">Подключи Команду на iPhone — займёт пару минут</small></button>';
  }
  return out;
}
function pmgShortIso(iso) { const d = pmgDateOf(iso); return d.getDate() + ' ' + PMG_MONTHS[d.getMonth()].slice(0, 3); }

// ---------- Домашка ----------
function pmgWebHwRow(i, opts) {
  opts = opts || {};
  const photos = pmgPhotoStrip(i.key, {});
  const cam = opts.full ? '<label class="w-cam" aria-label="Прикрепить фото"><input type="file" accept="image/*" data-act="ph-file" data-key="' + pmgEsc(i.key) + '" hidden>' +
    (pmg.phBusy === i.key ? '<span class="ph-spin"></span>' : '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.6A1 1 0 0 1 10 4h4a1 1 0 0 1 .8.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12.3" r="3.3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>') + '</label>' : '';
  return '<article class="w-hw' + (i.done ? ' done' : '') + (opts.late ? ' late' : '') + '" data-key="' + pmgEsc(i.key) + '">' +
    '<label class="hw-check"><input type="checkbox" data-act="done" data-key="' + pmgEsc(i.key) + '"' + (i.done ? ' checked' : '') + '><span class="check">' + PMG_TICK + '</span><span class="sr">Сделано</span></label>' +
    '<div class="w-hw-main"><div class="w-hw-head"><b>' + pmgEsc(opts.bySubject ? (i.due ? pmgHumanDay(i.due) : 'Без срока') : i.subject) + '</b>' +
    (i.own ? '<span class="tag t-own">своё</span>' : '') + (i.check ? '<span class="tag t-check">' + pmgEsc(i.check) + '</span>' : '') +
    (opts.late && i.due ? '<span class="w-late">' + pmgShort(i.due) + '</span>' : i.dueNumber ? '<span class="muted small">' + i.dueNumber + '-й урок</span>' : '') + cam + '</div>' +
    '<p class="w-hw-text strike">' + (i.text ? pmgLinkify(i.text) : 'Задание во вложении') + '</p>' +
    (i.files && i.files.length ? '<div class="files">' + i.files.map((f) => '<span class="file">' + pmgEsc(f) + '</span>').join('') + '</div>' : '') +
    photos + (i.own && opts.full ? '<button class="link sm" data-act="own-edit" data-v="' + pmgEsc(i.id) + '">изменить</button>' : '') + '</div></article>';
}

function pmgWebHomework() {
  const items = pmgHomework();
  const today = pmgToday().getTime();
  const upcoming = items.filter((i) => i.due && i.due.getTime() >= today);
  const overdue = items.filter((i) => !i.done && i.due && i.due.getTime() < today && i.due.getTime() >= today - 7 * PMG_DAY);
  const left = upcoming.filter((i) => !i.done).length;
  const sortIn = (a, b) => (a.done - b.done) || ((a.dueNumber || 99) - (b.dueNumber || 99)) || a.subject.localeCompare(b.subject, 'ru');
  let out = '<div class="w-title"><h1>Домашка</h1><div class="seg-ctl mini">' + [['days', 'По дням'], ['subjects', 'Предметы']].map(([k, l]) => '<button class="' + (web.hwView === k ? 'on' : '') + '" data-act="w-hwview" data-v="' + k + '">' + l + '</button>').join('') + '</div></div>' +
    '<p class="muted w-sub">' + (left ? 'Осталось ' + left + ' ' + pmgPlural(left, ['задание', 'задания', 'заданий']) : 'Всё сделано') + (overdue.length ? ' · долгов ' + overdue.length : '') + '</p>';
  if (overdue.length) {
    out += '<section class="w-group late"><button class="w-group-tg" data-act="w-overdue"><h2>Долги за неделю<span class="w-pill bad">' + overdue.length + '</span></h2><span class="muted small">' + (web.showOverdue ? 'скрыть' : 'показать') + '</span></button>' +
      (web.showOverdue ? overdue.sort((a, b) => b.due - a.due).map((i) => pmgWebHwRow(i, { late: true, full: true })).join('') : '') + '</section>';
  }
  if (web.hwView === 'subjects') {
    const by = {};
    upcoming.forEach((i) => { (by[i.subject] = by[i.subject] || []).push(i); });
    Object.keys(by).sort((a, b) => a.localeCompare(b, 'ru')).forEach((s) => {
      out += '<section class="w-group"><h2>' + pmgEsc(s) + '</h2>' + by[s].sort((a, b) => a.due - b.due).map((i) => pmgWebHwRow(i, { bySubject: true, full: true })).join('') + '</section>';
    });
  } else {
    const days = [...new Set(upcoming.map((i) => i.due.getTime()))].sort((a, b) => a - b);
    days.forEach((t) => {
      const list = upcoming.filter((i) => i.due.getTime() === t).sort(sortIn);
      const n = list.filter((i) => !i.done).length;
      out += '<section class="w-group"><h2>' + pmgHumanDay(new Date(t)) + '<span class="w-pill' + (n ? '' : ' ok') + '">' + (n ? n : '✓') + '</span></h2>' + list.map((i) => pmgWebHwRow(i, { full: true })).join('') + '</section>';
    });
  }
  if (!upcoming.length && !overdue.length) out += '<section class="card w-empty"><p class="muted">Заданий на ближайшие дни нет. Добавь своё кнопкой «+».</p></section>';
  // Прошедшее — свернуто
  const past = items.filter((i) => i.due && i.due.getTime() < today && (i.done || i.due.getTime() < today - 7 * PMG_DAY)).sort((a, b) => b.due - a.due).slice(0, 30);
  if (past.length) {
    out += '<button class="link w-more" data-act="w-past">' + (web.showPast ? 'Скрыть прошедшее' : 'Показать прошедшее (' + past.length + ')') + '</button>';
    if (web.showPast) out += '<section class="w-group past">' + past.map((i) => pmgWebHwRow(i, { late: true })).join('') + '</section>';
  }
  return out;
}

// ---------- Оценки ----------
function pmgWebGrades() {
  const periods = pmgPeriods().filter((p) => p.kind === 'term').sort((a, b) => a.from - b.from).concat(pmgPeriods().filter((p) => p.kind === 'year'));
  const period = pmgCurrentPeriod();
  const stats = pmgStats(period).filter((s) => s.values.length).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const all = stats.flatMap((s) => s.values), avg = pmgAvg(all);
  let out = '<div class="w-title"><h1>Оценки</h1></div><div class="w-periods">' + periods.map((p) => '<button class="w-chipbtn' + (period && p.id === period.id ? ' on' : '') + '" data-act="w-period" data-v="' + p.id + '">' + pmgEsc(p.kind === 'year' ? 'Год' : p.name) + '</button>').join('') + '</div>';
  out += '<section class="card w-avg"><div class="w-term-row">' + pmgRing(avg, pmgRound(avg, pmg.settings.threshold), 92) + '<div><h3>Средний ' + pmgPeriodName(period) + '</h3><p class="muted">' + all.length + ' ' + pmgPlural(all.length, ['оценка', 'оценки', 'оценок']) + ' · ' + stats.length + ' ' + pmgPlural(stats.length, ['предмет', 'предмета', 'предметов']) + '</p>' +
    '<p class="muted small">«5» ставится от ' + pmgFmtAvg(4 + pmg.settings.threshold) + ', «4» — от ' + pmgFmtAvg(3 + pmg.settings.threshold) + '</p></div></div></section>';
  out += '<section class="w-subjs">' + stats.map((s, n) => {
    const open = web.gradeSubj === s.id;
    let h = '<article class="w-subj' + (open ? ' open' : '') + '" style="--i:' + n + '"><button class="w-subj-row" data-act="w-subj" data-v="' + s.id + '"><span class="w-subj-name">' + pmgEsc(s.name) + '<small>' + s.values.slice(-10).map((v) => '<i class="' + pmgMarkClass(v) + '">' + v + '</i>').join('') + '</small></span>' +
      '<span class="w-subj-avg ' + pmgMarkClass(s.rounded) + '">' + pmgFmtAvg(s.avg) + '<small>→ ' + s.rounded + '</small></span></button>';
    if (open) {
      const need = s.rounded < 5 ? pmgNeed(s.values, s.rounded + 1, pmg.settings.threshold, 5) : 0;
      const keep = s.rounded > 2 ? pmgReserve(s.values, s.rounded, pmg.settings.threshold, 3) : null;
      h += '<div class="w-subj-more">' +
        (s.rounded < 5 ? '<p>До «' + (s.rounded + 1) + '» ' + (need === Infinity ? 'пятёрками уже не дотянуть' : 'нужно <b>' + need + '</b> ' + pmgPlural(need, ['пятёрка', 'пятёрки', 'пятёрок']) + ' подряд') + '.</p>'
          : '<p>Выходит «5». ' + (keep == null || keep === Infinity ? '' : keep === 0 ? 'Запаса нет: тройка опустит до «4».' : 'Можно получить ещё ' + keep + ' ' + pmgPlural(keep, ['тройку', 'тройки', 'троек']) + ' и остаться на «5».') + '</p>') +
        (keep && s.rounded < 5 && keep !== Infinity ? '<p class="muted small">Запас: ' + keep + ' ' + pmgPlural(keep, ['тройка', 'тройки', 'троек']) + ' без потери «' + s.rounded + '».</p>' : '') +
        '<ul class="w-mlist">' + s.marks.slice().reverse().map((m) => '<li>' + pmgMarkChip(m.value) + '<span class="w-ms">' + pmgEsc(m.typeName || 'Оценка') + '</span><span class="muted small">' + pmgShortIso(pmgIso(pmgParseDate(m.date))) + '</span></li>').join('') + '</ul></div>';
    }
    return h + '</article>';
  }).join('') + '</section>';
  if (!stats.length) out += '<section class="card w-empty"><p class="muted">За этот период оценок нет.</p></section>';
  return out;
}

// ---------- Здоровье и отчёты ----------
function pmgWebHealth() { return '<div class="w-title"><h1>Здоровье</h1></div>' + pmgHealthView(); }

function pmgWebReports() {
  let out = '<div class="w-title"><h1>Отчёты</h1></div>';
  out += pmgWeekReport();
  const term = pmgPickPeriod(pmgPeriods(), new Date());
  out += '<section class="card w-rep"><div class="card-head"><h3>Картинка для родителей</h3></div><p class="muted">Красивый итог с оценками по всем предметам, лучшими днями и сравнением с прошлым годом. Можно сразу отправить в мессенджер.</p>' +
    '<div class="w-rep-btns"><button class="btn primary" data-act="report-kind" data-v="term">' + pmgEsc(term ? term.name : 'Четверть') + '</button><button class="btn" data-act="report-kind" data-v="year">Весь год</button></div></section>';
  return out;
}

// ---------- События ----------
function pmgWebBind() {
  const root = document.getElementById('app');
  pmg.root = root;
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
    const act = t.dataset.act, v = t.dataset.v;
    switch (act) {
      case 'w-tab': if (web.tab !== v) { web.tab = v; web.enter = true; history.replaceState(null, '', '#' + v); pmgWebRender(); window.scrollTo(0, 0); } else window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      case 'w-sync': pmgWebSync(); return;
      case 'w-theme': { const order = ['auto', 'light', 'dark']; pmg.settings.theme = order[(order.indexOf(pmg.settings.theme || 'auto') + 1) % 3]; pmgApplyTheme(); await pmgSaveSettings(); pmgWebRender(true); return; }
      case 'w-claim': { const c = (root.querySelector('[data-act="w-code"]') || {}).value || ''; pmgWebClaim(c); return; }
      case 'w-hwview': web.hwView = v; pmgWebRender(true); return;
      case 'w-past': web.showPast = !web.showPast; pmgWebRender(true); return;
      case 'w-overdue': web.showOverdue = !web.showOverdue; pmgWebRender(true); return;
      case 'w-period': pmg.periodId = +v; web.gradeSubj = null; pmgWebRender(true); return;
      case 'w-subj': if (web.tab !== 'grades') { web.tab = 'grades'; web.enter = true; history.replaceState(null, '', '#grades'); } web.gradeSubj = web.gradeSubj === +v ? null : +v; pmgWebRender(true); return;
      case 'report-kind': await pmgOpenReport(v); pmgWebReportShareBtn(); return;
      case 'report-close': pmgCloseReport(); return;
      case 'report-save': pmgSaveReport(); return;
      case 'report-copy': pmgCopyReport(); return;
      case 'report-share': pmgWebShareReport(); return;
    }
    if (await pmgOwnHwAct(act, t)) return;
    await pmgHealthAct(act, t);
  });
  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (await pmgOwnHwChange(e)) return;
    if (t.dataset.act === 'done') {
      if (t.checked) pmg.done[t.dataset.key] = Date.now(); else delete pmg.done[t.dataset.key];
      const card = t.closest('.w-hw'); if (card) card.classList.toggle('done', t.checked);
      if (t.checked && navigator.vibrate) navigator.vibrate(12);
      await pmgStorageSet({ pmg_done: pmg.done });
      setTimeout(() => pmgWebRender(true), 450);
    }
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.act === 'w-code') { e.preventDefault(); pmgWebClaim(e.target.value); } });
  root.addEventListener('input', (e) => { if (e.target.dataset.act === 'w-code') { let x = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (x.length > 4) x = x.slice(0, 4) + '-' + x.slice(4); e.target.value = x; } });
}

// «Поделиться» картинкой отчёта (на телефоне сразу в мессенджер).
function pmgWebReportShareBtn() {
  const foot = document.querySelector('.rm-foot');
  if (!foot || foot.querySelector('[data-act="report-share"]') || !navigator.canShare) return;
  const b = document.createElement('button'); b.className = 'btn primary'; b.dataset.act = 'report-share'; b.textContent = 'Отправить';
  foot.prepend(b);
}
async function pmgWebShareReport() {
  const c = pmg.reportCanvas; if (!c) return;
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], pmgReportFileName(), { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Итоги Gradient' }); else pmgSaveReport(); }
  catch (_) { /* отменили */ }
}

// ---------- Запуск ----------
(async function pmgWebStart() {
  const style = document.createElement('style'); style.textContent = pmgFontsCss(); document.head.appendChild(style);
  pmgWebBind();
  await pmgWebLoad();
  const h = location.hash.slice(1);
  if (PMG_WEB_TABS.some(([k]) => k === h)) web.tab = h;
  const pair = /pair=([A-Za-z0-9-]+)/.exec(location.hash);
  pmgWebRender();
  if (pair && !web.authed) { const inp = document.querySelector('[data-act="w-code"]'); if (inp) inp.value = pair[1]; await pmgWebClaim(pair[1]); }
  else if (pair) history.replaceState(null, '', location.pathname);
  if (web.authed) {
    // Вход в приложение — тоже засчитывается в огонёк
    const lg = (await pmgStorageGet('pmg_logins')).pmg_logins || {};
    const today = pmgIso(new Date());
    if (!lg[today]) { lg[today] = Date.now(); await pmgStorageSet({ pmg_logins: lg }); }
    pmgWebSync();
  }
  window.addEventListener('hashchange', () => {
    const m = /pair=([A-Za-z0-9-]+)/.exec(location.hash);
    if (m && !web.authed) pmgWebClaim(m[1]);
    const k = location.hash.slice(1);
    if (web.authed && PMG_WEB_TABS.some(([x]) => x === k) && k !== web.tab) { web.tab = k; web.enter = true; pmgWebRender(); }
  });
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - web.lastSync > 5 * 60e3) pmgWebSync(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - web.lastSync > 60e3) pmgWebSync(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
