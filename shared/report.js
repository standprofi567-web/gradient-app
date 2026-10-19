// Отчёт для родителей: одна картинка с итогами четверти или года.
// Рисуется на canvas, чтобы его можно было скачать как PNG или скопировать в мессенджер.

const PMG_R = {
  W: 1080, P: 64,
  ink: '#0E1222', ink2: '#2A3042', soft: '#687086', hair: 'rgba(15,20,40,.09)', bg: '#F3F5FB', card: '#FFFFFF',
  accent: '#4C5FD5', m: { 5: '#12976A', 4: '#3767D9', 3: '#C47A10', 2: '#D9414A' },
  ill: '#7C5CE0', ok: '#1597A6', unk: '#D9414A',
  font: '"PMG Onest", "Segoe UI", system-ui, sans-serif'
};

// ---------- Данные ----------

function pmgReportData(kind) {
  const d = pmg.data;
  const ps = pmgPeriods();
  const year = ps.find((p) => p.kind === 'year');
  const term = pmgPickPeriod(ps, new Date());
  const period = kind === 'year' ? (year || term) : term;
  const th = pmg.settings.threshold;
  const stats = pmgSubjectStats(d.marks, d.subjects, period, th).filter((s) => s.values.length);
  const marks = d.marks.filter((m) => pmgInPeriod(m, period)).sort((a, b) => pmgParseDate(a.date) - pmgParseDate(b.date) || a.id - b.id);
  const avg = pmgAvg(marks.map((m) => m.value));
  const inYear = (f) => { const t = pmgParseDate(f.date); return year && t >= year.from && t <= year.to; };

  // Итоговая: настоящая, если уже выставлена, иначе прогноз по среднему
  const terms = ps.filter((p) => p.kind === 'term');
  const ti = terms.findIndex((p) => p.id === (term && term.id));
  const termCode = term ? String((/триместр/i.test(term.name) ? 3006 : /полугодие/i.test(term.name) ? 3009 : 3002) + Math.max(0, ti)) : null;
  const code = kind === 'year' ? '3011' : termCode;
  const prev = pmgPrevYear();
  const rows = stats.map((s) => {
    const f = d.finals.find((x) => x.subjectId === s.id && x.type === code && inYear(x) && x.value != null);
    const p = prev.get(s.id, s.name);
    return { name: s.name, id: s.id, avg: s.avg, count: s.values.length, final: f ? f.value : s.rounded, real: !!f, last: p ? p.annual : null, values: s.values };
  }).sort((a, b) => b.final - a.final || b.avg - a.avg || a.name.localeCompare(b.name, 'ru'));

  const dist = { 5: 0, 4: 0, 3: 0, 2: 0 };
  marks.forEach((m) => { dist[Math.max(2, m.value)]++; });
  const finalsDist = { 5: 0, 4: 0, 3: 0, 2: 0 };
  rows.forEach((r) => { finalsDist[Math.max(2, r.final)]++; });

  // Самая длинная серия пятёрок подряд
  let streak = 0, cur = 0;
  marks.forEach((m) => { cur = m.value === 5 ? cur + 1 : 0; streak = Math.max(streak, cur); });

  // Самый удачный день — больше всего пятёрок
  const byDay = new Map();
  marks.forEach((m) => { if (m.value === 5) byDay.set(m.date, (byDay.get(m.date) || 0) + 1); });
  let bestDay = null;
  byDay.forEach((n, dt) => { if (!bestDay || n > bestDay.n) bestDay = { date: dt, n }; });

  const best = stats.slice().sort((a, b) => b.avg - a.avg || b.values.length - a.values.length)[0];
  const absences = d.absences.filter((a) => pmgInPeriod(a, period));
  const absBy = { ill: 0, ok: 0, unk: 0 };
  absences.forEach((a) => { if (a.name === 'по болезни') absBy.ill++; else if (a.name === 'уважительная') absBy.ok++; else absBy.unk++; });
  const cmp = rows.filter((r) => r.last != null);
  const better = cmp.filter((r) => r.final > r.last).length, worse = cmp.filter((r) => r.final < r.last).length;
  const tips = pmgTips(stats, null).filter((t) => t.kind === 'up').slice(0, 3);
  const daysLeft = pmgDaysLeft(period);

  return { kind, period, student: d.student, avg, rounded: pmgRound(avg, th), marks, rows, dist, finalsDist, streak, bestDay, best, absences, absBy, better, worse, cmpN: cmp.length, tips, daysLeft, prevYear: prev.year };
}

