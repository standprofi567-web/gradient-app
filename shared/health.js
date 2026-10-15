// Вкладка «Здоровье»: шаги, этажи, расстояние и сон с iPhone, связь с оценками, отчёт недели и прогнозы.
// Здесь же — подключение телефона (код и QR) и ключ для Команды iPhone.

const PMG_SITE = 'https://gradient.klxshvpn.ru/';
const PMG_HEALTH_URL = PMG_SB_URL + '/functions/v1/health';
const PMG_IS_WEB = typeof PMG_WEB !== 'undefined' && PMG_WEB;

function pmgHealthGoal() { return (pmg.settings && pmg.settings.stepGoal) || 8000; }
function pmgHData() { return (pmg.health && pmg.health.days) || []; }
function pmgHByDay() { const m = {}; pmgHData().forEach((r) => { m[r.day] = r; }); return m; }
function pmgFmtInt(n) { return n == null ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function pmgKm(m) { return m == null ? '—' : (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ','); }
function pmgHm(min) { if (min == null) return '—'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h + ' ч' + (m ? ' ' + m + ' мин' : ''); }
function pmgPct(a, b) { if (!a || !b) return null; return Math.round((a / b - 1) * 100); }
function pmgAvgOf(list) { const v = list.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
function pmgDaysBack(n, from) { const out = []; const base = from ? new Date(from) : pmgToday(); for (let i = n - 1; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); out.push(pmgIso(d)); } return out; }

// ---------- Главный экран ----------
function pmgHealthView() {
  const rows = pmgHData();
  const has = rows.some((r) => r.steps != null || r.floors != null);
  let h = '<div class="health">';
  if (has) {
    h += pmgHealthHero();
    h += pmgHealthChartCard();
    h += '<div class="two">' + pmgHealthFacts() + pmgHealthInsights() + '</div>';
    h += pmgWeekReport();
  } else {
    h += '<section class="card hl-empty"><div class="hl-empty-art">' + pmgStepsIcon(56) + '</div><h2>Шаги и этажи с телефона</h2>' +
      '<p class="muted">Подключи телефон ниже — iPhone через «Команды», Android через Health Connect. Здесь появятся шаги, расстояние, отчёт недели и то, как активность совпадает с оценками.</p></section>';
  }
  h += pmgHealthSetupCard(has);
  h += pmgDevicesBlock();
  return h + '</div>';
}

// Вкладка расширения «Устройства»: связь с телефоном, список устройств и коротко — что пришло с телефона.
function pmgDevicesView() {
  const cloud = pmg.settings && pmg.settings.cloud;
  let h = '<div class="health devs">';
  h += pmgPairCard(!cloud);
  if (cloud) {
    h += pmgPhoneSummary();
    h += pmgHealthSetupCard(pmgHData().some((r) => r.steps != null));
    h += pmgDevicesBlock();
  }
  return h + '</div>';
}

// Коротко о данных с телефона (подробно — в приложении).
function pmgPhoneSummary() {
  const by = pmgHByDay(), t = by[pmgIso(pmgToday())] || {}, goal = pmgHealthGoal();
  const week = pmgDaysBack(7).reduce((s, d) => s + ((by[d] && by[d].steps) || 0), 0);
  const any = pmgHData().some((r) => r.steps != null);
  if (!any) return '<section class="card ph-sum"><div class="card-head"><h3>С телефона</h3></div><p class="muted">Шаги пока не приходят. Подключить их можно ниже, в «Шаги с телефона» — это нужно только для рейтинга шагов с друзьями.</p></section>';
  return '<section class="card ph-sum"><div class="card-head"><h3>С телефона</h3></div>' +
    '<div class="ph-sum-row"><div><b>' + pmgFmtInt(t.steps || 0) + '</b><span>шагов сегодня</span></div><div><b>' + (t.floors != null ? t.floors : '—') + '</b><span>этажей</span></div>' +
    '<div><b>' + pmgFmtInt(week) + '</b><span>за 7 дней</span></div></div>' +
    '<div class="xpbar"><i style="width:' + Math.min(100, (t.steps || 0) / goal * 100).toFixed(1) + '%"></i></div></section>';
}

function pmgTimeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts), mins = Math.round((Date.now() - d) / 60000);
  if (mins < 2) return 'только что';
  if (mins < 60) return mins + ' мин назад';
  const day = pmgAgo(d);
  return (day === 'сегодня' ? 'сегодня' : day) + ' в ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const PMG_DEV_ICON = {
  pc: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  steps: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 12h4l2.5-6 4 12 2.5-6H21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// Список устройств аккаунта + источник шагов. Общий для расширения и приложения.
