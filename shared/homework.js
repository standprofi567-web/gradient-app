// Умная домашка: срок сдачи из текста задания, тип задания, ближайшие проверочные.
// Без DOM — работает и на странице, и в фоне.

const PMG_DAY_MS = 86400000;
const PMG_MONTH_RE = ['январ', 'феврал', 'март', 'апрел', 'ма[яй]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const PMG_WD = [['понедельник', 1], ['вторник', 2], ['сред', 3], ['четверг', 4], ['пятниц', 5], ['суббот', 6]];

function pmgStartOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function pmgAddDays(d, n) {
  const x = pmgStartOfDay(d); x.setDate(x.getDate() + n); return x;
}

// Срок, явно написанный в тексте. base — дата урока, где задали.
// Возвращает { date, phrase } или null.
function pmgFindDateInText(text, base) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/ё/g, 'е').replace(/https?:\/\/[^\s]+/g, ' ');
  const b = pmgStartOfDay(base);
  // Разумное окно: от дня урока до двух месяцев вперёд
  const ok = (d) => d >= b && d - b <= 62 * PMG_DAY_MS;
  const withYear = (day, month) => {
    for (const y of [b.getFullYear(), b.getFullYear() + 1]) {
      const d = new Date(y, month, day);
      if (d.getDate() === day && ok(d)) return d;
    }
    return null;
  };

  // «до 20 октября», «к 3 ноября»
  let m = new RegExp('(\\d{1,2})\\s*(' + PMG_MONTH_RE.join('|') + ')[а-я]*').exec(t);
  if (m) {
    const month = PMG_MONTH_RE.findIndex((r) => new RegExp('^' + r).test(m[2]));
    const d = withYear(+m[1], month);
    if (d) return { date: d, phrase: m[0] };
  }
  // «к 20.10», «до 20.10.2026»
  const re = /(^|[^\d§№.,])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d])/g;
  while ((m = re.exec(t))) {
    const day = +m[2], month = +m[3] - 1;
    if (day < 1 || day > 31 || month < 0 || month > 11) continue;
    // Отсекаем «стр.27», «у.9», «№ 3.5»: перед датой не должно быть буквы с точкой
    const before = t.slice(Math.max(0, m.index - 4), m.index + m[1].length);
    if (/(стр|упр|у|с|п|№|номер)\s*$/.test(before)) continue;
    const d = withYear(day, month);
    if (d) return { date: d, phrase: m[0].trim() };
  }
  // «к понедельнику», «на среду», «до пятницы»
  m = /(?:^|[^а-я])(к|ко|на|в|во|до)\s+(понедельник|вторник|сред|четверг|пятниц|суббот)[а-я]*/.exec(t);
  if (m) {
    const wd = PMG_WD.find(([s]) => m[2].startsWith(s))[1];
    for (let i = 1; i <= 7; i++) {
      const d = pmgAddDays(b, i);
      if (d.getDay() === wd) return { date: d, phrase: m[0].trim() };
    }
  }
  if ((m = /послезавтра/.exec(t))) return { date: pmgAddDays(b, 2), phrase: m[0] };
  if ((m = /(?:^|[^а-я])(к|на)\s+завтра/.exec(t))) return { date: pmgAddDays(b, 1), phrase: m[0].trim() };
  if ((m = /через\s+(\d+|одну|две|три)?\s*(недел|дн|день)/.exec(t))) {
    const nWords = { одну: 1, две: 2, три: 3 };
    const n = m[1] ? (nWords[m[1]] || +m[1]) : 1;
    const days = /недел/.test(m[2]) ? n * 7 : n;
    if (days > 0 && days <= 62) return { date: pmgAddDays(b, days), phrase: m[0], soft: true };
  }
  if ((m = /на\s+следующ[а-я]+\s+неделе/.exec(t))) return { date: pmgAddDays(b, 7), phrase: m[0], soft: true };
  return null;
}

