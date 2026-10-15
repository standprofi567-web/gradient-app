// Чистая математика и разбор данных дневника. Без DOM — используется и на странице, и во всплывающем окне.

const PMG_FINAL_CODES = new Set(['3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '3010', '3011', '3012', '3013', '5544']);
const PMG_ATTENDANCE_CODE = '30000';

function pmgParseDate(s) {
  // "14.10.2026" или "14.10.2026 13:00:00"
  if (!s) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
}

function pmgFmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
}

function pmgDayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function pmgParseMark(code) {
  const m = /^([1-5])\/5$/.exec(code || '');
  return m ? +m[1] : null;
}

// Раскладывает ответ estimate/table на оценки, итоговые и пропуски.
function pmgSplitEstimates(items) {
  const marks = [], finals = [], absences = [], notes = [];
  for (const it of items || []) {
    const base = {
      id: it.id, subjectId: it.subject_id, subject: it.subject_name,
      date: it.date, type: it.estimate_type_code, typeName: it.estimate_type_name,
      comment: it.estimate_comment || '', lessonId: it.lesson_id,
      code: it.estimate_value_code, name: it.estimate_value_name
    };
    const value = pmgParseMark(it.estimate_value_code);
    if (it.estimate_type_code === PMG_ATTENDANCE_CODE) absences.push(base);
    else if (PMG_FINAL_CODES.has(it.estimate_type_code)) finals.push({ ...base, value });
    else if (value != null) marks.push({ ...base, value });
    else notes.push(base); // зачёт, «усвоил», замечание
  }
  const byDate = (a, b) => pmgParseDate(a.date) - pmgParseDate(b.date) || a.id - b.id;
  marks.sort(byDate); finals.sort(byDate); absences.sort(byDate); notes.sort(byDate);
  return { marks, finals, absences, notes };
}

function pmgAvg(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Оценка за период по среднему. threshold — с какой дробной части округлять вверх (0.5 или 0.6).
function pmgRound(avg, threshold) {
  if (avg == null) return null;
  const f = Math.floor(avg + 1e-9);
  return Math.min(5, f + (avg - f + 1e-9 >= threshold ? 1 : 0));
}

// Минимальный средний, чтобы вышла оценка target.
function pmgWantAvg(target, threshold) {
  return target - 1 + threshold;
}

// Сколько оценок mark нужно добавить, чтобы средний дошёл до want.
function pmgNeed(values, target, threshold, mark) {
  const want = pmgWantAvg(target, threshold);
  const n = values.length, s = values.reduce((a, b) => a + b, 0);
  if (n && s / n + 1e-9 >= want) return 0;
  if (mark + 1e-9 < want) return Infinity;
  if (mark - want < 1e-9) return Infinity;
  return Math.max(0, Math.ceil((want * n - s) / (mark - want) - 1e-9));
}

// Сколько оценок mark можно получить, не опустившись ниже target.
function pmgReserve(values, target, threshold, mark) {
  const want = pmgWantAvg(target, threshold);
  const n = values.length, s = values.reduce((a, b) => a + b, 0);
  if (!n || s / n + 1e-9 < want) return 0;
  if (mark + 1e-9 >= want) return Infinity;
  return Math.max(0, Math.floor((s - want * n) / (want - mark) + 1e-9));
}

function pmgRunning(values) {
  let s = 0;
  return values.map((v, i) => (s += v) / (i + 1));
}

function pmgPlural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

const PMG_MARK_WORDS = {
  5: ['пятёрка', 'пятёрки', 'пятёрок'],
  4: ['четвёрка', 'четвёрки', 'четвёрок'],
  3: ['тройка', 'тройки', 'троек'],
  2: ['двойка', 'двойки', 'двоек']
};

function pmgCountWord(n, mark) {
  return n + ' ' + pmgPlural(n, PMG_MARK_WORDS[mark]);
}

function pmgFmtAvg(a) {
  return a == null ? '—' : a.toFixed(2).replace('.', ',');
}

// Период, в котором сейчас идёт учёба (или последний закончившийся).
function pmgPickPeriod(periods, now) {
  const qs = periods.filter((p) => p.kind === 'term');
  const t = now.getTime();
  const cur = qs.find((p) => t >= p.from.getTime() && t <= p.to.getTime() + 86399999);
  if (cur) return cur;
  const past = qs.filter((p) => p.to.getTime() < t).sort((a, b) => b.to - a.to);
  return past[0] || qs[0] || periods[0];
}

function pmgInPeriod(item, period) {
  const d = pmgParseDate(item.date);
  return d && d >= period.from && d.getTime() <= period.to.getTime() + 86399999;
}

// Статистика по предметам за период.
function pmgSubjectStats(marks, subjects, period, threshold) {
  const bySubj = new Map();
  for (const s of subjects) bySubj.set(s.id, { id: s.id, name: s.name, marks: [] });
  for (const m of marks) {
    if (period && !pmgInPeriod(m, period)) continue;
    if (!bySubj.has(m.subjectId)) bySubj.set(m.subjectId, { id: m.subjectId, name: m.subject, marks: [] });
    bySubj.get(m.subjectId).marks.push(m);
  }
  const out = [];
  for (const s of bySubj.values()) {
    const values = s.marks.map((m) => m.value);
    const avg = pmgAvg(values);
    const rounded = pmgRound(avg, threshold);
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    values.forEach((v) => dist[v]++);
    let trend = 0;
    if (values.length >= 4) {
      const k = Math.min(3, Math.floor(values.length / 2));
      trend = pmgAvg(values.slice(-k)) - pmgAvg(values.slice(0, -k));
    }
    const up = rounded != null && rounded < 5 ? pmgNeed(values, rounded + 1, threshold, 5) : null;
    const down = rounded != null && rounded > 2 ? pmgReserve(values, rounded, threshold, 3) : null;
    out.push({ ...s, values, avg, rounded, dist, trend, up, down });
  }
  return out;
}

// Подсказки: где можно подняться, где опасно, где мало оценок.
function pmgTips(stats, daysLeft) {
  const tips = [];
  for (const s of stats) {
    if (s.avg == null) continue;
    if (s.up != null && s.up > 0 && s.up <= 2) {
      tips.push({ kind: 'up', subject: s.name, id: s.id, weight: s.up === 1 ? 6 : 5,
        text: 'до «' + (s.rounded + 1) + '» ' + pmgPlural(s.up, ['нужна', 'нужны', 'нужно']) + ' ещё ' + pmgCountWord(s.up, 5) });
    }
    if (s.down === 0 && s.rounded >= 4 && s.values.length >= 3) {
      tips.push({ kind: 'risk', subject: s.name, id: s.id, weight: 4,
        text: 'одна тройка опустит оценку до «' + (s.rounded - 1) + '»' });
    }
    if (s.values.length < 3 && daysLeft != null && daysLeft <= 14) {
      tips.push({ kind: 'few', subject: s.name, id: s.id, weight: s.values.length < 2 ? 4.5 : 3,
        text: 'всего ' + s.values.length + ' ' + pmgPlural(s.values.length, ['оценка', 'оценки', 'оценок']) + ', а до конца четверти ' + daysLeft + ' ' + pmgPlural(daysLeft, ['день', 'дня', 'дней']) });
    }
  }
  // По одной подсказке на предмет — самой важной.
  tips.sort((a, b) => b.weight - a.weight);
  const seen = new Set();
  return tips.filter((t) => !seen.has(t.id) && seen.add(t.id));
}

// Приводит периоды из API к удобному виду.
function pmgNormPeriods(items) {
  return (items || []).map((p) => {
    const code = p.education_period && p.education_period.code;
    const name = p.name || (p.education_period && p.education_period.name);
    let kind = 'other';
    if (code === '20') kind = 'year';
    else if (/четверть|триместр|полугодие/i.test(name)) kind = 'term';
    else if (/каникулы/i.test(name)) kind = 'holiday';
    return { id: p.identity && p.identity.id, name, code, kind, from: pmgParseDate(p.date_from), to: pmgParseDate(p.date_to) };
  }).filter((p) => p.from && p.to).sort((a, b) => a.from - b.from);
}

// Даты в кэше хранятся числами — превращаем обратно.
function pmgRevive(data) {
  return { ...data, periods: data.periods.map((p) => ({ ...p, from: new Date(p.from), to: new Date(p.to) })) };
}

if (typeof module !== 'undefined') {
  module.exports = { pmgSplitEstimates, pmgAvg, pmgRound, pmgNeed, pmgReserve, pmgRunning, pmgSubjectStats, pmgTips, pmgNormPeriods, pmgPickPeriod, pmgParseDate, pmgCountWord, pmgFmtAvg, pmgInPeriod, pmgRevive };
}