function pmgDevicesBlock() {
  const D = pmg.devices || {};
  const list = D.devices || [];
  const hs = D.health || (pmg.health && pmg.health.key && pmg.health.key.has ? { has: true, last_used: pmg.health.key.last_used } : null);
  const row = (icon, title, sub, extra) => '<li class="dev"><span class="dev-ic">' + icon + '</span><div class="dev-main"><b>' + title + '</b><small class="muted">' + sub + '</small></div>' + (extra || '') + '</li>';
  let h = '<section class="card devs-list"><div class="card-head"><h3>Устройства</h3>' + (D.at ? '<span class="muted small">обновлено ' + pmgTimeAgo(D.at) + '</span>' : '') + '</div><ul>';
  list.forEach((d) => {
    const me = d.id === D.me;
    const isPhone = /iPhone|Android|iPad/.test(d.platform || '');
    const extra = me ? '<span class="dev-me">это устройство</span>'
      : pmg.confirm === 'rev:' + d.id ? '<button class="btn small danger" data-act="dev-revoke" data-v="' + pmgEsc(d.id) + '">Точно отключить?</button>'
      : '<button class="btn small" data-act="dev-revoke" data-v="' + pmgEsc(d.id) + '">Отключить</button>';
    h += row(isPhone ? PMG_DEV_ICON.phone : PMG_DEV_ICON.pc, pmgEsc(d.kind === 'web' ? 'Приложение Gradient' : 'Расширение Gradient'),
      pmgEsc(d.platform || '') + ' · ' + (me ? 'сейчас' : 'был ' + pmgTimeAgo(d.last_seen)), extra);
  });
  if (!list.length) h += '<li class="dev empty muted">Пока ни одного устройства. Подключи телефон — и он появится здесь.</li>';
  const src = hs && hs.source === 'android' ? 'Android · Health Connect' : hs && hs.source === 'iphone' ? 'iPhone · Команда' : 'ключ создан';
  h += row(PMG_DEV_ICON.steps, 'Шаги', hs && hs.has ? src + (hs.last_used ? ' · последний раз ' + pmgTimeAgo(hs.last_used) : ' · данных ещё не было') : 'не подключены — настраиваются в приложении на телефоне');
  h += '</ul>';
  if (D.snapshot_at) h += '<p class="muted small dev-note">Последний снимок дневника на сервере: ' + pmgTimeAgo(D.snapshot_at) + '.</p>';
  if (PMG_IS_WEB) h += '<div class="hl-dev-act">' + (pmg.confirm === 'signout' ? '<button class="btn small danger" data-act="hl-signout">Точно выйти?</button>' : '<button class="btn small" data-act="hl-signout">Выйти на этом телефоне</button>') + '</div>';
  else h += '<div class="hl-dev-act">' + (pmg.confirm === 'cloud-off' ? '<button class="btn small danger" data-act="hl-cloud-off">Точно выключить?</button>' : '<button class="btn small" data-act="hl-cloud-off">Выключить связь с телефоном</button>') +
    '<span class="muted small">Оценки перестанут отправляться на сервер.</span></div>';
  return h + '</section>';
}

function pmgStepsIcon(s) {
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true"><defs><linearGradient id="hlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs>' +
    '<path fill="url(#hlg)" d="M8.6 2.5c1.7 0 2.7 1.9 2.6 4.3-.1 2.1-.8 3.6-1.3 4.9-.3.8-1.2 1.2-2 1-1.4-.3-2.5-1.3-2.7-3.4C5 6.2 6.6 2.5 8.6 2.5zM6.2 14.3l3.6.8c.4 1.6-.2 3.3-1.6 3.4-1.7.1-2.6-1.7-2-4.2zM15.4 7.3c2 0 3.6 3.7 3.4 6.8-.2 2.1-1.3 3.1-2.7 3.4-.8.2-1.7-.2-2-1-.5-1.3-1.2-2.8-1.3-4.9-.1-2.4.9-4.3 2.6-4.3zM14.2 19.1l3.6-.8c.6 2.5-.3 4.3-2 4.2-1.4-.1-2-1.8-1.6-3.4z"/></svg>';
}

function pmgStepRing(v, goal, size) {
  const r = size / 2 - 9, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, (v || 0) / goal));
  return '<svg class="hl-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + pmgFmtInt(v) + ' шагов из ' + pmgFmtInt(goal) + '">' +
    '<defs><linearGradient id="hlr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="hl-ring-track"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="hl-ring-arc" stroke="url(#hlr)" stroke-dasharray="' + c.toFixed(1) + '" style="--c:' + c.toFixed(1) + ';--off:' + (c * (1 - f)).toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
    (f >= 1 ? '<circle cx="' + size / 2 + '" cy="' + (size / 2 - r) + '" r="5" fill="#14B8A6" class="hl-ring-dot"/>' : '') + '</svg>';
}

