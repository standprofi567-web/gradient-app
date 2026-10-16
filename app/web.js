// Gradient на телефоне: главное из расширения — оценки, домашка (в том числе своя, с фото), отчёты и Gradient Pass.
// Данные приходят с сервера: снимок дневника присылает расширение. Очки Pass телефон считает тем же кодом, что и расширение.

const PMG_WEB_TABS = [
  ['home', 'Главная', '<path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>'],
  ['homework', 'Домашка', '<path d="M6 3.5h9.5L19 7v13.5H6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 11.5l2 2 4-4.2M9 17h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['grades', 'Оценки', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'],
  ['pass', 'Pass', '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m12 9 .9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z" fill="currentColor"/>'],
  ['friends', 'Друзья', '<circle cx="9" cy="8.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.7c1.9.6 3.1 2.2 3.5 4.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>']
];
const PMG_WEB_KEYS = ['pmg_devices', 'pmg_auth', 'pmg_cache', 'pmg_status', 'pmg_settings', 'pmg_done', 'pmg_hw_due', 'pmg_own_hw', 'pmg_hw_photos', 'pmg_health', 'pmg_cloud_at', 'pmg_mark_seen', 'pmg_game', 'pmg_profile', 'pmg_push_hide', 'pmg_groups', 'pmg_boards'];
const PMG_WEB_SYNCED = ['pmg_done', 'pmg_hw_due', 'pmg_own_hw', 'pmg_hw_photos', 'pmg_settings', 'pmg_logins', 'pmg_quests', 'pmg_wquests', 'pmg_actions', 'pmg_mark_seen', 'pmg_profile'];

const web = { authed: false, tab: 'home', syncing: false, syncErr: null, applying: false, lastSync: 0, pairErr: null, pairing: false, gradeSubj: null, hwView: 'days', showPast: false, enter: true };
pmg.mode = 'page';
pmg.open = true;

// ---------- «Фон» приложения: ответы на сообщения общего кода ----------
async function pmgWebMessage(msg) {
  if (!msg) return { ok: false };
  if (msg.kind === 'pmg-sync') { await pmgWebSync(); return { ok: !web.syncErr }; }
  if (msg.kind !== 'pmg-game') return { ok: true };
  switch (msg.op) {
    case 'login': {
      const lg = (await pmgStorageGet('pmg_logins')).pmg_logins || {}, today = pmgIso(new Date());
      if (!lg[today]) { lg[today] = Date.now(); await pmgStorageSet({ pmg_logins: lg }); }
      if (pmg.data) await pmgGameRun({ push: true });
      return { ok: true };
    }
    case 'health-key': return pmgHealthNewKey();
    case 'health-pull': return pmgHealthPull();
    case 'devices': { const r = await pmgDevicesSync('web'); await pmgWebLoad(); return r; }
    case 'device-revoke': { const r = await pmgDeviceRevoke(msg.id); await pmgWebLoad(); return r; }
    case 'cloud-sync': await pmgWebSync(); return { ok: true };
    case 'hw-photo-upload': return { ok: true, path: await pmgHwPhotoUpload(msg.dataUrl) };
    case 'hw-photo-urls': return { ok: true, urls: await pmgHwPhotoUrls(msg.paths || [], false) };
  }
  // Всё остальное про Pass — тот же код, что в расширении
  if (typeof pmgGameMessage === 'function') return pmgGameMessage(msg);
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
  pmg.devices = s.pmg_devices || null;
  pmg.groups = s.pmg_groups || []; pmg.boards = s.pmg_boards || {};
  web.pushHide = !!s.pmg_push_hide;
  if (typeof pmgPushState === 'function') web.push = await pmgPushState();
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
    if (r.devices && r.devices.revoked) { web.applying = false; web.syncing = false; await pmgWebSignOut(true, 'Этот телефон отключили на компьютере. Чтобы вернуть, подключи его заново кодом.'); return; }
  } catch (e) { web.syncErr = String(e.message || e); }
  if (/signed_out|invalid|refresh/i.test(web.syncErr || '')) { await pmgWebSignOut(true); return; }
  try { await pmgGameRun({ push: true }); } catch (e) { console.warn('pass', e); }
  await pmgWebLoad();
  web.applying = false; web.syncing = false; web.lastSync = Date.now();
  pmgWebRender(true);
}

