// Своя домашка и фото к домашке — общее для расширения и приложения на телефоне.
// Хранится в pmg_own_hw и pmg_hw_photos, между устройствами расходится через сервер (cloud.js).

function pmgOwnHwList(own, done) {
  return Object.values(own || {}).filter((x) => x && x.id && !x.deleted).map((x) => {
    const due = x.due ? pmgDateOf(x.due) : null;
    const assigned = x.created ? new Date(x.created) : null;
    if (assigned) assigned.setHours(0, 0, 0, 0);
    return {
      key: 'own:' + x.id, own: true, id: x.id, subject: x.subject || 'Своё', subjectId: x.subjectId || null,
      text: x.text || '', files: [], topic: '', assigned, due, source: 'own', phrase: '', dueNumber: null, dueTime: '',
      tags: [], check: null, done: !!(done || {})['own:' + x.id]
    };
  });
}

function pmgHwPhotosOf(map, key) { return ((map || {})[key] || []).filter((p) => p && p.p && !p.x); }

// Ближайший урок предмета после даты (для кнопки «К следующему уроку»).
function pmgNextLessonDay(lessons, subjectId, after) {
  if (!subjectId || !lessons) return null;
  const a = new Date(after); a.setHours(23, 59, 59, 999);
  const ds = lessons.filter((l) => l.subjectId === subjectId).map((l) => pmgParseDate(l.from)).filter((d) => d && d > a).sort((x, y) => x - y);
  if (!ds.length) return null;
  const d = new Date(ds[0]); d.setHours(0, 0, 0, 0); return d;
}