function pmgHealthHero() {
  const by = pmgHByDay(), today = pmgIso(pmgToday()), goal = pmgHealthGoal();
  const t = by[today] || {};
  const y = (() => { const d = pmgToday(); d.setDate(d.getDate() - 1); return by[pmgIso(d)] || null; })();
  const left = Math.max(0, goal - (t.steps || 0));
  const updated = t.at ? new Date(t.at) : null;
  const msg = t.steps == null ? 'Сегодняшних данных ещё нет — Команда пришлёт их по расписанию.'
    : left === 0 ? 'Цель на сегодня выполнена' + ((t.steps || 0) > goal * 1.3 ? ' с запасом' : '') + '.'
    : 'До цели ' + pmgFmtInt(left) + ' ' + pmgPlural(left, ['шаг', 'шага', 'шагов']) + ' — это примерно ' + Math.max(1, Math.round(left / 100)) + ' мин ходьбы.';
  return '<section class="hero hl-hero glare"><div class="hl-ring-wrap">' + pmgStepRing(t.steps, goal, 150) +
    '<div class="hl-ring-in"><b data-count-int="' + (t.steps || 0) + '">' + pmgFmtInt(t.steps || 0) + '</b><span>из ' + pmgFmtInt(goal) + '</span></div></div>' +
    '<div class="hl-hero-main"><span class="muted">Сегодня' + (updated ? ' · обновлено в ' + String(updated.getHours()).padStart(2, '0') + ':' + String(updated.getMinutes()).padStart(2, '0') : '') + '</span>' +
    '<p class="hl-msg">' + msg + '</p>' +
    '<div class="hl-chips"><span class="chip"><b>' + pmgFmtInt(t.floors) + '</b> ' + pmgPlural(t.floors || 0, ['этаж', 'этажа', 'этажей']) + '</span>' +
    '<span class="chip"><b>' + pmgKm(t.distance_m) + '</b> км</span>' +
    (t.kcal != null ? '<span class="chip"><b>' + pmgFmtInt(t.kcal) + '</b> ккал</span>' : '') +
    (t.sleep_min != null ? '<span class="chip">сон <b>' + pmgHm(t.sleep_min) + '</b></span>' : '') +
    (y && y.steps != null ? '<span class="chip muted">вчера ' + pmgFmtInt(y.steps) + '</span>' : '') + '</div>' +
    '<div class="seg-ctl mini hl-goal"><span>Цель</span>' + [6000, 8000, 10000, 12000].map((g) => '<button class="' + (g === goal ? 'on' : '') + '" data-act="hl-goal" data-v="' + g + '">' + (g / 1000) + 'K</button>').join('') + '</div></div></section>';
}