let pmgWebPushTimer = null;
// Pass: состояние игры меняется — перерисовать и показать новые очки
let pmgWebGameTimer = null, pmgWebFigTimer = null;
chrome.storage.onChanged.addListener((c) => {
  if (c.pmg_game) {
    const old = pmg.game; pmg.game = c.pmg_game.newValue || null;
    const vo = old && old.view, vn = pmg.game && pmg.game.view;
    if (web.tab === 'pass' && (!vo || !vn || vo.xp !== vn.xp || vo.level.level !== vn.level.level || JSON.stringify(vo.quests) !== JSON.stringify(vn.quests) || vo.streak.days !== vn.streak.days)) pmgWebRender(true);
    if (web.tab === 'pass') pmgPlayGains();
  }
  if (c.pmg_profile) {
    pmg.profile = c.pmg_profile.newValue || {};
    if (web.tab === 'pass' || web.tab === 'friends') pmgWebRender(true);
    if (web.tab === 'friends') { clearTimeout(pmgWebFigTimer); pmgWebFigTimer = setTimeout(() => pmgFriendsLoad(), 1500); }
  }
  if (c.pmg_groups) pmg.groups = c.pmg_groups.newValue || [];
  if (c.pmg_boards) pmg.boards = c.pmg_boards.newValue || {};
  if (!web.applying && pmg.data && (c.pmg_done || c.pmg_actions)) { clearTimeout(pmgWebGameTimer); pmgWebGameTimer = setTimeout(() => pmgGameRun({ push: true }).catch(() => {}), 600); }
});
chrome.storage.onChanged.addListener((c) => {
  if (web.applying) return;
  if (PMG_WEB_SYNCED.some((k) => c[k])) {
    clearTimeout(pmgWebPushTimer);
    pmgWebPushTimer = setTimeout(async () => { web.applying = true; try { await pmgCloudSync(); } catch (_) { /* в следующий раз */ } web.applying = false; }, 2500);
  }
});

async function pmgWebSignOut(lost, why) {
  const keep = (await pmgStorageGet('pmg_settings')).pmg_settings;
  await chrome.storage.local.clear();
  if (keep) await pmgStorageSet({ pmg_settings: { theme: keep.theme, stepGoal: keep.stepGoal } });
  web.authed = false; web.pairErr = why || (lost ? 'Вход на этом телефоне потерялся. Подключи телефон заново кодом с компьютера.' : null);
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
  const views = { home: pmgWebHome, homework: pmgWebHomework, grades: pmgWebGrades, pass: pmgWebPass, friends: pmgWebFriends, me: pmgWebMe };
  let body;
  if (!pmg.data && web.tab !== 'me' && web.tab !== 'friends') body = pmgWebNoData();
  else {
    try { body = (views[web.tab] || pmgWebHome)(); }
    catch (e) { console.error(e); body = '<section class="card"><p class="err">Что-то сломалось при отрисовке: ' + pmgEsc(e.message) + '</p></section>'; }
  }
  const keepModal = root.querySelector('.report-modal');
  const keepFx = [...root.querySelectorAll('.gains-card, .lvl-up, .streak-scene')];
  root.innerHTML = '<div class="panel web">' + pmgWebHeader() +
    '<main class="w-main' + (web.enter ? ' enter' : '') + '" id="w-main">' + body + '</main>' +
    (web.tab === 'homework' && pmg.data ? '<button class="w-fab" data-act="own-new" aria-label="Добавить своё задание"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>' : '') +
    pmgWebNav() + pmgOwnHwForm() + pmgPhotoViewer() + (web.tab === 'pass' || web.tab === 'friends' ? pmgCropModal() : '') + '</div>';
  if (keepModal) root.querySelector('.panel').appendChild(keepModal);
  keepFx.forEach((el) => root.querySelector('.panel').appendChild(el));
  web.enter = false;
  if (keep) window.scrollTo(0, y);
  pmgWebAfter();
}
// Общий код зовёт pmgRender — направляем его сюда.
pmgRender = function (keepScroll) { pmgWebRender(keepScroll !== false); };