// Сжатие фото: длинная сторона до 1600 px, JPEG ~80%.
async function pmgCompressPhoto(file, max, q) {
  max = max || 1600; q = q || 0.8;
  let bmp = null;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {
    bmp = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  const w = bmp.width, h = bmp.height, k = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  let out = cv.toDataURL('image/jpeg', q);
  while (out.length > 1.9e6 && q > 0.45) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
  return out;
}

async function pmgOwnHwSave(item) {
  const s = await pmgStorageGet('pmg_own_hw');
  const own = s.pmg_own_hw || {};
  own[item.id] = { ...(own[item.id] || {}), ...item, edited: Date.now() };
  pmg.ownHw = own;
  await pmgStorageSet({ pmg_own_hw: own });
}

async function pmgOwnHwRemove(id) {
  const s = await pmgStorageGet('pmg_own_hw');
  const own = s.pmg_own_hw || {};
  if (!own[id]) return;
  own[id] = { id, deleted: true, edited: Date.now() };
  pmg.ownHw = own;
  await pmgStorageSet({ pmg_own_hw: own });
}

async function pmgHwPhotoAdd(key, file) {
  const dataUrl = await pmgCompressPhoto(file);
  const r = await pmgGameMsg('hw-photo-upload', { dataUrl });
  if (!r || !r.ok) throw new Error((r && r.error) || 'upload');
  const s = await pmgStorageGet('pmg_hw_photos');
  const map = s.pmg_hw_photos || {};
  map[key] = (map[key] || []).concat([{ p: r.path, t: Date.now() }]);
  pmg.hwPhotos = map;
  (pmg.photoUrls = pmg.photoUrls || {})[r.path] = await pmgMakeThumb(dataUrl);
  await pmgStorageSet({ pmg_hw_photos: map });
  return r.path;
}

async function pmgHwPhotoHide(key, path) {
  const s = await pmgStorageGet('pmg_hw_photos');
  const map = s.pmg_hw_photos || {};
  map[key] = (map[key] || []).map((p) => (p.p === path ? { ...p, x: Date.now() } : p));
  pmg.hwPhotos = map;
  await pmgStorageSet({ pmg_hw_photos: map });
}

// Превью — маленькая копия снимка (~10 КБ). Карточки домашки перерисовываются часто,
// и с полными фото каждая перерисовка держала бы в памяти мегабайты картинок.
const PMG_THUMB = 192;
function pmgMakeThumb(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const k = Math.min(1, PMG_THUMB / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.75));
      } catch (_) { resolve(src); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Полное фото — только для открытого просмотра, потом сразу отпускаем.
async function pmgPhotoFull(path) {
  const r = await pmgGameMsg('hw-photo-urls', { paths: [path] });
  if (pmg.phView && pmg.phView.path === path) { pmg.phView.url = (r && r.ok && r.urls && r.urls[path]) || null; pmg.phView.failed = !pmg.phView.url; pmgRender(true, true); }
}

// Догрузить превью фото, которых ещё нет; после — перерисовать.
let pmgPhotoLoading = false;
async function pmgEnsurePhotoUrls(paths) {
  pmg.photoUrls = pmg.photoUrls || {};
  const need = paths.filter((p) => !(p in pmg.photoUrls));
  if (!need.length || pmgPhotoLoading) return;
  pmgPhotoLoading = true;
  need.forEach((p) => { pmg.photoUrls[p] = null; });
  try {
    const r = await pmgGameMsg('hw-photo-urls', { paths: need });
    if (r && r.ok) {
      const urls = r.urls || {};
      await Promise.all(Object.keys(urls).map(async (p) => { pmg.photoUrls[p] = await pmgMakeThumb(urls[p]); }));
    }
  } catch (_) { /* покажем заглушку */ }
  pmgPhotoLoading = false;
  pmgRender(true, true);
}

// Полоска превью фото для карточки.
function pmgPhotoStrip(key, opts) {
  opts = opts || {};
  const list = pmgHwPhotosOf(pmg.hwPhotos, key);
  if (!list.length && !opts.add) return '';
  pmgEnsurePhotoUrls(list.map((p) => p.p));
  const urls = pmg.photoUrls || {};
  return '<div class="ph-strip">' + list.map((p) => {
    const u = urls[p.p];
    return '<button class="ph-th' + (u ? '' : ' wait') + '" data-act="ph-open" data-key="' + pmgEsc(key) + '" data-v="' + pmgEsc(p.p) + '" aria-label="Фото">' + (u ? '<img src="' + u + '" alt="" loading="lazy">' : '') + '</button>';
  }).join('') +
    (opts.add ? '<label class="ph-add" aria-label="Добавить фото"><input type="file" accept="image/*" ' + (opts.camera ? 'capture="environment" ' : '') + 'data-act="ph-file" data-key="' + pmgEsc(key) + '" hidden>' +
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.6A1 1 0 0 1 10 4h4a1 1 0 0 1 .8.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12.3" r="3.3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>' +
      (pmg.phBusy === key ? '<span class="ph-spin"></span>' : '') + '</label>' : '') + '</div>';
}

// Просмотр фото во весь экран.
function pmgPhotoViewer() {
  const v = pmg.phView;
  if (!v) return '';
  const u = v.url || null;
  return '<div class="ph-view" role="dialog" aria-label="Фото"><button class="ph-x" data-act="ph-close" aria-label="Закрыть">×</button>' +
    (u ? '<img src="' + u + '" alt="">' : v.failed ? '<p class="muted">Не получилось загрузить фото.</p>' : '<div class="loader"><span></span><span></span><span></span></div>') +
    '<div class="ph-bar">' + (u && u.startsWith('http') ? '<a class="btn small" href="' + u + '" target="_blank" rel="noopener">Открыть</a>' : '') +
    (pmg.confirm === 'ph:' + v.path ? '<button class="btn small danger" data-act="ph-hide">Точно убрать?</button>' : '<button class="btn small" data-act="ph-hide">Убрать фото</button>') + '</div></div>';
}

// Форма своей домашки (и в расширении, и в приложении).
function pmgOwnHwForm() {
  const f = pmg.ownForm;
  if (!f) return '';
  const subs = (pmg.data && pmg.data.subjects ? pmg.data.subjects : []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const t = pmgToday(), tom = new Date(t); tom.setDate(t.getDate() + 1);
  const after = new Date(t); after.setDate(t.getDate() + 2);
  const next = f.subjectId ? pmgNextLessonDay(pmg.data && pmg.data.lessons, f.subjectId, t) : null;
  const chip = (iso, label) => '<button type="button" class="' + (f.due === iso ? 'on' : '') + '" data-act="own-due" data-v="' + iso + '">' + label + '</button>';
  return '<div class="own-sheet" role="dialog" aria-label="Своя домашка"><form class="own-form card" data-act="own-form">' +
    '<header><h3>' + (f.id && f.editing ? 'Изменить задание' : 'Своё задание') + '</h3><button type="button" class="icon-btn" data-act="own-cancel" aria-label="Закрыть">×</button></header>' +
    // Предметы — плашками, как четверти: всё видно сразу, без выпадающего списка
    '<div class="field"><span>Предмет</span><div class="own-subjs" role="radiogroup" aria-label="Предмет">' +
      subs.map((s) => '<button type="button" role="radio" aria-checked="' + (+f.subjectId === s.id) + '" class="own-subj' + (+f.subjectId === s.id ? ' on' : '') + '" data-act="own-subj" data-v="' + s.id + '">' + pmgEsc(s.name) + '</button>').join('') +
      '<button type="button" role="radio" aria-checked="' + !f.subjectId + '" class="own-subj other' + (!f.subjectId ? ' on' : '') + '" data-act="own-subj" data-v="">Другое</button></div></div>' +
    (!f.subjectId ? '<label class="field"><span>Название</span><input class="in" data-act="own-subj-name" maxlength="40" placeholder="Например, Кружок" value="' + pmgEsc(f.subjectName || '') + '"></label>' : '') +
    '<label class="field"><span>Что сделать</span><textarea class="in" data-act="own-text" rows="3" maxlength="1000" placeholder="№ 245, выучить правило…">' + pmgEsc(f.text || '') + '</textarea></label>' +
    '<div class="field"><span>Когда сдавать</span><div class="seg-ctl mini own-due">' + chip(pmgIso(tom), 'Завтра') + chip(pmgIso(after), 'Послезавтра') +
      (next ? chip(pmgIso(next), 'К уроку · ' + PMG_WD_SHORT[next.getDay()] + ' ' + next.getDate()) : '') +
      '<input type="date" class="in date-in" data-act="own-date" value="' + (f.due || '') + '"></div></div>' +
    (f.id ? pmgPhotoStrip('own:' + f.id, { add: true, camera: PMG_IS_WEB }) : '<p class="muted small">Фото можно прикрепить после сохранения.</p>') +
    (f.error ? '<p class="err">' + pmgEsc(f.error) + '</p>' : '') +
    '<footer>' + (f.editing ? (pmg.confirm === 'own-del' ? '<button type="button" class="btn danger" data-act="own-del">Точно удалить?</button>' : '<button type="button" class="btn" data-act="own-del">Удалить</button>') : '') +
    '<button type="button" class="btn primary" data-act="own-save">' + (f.editing ? 'Сохранить' : 'Добавить') + '</button></footer></form></div>';
}

function pmgOwnFormRead() {
  const f = pmg.ownForm; if (!f) return;
  const q = (s) => pmgQ('[data-act="' + s + '"]');
  if (q('own-text')) f.text = q('own-text').value;
  if (q('own-subj-name')) f.subjectName = q('own-subj-name').value;
  if (q('own-date') && q('own-date').value) f.due = q('own-date').value;
}

async function pmgOwnHwAct(act, t) {
  const v = t.dataset.v;
  switch (act) {
    case 'own-new': pmg.ownForm = { due: pmgIso((() => { const d = pmgToday(); d.setDate(d.getDate() + 1); return d; })()), subjectId: null, text: '' }; pmg.confirm = null; pmgRender(true, true); setTimeout(() => { const x = pmgQ('[data-act="own-text"]'); if (x) x.focus(); }, 60); return true;
    case 'own-edit': {
      const x = (pmg.ownHw || {})[v]; if (!x) return true;
      pmg.ownForm = { id: x.id, editing: true, subjectId: x.subjectId || null, subjectName: x.subjectId ? '' : x.subject, text: x.text, due: x.due };
      pmg.confirm = null; pmgRender(true, true); return true;
    }
    case 'own-cancel': pmg.ownForm = null; pmgRender(true, true); return true;
    case 'own-due': pmgOwnFormRead(); pmg.ownForm.due = v; pmgRender(true, true); return true;
    case 'own-subj': pmgOwnFormRead(); pmg.ownForm.subjectId = v ? +v : null; pmgRender(true, true); return true;
    case 'own-save': {
      pmgOwnFormRead();
      const f = pmg.ownForm;
      if (!(f.text || '').trim()) { f.error = 'Напиши, что нужно сделать.'; pmgRender(true, true); return true; }
      if (!f.due) { f.error = 'Выбери, когда сдавать.'; pmgRender(true, true); return true; }
      const sub = f.subjectId ? (pmg.data.subjects || []).find((s) => s.id === +f.subjectId) : null;
      const id = f.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      await pmgOwnHwSave({ id, subjectId: sub ? sub.id : null, subject: sub ? sub.name : ((f.subjectName || '').trim() || 'Своё'), text: f.text.trim(), due: f.due, created: f.created || Date.now() });
      pmg.ownForm = f.editing ? null : { id, editing: true, subjectId: sub ? sub.id : null, subjectName: f.subjectName, text: f.text.trim(), due: f.due, saved: true };
      if (!f.editing && typeof pmgToast === 'function') pmgToast('Задание добавлено — можно прикрепить фото');
      pmgRender(true, true); return true;
    }
    case 'own-del': {
      if (pmg.confirm !== 'own-del') { pmg.confirm = 'own-del'; pmgRender(true, true); return true; }
      pmg.confirm = null;
      await pmgOwnHwRemove(pmg.ownForm.id); pmg.ownForm = null; pmgRender(true, true); return true;
    }
    case 'ph-open': pmg.phView = { key: t.dataset.key, path: v }; pmg.confirm = null; pmgRender(true, true); pmgPhotoFull(v); return true;
    case 'ph-close': pmg.phView = null; pmgRender(true, true); return true;
    case 'ph-hide': {
      const pv = pmg.phView; if (!pv) return true;
      if (pmg.confirm !== 'ph:' + pv.path) { pmg.confirm = 'ph:' + pv.path; pmgRender(true, true); return true; }
      pmg.confirm = null; await pmgHwPhotoHide(pv.key, pv.path); pmg.phView = null; pmgRender(true, true); return true;
    }
  }
  return false;
}

// Выбор файла фото (обработчик change).
async function pmgOwnHwChange(e) {
  const t = e.target;
  if (t.dataset.act === 'own-date') { pmg.ownForm.due = t.value; return true; }
  if (t.dataset.act !== 'ph-file' || !t.files || !t.files[0]) return false;
  const key = t.dataset.key;
  pmg.phBusy = key; pmgRender(true, true);
  try { await pmgHwPhotoAdd(key, t.files[0]); if (typeof pmgToast === 'function') pmgToast('Фото прикреплено'); }
  catch (err) { if (typeof pmgToast === 'function') pmgToast('Не получилось загрузить фото: ' + pmgErrText(err.message || 'network')); }
  pmg.phBusy = null; pmgRender(true, true);
  return true;
}