// ---------- График ----------
function pmgHealthChartCard() {
  const range = pmg.hlRange || 7, metric = pmg.hlMetric || 'steps';
  const metrics = [['steps', 'Шаги'], ['floors', 'Этажи'], ['distance_m', 'Км']];
  if (pmgHData().some((r) => r.sleep_min != null)) metrics.push(['sleep_min', 'Сон']);
  return '<section class="card hl-chart"><div class="card-head"><div class="seg-ctl mini">' + metrics.map(([k, l]) => '<button class="' + (k === metric ? 'on' : '') + '" data-act="hl-metric" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
    '<div class="seg-ctl mini">' + [[7, '7 дней'], [30, '30'], [90, '90']].map(([k, l]) => '<button class="' + (k === range ? 'on' : '') + '" data-act="hl-range" data-v="' + k + '">' + l + '</button>').join('') + '</div></div>' +
    pmgBarChart(metric, range) + '</section>';
}

function pmgBarChart(metric, range) {
  const by = pmgHByDay(), days = pmgDaysBack(range), goal = metric === 'steps' ? pmgHealthGoal() : metric === 'sleep_min' ? 480 : null;
  const val = (iso) => { const r = by[iso]; return r && r[metric] != null ? r[metric] : null; };
  const vals = days.map(val), max = Math.max(goal || 0, ...vals.filter((v) => v != null), 1) * 1.08;
  const w = 640, h = 220, pad = { l: 8, r: 8, t: 12, b: 24 };
  const bw = (w - pad.l - pad.r) / days.length, gap = Math.min(10, bw * 0.28);
  const Y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const today = pmgIso(pmgToday());
  let g = '';
  days.forEach((iso, i) => {
    const v = vals[i], x = pad.l + i * bw + gap / 2, bwi = Math.max(2, bw - gap);
    const d = pmgDateOf(iso);
    if (v != null) {
      const met = goal ? v >= goal : false;
      const lbl = metric === 'distance_m' ? pmgKm(v) + ' км' : metric === 'sleep_min' ? pmgHm(v) : pmgFmtInt(v);
      g += '<rect class="hl-bar' + (met ? ' met' : '') + (iso === today ? ' today' : '') + '" x="' + x.toFixed(1) + '" y="' + Y(v).toFixed(1) + '" width="' + bwi.toFixed(1) + '" height="' + (h - pad.b - Y(v)).toFixed(1) + '" rx="' + Math.min(6, bwi / 2).toFixed(1) + '" style="--i:' + i + '"><title>' + d.getDate() + ' ' + PMG_MONTHS[d.getMonth()] + ': ' + lbl + '</title></rect>';
    } else {
      g += '<rect class="hl-bar none" x="' + x.toFixed(1) + '" y="' + (h - pad.b - 3) + '" width="' + bwi.toFixed(1) + '" height="3" rx="1.5"/>';
    }
    const showLbl = range === 7 || (range === 30 && (i % 5 === 0 || i === days.length - 1)) || (range === 90 && d.getDate() === 1);
    if (showLbl) g += '<text class="axis" x="' + (x + bwi / 2).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + (range === 7 ? PMG_WD_SHORT[d.getDay()] : range === 90 ? PMG_MONTHS[d.getMonth()].slice(0, 3) : d.getDate()) + '</text>';
  });
  if (goal) g += '<line class="hl-goal-line" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + Y(goal).toFixed(1) + '" y2="' + Y(goal).toFixed(1) + '"/><text class="axis hl-goal-txt" x="' + (w - pad.r - 4) + '" y="' + (Y(goal) - 5).toFixed(1) + '" text-anchor="end">цель ' + (metric === 'sleep_min' ? '8 ч' : pmgFmtInt(goal)) + '</text>';
  const have = vals.filter((v) => v != null);
  const avg = pmgAvgOf(have);
  const sum = have.reduce((s, v) => s + v, 0);
  const fmt = (v) => metric === 'distance_m' ? pmgKm(v) + ' км' : metric === 'sleep_min' ? pmgHm(v) : pmgFmtInt(v);
  return '<svg class="hl-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="График за ' + range + ' дней">' + g + '</svg>' +
    '<div class="hl-sum"><span>в среднем <b>' + fmt(avg) + '</b> в день</span>' + (metric !== 'sleep_min' ? '<span>всего <b>' + fmt(sum) + '</b></span>' : '') + '<span class="muted">' + have.length + ' из ' + range + ' дней с данными</span></div>';
}

// ---------- Цифры ----------
function pmgHealthFacts() {
  const by = pmgHByDay(), goal = pmgHealthGoal();
  const last7 = pmgDaysBack(7).map((d) => by[d] && by[d].steps), prev7 = pmgDaysBack(7, (() => { const d = pmgToday(); d.setDate(d.getDate() - 7); return d; })()).map((d) => by[d] && by[d].steps);
  const a7 = pmgAvgOf(last7), p7 = pmgAvgOf(prev7), ch = pmgPct(a7, p7);
  // Серия дней с целью (сегодня не ломает, если ещё не выполнено)
  let streak = 0; const d = pmgToday();
  for (let i = 0; i < 400; i++) {
    const iso = pmgIso(d), r = by[iso];
    if (r && r.steps != null && r.steps >= goal) streak++;
    else if (!(i === 0)) break;
    d.setDate(d.getDate() - 1);
  }
  const all = pmgHData().filter((r) => r.steps != null);
  const best = all.slice().sort((x, y) => y.steps - x.steps)[0];
  const month = pmgDaysBack(30).map((x) => by[x]).filter(Boolean);
  const floors30 = month.reduce((s, r) => s + (r.floors || 0), 0);
  const fact = (b, s, extra) => '<div class="fact"><b>' + b + '</b><span>' + s + '</span>' + (extra || '') + '</div>';
  return '<section class="hl-facts"><h3>Цифры</h3><div class="hl-fgrid">' +
    fact(pmgFmtInt(a7), 'шагов в день за неделю', ch != null ? '<em class="' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch) + '% к прошлой</em>' : '') +
    fact(streak, pmgPlural(streak, ['день', 'дня', 'дней']) + ' подряд с целью') +
    fact(best ? pmgFmtInt(best.steps) : '—', best ? 'рекорд · ' + pmgDateOf(best.day).getDate() + ' ' + PMG_MONTHS[pmgDateOf(best.day).getMonth()] : 'рекорд') +
    fact(pmgFmtInt(floors30), 'этажей за 30 дней' + (floors30 >= 110 ? ' — как подняться на Эйфелеву башню ×' + (floors30 * 3 / 330).toFixed(1).replace('.', ',') : '')) +
    '</div></section>';
}