// ---------- Рисование ----------

function pmgRRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function pmgText(ctx, text, x, y, size, weight, color, align) {
  ctx.font = (weight || 400) + ' ' + size + 'px ' + PMG_R.font;
  ctx.fillStyle = color || PMG_R.ink;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  return ctx.measureText(text).width;
}

// Перенос текста по ширине. Возвращает высоту.
function pmgWrap(ctx, text, x, y, maxW, size, weight, color, lh) {
  ctx.font = (weight || 400) + ' ' + size + 'px ' + PMG_R.font;
  const words = String(text).split(' ');
  let line = '', yy = y;
  lh = lh || size * 1.35;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { pmgText(ctx, line, x, yy, size, weight, color); line = w; yy += lh; }
    else line = test;
  }
  if (line) pmgText(ctx, line, x, yy, size, weight, color);
  return yy - y + lh;
}

function pmgChip(ctx, v, x, y, size, outline) {
  const c = PMG_R.m[Math.max(2, Math.min(5, v))] || PMG_R.soft;
  if (outline) {
    pmgRRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, size * .28, null, null);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
  } else {
    pmgRRect(ctx, x, y, size, size, size * .28, c);
  }
  pmgText(ctx, String(v), x + size / 2, y + size * .7, size * .55, 700, outline ? c : '#fff', 'center');
}