function pmgWebAfter() {
  if (typeof pmgStairsAfter === 'function') pmgStairsAfter(document.getElementById('app'));
  if (web.tab === 'pass' && typeof pmgPassAfterRender === 'function') pmgPassAfterRender();
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
    '<div class="head-tools"><button class="icon-btn' + (web.tab === 'me' ? ' on' : '') + '" data-act="w-tab" data-v="me" aria-label="Настройки"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button class="icon-btn" data-act="w-theme" aria-label="Тема">' + pmgIcon(t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'auto') + '</button>' +
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
    '<h1>Gradient</h1><p class="muted">Оценки, домашка, отчёты и Gradient Pass — на телефоне.</p>' +
    '<section class="card"><h3>Подключи телефон</h3><ol class="w-steps"><li>На компьютере открой Gradient → вкладка <b>«Устройства»</b>.</li><li>Нажми <b>«Подключить телефон»</b>.</li><li>Наведи камеру телефона на QR-код — или введи код ниже.</li></ol>' +
    '<input class="in w-code" data-act="w-code" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" maxlength="9" placeholder="ABCD-1234">' +
    (web.pairErr ? '<p class="err">' + pmgEsc(web.pairErr) + '</p>' : '') +
    '<button class="btn primary big" data-act="w-claim"' + (web.pairing ? ' disabled' : '') + '>' + (web.pairing ? 'Подключаю…' : 'Подключить') + '</button></section>' +
    '<p class="muted small w-foot">Пароль не нужен: телефон получает доступ только к твоему аккаунту Gradient. Выйти можно в настройках (шестерёнка сверху).</p></div>';
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
  out += pmgWebPushCard(false);
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
      marks.map((m, i) => '<li style="--i:' + i + '">' + pmgMarkChip(m.value) + '<span class="w-ms">' + pmgEsc(m.subject) + '<small>' + pmgEsc((m.typeName || '').toLowerCase()) + '</small></span><span class="muted small">' + pmgWebShortIso(m.g) + '</span></li>').join('') + '</ul></section>';
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
    out += '<button class="card w-steps-card" data-act="w-tab" data-v="friends"><div class="w-steps-top"><span>Шаги сегодня</span><b data-count-int="' + st + '">' + pmgFmtInt(st) + '</b></div>' +
      '<div class="xpbar"><i style="width:' + Math.min(100, st / goal * 100).toFixed(1) + '%"></i></div><small class="muted">цель ' + pmgFmtInt(goal) + (tr && tr.floors != null ? ' · ' + tr.floors + ' ' + pmgPlural(tr.floors, ['этаж', 'этажа', 'этажей']) : '') + '</small></button>';
  }
  return out;
}
// Уведомления о новых оценках на телефон
function pmgWebPushCard(inSettings) {
  const p = web.push;
  if (!web.authed || !p) return '';
  if (!inSettings && (p.subscribed || web.pushHide)) return '';
  const bell = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  let body, btn = '';
  if (p.subscribed) { body = 'Включены на этом телефоне. Новые оценки и домашка придут сюда, пока Gradient работает на компьютере.'; btn = '<button class="btn small" data-act="w-push-test">Проверить</button><button class="btn small ghost" data-act="w-push-off">Выключить</button>'; }
  else if (p.ios && !p.standalone) body = 'На iPhone уведомления работают, только если Gradient добавлен на экран «Домой»: нажми «Поделиться» → «На экран „Домой“» и открой его оттуда.';
  else if (!p.supported) body = 'Этот браузер не умеет присылать уведомления. Открой Gradient в Safari (iPhone) или Chrome (Android).';
  else if (p.permission === 'denied') body = 'Уведомления запрещены в настройках браузера для этого сайта. Разреши их там и вернись сюда.';
  else { body = 'Новая оценка или домашка — сразу на экран телефона.'; btn = '<button class="btn primary small" data-act="w-push-on">Включить уведомления</button>'; }
  return '<section class="card w-push' + (inSettings ? ' in-set' : '') + '"><div class="w-push-row"><span class="w-push-ic">' + bell + '</span><div><h3>Уведомления</h3><p class="muted">' + body + '</p></div>' +
    (!inSettings && !p.subscribed ? '<button class="w-push-x" data-act="w-push-hide" aria-label="Скрыть">×</button>' : '') + '</div>' + (btn ? '<div class="w-push-btns">' + btn + '</div>' : '') + '</section>';
}
function pmgWebShortIso(iso) { const d = pmgDateOf(iso); return d.getDate() + ' ' + PMG_MONTHS[d.getMonth()].slice(0, 3); }

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
        '<ul class="w-mlist">' + s.marks.slice().reverse().map((m) => '<li>' + pmgMarkChip(m.value) + '<span class="w-ms">' + pmgEsc(m.typeName || 'Оценка') + '</span><span class="muted small">' + pmgWebShortIso(pmgIso(pmgParseDate(m.date))) + '</span></li>').join('') + '</ul></div>';
    }
    return h + '</article>';
  }).join('') + '</section>';
  if (!stats.length) out += '<section class="card w-empty"><p class="muted">За этот период оценок нет.</p></section>';
  out += pmgWebReports();
  return out;
}