// Что за задание: метки для быстрого взгляда.
const PMG_TAGS = [
  ['check', 'К проверочной', /контрольн|проверочн|самостоятельн|(?<![а-яё])тест|диктант|зачет|зачёт|(?<![а-яё])впр(?![а-яё])|(?<![а-яё])огэ(?![а-яё])|(?<![а-яё])опрос/i],
  ['learn', 'Выучить', /выучи|наизусть|(?<![а-яё])знать|повтор|запомн/i],
  ['write', 'Письменно', /письм|написат|сочинен|конспект|переписат|таблиц|рецензи|эссе|составит/i],
  ['oral', 'Устно', /устно|пересказ|читат|(?<![а-яё])чит\.|прочита|ответить на вопрос/i],
  ['project', 'Проект', /сообщени|доклад|презентац|проект|реферат|лабораторн/i],
  ['tasks', 'Задачи', /№|задач|(?<![а-яё])упр|(?<![а-яё])у\.\s?\d|стр\.?\s?\d|\d{3}\s*\(/i]
];

function pmgHwTags(text, files) {
  const tags = PMG_TAGS.filter(([, , re]) => re.test(text || '')).map(([k, l]) => ({ k, l }));
  if (files && files.length) tags.push({ k: 'file', l: 'Файл' });
  if (/https?:\/\//.test(text || '')) tags.push({ k: 'link', l: 'Онлайн' });
  return tags;
}

// Какая проверка ожидается по теме урока.
const PMG_CHECK_KINDS = [
  [/контрольн/i, 'Контрольная'],
  [/проверочн/i, 'Проверочная'],
  [/самостоятельн/i, 'Самостоятельная'],
  [/диктант/i, 'Диктант'],
  [/изложени/i, 'Изложение'],
  [/сочинени/i, 'Сочинение'],
  [/(?<![а-яё])впр(?![а-яё])/i, 'ВПР'],
  [/зачет|зачёт/i, 'Зачёт'],
  [/(?<![а-яё])опрос/i, 'Опрос'],
  [/(?<![а-яё])тест/i, 'Тест']
];

// strict — для текста домашки: проверка должна быть именно предстоящей («к контрольной», «будет тест»).
function pmgCheckKind(text, strict) {
  if (!text) return null;
  if (strict && !/подготов|будет|предстоит|(?<![а-яё])(к|ко)\s+(контрольн|проверочн|самостоятельн|тест|диктант|зачет|зачёт|впр|сочинени|изложени|опрос)/i.test(text)) return null;
  const k = PMG_CHECK_KINDS.find(([re]) => re.test(text));
  return k ? k[1] : null;
}

// Дни недели, в которые бывает предмет (по загруженным урокам).
function pmgSubjectWeekdays(lessons, subjectId) {
  return new Set(lessons.filter((l) => l.subjectId === subjectId).map((l) => pmgParseDate(l.from).getDay()));
}

// Собирает домашку со сроками.
// opts: { mode: 'assigned' | 'due', done: {key: ts}, overrides: {key: ts} }
function pmgBuildHomework(lessons, opts) {
  opts = opts || {};
  const done = opts.done || {}, overrides = opts.overrides || {};
  const sorted = (lessons || []).slice().sort((a, b) => pmgParseDate(a.from) - pmgParseDate(b.from));
  const items = [];
  sorted.forEach((l, i) => {
    if (!l.tasks || !l.tasks.length) return;
    const lessonDate = pmgParseDate(l.from);
    const nextLesson = sorted.slice(i + 1).find((x) => x.subjectId === l.subjectId && pmgStartOfDay(pmgParseDate(x.from)) > pmgStartOfDay(lessonDate));
    l.tasks.forEach((t, k) => {
      const key = l.id + ':' + k;
      let due = null, source = 'none', phrase = '';
      const found = pmgFindDateInText(t.text, lessonDate);
      if (overrides[key]) { due = new Date(overrides[key]); source = 'manual'; }
      else if (found && !found.soft) { due = found.date; source = 'text'; phrase = found.phrase; }
      else if (opts.mode === 'due') { due = pmgStartOfDay(lessonDate); source = 'lesson'; }
      else if (found && found.soft) {
        // «через неделю» — ближайший урок предмета не раньше этой даты
        const wds = pmgSubjectWeekdays(sorted, l.subjectId);
        due = found.date;
        for (let j = 0; j < 7 && wds.size; j++) { const d = pmgAddDays(found.date, j); if (wds.has(d.getDay())) { due = d; break; } }
        source = 'text'; phrase = found.phrase;
      } else if (nextLesson) { due = pmgStartOfDay(pmgParseDate(nextLesson.from)); source = 'next'; }
      else {
        // Следующего урока ещё нет в дневнике — угадываем по дням недели этого предмета
        const wds = pmgSubjectWeekdays(sorted, l.subjectId);
        for (let j = 1; j <= 14 && wds.size; j++) { const d = pmgAddDays(lessonDate, j); if (wds.has(d.getDay())) { due = d; source = 'guess'; break; } }
      }
      const dueDay = due ? pmgStartOfDay(due) : null;
      // Урок, к которому сдавать: тот же предмет в день сдачи
      let dueLesson = null;
      if (opts.mode === 'due') dueLesson = l;
      else if (dueDay) dueLesson = sorted.find((x) => x.subjectId === l.subjectId && pmgStartOfDay(pmgParseDate(x.from)).getTime() === dueDay.getTime()) || null;
      items.push({
        key, lessonId: l.id, subject: l.subject, subjectId: l.subjectId,
        text: t.text, files: t.files || [], topic: l.topic,
        assigned: opts.mode === 'due' ? null : pmgStartOfDay(lessonDate),
        due: dueDay, source, phrase,
        dueNumber: dueLesson ? dueLesson.number : null,
        dueTime: dueLesson ? (/\s(\d{2}:\d{2})/.exec(dueLesson.from) || [])[1] || '' : '',
        tags: pmgHwTags(t.text, t.files), check: pmgCheckKind(t.text, true),
        done: !!done[key]
      });
    });
  });
  return pmgDedupeHomework(items);
}

// Учителя часто дублируют одно и то же задание — оставляем одно, файлы объединяем.
function pmgDedupeHomework(items) {
  const norm = (t) => (t || '').toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
  const seen = new Map(), out = [];
  for (const it of items) {
    const k = it.subjectId + '|' + (it.due ? it.due.getTime() : 'x') + '|' + norm(it.text);
    if (seen.has(k)) {
      const prev = seen.get(k);
      it.files.forEach((f) => { if (!prev.files.includes(f)) prev.files.push(f); });
      prev.done = prev.done || it.done;
      continue;
    }
    seen.set(k, it);
    out.push(it);
  }
  // Задание без текста (только файл) приклеиваем к заданию с текстом в тот же срок
  return out.filter((it) => {
    if (it.text) return true;
    const sib = out.find((o) => o !== it && o.text && o.subjectId === it.subjectId && o.due && it.due && o.due.getTime() === it.due.getTime());
    if (!sib) return true;
    it.files.forEach((f) => { if (!sib.files.includes(f)) sib.files.push(f); });
    if (!sib.tags.some((t) => t.k === 'file') && sib.files.length) sib.tags.push({ k: 'file', l: 'Файл' });
    return false;
  });
}

// Ближайший учебный день после сегодняшнего и задания на него.
function pmgNextDayTodo(items, now) {
  const tomorrow = pmgAddDays(now || new Date(), 1).getTime();
  const days = items.filter((h) => h.due && h.due.getTime() >= tomorrow).map((h) => h.due.getTime());
  if (!days.length) return { day: null, items: [] };
  const day = Math.min(...days);
  return { day: new Date(day), items: items.filter((h) => h.due && h.due.getTime() === day) };
}

// Ближайшие проверочные: из тем будущих уроков и из текста домашки.
function pmgUpcomingChecks(lessons, hwItems, now) {
  const today = pmgStartOfDay(now || new Date());
  const out = new Map();
  for (const l of lessons || []) {
    const d = pmgStartOfDay(pmgParseDate(l.from));
    if (d < today) continue;
    const kind = pmgCheckKind(l.topic);
    if (kind) out.set(l.subjectId + ':' + d.getTime(), { date: d, subject: l.subject, subjectId: l.subjectId, kind, text: l.topic, from: 'topic' });
  }
  for (const h of hwItems || []) {
    if (!h.check || !h.due || h.due < today) continue;
    const k = h.subjectId + ':' + h.due.getTime();
    if (!out.has(k)) out.set(k, { date: h.due, subject: h.subject, subjectId: h.subjectId, kind: h.check, text: h.text, from: 'homework' });
  }
  return [...out.values()].sort((a, b) => a.date - b.date);
}

if (typeof module !== 'undefined') {
  module.exports = { pmgFindDateInText, pmgHwTags, pmgCheckKind, pmgBuildHomework, pmgNextDayTodo, pmgUpcomingChecks };
}

// Сводка для вечернего напоминания: ближайший день сдачи и ключи заданий на него.
// Сервер сам сверит их с галочками (они общие для телефона и компьютера) и в 19:00 пришлёт «на завтра осталось N».
function pmgRemindSummary(items) {
  const next = pmgNextDayTodo(items || []);
  if (!next.day) return null;
  return { day: pmgDayKey(next.day), items: next.items.map((h) => ({ k: h.key, s: h.subject })) };
}