function pmgLogoMark(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 24, s / 24);
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M16.95 7.05A7 7 0 1 0 19 12h-6'));
  ctx.beginPath(); ctx.arc(16.95, 7.05, 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function pmgSectionTitle(ctx, text, y) {
  pmgText(ctx, text, PMG_R.P, y, 34, 700, PMG_R.ink);
  return y + 30;
}

async function pmgDrawReport(r) {
  const R = PMG_R, W = 1920, H = 1080;
  try { await Promise.all([document.fonts.load('400 30px "PMG Onest"'), document.fonts.load('600 30px "PMG Onest"'), document.fonts.load('700 30px "PMG Onest"')]); } catch (e) { /* системный шрифт */ }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = R.bg; ctx.fillRect(0, 0, W, H);

  // ---------- Левая колонка: фирменная панель ----------
  const LW = 600;
  const g = ctx.createLinearGradient(0, 0, LW, H);
  g.addColorStop(0, '#6366F1'); g.addColorStop(.5, '#8B5CF6'); g.addColorStop(1, '#14B8A6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, H);
  ctx.save(); ctx.globalAlpha = .1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(LW + 40, -40, 120 + i * 70, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  const P = 64;
  pmgRRect(ctx, P, 56, 60, 60, 17, 'rgba(255,255,255,.18)');
  pmgLogoMark(ctx, P + 8, 64, 44);
  pmgText(ctx, 'Gradient', P + 78, 98, 28, 700, '#fff');
  const pname = r.kind === 'year' ? 'учебного года' : r.period.name.replace(/^(\S+)\s+четверть$/i, '$1 четверти');
  const y0 = r.period.from.getMonth() >= 8 ? r.period.from.getFullYear() : r.period.from.getFullYear() - 1;
  pmgText(ctx, 'Итоги', P, 200, 64, 700, '#fff');
  pmgText(ctx, pname, P, 268, 56, 700, '#fff');
  pmgText(ctx, y0 + '/' + String(y0 + 1).slice(2) + ' учебный год', P, 314, 26, 500, 'rgba(255,255,255,.9)');
  pmgWrap(ctx, r.student.name + ', ' + r.student.groupName + (r.student.school ? ', ' + r.student.school : ''), P, 352, LW - P * 2, 24, 400, 'rgba(255,255,255,.85)', 32);

  // Шкала среднего на белой карточке
  const cy0 = 420;
  ctx.save(); ctx.shadowColor = 'rgba(15,20,40,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  pmgRRect(ctx, P, cy0, LW - P * 2, 300, 28, R.card); ctx.restore();
  const gx = LW / 2, gy = cy0 + 200, rad = 140;
  ctx.lineCap = 'round'; ctx.lineWidth = 22;
  ctx.strokeStyle = 'rgba(15,20,40,.08)'; ctx.beginPath(); ctx.arc(gx, gy, rad, Math.PI, 0); ctx.stroke();
  const frac = r.avg == null ? 0 : Math.max(0, Math.min(1, (r.avg - 2) / 3));
  const mc = R.m[Math.max(2, r.rounded || 2)];
  const ag = ctx.createLinearGradient(gx - rad, 0, gx + rad, 0);
  ag.addColorStop(0, mc + '66'); ag.addColorStop(1, mc);
  ctx.strokeStyle = ag; ctx.beginPath(); ctx.arc(gx, gy, rad, Math.PI, Math.PI + Math.PI * frac); ctx.stroke();
  pmgText(ctx, pmgFmtAvg(r.avg), gx, gy - 10, 96, 700, R.ink, 'center');
  pmgText(ctx, 'средний балл, ' + r.marks.length + ' ' + pmgPlural(r.marks.length, ['оценка', 'оценки', 'оценок']), gx, gy + 62, 23, 500, R.soft, 'center');
  pmgText(ctx, '2', gx - rad, gy + 30, 18, 600, R.soft, 'center');
  pmgText(ctx, '5', gx + rad, gy + 30, 18, 600, R.soft, 'center');

  // Итоговые: сколько каких
  let fy = cy0 + 360;
  pmgText(ctx, r.kind === 'year' ? (r.rows.some((x) => x.real) ? 'Годовые оценки' : 'Годовые оценки, прогноз') : (r.daysLeft != null ? 'Выходит за четверть (до конца ' + r.daysLeft + ' ' + pmgPlural(r.daysLeft, ['день', 'дня', 'дней']) + ')' : 'Оценки за четверть'), P, fy, 24, 600, '#fff');
  let fx = P;
  [5, 4, 3, 2].filter((k) => r.finalsDist[k]).forEach((k) => {
    pmgRRect(ctx, fx, fy + 22, 64, 64, 18, 'rgba(255,255,255,.95)');
    pmgText(ctx, String(k), fx + 32, fy + 68, 36, 700, R.m[k], 'center');
    const w = pmgText(ctx, '× ' + r.finalsDist[k], fx + 76, fy + 66, 30, 600, '#fff');
    fx += 76 + w + 34;
  });
  if (r.cmpN) {
    const parts = [];
    if (r.better) parts.push(r.better + ' лучше');
    if (r.worse) parts.push(r.worse + ' хуже');
    pmgWrap(ctx, 'По сравнению с ' + r.prevYear + '/' + String(r.prevYear + 1).slice(2) + ': ' + (parts.length ? parts.join(', ') + ', остальные так же' : 'всё на том же уровне'), P, fy + 130, LW - P * 2, 21, 400, 'rgba(255,255,255,.9)', 28);
  }
  const now = new Date();
  pmgText(ctx, 'Сформировано в Gradient ' + now.getDate() + ' ' + PMG_MONTHS[now.getMonth()] + ' ' + now.getFullYear(), P, H - 66, 17, 400, 'rgba(255,255,255,.8)');
  pmgText(ctx, 'по данным Электронного дневника СПб', P, H - 42, 17, 400, 'rgba(255,255,255,.8)');

  // ---------- Правая часть ----------
  const X = LW + 64, RW = W - X - 64;
  pmgText(ctx, 'Оценки по предметам', X, 104, 34, 700, R.ink);
  pmgText(ctx, 'справа — итоговая (пунктиром — прогноз), стрелка — сравнение с прошлым годом', X + RW, 104, 18, 400, R.soft, 'right');
  const rows = r.rows;
  const perCol = Math.ceil(rows.length / 2) || 1;
  const tableY = 132, tableH = 500;
  const rowH = Math.min(62, (tableH - 24) / perCol);
  const colW = (RW - 24) / 2;
  [0, 1].forEach((ci) => {
    const cx = X + ci * (colW + 24);
    pmgRRect(ctx, cx, tableY, colW, tableH, 24, R.card);
    rows.slice(ci * perCol, ci * perCol + perCol).forEach((row, i) => {
      const ry = tableY + 12 + i * rowH;
      if (i) { ctx.fillStyle = R.hair; ctx.fillRect(cx + 24, ry, colW - 48, 2); }
      const mid = ry + rowH / 2;
      let name = row.name;
      ctx.font = '500 22px ' + R.font;
      while (ctx.measureText(name).width > colW - 340 && name.length > 4) name = name.slice(0, -2) + '…';
      pmgText(ctx, name, cx + 26, mid + 8, 22, 500, R.ink);
      row.values.slice(-8).forEach((v, k) => { ctx.fillStyle = R.m[Math.max(2, v)]; ctx.beginPath(); ctx.arc(cx + colW - 300 + k * 13, mid, 4.5, 0, Math.PI * 2); ctx.fill(); });
      pmgText(ctx, pmgFmtAvg(row.avg), cx + colW - 130, mid + 8, 21, 600, R.soft, 'right');
      if (row.last != null) {
        const diff = row.final - row.last;
        pmgText(ctx, diff > 0 ? '↑' : diff < 0 ? '↓' : '=', cx + colW - 100, mid + 9, 24, 700, diff > 0 ? R.m[5] : diff < 0 ? R.m[2] : R.soft, 'center');
      }
      const cs = Math.min(44, rowH - 14);
      pmgChip(ctx, row.final, cx + colW - 26 - cs, mid - cs / 2, cs, !row.real);
    });
  });

  // Полоса «сколько каких оценок»
  const dy = tableY + tableH + 28;
  pmgRRect(ctx, X, dy, RW, 92, 24, R.card);
  pmgText(ctx, 'Все оценки', X + 26, dy + 56, 22, 600, R.ink);
  const total = r.marks.length || 1;
  let bx = X + 180;
  const bw = RW - 180 - 540;
  [5, 4, 3, 2].forEach((k) => {
    const w = bw * r.dist[k] / total;
    if (w > 0) { pmgRRect(ctx, bx, dy + 34, Math.max(w - 4, 4), 24, 8, R.m[k]); bx += w; }
  });
  let lx = X + RW - 500;
  [5, 4, 3, 2].forEach((k) => {
    ctx.fillStyle = R.m[k]; ctx.beginPath(); ctx.arc(lx + 8, dy + 48, 8, 0, Math.PI * 2); ctx.fill();
    const w = pmgText(ctx, k + ' — ' + r.dist[k], lx + 24, dy + 56, 22, 600, R.ink2);
    lx += 24 + w + 30;
  });

  // Плитки «Главное»
  const tiles = [];
  if (r.best) tiles.push(['Лучший предмет', r.best.name, pmgFmtAvg(r.best.avg) + ', ' + r.best.values.length + ' ' + pmgPlural(r.best.values.length, ['оценка', 'оценки', 'оценок']), R.m[5]]);
  if (r.streak > 1) tiles.push(['Пятёрок подряд', String(r.streak), 'самая длинная серия', R.accent]);
  if (r.bestDay && r.bestDay.n > 1) { const bd = pmgParseDate(r.bestDay.date); tiles.push(['Самый удачный день', bd.getDate() + ' ' + PMG_MONTHS[bd.getMonth()], pmgCountWord(r.bestDay.n, 5) + ' за день', R.m[4]]); }
  tiles.push(['Пропущено уроков', String(r.absences.length), r.absences.length ? [r.absBy.ill ? r.absBy.ill + ' по болезни' : '', r.absBy.ok ? r.absBy.ok + ' по уваж. причине' : '', r.absBy.unk ? r.absBy.unk + ' без причины' : ''].filter(Boolean).join(', ') : 'ни одного пропуска', r.absences.length ? R.ill : R.m[5]]);
  const ty = dy + 92 + 24, th = H - 64 - ty;
  const n = Math.min(4, tiles.length), tw = (RW - 24 * (n - 1)) / n;
  tiles.slice(0, 4).forEach((t, i) => {
    const tx = X + i * (tw + 24);
    pmgRRect(ctx, tx, ty, tw, th, 24, R.card);
    pmgRRect(ctx, tx + 24, ty + 26, 8, 30, 4, t[3]);
    pmgText(ctx, t[0], tx + 44, ty + 50, 20, 500, R.soft);
    const mid = ty + th / 2;
    let big = 44;
    ctx.font = '700 ' + big + 'px ' + R.font;
    while (big > 24 && ctx.measureText(t[1]).width > tw - 48) { big -= 2; ctx.font = '700 ' + big + 'px ' + R.font; }
    let label = t[1];
    while (ctx.measureText(label).width > tw - 48 && label.length > 4) label = label.slice(0, -2) + '…';
    pmgText(ctx, label, tx + 24, mid + 22, big, 700, R.ink);
    pmgWrap(ctx, t[2], tx + 24, mid + 62, tw - 48, 18, 400, R.soft, 24);
  });
  return c;
}

// ---------- Окно предпросмотра ----------

async function pmgOpenReport(kind) {
  if (!pmg.data) return;
  pmg.reportKind = kind || pmg.reportKind || 'term';
  let modal = pmgQ('.report-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'report-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Отчёт для родителей');
    pmgQ('.panel').appendChild(modal);
  }
  const term = pmgPickPeriod(pmgPeriods(), new Date());
  modal.innerHTML = '<div class="rm-box"><header class="rm-head"><h2>Отчёт для родителей</h2>' +
    '<div class="seg-ctl sm" role="group" aria-label="Период">' + [['term', term ? term.name : 'Четверть'], ['year', 'Весь год']].map(([v, l]) => '<button class="' + (pmg.reportKind === v ? 'on' : '') + '" data-act="report-kind" data-v="' + v + '">' + pmgEsc(l) + '</button>').join('') + '</div>' +
    '<button class="icon-btn" data-act="report-close" aria-label="Закрыть">' + pmgIcon('close') + '</button></header>' +
    '<div class="rm-preview"><div class="loader"><span></span><span></span><span></span></div></div>' +
    '<footer class="rm-foot"><button class="btn primary" data-act="report-save" disabled>Скачать картинку</button><button class="btn" data-act="report-copy" disabled>Скопировать</button><span class="rm-note muted"></span></footer></div>';
  requestAnimationFrame(() => modal.classList.add('open'));
  const canvas = await pmgDrawReport(pmgReportData(pmg.reportKind));
  pmg.reportCanvas = canvas;
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.alt = 'Отчёт для родителей';
  const prev = modal.querySelector('.rm-preview');
  prev.innerHTML = '';
  prev.appendChild(img);
  modal.querySelectorAll('[data-act="report-save"], [data-act="report-copy"]').forEach((b) => { b.disabled = false; });
}

function pmgCloseReport() {
  const m = pmgQ('.report-modal');
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => m.remove(), 250);
}

function pmgReportFileName() {
  const r = pmg.reportKind === 'year' ? 'год' : (pmgPickPeriod(pmgPeriods(), new Date()) || { name: 'четверть' }).name.replace(/\s+/g, '-');
  return 'Gradient-итоги-' + r + '-' + pmgIsoDate(new Date()) + '.png';
}

function pmgSaveReport() {
  const c = pmg.reportCanvas;
  if (!c) return;
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = pmgReportFileName();
    (pmg.mode === 'page' ? document.body : document.documentElement).appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const n = pmgQ('.rm-note'); if (n) n.textContent = 'Сохранено в «Загрузки».';
    pmgNoteReport();
  }, 'image/png');
}