// ---------- Здоровье и отчёты ----------
// ---------- Pass: тот же экран, что во вкладке расширения ----------
function pmgWebPass() {
  setTimeout(() => { if (typeof pmgPlayGains === 'function') pmgPlayGains(); }, 300);
  return '<div class="sheet tab-pass w-pass">' + pmgPassView() + '</div>';
}

// ---------- Настройки: уведомления, устройства, выход ----------
function pmgWebMe() {
  return '<div class="w-title"><h1>Настройки</h1></div>' + pmgWebPushCard(true) + '<div class="health devs">' + pmgDevicesBlock() + '</div>';
}

function pmgWebReports() {
  let out = '<h2 class="w-h2">Отчёты</h2>';
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
      case 'w-tab': if (web.tab !== v) { web.tab = v; web.enter = true; history.replaceState(null, '', '#' + v); if (v === 'friends') pmgFriendsLoad(); if (v === 'me') pmgGameMsg('devices'); pmgWebRender(); window.scrollTo(0, 0); } else window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      case 'tab': { const k = t.dataset.tab === 'friends' ? 'friends' : t.dataset.tab === 'pass' ? 'pass' : 'home'; web.tab = k; web.enter = true; history.replaceState(null, '', '#' + k); if (k === 'friends') pmgFriendsLoad(); pmgWebRender(); window.scrollTo(0, 0); return; }
      case 'w-sync': pmgWebSync(); return;
      case 'w-push-on': { t.disabled = true; const r = await pmgPushSubscribe().catch((e) => ({ ok: false, error: e.message })); web.push = await pmgPushState(); pmgToast(r.ok ? 'Готово — сейчас придёт проверочное уведомление' : r.error === 'denied' ? 'Ты не разрешил уведомления' : r.error === 'ios_home' ? 'Сначала добавь Gradient на экран «Домой»' : 'Не получилось: ' + r.error); pmgWebRender(true); return; }
      case 'w-push-off': await pmgPushUnsubscribe(); web.push = await pmgPushState(); pmgToast('Уведомления выключены'); pmgWebRender(true); return;
      case 'w-push-test': { const r = await pmgPushTest().catch(() => null); pmgToast(r && r.sent ? 'Отправлено — смотри уведомления' : 'Не дошло. Выключи и включи уведомления заново'); return; }
      case 'w-push-hide': web.pushHide = true; await pmgStorageSet({ pmg_push_hide: true }); pmgWebRender(true); return;
      case 'w-theme': { const order = ['auto', 'light', 'dark']; pmg.settings.theme = order[(order.indexOf(pmg.settings.theme || 'auto') + 1) % 3]; pmgApplyTheme(); await pmgSaveSettings(); pmgWebRender(true); return; }
      case 'w-claim': { const c = (root.querySelector('[data-act="w-code"]') || {}).value || ''; pmgWebClaim(c); return; }
      case 'w-hwview': web.hwView = v; pmgWebRender(true); return;
      case 'w-past': web.showPast = !web.showPast; pmgWebRender(true); return;
      case 'w-overdue': web.showOverdue = !web.showOverdue; pmgWebRender(true); return;
      case 'w-period': pmg.periodId = +v; web.gradeSubj = null; pmgWebRender(true); return;
      case 'f-group': web.gid = v; pmgFriendsLoad(true); pmgWebRender(true); return;
      case 'f-mode': web.fMode = v; if (v === 'steps' || v === 'xp' || v === 'study' || v === 'avg') pmgFriendsLoad(); pmgWebRender(true); return;
      case 'f-period': web.fPeriod = v; pmgFriendsLoad(); pmgWebRender(true); return;
      case 'f-duel': { t.disabled = true; const r = await pmgRpc('duel_challenge', { p_to: v }).catch((e) => ({ ok: false, error: e.message })); pmgToast(r && r.ok ? 'Вызов отправлен — ждём ответа' : pmgFriendErr(r && r.error)); pmgFriendsLoad(); return; }
      case 'f-duel-yes': case 'f-duel-no': { await pmgRpc('duel_answer', { p_id: +v, p_accept: act === 'f-duel-yes' }).catch(() => {}); pmgFriendsLoad(); return; }
      case 'f-start': { const nick = ((root.querySelector('[data-act="f-nick"]') || {}).value || '').trim(); if (nick.length < 3) { pmgToast('Ник — от 3 до 16 символов'); return; } const r = await pmgRpc('ensure_profile', { p_nick: nick, p_student_hash: null }).catch((e) => ({ ok: false, error: e.message })); if (r && r.ok) { await pmgRpc('update_profile', { p: { nick } }).catch(() => {}); pmg.profile = { ...(pmg.profile || {}), nick, created: true }; await pmgStorageSet({ pmg_profile: pmg.profile }); pmgFriendsLoad(true); } else pmgToast(pmgFriendErr(r && r.error)); return; }
      case 'f-join': { const code = ((root.querySelector('[data-act="f-code"]') || {}).value || '').trim().toUpperCase(); const norm = code.includes('-') ? code : code.slice(0, 3) + '-' + code.slice(3); const r = await pmgRpc('join_group', { p_code: norm, p_privacy: null }).catch((e) => ({ ok: false, error: e.message })); if (r && r.ok) { web.gid = r.group.id; pmgFriendsLoad(true); } else pmgToast(pmgFriendErr(r && r.error)); return; }
      case 'f-create': { const name = ((root.querySelector('[data-act="f-gname"]') || {}).value || '').trim(); if (name.length < 2) { pmgToast('Название — от 2 символов'); return; } const r = await pmgRpc('create_group', { p_name: name }).catch((e) => ({ ok: false, error: e.message })); if (r && r.ok) { web.gid = r.group.id; pmgFriendsLoad(true); } else pmgToast(pmgFriendErr(r && r.error)); return; }
      case 'f-pl': web.fSel = v && v !== web.fSel ? v : null; pmgWebRender(true); return;
      case 'f-copy': try { await navigator.clipboard.writeText(v); pmgToast('Код скопирован'); } catch (_) { pmgToast(v); } return;
      case 'w-subj': if (web.tab !== 'grades') { web.tab = 'grades'; web.enter = true; history.replaceState(null, '', '#grades'); } web.gradeSubj = web.gradeSubj === +v ? null : +v; pmgWebRender(true); return;
      case 'report-kind': await pmgOpenReport(v); pmgWebReportShareBtn(); return;
      case 'report-close': pmgCloseReport(); return;
      case 'report-save': pmgSaveReport(); return;
      case 'report-copy': pmgCopyReport(); return;
      case 'report-share': pmgWebShareReport(); return;
    }
    if (await pmgOwnHwAct(act, t)) return;
    if (await pmgHealthAct(act, t)) return;
    await pmgPassAct(act, t);
  });
  root.addEventListener('input', pmgPassInput);
  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (await pmgOwnHwChange(e)) return;
    if (await pmgPassChange(e)) return;
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
  if (PMG_WEB_TABS.some(([k]) => k === h) || h === 'me') web.tab = h;
  if (h === 'health') web.tab = 'me';
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
    if (web.authed && (PMG_WEB_TABS.some(([x]) => x === k) || k === 'me') && k !== web.tab) { web.tab = k; web.enter = true; pmgWebRender(); }
  });
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - web.lastSync > 5 * 60e3) pmgWebSync(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - web.lastSync > 60e3) pmgWebSync(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();


// ---------- Друзья: рейтинг шагов, XP, учёбы и дуэли ----------
function pmgFriendErr(e) {
  return ({ duel_exists: 'С этим другом дуэль на неделю уже есть.', duel_limit: 'Больше 3 дуэлей в неделю нельзя.', duel_off: 'Этот друг выключил дуэли или скрывает шаги.',
    not_found: 'Такого кода нет. Проверь буквы и цифры.', closed: 'Вступление в эту группу закрыто.', full: 'В группе уже 30 человек.',
    too_many_groups: 'Можно состоять максимум в 3 группах.', no_profile: 'Сначала начни игру — придумай ник.' })[e] || ('Не получилось: ' + (e || 'нет связи'));
}

async function pmgFriendsLoad(groups) {
  if (!web.authed) return;
  web.fLoading = true;
  try {
    if (groups || !web.groups) {
      web.groups = await pmgRpc('my_groups', {});
      const prof = (pmg.profile && pmg.profile.created) || (web.groups && web.groups.length);
      if (prof && !(pmg.profile && pmg.profile.created)) { pmg.profile = { ...(pmg.profile || {}), created: true }; }
    }
    const gs = web.groups || [];
    if (!gs.some((g) => g.id === web.gid)) web.gid = gs.length ? gs[0].id : null;
    if (web.gid) {
      const per = web.fMode === 'steps' || !web.fMode ? (web.fPeriod || 'week') : 'week';
      const [board, duels] = await Promise.all([pmgRpc('group_board', { p_group: web.gid, p_period: per }), pmgRpc('my_duels', {})]);
      const paths = ((board && board.players) || []).map((p) => p.photo).concat(((duels && duels.duels) || []).map((d) => d.rival && d.rival.photo)).filter(Boolean);
      const photos = paths.length ? await pmgPhotos(paths).catch(() => ({})) : {};
      ((board && board.players) || []).forEach((p) => { p.photoUrl = p.photo ? photos[p.photo] || null : null; });
      ((duels && duels.duels) || []).forEach((d) => { if (d.rival) d.rival.photoUrl = d.rival.photo ? photos[d.rival.photo] || null : null; });
      web.board = board; web.boardPer = per; web.duels = duels;
    }
    web.fErr = null;
  } catch (e) { web.fErr = String(e.message || e); }
  web.fLoading = false;
  if (web.tab === 'friends') pmgWebRender(true);
}

function pmgWebFriends() {
  let out = '<div class="w-title"><h1>Друзья</h1></div>';
  if (!web.groups && !web.fErr) { if (!web.fLoading) pmgFriendsLoad(true); return out + '<section class="card w-empty"><div class="loader"><span></span><span></span><span></span></div></section>'; }
  if (web.fErr && !web.groups) return out + '<section class="card w-empty"><p class="err">Нет связи с сервером.</p><button class="btn" data-act="w-sync">Повторить</button></section>';
  const gs = web.groups || [];
  if (!(pmg.profile && pmg.profile.created) && !gs.length) {
    const first = pmg.data && pmg.data.student ? pmg.data.student.name.split(/\s+/)[0] : '';
    return out + '<section class="card f-start"><h3>Рейтинг с друзьями</h3><p class="muted">Шаги, XP и учёба недели — в общем рейтинге группы. Друзья видят только итоги: ни оценок, ни домашки, ни фото.</p>' +
      '<label class="field"><span>Твой ник</span><input class="in" data-act="f-nick" maxlength="16" value="' + pmgEsc(first) + '"></label><button class="btn primary big" data-act="f-start">Начать</button></section>';
  }
  if (!gs.length) {
    return out + '<section class="card"><h3>Вступить по коду</h3><p class="muted">Код вида KOT-482 даёт создатель группы.</p><input class="in w-code" data-act="f-code" maxlength="7" placeholder="ABC-123"><button class="btn primary big" data-act="f-join">Вступить</button></section>' +
      '<section class="card"><h3>Или создай свою</h3><input class="in" data-act="f-gname" maxlength="40" placeholder="Например, 8Б и друзья"><button class="btn big" data-act="f-create" style="margin-top:10px">Создать группу</button></section>';
  }
  const g = gs.find((x) => x.id === web.gid) || gs[0];
  if (gs.length > 1) out += '<div class="w-periods">' + gs.map((x) => '<button class="w-chipbtn' + (x.id === g.id ? ' on' : '') + '" data-act="f-group" data-v="' + x.id + '">' + pmgEsc(x.name) + '</button>').join('') + '</div>';
  out += '<div class="f-grp"><b>' + pmgEsc(g.name) + '</b><span class="muted small">' + g.members + ' ' + pmgPlural(g.members, ['участник', 'участника', 'участников']) + '</span>' +
    (g.code ? '<button class="f-code" data-act="f-copy" data-v="' + g.code + '">' + g.code + '</button>' : '') + '</div>';
  out += pmgDuelsBlock();
  const mode = web.fMode || 'steps';
  const players = ((web.board && web.board.players) || []).map((p) => p.me && pmg.profile && pmg.profile.equipped ? { ...p, equipped: { ...(p.equipped || {}), ...pmg.profile.equipped } } : p);
  const anyAvg = players.some((p) => p.avg != null);
  out += '<div class="seg-ctl f-modes">' + [['steps', 'Шаги'], ['xp', 'XP'], ['study', 'Учёба']].concat(anyAvg ? [['avg', 'Средний']] : []).map(([k, l]) => '<button class="' + (mode === k ? 'on' : '') + '" data-act="f-mode" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
  if (mode === 'steps') out += '<div class="seg-ctl mini f-per">' + [['day', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц']].map(([k, l]) => '<button class="' + ((web.fPeriod || 'week') === k ? 'on' : '') + '" data-act="f-period" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
  out += pmgBoardList(players, mode);
  if (pmg.profile && pmg.profile.created) out += '<div class="w-face">' + pmgFaceBlock() + '</div>';
  return out;
}

function pmgBoardValue(p, mode) {
  if (mode === 'steps') return p.steps_on && p.steps != null ? p.steps : null;
  if (mode === 'xp') return p.xp_week || 0;
  if (mode === 'avg') return p.avg != null ? +p.avg : null;
  if (mode === 'study') {
    const s = p.study; if (!s || !s.hw) return null;
    const mon = pmgToday(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const thisWeek = s.week === pmgIso(mon);
    if (!thisWeek) return null;
    const hw = s.hw.total ? s.hw.done / s.hw.total : null, na = s.noabs && s.noabs.total ? s.noabs.ok / s.noabs.total : null;
    if (hw == null && na == null) return null;
    return Math.round(((hw == null ? na : hw) * 0.6 + (na == null ? hw : na) * 0.4) * 100);
  }
  return null;
}

function pmgBoardList(players, mode) {
  const rows = players.map((p) => ({ p, v: pmgBoardValue(p, mode) }));
  const ranked = rows.filter((r) => r.v != null && (mode !== 'steps' || r.v > 0)).sort((a, b) => b.v - a.v);
  const rest = rows.filter((r) => !ranked.includes(r));
  if (!ranked.length && !rest.length) return '<section class="card w-empty"><p class="muted">В группе пока никого.</p></section>';
  const fmt = (r) => mode === 'steps' ? pmgFmtInt(r.v) : mode === 'xp' ? pmgFmtInt(r.v) + ' XP' : mode === 'avg' ? pmgFmtAvg(r.v) : r.v + '%';
  const sub = (r) => {
    const p = r.p;
    if (mode === 'steps') {
      const ch = p.steps_prev ? Math.round((p.steps / p.steps_prev - 1) * 100) : null;
      const bits = [];
      if (p.goal_streak) bits.push('🔥 цель ' + p.goal_streak + ' ' + pmgPlural(p.goal_streak, ['день', 'дня', 'дней']) + ' подряд');
      if (ch != null && isFinite(ch)) bits.push((ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch) + '%');
      if (p.floors) bits.push(p.floors + ' эт.');
      return bits.join(' · ') || 'уровень ' + p.level;
    }
    if (mode === 'study') { const s = p.study; return 'домашка ' + (s.hw ? s.hw.done + '/' + s.hw.total : '—') + ' · без пропусков ' + (s.noabs ? s.noabs.ok + '/' + s.noabs.total : '—'); }
    if (mode === 'xp') return 'уровень ' + p.level + (p.streak ? ' · огонёк ' + p.streak : '');
    return 'средний за четверть';
  };
  const me = players.find((p) => p.me);
  let h = '';
  // Лесенка: фигурки друзей с фото вместо головы, лидер на самой высокой ступеньке
  if (ranked.length) {
    const why = mode === 'steps' ? (r) => (!r.p.steps_on ? 'скрыто' : 'нет шагов') : mode === 'study' ? () => 'нет данных' : () => 'скрыто';
    const srows = ranked.map((r) => ({ p: r.p, v: r.v, label: fmt(r) })).concat(rest.map((r) => ({ p: r.p, v: 0, label: why(r), sleep: true })));
    const animate = web.stairsSeen !== web.gid + mode;
    web.stairsSeen = web.gid + mode;
    h += '<section class="card f-stairs">' + pmgStairs(srows, { sel: web.fSel, act: 'f-pl', key: 'w:' + web.gid + ':' + mode, animate }) + '</section>';
    const sel = web.fSel && players.find((p) => p.id === web.fSel);
    if (sel) {
      const r = rows.find((x) => x.p === sel), place = ranked.indexOf(r) + 1;
      const canDuel = mode === 'steps' && !sel.me && me && me.steps_on && sel.steps_on && !(web.duels && (web.duels.duels || []).some((d) => d.rival && d.rival.id === sel.id && d.week_start === web.duels.week_start));
      h += '<section class="card f-pcard"><span class="pc-fig">' + pmgFigure(sel, 92, { lead: place === 1 }) + '</span><div class="f-pc-main"><b>' + pmgEsc(sel.nick) + (sel.me ? ' <small>ты</small>' : '') + '</b>' +
        '<small class="muted">' + (place ? place + '-е место · ' + fmt(r) : 'нет данных') + '</small><small class="muted">уровень ' + sel.level + (sel.streak ? ' · огонёк ' + sel.streak : '') + '</small>' +
        (place ? '<small class="muted">' + sub(r) + '</small>' : '') +
        (canDuel ? '<button class="btn small primary" data-act="f-duel" data-v="' + sel.id + '">Вызвать на дуэль шагов</button>' : '') + '</div>' +
        '<button class="icon-btn" data-act="f-pl" data-v="" aria-label="Закрыть">' + pmgIcon('close') + '</button></section>';
    }
  }
  h += '<section class="f-list">' + ranked.map((r, i) => {
    const p = r.p, stale = mode === 'steps' && p.health_at && Date.now() - new Date(p.health_at) > 2 * 864e5;
    const canDuel = mode === 'steps' && !p.me && me && me.steps_on && p.steps_on && !(web.duels && (web.duels.duels || []).some((d) => d.rival && d.rival.id === p.id && d.week_start === web.duels.week_start));
    return '<div class="f-row' + (p.me ? ' me' : '') + (stale ? ' stale' : '') + '" style="--i:' + i + '"><span class="f-rank">' + (i + 1) + '</span>' + pmgAvatar(p, 40) +
      '<div class="f-main"><b>' + pmgEsc(p.nick) + (p.me ? ' <small>ты</small>' : '') + '</b><small class="muted">' + (stale ? 'шаги не обновлялись ' + pmgAgo(p.health_at) : sub(r)) + '</small></div>' +
      '<span class="f-val">' + fmt(r) + '</span>' + (canDuel ? '<button class="f-duel-btn" data-act="f-duel" data-v="' + p.id + '" aria-label="Вызвать на дуэль">⚔</button>' : '') + '</div>';
  }).join('') + '</section>';
  if (rest.length) {
    const why = mode === 'steps' ? (r) => (!r.p.steps_on ? 'скрывает шаги' : 'шагов пока нет') : mode === 'study' ? () => 'нет данных за неделю' : () => 'скрыто';
    h += '<section class="f-rest">' + rest.map((r) => '<div class="f-row muted-row">' + pmgAvatar(r.p, 32) + '<div class="f-main"><b>' + pmgEsc(r.p.nick) + (r.p.me ? ' <small>ты</small>' : '') + '</b><small class="muted">' + why(r) + '</small></div></div>').join('') + '</section>';
  }
  if (mode === 'steps' && me && !me.steps_on) h += '<p class="muted small">Твои шаги скрыты от друзей — включи галочку «Мои шаги в рейтинге» в профиле в расширении.</p>';
  if (mode === 'study') h += '<p class="muted small">Учёба недели: 60% — домашка, отмеченная вовремя, 40% — дни без пропусков. Считается в расширении на компьютере.</p>';
  return h;
}

function pmgDuelsBlock() {
  const ds = (web.duels && web.duels.duels) || [];
  if (!ds.length) return '';
  const wk = web.duels.week_start;
  const left = (() => { const end = pmgDateOf(wk); end.setDate(end.getDate() + 7); return Math.max(0, Math.round((end - pmgToday()) / 864e5)); })();
  return '<section class="card f-duels"><div class="card-head"><h3>Дуэли шагов</h3><span class="muted small">неделя · осталось ' + left + ' ' + pmgPlural(left, ['день', 'дня', 'дней']) + '</span></div>' + ds.map((d) => {
    const r = d.rival || {};
    if (d.status === 'pending') {
      return '<div class="f-du pend">' + pmgAvatar(r, 36) + '<div class="f-main"><b>' + pmgEsc(r.nick || '') + '</b><small class="muted">' + (d.mine ? 'ждём ответа' : 'вызывает тебя на неделю шагов') + '</small></div>' +
        (d.mine ? '<button class="btn small" data-act="f-duel-no" data-v="' + d.id + '">Отменить</button>' : '<button class="btn small primary" data-act="f-duel-yes" data-v="' + d.id + '">Принять</button><button class="btn small" data-act="f-duel-no" data-v="' + d.id + '">Нет</button>') + '</div>';
    }
    const a = d.me_steps || 0, b = d.rival_steps || 0, tot = Math.max(1, a + b), past = d.week_start !== wk;
    const res = past && d.settled ? (d.draw ? 'Ничья · +50 XP' : d.winner_me ? 'Победа · +150 XP' : 'Поражение · +50 XP') : (a > b ? 'ты впереди на ' + pmgFmtInt(a - b) : a < b ? 'отстаёшь на ' + pmgFmtInt(b - a) : 'поровну');
    return '<div class="f-du"><div class="f-du-top"><span>Ты <b>' + pmgFmtInt(a) + '</b></span><span class="muted small">' + res + '</span><span><b>' + pmgFmtInt(b) + '</b> ' + pmgEsc(r.nick || '') + '</span></div>' +
      '<div class="f-du-bar"><i style="width:' + (a / tot * 100).toFixed(1) + '%"></i></div></div>';
  }).join('') + '</section>';
}
