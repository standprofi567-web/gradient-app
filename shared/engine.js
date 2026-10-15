// Gradient Pass: считает очки, огонёк, задания и достижения по данным дневника.
// Работает целиком на компьютере. На сервер уходят только события вида {ref, kind, day, xp} — без предметов и текстов.

const PMG_CONTROL_RE = /провер|контрол|тест|диктант|изложен|сочинен|самостоят|зач[её]т/i;
const PMG_MARK_XP = { 5: 60, 4: 40, 3: 20, 2: 0, 1: 0 };
const PMG_MARK_NAME = { 5: 'Пятёрка', 4: 'Четвёрка', 3: 'Тройка', 2: 'Двойка', 1: 'Единица' };

function pmgHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pmgSod(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function pmgPlusDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function pmgMonday(d) { const x = pmgSod(d); const wd = (x.getDay() + 6) % 7; return pmgPlusDays(x, -wd); }

// Общие для расчёта и выбора заданий сведения о дневнике.
function pmgGameContext(input) {
  const data = input.data, now = new Date(input.now || Date.now());
  const today = pmgSod(now), todayIso = pmgIso(today);
  const terms = data.periods.filter((p) => p.kind === 'term');
  const holidays = data.periods.filter((p) => p.kind === 'holiday');
  const inP = (d, p) => d >= pmgSod(p.from) && d <= pmgSod(p.to);
  const termOf = (d) => terms.find((p) => inP(d, p)) || null;

  // d — дата урока (по ней средние и четверти), g — день, когда оценка появилась в дневнике (по нему очки и задания).
  // Учитель может выставить оценку за 13-е только 15-го: тогда очки и огонёк — за 15-е.
  const seen = input.seen || {};
  const marks = data.marks.map((m) => ({ ...m, d: pmgSod(pmgParseDate(m.date)) })).filter((m) => m.d)
    .map((m) => { const s = seen[m.id] ? pmgDateOf(seen[m.id]) : null; return { ...m, g: s && s > m.d ? s : m.d }; })
    .sort((a, b) => a.d - b.d || a.id - b.id);
  const lessonsByDay = {};
  (data.lessons || []).forEach((l) => { const d = pmgParseDate(l.from); if (!d) return; const k = pmgIso(d); (lessonsByDay[k] = lessonsByDay[k] || []).push(l); });
  const marksByDay = {}, marksByLesson = {};
  marks.forEach((m) => { const k = pmgIso(m.g); (marksByDay[k] = marksByDay[k] || []).push(m); });
  marks.forEach((m) => { const k = pmgIso(m.d); (marksByLesson[k] = marksByLesson[k] || []).push(m); });
  const absByDay = {};
  (data.absences || []).forEach((a) => { const d = pmgParseDate(a.date); if (!d) return; const k = pmgIso(d); (absByDay[k] = absByDay[k] || []).push(a); });

  const isSchool = (d) => {
    if (holidays.some((p) => inP(d, p))) return false;
    if (!termOf(d)) return false;
    const wd = d.getDay();
    return (wd >= 1 && wd <= 5) || !!lessonsByDay[pmgIso(d)];
  };
  const nextSchool = (d) => { for (let i = 1; i <= 14; i++) { const x = pmgPlusDays(d, i); if (isSchool(x)) return x; } return null; };

  const done = input.done || {};
  const hw = pmgBuildHomework(data.lessons || [], { mode: input.hwMode || 'assigned', done, overrides: input.overrides || {} })
    .map((h) => ({ ...h, doneAt: done[h.key] || null }));

  // Средние по предметам в текущей четверти (для «слабого предмета»)
  const curTerm = termOf(today) || terms.filter((p) => pmgSod(p.to) < today).pop() || null;
  const subjAvg = {};
  if (curTerm) {
    const by = {};
    marks.filter((m) => inP(m.d, curTerm)).forEach((m) => { (by[m.subjectId] = by[m.subjectId] || { name: m.subject, v: [] }).v.push(m.value); });
    Object.entries(by).forEach(([id, s]) => { subjAvg[id] = { id: +id, name: s.name, avg: pmgAvg(s.v), n: s.v.length }; });
  }
  const weak = Object.values(subjAvg).filter((s) => s.n >= 2).sort((a, b) => a.avg - b.avg)[0] || null;

  return { data, now, today, todayIso, terms, termOf, marks, lessonsByDay, marksByDay, marksByLesson, absByDay, isSchool, nextSchool, hw, curTerm, subjAvg, weak, inP };
}

function pmgIsControl(m) { return PMG_CONTROL_RE.test(m.typeName || ''); }

// Домашка на следующий учебный день после d.
function pmgTomorrowHw(ctx, d) {
  const nx = ctx.nextSchool(d);
  if (!nx) return [];
  return ctx.hw.filter((h) => h.due && h.due.getTime() === nx.getTime());
}

// Отмечено ли всё на завтра к моменту limit (часы в день d).
function pmgAllDoneBy(items, d, hour) {
  if (!items.length) return false;
  const limit = pmgSod(d).getTime() + hour * 3600e3;
  return items.every((h) => h.doneAt && h.doneAt <= limit);
}

// ---------- Выбор заданий ----------
function pmgPickDaily(ctx, iso, seed, opts) {
  opts = opts || {};
  const d = pmgDateOf(iso);
  const lessons = ctx.lessonsByDay[iso] || [];
  const hasLesson = (id) => lessons.some((l) => l.subjectId === id);
  const pick = (group, list) => {
    const pool = list.filter((q) => !(opts.exclude || []).includes(q.id));
    const use = pool.length ? pool : list;
    return use[pmgHash(iso + '|' + seed + '|' + group + '|' + (opts.salt || '')) % use.length];
  };
  const study = PMG_DAILY.study.filter((q) => {
    if (q.id === 's_weak') return ctx.weak && hasLesson(ctx.weak.id);
    if (q.id === 's_five_low') return Object.values(ctx.subjAvg).some((s) => s.avg < 4.5 && hasLesson(s.id));
    return true;
  });
  const undone = ctx.hw.filter((h) => !h.doneAt);
  const hw = PMG_DAILY.hw.filter((q) => {
    if (q.id === 'h_overdue') return undone.some((h) => h.due && h.due < d);
    if (q.id === 'h_learn') return undone.some((h) => h.due && h.due >= d && h.due <= pmgPlusDays(d, 7) && h.tags.some((t) => t.k === 'learn' || t.k === 'check'));
    if (q.id === 'h_tomorrow') return pmgTomorrowHw(ctx, d).length > 0;
    return true;
  });
  const easy = PMG_DAILY.easy.filter((q) => {
    if (q.id === 'e_cheer') return !!opts.inGroup;
    if (q.id === 'e_need') return !!ctx.weak;
    return true;
  });
  const out = { study: pick('study', study.length ? study : [PMG_DAILY.study[0]]), hw: pick('hw', hw.length ? hw : [PMG_DAILY.hw[0]]), easy: pick('easy', easy) };
  if (opts.only) return out[opts.only];
  return { ids: [out.study.id, out.hw.id, out.easy.id], weak: ctx.weak ? ctx.weak.id : null, rerolled: false };
}

function pmgPickWeekly(ctx, monIso, seed) {
  const mon = pmgDateOf(monIso), sun = pmgPlusDays(mon, 6);
  const r = (k, n) => pmgHash(monIso + '|' + seed + '|' + k) % n;
  const easy = PMG_WEEKLY.easy[r('e', 2)];
  const mid = PMG_WEEKLY.mid[r('m', 3)];
  const avgs = Object.values(ctx.subjAvg);
  const overall = avgs.length ? pmgAvg(avgs.map((s) => s.avg)) : null;
  const hasCheck = ctx.hw.some((h) => h.due && h.due >= mon && h.due <= sun && h.tags.some((t) => t.k === 'check')) ||
    Object.keys(ctx.lessonsByDay).some((k) => k >= monIso && k <= pmgIso(sun) && ctx.lessonsByDay[k].some((l) => PMG_CONTROL_RE.test(l.topic || '')));
  let hard;
  if (ctx.weak && ctx.weak.avg < 3.6) hard = 'w_raise';
  else if (overall != null && overall >= 4.6) hard = hasCheck ? 'w_test45' : (ctx.weak && ctx.weak.avg < 4.85 ? 'w_raise' : 'w_5fives');
  else hard = hasCheck && r('h', 2) ? 'w_test45' : 'w_5fives';
  if (hard === 'w_raise' && !ctx.weak) hard = 'w_5fives';
  return { ids: [easy.id, mid.id, hard], weak: ctx.weak ? ctx.weak.id : null, weakName: ctx.weak ? ctx.weak.name : null, base: ctx.weak ? ctx.weak.avg : null };
}

// ---------- Главный расчёт ----------
// input: { data, season, now, threshold, done, overrides, hwMode, logins, actions, quests, wquests, level, inGroup }
function pmgGame(input) {
  const ctx = pmgGameContext(input);
  const season = input.season, th = input.threshold || 0.55;
  const S = pmgDateOf(season.starts), E = pmgDateOf(season.ends);
  const today = ctx.today, endDay = today < E ? today : E;
  const over = today > E;
  const now = ctx.now;
  const inSeason = (d) => d >= S && d <= E;
  const logins = input.logins || {}, actions = input.actions || {};
  const dq = input.quests || {}, wq = input.wquests || {};
  const level = input.level || 1;

  const schoolDays = [];
  for (let d = new Date(S); d <= endDay; d = pmgPlusDays(d, 1)) if (ctx.isSchool(d)) schoolDays.push(new Date(d));

  // --- Сведения о каждом учебном дне ---
  const day = {};
  const lowFiveIds = new Set();
  // Пятёрки по предметам с низким средним (средний до оценки в той же четверти ниже 4,5)
  {
    const hist = {};
    ctx.marks.forEach((m) => {
      const t = ctx.termOf(m.d); const k = m.subjectId + '|' + (t ? t.id : '-');
      const prev = hist[k] || (hist[k] = []);
      if (m.value === 5 && prev.length && pmgAvg(prev) < 4.5) lowFiveIds.add(m.id);
      prev.push(m.value);
    });
  }
  schoolDays.forEach((d) => {
    const iso = pmgIso(d);
    const ms = ctx.marksByDay[iso] || [];
    const tom = pmgTomorrowHw(ctx, d);
    const abs = ctx.absByDay[iso] || [];
    day[iso] = {
      d, iso, marks: ms,
      m45: ms.filter((m) => m.value >= 4).length,
      fives: ms.filter((m) => m.value === 5).length,
      tom, tomAll: pmgAllDoneBy(tom, d, 24), tom22: pmgAllDoneBy(tom, d, 22), tom18: pmgAllDoneBy(tom, d, 18),
      abs, ill: abs.length > 0 && !ms.length && abs.every((a) => /болезн/i.test(a.name || '')),
      lessons: ctx.lessonsByDay[iso] || []
    };
  });

  // --- Задания дня ---
  const dayStart = (d) => pmgSod(d).getTime(), dayEnd = (d) => pmgSod(d).getTime() + 864e5;
  function dailyState(id, iso, meta) {
    const info = day[iso]; const d = pmgDateOf(iso);
    const q = PMG_QUEST_BY_ID[id];
    let progress = 0, goal = 1;
    if (!info) return { id, text: q.text, xp: q.xp, progress, goal, done: false };
    const doneOn = (h) => h.doneAt && h.doneAt >= dayStart(d) && h.doneAt < dayEnd(d);
    switch (id) {
      case 's_any45': progress = Math.min(1, info.m45); break;
      case 's_weak': progress = Math.min(1, info.marks.filter((m) => m.subjectId === meta.weak).length); break;
      case 's_two': goal = 2; progress = Math.min(2, info.marks.length); break;
      case 's_five_low': progress = info.marks.some((m) => lowFiveIds.has(m.id)) ? 1 : 0; break;
      case 'h_tomorrow': goal = Math.max(1, info.tom.length); progress = info.tom.filter((h) => h.doneAt && h.doneAt <= dayStart(d) + 22 * 3600e3).length; if (!info.tom.length) progress = 0; break;
      case 'h_overdue': progress = ctx.hw.some((h) => h.due && h.due < d && doneOn(h)) ? 1 : 0; break;
      case 'h_learn': progress = ctx.hw.some((h) => doneOn(h) && h.tags.some((t) => t.k === 'learn' || t.k === 'check')) ? 1 : 0; break;
      case 'e_need': progress = actions['need:' + iso] ? 1 : 0; break;
      case 'e_cheer': progress = actions['cheer:' + iso] ? 1 : 0; break;
      case 'e_sched': { const t = actions['sched:' + iso]; progress = t && t <= dayStart(d) + 21 * 3600e3 ? 1 : 0; break; }
    }
    return { id, text: q.text, xp: q.xp, progress, goal, done: progress >= goal };
  }
  const questsByDay = {};
  Object.keys(dq).forEach((iso) => {
    if (!day[iso]) return;
    questsByDay[iso] = dq[iso].ids.map((id) => dailyState(id, iso, dq[iso]));
  });
  const questsDone = (iso) => (questsByDay[iso] || []).filter((q) => q.done).length;

  // --- Огонёк ---
  const earnedFreezes = [8, 18, 28, 38].filter((l) => level >= l).length;
  // Огонёк — про привычку, а не про удачу с оценками. Учебный день засчитан, если было хоть одно:
  // открыл Gradient, отметил домашку, появилась 4 или 5, выполнил задание дня.
  // Не засчитан: первый такой день в неделе прощается сам («передышка»), дальше спасает заморозка, потом огонёк гаснет.
  // Выходные, каникулы и дни болезни огонёк не трогают. Сегодняшний день не гасит огонёк, пока не закончился.
  let streak = 0, best = 0, used = 0, everBroken = false, restoreUsed = !!(input.restoreUsed), lost = null;
  const multBy = {}, streakBy = {}, frozen = [], countedBy = {}, restWeeks = new Set(), rested = [];
  const hwDoneOn = {};
  ctx.hw.forEach((h) => { if (h.doneAt) { const k = pmgIso(pmgSod(h.doneAt)); hwDoneOn[k] = (hwDoneOn[k] || 0) + 1; } });
  let restoreOffer = null;
  schoolDays.forEach((d, i) => {
    const iso = pmgIso(d), info = day[iso];
    const counted = !!logins[iso] || !!hwDoneOn[iso] || info.m45 > 0 || questsDone(iso) >= 1;
    countedBy[iso] = counted;
    if (info.ill && !counted) { multBy[iso] = pmgStreakMult(streak); streakBy[iso] = streak; return; }
    // «Вернуть серию»: на следующий учебный день после потери — все 3 задания дня
    if (lost && lost.next === iso) {
      if (questsDone(iso) >= 3 && !restoreUsed) { streak = lost.value; restoreUsed = true; everBroken = lost.wasBroken; }
      else if (iso === ctx.todayIso && !restoreUsed) restoreOffer = { value: lost.value };
      lost = null;
    }
    if (counted) streak++;
    else if (iso === ctx.todayIso) { /* день ещё идёт */ }
    else if (streak > 0 && !restWeeks.has(pmgIso(pmgMonday(d)))) { restWeeks.add(pmgIso(pmgMonday(d))); rested.push(iso); }
    else if (streak > 0 && Math.min(2, earnedFreezes - used) > 0) { used++; frozen.push(iso); }
    else {
      if (streak > 0) {
        if (streak >= 7 && !restoreUsed) lost = { value: streak, next: schoolDays[i + 1] ? pmgIso(schoolDays[i + 1]) : pmgIso(ctx.nextSchool(d) || d), wasBroken: everBroken };
        everBroken = true;
      }
      streak = 0;
    }
    best = Math.max(best, streak);
    multBy[iso] = pmgStreakMult(streak); streakBy[iso] = streak;
  });
  // Полоска недели для анимации огонька: пн…вс текущей недели
  const schoolSet = new Set(schoolDays.map(pmgIso)), frozenSet = new Set(frozen), restSet = new Set(rested);
  const weekStrip = [];
  { const mon = pmgMonday(today);
    for (let k = 0; k < 7; k++) {
      const d = new Date(mon); d.setDate(d.getDate() + k); const iso = pmgIso(d);
      let st;
      if (countedBy[iso]) st = 'on';
      else if (iso > ctx.todayIso) st = 'future';
      else if (iso === ctx.todayIso) st = schoolSet.has(iso) ? 'today' : 'off';
      else if (frozenSet.has(iso)) st = 'frozen';
      else if (restSet.has(iso)) st = 'rest';
      else if (!schoolSet.has(iso) || (day[iso] && day[iso].ill)) st = 'off';
      else st = 'miss';
      weekStrip.push({ iso, st });
    } }
  // Если потеря была вчера, а сегодня ещё не учебный день — предложение висит
  if (lost && !restoreUsed && lost.next >= ctx.todayIso) restoreOffer = { value: lost.value, day: lost.next };
  const multOf = (iso) => {
    if (multBy[iso] != null) return multBy[iso];
    // выходной: множитель последнего учебного дня до него
    let m = 1; for (const k of Object.keys(multBy)) if (k <= iso) m = multBy[k]; return m;
  };
  const todayCounted = !!countedBy[ctx.todayIso];

  // --- События ---
  const events = [];
  const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const add = (ref, kind, d, xp, label, extra) => { events.push({ ref, kind, day: typeof d === 'string' ? d : pmgIso(d), xp: Math.round(xp), label, ...(extra || {}) }); };

  // Оценки
  const subjHist = {}, termHist = {}, upDone = new Set();
  let fiveRun = 0, fiveRunBest = 0, comebacks = 0;
  ctx.marks.forEach((m) => {
    const t = ctx.termOf(m.d); const tk = m.subjectId + '|' + (t ? t.id : '-');
    const prevTerm = termHist[tk] || (termHist[tk] = []);
    const prevAll = subjHist[m.subjectId] || (subjHist[m.subjectId] = []);
    if (inSeason(m.g) && m.g <= endDay) {
      const iso = pmgIso(m.g), mult = multOf(iso), ctrl = pmgIsControl(m);
      const lbl = (PMG_MARK_NAME[m.value] || 'Оценка') + (ctrl ? ' за ' + (m.typeName || '').toLowerCase() : '') + ' · ' + m.subject;
      add('mark:' + m.id, 'mark', iso, PMG_MARK_XP[m.value] * (ctrl ? 1.5 : 1) * mult, lbl, { src: 'mark', subject: m.subject, value: m.value });
      const avgBefore = prevTerm.length ? pmgAvg(prevTerm) : null;
      if (avgBefore != null && avgBefore < 4.5 && m.value >= avgBefore + 1) add('rush:' + m.id, 'rush', iso, 25, 'Рывок · ' + m.subject);
      const last = prevAll[prevAll.length - 1];
      if (last != null && last <= 3 && m.value >= 4) { add('comeback:' + m.id, 'comeback', iso, 80, 'Камбэк · ' + m.subject); comebacks++; }
      if (m.value === 5) {
        fiveRun++; fiveRunBest = Math.max(fiveRunBest, fiveRun);
        const bonus = fiveRun === 3 ? 10 : fiveRun === 4 ? 20 : fiveRun === 5 ? 30 : fiveRun > 5 ? 50 : 0;
        if (bonus) add('f5:' + m.id, 'streak5', iso, bonus, fiveRun + ' пятёрок подряд');
      } else fiveRun = 0;
      if (prevTerm.length) {
        const before = pmgRound(pmgAvg(prevTerm), th), after = pmgRound(pmgAvg(prevTerm.concat(m.value)), th);
        for (let to = before + 1; to <= after; to++) {
          if (to < 4) continue;
          const ref = 'up:' + m.subjectId + ':' + (t ? t.id : '-') + ':' + to;
          if (upDone.has(ref)) continue;
          upDone.add(ref); add(ref, 'up', iso, 150, 'Прогноз вырос до «' + to + '» · ' + m.subject);
        }
      }
    }
    prevTerm.push(m.value); prevAll.push(m.value);
  });

  // Итоговые за четверть
  const finals = (ctx.data.finals || []).map((f) => ({ ...f, d: pmgSod(pmgParseDate(f.date)) })).filter((f) => f.d && f.value);
  const termFinals = finals.filter((f) => /четверт|полугод|триместр/i.test(f.typeName || ''));
  let above = false;
  termFinals.forEach((f) => {
    if (f.d < S || f.d > pmgPlusDays(E, 10) || f.d > today) return;
    const xp = { 5: 300, 4: 200, 3: 100 }[f.value] || 0;
    if (!xp) return;
    add('final:' + f.id, 'final', f.d > E ? E : f.d, xp, 'Итоговая «' + f.value + '» · ' + f.subject);
    const prev = termFinals.filter((x) => x.subjectId === f.subjectId && x.d < f.d).sort((a, b) => b.d - a.d)[0];
    if (prev && f.value > prev.value) above = true;
  });

  // Домашка
  const hwByDay = {};
  ctx.hw.filter((h) => h.doneAt && h.due).sort((a, b) => a.doneAt - b.doneAt).forEach((h) => {
    const dd = pmgSod(h.doneAt);
    if (!inSeason(dd) || dd > endDay) return;
    if (h.doneAt >= dayStart(h.due) + 9 * 3600e3) return; // сдана поздно
    const iso = pmgIso(dd);
    hwByDay[iso] = (hwByDay[iso] || 0) + 1;
    if (hwByDay[iso] > 8) return;
    add('hw:' + h.key, 'hw', iso, 15 * multOf(iso), 'Домашка · ' + h.subject, { src: 'hw', key: h.key });
    if (h.due <= today && inSeason(h.due)) {
      const ok = (ctx.marksByLesson[pmgIso(h.due)] || []).some((m) => m.subjectId === h.subjectId && m.value >= 4);
      if (ok) add('hwok:' + h.key, 'hwok', h.due, 20, 'Домашка подтверждена оценкой · ' + h.subject);
    }
  });

  // Без долгов, без пропусков, вход
  const hour = now.getHours();
  schoolDays.forEach((d) => {
    const iso = pmgIso(d), info = day[iso];
    const closed = d < today || (iso === ctx.todayIso && hour >= 18);
    if (closed) {
      const week = ctx.hw.filter((h) => h.due && h.due <= d && h.due > pmgPlusDays(d, -7));
      if (week.length && week.every((h) => h.doneAt && h.doneAt < dayEnd(d))) add('nodebt:' + iso, 'nodebt', iso, 30, 'Без долгов');
    }
    if (d < today && info.lessons.length && !info.abs.length) add('present:' + iso, 'present', iso, 30, 'День без пропусков');
    if (logins[iso]) add('login:' + iso, 'login', iso, 10, 'Зашёл в Gradient');
  });
  if (actions['report:' + season.id]) {
    const rd = pmgSod(actions['report:' + season.id]);
    if (inSeason(rd)) add('report:' + season.id, 'report', rd, 100, 'Отчёт для родителей');
  }

  // Задания дня
  const warmEnd = pmgPlusDays(S, 7);
  Object.entries(questsByDay).forEach(([iso, list]) => {
    const d = pmgDateOf(iso);
    list.forEach((q) => { if (q.done) add('q:' + iso + ':' + q.id, 'quest', iso, q.xp * (d < warmEnd ? 1.25 : 1) * multOf(iso), 'Задание дня: ' + lc(q.text), { src: 'quest' }); });
  });

  // Задания недели
  const finalFrom = pmgPlusDays(E, -6);
  const weekStates = {};
  Object.entries(wq).forEach(([monIso, meta]) => {
    const mon = pmgDateOf(monIso), sun = pmgPlusDays(mon, 6);
    const from = mon < S ? S : mon, to = sun > E ? E : sun;
    const weekSchool = schoolDays.filter((d) => d >= from && d <= to);
    const allSchool = []; for (let d = new Date(from); d <= to; d = pmgPlusDays(d, 1)) if (ctx.isSchool(d)) allSchool.push(new Date(d));
    const finished = allSchool.length > 0 && today > allSchool[allSchool.length - 1];
    const wMarks = ctx.marks.filter((m) => m.g >= from && m.g <= to);
    const states = meta.ids.map((id) => {
      const q = PMG_QUEST_BY_ID[id]; let progress = 0, goal = q.goal || 1, done = false, note = '';
      switch (id) {
        case 'w_login4': progress = weekSchool.filter((d) => logins[pmgIso(d)]).length; goal = Math.min(4, Math.max(1, allSchool.length - 1)); break;
        case 'w_8daily': progress = Object.keys(questsByDay).filter((k) => k >= pmgIso(from) && k <= pmgIso(to)).reduce((s, k) => s + questsDone(k), 0); break;
        case 'w_hw_all': {
          const items = ctx.hw.filter((h) => h.due && h.due >= from && h.due <= to);
          goal = Math.max(1, items.length);
          progress = items.filter((h) => h.doneAt && h.doneAt < dayStart(h.due) + 9 * 3600e3).length;
          done = finished && items.length > 0 && progress === items.length; break;
        }
        case 'w_noabs': goal = Math.max(1, allSchool.length); progress = weekSchool.filter((d) => d < today && !(ctx.absByDay[pmgIso(d)] || []).length).length;
          done = finished && allSchool.every((d) => !(ctx.absByDay[pmgIso(d)] || []).length); break;
        case 'w_6subj': progress = new Set(wMarks.map((m) => m.subjectId)).size; break;
        case 'w_5fives': progress = wMarks.filter((m) => m.value === 5).length; break;
        case 'w_test45': progress = wMarks.some((m) => pmgIsControl(m) && m.value >= 4) ? 1 : 0; break;
        case 'w_raise': {
          const s = meta.weak != null ? ctx.subjAvg[meta.weak] : null;
          const gain = s && meta.base != null ? s.avg - meta.base : 0;
          goal = 15; progress = Math.max(0, Math.min(15, Math.round(gain * 100)));
          note = meta.weakName ? meta.weakName + ': ' + pmgFmtAvg(meta.base) + ' → ' + pmgFmtAvg(s ? s.avg : meta.base) : ''; break;
        }
      }
      if (!['w_hw_all', 'w_noabs'].includes(id)) done = progress >= goal;
      const mult = to >= finalFrom ? 1.5 : 1;
      return { id, text: q.text, xp: Math.round(q.xp * mult), progress: Math.min(progress, goal), goal, done, note, finished };
    });
    weekStates[monIso] = states;
    states.forEach((st) => { if (st.done) add('wq:' + monIso + ':' + st.id, 'wquest', to < endDay ? to : endDay, st.xp, 'Задание недели: ' + lc(st.text), { src: 'quest' }); });
  });

  // --- Достижения ---
  const ach = new Set();
  const seasonMarks = ctx.marks.filter((m) => inSeason(m.g) && m.g <= endDay);
  if (seasonMarks.length) ach.add('first');
  if (Object.values(day).some((x) => x.fives >= 3)) ach.add('hattrick');
  // Недели сезона
  for (let mon = pmgMonday(S); mon <= endDay; mon = pmgPlusDays(mon, 7)) {
    const sun = pmgPlusDays(mon, 6);
    const from = mon < S ? S : mon, to = sun > E ? E : sun;
    const wMarks = seasonMarks.filter((m) => m.g >= from && m.g <= to);
    if (new Set(wMarks.map((m) => m.subjectId)).size >= 8) ach.add('polyglot');
    if (wMarks.length >= 5 && wMarks.every((m) => m.value === 5)) ach.add('week5');
    const ws = []; for (let d = new Date(from); d <= to; d = pmgPlusDays(d, 1)) if (ctx.isSchool(d)) ws.push(new Date(d));
    const finished = ws.length && today > ws[ws.length - 1];
    if (finished && ws.length >= 3 && ws.every((d) => !(ctx.absByDay[pmgIso(d)] || []).length)) ach.add('clean');
    const items = ctx.hw.filter((h) => h.due && h.due >= from && h.due <= to);
    if (finished && items.length >= 3 && items.every((h) => h.doneAt && h.doneAt < dayStart(h.due) + 9 * 3600e3)) ach.add('order');
  }
  if (comebacks >= 3) ach.add('comeback3');
  if (best >= 14) ach.add('iron');
  if (fiveRunBest >= 5) ach.add('five5');
  if (above) ach.add('above');
  if (level >= 50) ach.add('legend');
  if (ctx.hw.some((h) => h.doneAt && h.due && inSeason(h.due) && h.doneAt < dayStart(h.due) + 9 * 3600e3 && h.tags.some((t) => t.k === 'check') &&
      (ctx.marksByLesson[pmgIso(h.due)] || []).some((m) => m.subjectId === h.subjectId && m.value === 5))) ach.add('prepared');
  {
    let run = 0;
    schoolDays.forEach((d) => { const x = day[pmgIso(d)]; if (x.tom.length && x.tom18) { run++; if (run >= 5) ach.add('early'); } else if (x.tom.length || d < today) run = 0; });
  }
  if (over && best > 0 && !everBroken) ach.add('season_fire');
  if (over && seasonMarks.length >= 15 && seasonMarks.every((m) => m.value >= 4)) ach.add('no3');

  // --- Публичные цифры (видны друзьям только по галочке) ---
  const termMarks = ctx.curTerm ? ctx.marks.filter((m) => ctx.inP(m.d, ctx.curTerm)) : [];
  const forecast = { 5: 0, 4: 0, 3: 0, 2: 0 };
  Object.values(ctx.subjAvg).forEach((s) => { const r = pmgRound(s.avg, th); if (forecast[r] != null) forecast[r]++; });
  // Неделя для рейтинга друзей: домашка вовремя и дни без пропусков (только числа, без предметов)
  const wMon = pmgMonday(today), wIso = pmgIso(wMon);
  const wItems = ctx.hw.filter((h) => !h.own && h.due && h.due >= wMon && h.due <= today);
  const wDays = []; for (let d = new Date(wMon); d <= today; d = pmgPlusDays(d, 1)) if (ctx.isSchool(d) && (d < today || now.getHours() >= 15)) wDays.push(new Date(d));
  const publicStats = {
    avg: termMarks.length ? Math.round(pmgAvg(termMarks.map((m) => m.value)) * 100) / 100 : null, finals: forecast,
    week: wIso,
    hw: { done: wItems.filter((h) => h.doneAt && h.doneAt < dayStart(h.due) + 9 * 3600e3).length, total: wItems.length },
    noabs: { ok: wDays.filter((d) => !(ctx.absByDay[pmgIso(d)] || []).length).length, total: wDays.length }
  };

  const totalXp = events.reduce((s, e) => s + e.xp, 0);
  const todayQuests = questsByDay[ctx.todayIso] || null;
  const curMon = pmgIso(pmgMonday(today));

  return {
    season, ctx, events, totalXp,
    streak: { days: streak, best, mult: pmgStreakMult(streak), todayCounted, freezes: Math.max(0, Math.min(2, earnedFreezes - used)), frozen, everBroken, restoreOffer, restoreUsed, byDay: streakBy, rested, restLeft: !restWeeks.has(pmgIso(pmgMonday(today))), week: weekStrip },
    quests: { today: todayQuests, week: weekStates[curMon] || null, weekKey: curMon, byDay: questsByDay },
    achievements: [...ach],
    publicStats,
    schoolToday: ctx.isSchool(today) && inSeason(today),
    weak: ctx.weak
  };
}

if (typeof module !== 'undefined') {
  module.exports = { pmgGame, pmgPickDaily, pmgPickWeekly, pmgGameContext, pmgMonday, pmgHash };
}