function pmgCopyReport() {
  const c = pmg.reportCanvas, n = pmgQ('.rm-note');
  if (!c) return;
  c.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (n) n.textContent = 'Скопировано. Вставь в чат с родителями.';
      pmgNoteReport();
    } catch (e) {
      if (n) n.textContent = 'Не получилось скопировать — скачай картинку.';
    }
  }, 'image/png');
}

function pmgNoteReport() {
  const G = pmg.game && pmg.game.view;
  if (G && typeof pmgGameMsg === 'function') pmgGameMsg('action', { key: 'report:' + G.season.id });
}

// ---------- Неделя: с понедельника против того же отрезка прошлой недели ----------
function pmgWeekReport() {
  const mon = pmgToday(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const span = Math.round((pmgToday() - mon) / 864e5) + 1;
  const prevEnd = new Date(mon); prevEnd.setDate(prevEnd.getDate() - 7 + span - 1);
  const cur = pmgDaysBack(span), prev = pmgDaysBack(span, prevEnd);
  const marksIn = (list) => (pmg.data && pmg.data.marks ? pmg.data.marks.filter((m) => { const d = pmgParseDate(m.date); return d && m.value && list.includes(pmgIso(d)); }) : []);
  const mc = marksIn(cur), mp = marksIn(prev);
  const hwIn = (list) => Object.values(pmg.done || {}).filter((t) => t && list.includes(pmgIso(new Date(t)))).length;
  const rows = [
    ['Средний балл', mc.length ? pmgAvg(mc.map((m) => m.value)) : null, mp.length ? pmgAvg(mp.map((m) => m.value)) : null, pmgFmtAvg],
    ['Оценок', mc.length, mp.length, pmgFmtInt],
    ['Пятёрок', mc.filter((m) => m.value === 5).length, mp.filter((m) => m.value === 5).length, pmgFmtInt],
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