// ---------- Наблюдения и прогнозы ----------
function pmgHealthInsights() {
  const by = pmgHByDay(), goal = pmgHealthGoal(), out = [];
  const now = pmgToday();
  // Прогноз на месяц
  const a7 = pmgAvgOf(pmgDaysBack(7).map((d) => by[d] && by[d].steps));
  const dist7 = pmgAvgOf(pmgDaysBack(7).map((d) => by[d] && by[d].distance_m));
  if (a7) {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const done = pmgDaysBack(now.getDate()).reduce((s, d) => s + ((by[d] && by[d].steps) || 0), 0);
    const proj = done + a7 * (dim - now.getDate());
    out.push(['trend', 'При таком темпе за ' + PMG_MONTHS_PREP_H[now.getMonth()] + ' наберёшь около <b>' + pmgFmtInt(Math.round(proj / 1000) * 1000) + '</b> шагов' + (dist7 ? ' — это ~' + Math.round(dist7 * dim / 1000) + ' км' : '') + '.']);
  }
  // Будни против выходных
  const wd = [], we = [];
  pmgDaysBack(42).forEach((d) => { const r = by[d]; if (!r || r.steps == null) return; const x = pmgDateOf(d).getDay(); (x === 0 || x === 6 ? we : wd).push(r.steps); });
  if (wd.length >= 5 && we.length >= 3) {
    const a = pmgAvgOf(wd), b = pmgAvgOf(we), p = pmgPct(b, a);
    if (Math.abs(p) >= 15) out.push(['week', p < 0 ? 'В выходные ты ходишь на <b>' + Math.abs(p) + '%</b> меньше, чем в будни. Прогулка в субботу закроет разницу.' : 'В выходные ты активнее будней на <b>' + p + '%</b>.']);
  }
  // Связь с оценками: в активные дни и после хорошего сна
  if (pmg.data && pmg.data.marks) {
    const act = [], lazy = [], slept = [], short = [];
    pmg.data.marks.forEach((m) => {
      const dt = pmgParseDate(m.date); if (!dt || !m.value) return;
      const iso = pmgIso(dt), r = by[iso];
      if (r && r.steps != null) (r.steps >= goal ? act : lazy).push(m.value);
      if (r && r.sleep_min != null) (r.sleep_min >= 480 ? slept : r.sleep_min < 420 ? short : []).push(m.value);
    });
    if (act.length >= 5 && lazy.length >= 5) {
      const a = pmgAvgOf(act), b = pmgAvgOf(lazy);
      out.push(['grades', 'В дни, когда ты проходил ' + pmgFmtInt(goal) + '+ шагов, средняя оценка <b>' + pmgFmtAvg(a) + '</b>, в остальные — <b>' + pmgFmtAvg(b) + '</b>.' + (a - b >= 0.15 ? ' Похоже, движение тебе помогает.' : b - a >= 0.15 ? ' Связи пока не видно — оценки держатся и без шагов.' : ' Разницы почти нет.')]);
    } else {
      const need = Math.max(0, 5 - act.length) + Math.max(0, 5 - lazy.length);
      out.push(['grades', 'Связь шагов с оценками покажу, когда накопится ещё ~' + need + ' ' + pmgPlural(need, ['оценка', 'оценки', 'оценок']) + ' в дни с данными о шагах.']);
    }
    if (slept.length >= 4 && short.length >= 4) {
      const a = pmgAvgOf(slept), b = pmgAvgOf(short);
      out.push(['sleep', 'После 8+ часов сна средняя оценка <b>' + pmgFmtAvg(a) + '</b>, после сна меньше 7 часов — <b>' + pmgFmtAvg(b) + '</b>.']);
    }
  }
  // Этажи
  const f7 = pmgDaysBack(7).reduce((s, d) => s + ((by[d] && by[d].floors) || 0), 0);
  if (f7) out.push(['floors', 'За неделю — <b>' + f7 + '</b> ' + pmgPlural(f7, ['этаж', 'этажа', 'этажей']) + ' по лестнице' + (f7 >= 70 ? ', это как подняться на 25-этажный дом почти трижды.' : '.')]);
  return '<section class="hl-ins"><h3>Наблюдения</h3><ul>' + out.map(([k, t]) => '<li class="ins-' + k + '">' + t + '</li>').join('') + '</ul></section>';
}
const PMG_MONTHS_PREP_H = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// ---------- Отчёт недели ----------
function pmgWeekReport() {
  const by = pmgHByDay();
  const mon = (() => { const d = pmgToday(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
  const span = Math.round((pmgToday() - mon) / 864e5) + 1;
  const cur = pmgDaysBack(span), prevEnd = new Date(mon); prevEnd.setDate(prevEnd.getDate() - 7 + span - 1);
  const prev = pmgDaysBack(span, prevEnd);
  const sum = (list, k) => list.reduce((s, d) => s + ((by[d] && by[d][k]) || 0), 0);
  const marksIn = (list) => (pmg.data && pmg.data.marks ? pmg.data.marks.filter((m) => { const d = pmgParseDate(m.date); return d && list.includes(pmgIso(d)) && m.value; }) : []);
  const mc = marksIn(cur), mp = marksIn(prev);
  const done = pmg.done || {};
  const hwIn = (list) => Object.values(done).filter((t) => t && list.includes(pmgIso(new Date(t)))).length;
  const rows = [
    ['Шаги', sum(cur, 'steps'), sum(prev, 'steps'), pmgFmtInt],
    ['Этажи', sum(cur, 'floors'), sum(prev, 'floors'), pmgFmtInt],
    ['Средний балл', mc.length ? pmgAvg(mc.map((m) => m.value)) : null, mp.length ? pmgAvg(mp.map((m) => m.value)) : null, pmgFmtAvg],
    ['Оценок', mc.length, mp.length, pmgFmtInt],
    ['Домашек отмечено', hwIn(cur), hwIn(prev), pmgFmtInt]
  ];
  const G = pmg.game && pmg.game.view;
  if (G) rows.push(['XP за неделю', G.weekXp, null, pmgFmtInt]);
  return '<section class="card hl-week"><div class="card-head"><h3>Неделя</h3><span class="muted">с понедельника против того же отрезка прошлой недели</span></div><table class="hl-tbl"><tbody>' +
    rows.map(([l, a, b, f]) => {
      const d = a != null && b != null ? a - b : null;
      const cls = d == null || Math.abs(d) < 1e-9 ? '' : d > 0 ? 'up' : 'down';
      return '<tr><th>' + l + '</th><td><b>' + (a == null ? '—' : f(a)) + '</b></td><td class="muted">' + (b == null ? '' : 'было ' + f(b)) + '</td><td class="' + cls + '">' + (d == null || !cls ? '' : (d > 0 ? '▲' : '▼')) + '</td></tr>';
    }).join('') + '</tbody></table></section>';
}

// ---------- Шаги с телефона: iPhone (Команды) и Android (Health Connect) ----------
function pmgHealthSetupCard(has) {
  const k = (pmg.health && pmg.health.key) || { has: false };
  const fresh = pmg.hlKey;
  const plat = pmg.hlPlat || (/Android/.test(navigator.userAgent) ? 'android' : 'ios');
  const open = !has || pmg.hlSetupOpen || fresh;
  let h = '<section class="card hl-setup' + (open ? '' : ' closed') + '"><div class="card-head"><h3>Шаги с телефона</h3>' +
    (has && !fresh ? '<button class="btn small" data-act="hl-setup-toggle">' + (pmg.hlSetupOpen ? 'Свернуть' : 'Настроить') + '</button>' : '') + '</div>';
  if (!open) {
    const src = pmg.devices && pmg.devices.health && pmg.devices.health.source;
    return h + '<p class="muted small">Данные приходят' + (src === 'android' ? ' с Android' : src === 'iphone' ? ' с iPhone' : '') + (k.last_used ? ', последний раз ' + pmgTimeAgo(k.last_used) : '') + '.</p></section>';
  }
  h += '<div class="seg-ctl mini hl-plat">' + [['ios', 'iPhone'], ['android', 'Android']].map(([x, l]) => '<button class="' + (plat === x ? 'on' : '') + '" data-act="hl-plat" data-v="' + x + '">' + l + '</button>').join('') + '</div>';
  if (!fresh) {
    h += '<p class="muted">' + (plat === 'ios'
      ? 'На iPhone шаги и этажи лежат в «Здоровье». Команда раз в день сама берёт их оттуда и присылает сюда.'
      : 'На Android шаги собирает Health Connect (туда пишут Google Fit, Samsung Health, Mi Fitness и другие). Бесплатное приложение HC Webhook отправляет их сюда само, по расписанию.') +
      ' Для этого нужен личный ключ — он как пароль, никому не показывай.</p>' +
      (k.has ? '<p class="muted small">Ключ уже создан' + (k.last_used ? ', последний раз использован ' + pmgTimeAgo(k.last_used) : ', но ещё ни разу не использован') + '. Новый ключ отключит старый.</p>' : '') +
      '<button class="btn primary" data-act="hl-key"' + (pmg.busy ? ' disabled' : '') + '>' + (k.has ? 'Создать новый ключ' : 'Получить ключ') + '</button>';
    return h + '</section>';
  }
  h += '<p class="hl-warn">Ключ показывается один раз. Сразу вставь ссылку в ' + (plat === 'ios' ? 'Команду' : 'HC Webhook') + '.</p>';
  if (plat === 'ios') {
    const url = PMG_HEALTH_URL + '?k=' + fresh + '&steps=';
    h += '<div class="hl-copy"><code>' + pmgEsc(url) + '</code><button class="btn small" data-act="hl-copy" data-v="' + pmgEsc(url) + '">Копировать</button></div>' +
      '<ol class="hl-steps">' +
      '<li>Открой <b>«Команды»</b> → «Быстрые команды» → <b>+</b>. Назови команду <b>Gradient</b>.</li>' +
      '<li>Добавь действие <b>«Найти образцы здоровья»</b> (в поиске набери «здоров»). Тип — <b>Шаги</b>, «Дата начала» — <b>Сегодня</b>, внизу «Группировать по» — <b>День</b>.</li>' +
      '<li>Добавь <b>«Получить сведения об образце здоровья»</b> → <b>Значение</b>, затем <b>«Задать переменную»</b> → <b>steps</b>.</li>' +
      '<li>Повтори шаги 2–3 для <b>«Пролёты пройдены»</b> (переменная <b>floors</b>) и <b>«Расстояние ходьбы и бега»</b> (<b>km</b>).</li>' +
      '<li>Добавь <b>«Текст»</b>: вставь скопированную ссылку, сразу за ней переменную <b>steps</b>, потом <code>&amp;floors=</code> + <b>floors</b> и <code>&amp;km=</code> + <b>km</b>.</li>' +
      '<li>Добавь <b>«Получить содержимое URL»</b> и <b>«Показать результат»</b>. Нажми ▶ — появится «Готово: … шагов».</li>' +
      '<li><b>«Автоматизация»</b> → <b>+</b> → <b>«Время суток»</b> → 21:30, ежедневно → <b>«Запускать сразу»</b> → «Запустить команду» → Gradient. Вторую сделай на 14:00.</li></ol>' +
      '<p class="muted small">Названия действий в разных версиях iOS могут слегка отличаться. Можно добавить сон в минутах: <code>&amp;sleep=</code>.</p>';
  } else {
    const url = PMG_HEALTH_URL + '?k=' + fresh;
    h += '<div class="hl-copy"><code>' + pmgEsc(url) + '</code><button class="btn small" data-act="hl-copy" data-v="' + pmgEsc(url) + '">Копировать</button></div>' +
      '<ol class="hl-steps">' +
      '<li>Проверь, что шаги попадают в <b>Health Connect</b>: Настройки → «Health Connect» (или «Подключение к Здоровью»). Samsung Health, Google Fit, Mi Fitness — в их настройках включи синхронизацию с Health Connect.</li>' +
      '<li>Установи из Google Play бесплатное приложение <b>HC Webhook</b> (com.hcwebhook.app).</li>' +
      '<li>Открой его и разреши чтение: <b>Шаги</b>, <b>Расстояние</b>, <b>Активные калории</b>, <b>Сон</b>.</li>' +
      '<li>Раздел <b>Webhooks</b> → добавить → вставь скопированную ссылку. Формат — <b>JSON</b>. Нажми <b>Test</b> — должно быть «ок».</li>' +
      '<li>Синхронизация: <b>Interval</b>, раз в 60 минут. В настройках телефона отключи для HC Webhook экономию батареи — иначе Android может его усыплять.</li></ol>' +
      '<p class="muted small">Этажи на большинстве Android не считаются — в рейтинге у тебя будут шаги и расстояние.</p>';
  }
  h += '<button class="btn" data-act="hl-key-done">Готово, ключ сохранил</button></section>';
  return h;
}

// ---------- Подключить телефон (расширение) ----------
function pmgPairCard(promo) {
  const pc = pmg.pairCode;
  let h = '<section class="card hl-dev' + (promo ? ' promo' : '') + '"><div class="card-head"><h3>' + (promo ? 'Gradient на телефоне' : 'Подключить телефон') + '</h3></div>';
  if (promo) h += '<p class="muted">Приложение на телефоне: оценки, домашка (можно добавлять свою, с фото доски), отчёты и Gradient Pass с огоньком и заданиями. Работает на iPhone и Android. Оценки будут храниться на сервере в закрытом разделе — видишь их только ты.</p>';
  if (pc && pc.expires > Date.now()) {
    const link = PMG_SITE + '#pair=' + pc.raw;
    let qr = '';
    try { const q = qrcode(0, 'M'); q.addData(link); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } catch (_) { /* без QR */ }
    const left = Math.max(0, Math.ceil((pc.expires - Date.now()) / 60000));
    h += '<div class="pair"><div class="pair-qr">' + qr + '</div><div class="pair-txt"><p>Наведи камеру телефона на QR-код или открой <b>' + PMG_SITE.replace('https://', '').replace(/\/$/, '') + '</b> и введи код:</p>' +
      '<div class="pair-code">' + pmgEsc(pc.code) + '</div><p class="muted small">Код одноразовый, действует ещё ' + left + ' мин.</p>' +
      '<p class="muted small">iPhone: в Safari «Поделиться» → «На экран Домой». Android: в Chrome меню ⋮ → «Добавить на главный экран».</p></div></div>';
  } else {
    h += '<div class="hl-dev-act"><button class="btn primary" data-act="hl-pair"' + (pmg.busy ? ' disabled' : '') + '>' + (pmg.busy ? 'Готовлю код…' : promo ? 'Подключить телефон' : 'Показать код для ещё одного телефона') + '</button></div>';
  }
  if (pmg.pairError) h += '<p class="err">' + pmgEsc(pmg.pairError) + '</p>';
  return h + '</section>';
}

// ---------- Действия ----------
async function pmgHealthAct(act, t) {
  const v = t.dataset.v;
  switch (act) {
    case 'hl-range': pmg.hlRange = +v; pmgRender(true, true); return true;
    case 'hl-metric': pmg.hlMetric = v; pmgRender(true, true); return true;
    case 'hl-goal': pmg.settings.stepGoal = +v; await pmgSaveSettings(); pmgRender(true, true); return true;
    case 'hl-setup-toggle': pmg.hlSetupOpen = !pmg.hlSetupOpen; pmgRender(true, true); return true;
    case 'hl-key': {
      pmg.busy = true; pmgRender(true, true);
      const r = await pmgGameMsg('health-key');
      pmg.busy = false;
      if (r && r.ok && r.key) { pmg.hlKey = r.key; pmg.hlSetupOpen = true; } else pmgToast('Не получилось: ' + pmgErrText((r && r.error) || 'network'));
      pmgRender(true, true); return true;
    }
    case 'hl-key-done': pmg.hlKey = null; pmg.hlSetupOpen = false; pmgRender(true, true); return true;
    case 'hl-copy': {
      try { await navigator.clipboard.writeText(v); pmgToast('Ссылка скопирована'); }
      catch (_) { pmgToast('Выдели ссылку и скопируй вручную'); }
      return true;
    }
    case 'hl-pair': {
      pmg.busy = true; pmg.pairError = null; pmgRender(true, true);
      const r = await pmgGameMsg('pair-code');
      pmg.busy = false;
      if (r && r.ok) {
        pmg.pairCode = { code: r.code, raw: r.code.replace('-', ''), expires: new Date(r.expires_at).getTime() };
        clearInterval(pmg.pairTimer);
        const webBefore = ((pmg.devices && pmg.devices.devices) || []).filter((d) => d.kind === 'web').length;
        let ticks = 0;
        pmg.pairTimer = setInterval(async () => {
          ticks++;
          if (!pmg.pairCode || pmg.pairCode.expires < Date.now()) { clearInterval(pmg.pairTimer); pmgRender(true, true); return; }
          // Ждём, пока телефон войдёт по коду
          const d = await pmgGameMsg('devices');
          const now = ((pmg.devices && pmg.devices.devices) || []).filter((x) => x.kind === 'web').length;
          if (d && d.ok && now > webBefore) { clearInterval(pmg.pairTimer); pmg.pairCode = null; pmgToast('Телефон подключён'); }
          if (pmg.tab === 'devices' && (ticks % 6 === 0 || !pmg.pairCode)) pmgRender(true, true);
        }, 5000);
      } else pmg.pairError = 'Не получилось: ' + pmgErrText((r && r.error) || 'network');
      pmgRender(true, true); return true;
    }
    case 'hl-cloud-off': {
      if (pmg.confirm !== 'cloud-off') { pmg.confirm = 'cloud-off'; pmgRender(true, true); return true; }
      pmg.confirm = null; await pmgGameMsg('cloud-off'); pmgRender(true, true); return true;
    }
    case 'dev-revoke': {
      if (pmg.confirm !== 'rev:' + v) { pmg.confirm = 'rev:' + v; pmgRender(true, true); return true; }
      pmg.confirm = null; await pmgGameMsg('device-revoke', { id: v }); pmgRender(true, true); return true;
    }
    case 'hl-plat': pmg.hlPlat = v; pmgRender(true, true); return true;
    case 'hl-sync': {
      t.disabled = true; t.textContent = 'Обновляю…';
      await pmgRefresh();
      return true;
    }
    case 'hl-signout': {
      if (pmg.confirm !== 'signout') { pmg.confirm = 'signout'; pmgRender(true, true); return true; }
      pmg.confirm = null;
      if (typeof pmgWebSignOut === 'function') pmgWebSignOut();
      return true;
    }
  }
  return false;
}
