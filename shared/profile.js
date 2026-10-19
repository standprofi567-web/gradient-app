// Вкладка «Профиль»: кто я в Gradient Pass — фигурка, ник, награды, что видят друзья и мои данные.
// Одна и та же вкладка в расширении и в приложении на телефоне. Разделы открываются по одному,
// чтобы не рисовать сразу все позы, наклейки и награды (это и понятнее, и легче для памяти).

const PMG_PROF_SECTIONS = [['look', 'Внешность'], ['rewards', 'Награды'], ['privacy', 'Что видят друзья'], ['data', 'Мои данные']];
const PMG_LOOK_PARTS = [['photo', 'Фото'], ['pose', 'Поза'], ['pen', 'Цвет'], ['sticker', 'Наклейка']];
const PMG_EQUIP_KINDS = [
  ['frame', 'Рамка', 'обводка аватара в рейтинге'],
  ['title', 'Титул', 'подпись под ником'],
  ['theme', 'Тема', 'цвет кнопок и акцентов Gradient'],
  ['aura', 'Аура', 'свечение вокруг фигурки'],
  ['skin', 'Карточка', 'вид твоей карточки у друзей'],
  ['bgpack', 'Фон', 'значки на фоне Gradient']
];
const PMG_EQUIP_NAMES = {
  theme: { default: 'Gradient', mint: 'Мята', sunset: 'Закат', midnight: 'Полночь', aurora: 'Аврора' },
  skin: { default: 'Обычная', notebook: 'Тетрадь', holo: 'Голограмма' },
  bgpack: { glyphs: 'Учебные значки', space: 'Стикеры', chem: 'Химия', formulas: 'Формулы' }
};

function pmgEquipNames(kind) {
  if (kind === 'frame') return PMG_FRAME_NAMES;
  if (kind === 'title') return PMG_TITLE_NAMES;
  if (kind === 'aura') { const G = pmgGV(); return { none: 'Без ауры', glow: 'Свечение', orbit: 'Орбита', season: G ? G.season.aura : 'Сезонная' }; }
  return PMG_EQUIP_NAMES[kind] || {};
}

// Друзья видят только то, что включено. Шаги и дуэли из Gradient убраны — всегда выключены.
function pmgPrivacyOf(prof) {
  return { ...PMG_PRIVACY_DEFAULT, ...((prof && prof.privacy) || {}), steps: false, duels: false };
}

// Ближайшая награда этого вида, которая ещё закрыта.
function pmgNextUnlock(kind, level) {
  for (let l = level + 1; l <= 50; l++) {
    const r = (PMG_REWARDS[l] || []).find((x) => x.kind === kind);
    if (r) return { level: l, name: r.name };
  }
  return null;
}

function pmgProfileView() {
  const prof = pmgProfile();
  if (!prof.created) return '<div class="prof">' + pmgStartView() + '</div>';
  pmgPrivacyFix();
  const sec = pmg.profSec || 'look';
  let h = '<div class="prof">' + pmgProfHero();
  h += '<nav class="seg-ctl prof-nav" role="tablist">' + PMG_PROF_SECTIONS.map(([k, l]) => '<button role="tab" class="' + (sec === k ? 'on' : '') + '" aria-selected="' + (sec === k) + '" data-act="prof-sec" data-v="' + k + '">' + l + '</button>').join('') + '</nav>';
  if (sec === 'look') h += pmgProfLook();
  if (sec === 'rewards') h += pmgProfRewards();
  if (sec === 'privacy') h += pmgProfPrivacy();
  if (sec === 'data') h += pmgProfData();
  return h + '</div>';
}

// Шапка: фигурка, ник (можно поменять прямо здесь), уровень и огонёк.
function pmgProfHero() {
  const prof = pmgProfile(), eq = pmgEquipped(), G = pmgGV();
  const me = { id: 'me', nick: prof.nick || 'я', avatar: prof.avatar || 'planet-1', photoUrl: prof.photoLocal || null, equipped: eq };
  const title = eq.title && eq.title !== 'none' ? PMG_TITLE_NAMES[eq.title] : '';
  const have = G ? new Set((pmg.game && pmg.game.achAll) || G.achievements).size : 0;
  const nick = pmg.nickEdit
    ? '<div class="prof-nick-edit"><input class="in" data-act="nick-edit" maxlength="16" value="' + pmgEsc(prof.nick || '') + '" aria-label="Ник"><button class="btn small primary" data-act="nick-save">Сохранить</button><button class="btn small" data-act="nick-cancel">Отмена</button></div>'
    : '<h2 class="prof-nick">' + pmgEsc(prof.nick || 'Без ника') + '<button class="link sm" data-act="nick-open">изменить</button></h2>';
  return '<section class="card prof-hero"><div class="prof-fig">' + pmgFigure(me, 140, { fig: eq.body && PMG_FIGS[eq.body] ? eq.body : undefined }) + '</div>' +
    '<div class="prof-main">' + nick + (title ? '<span class="prof-title">' + pmgEsc(title) + '</span>' : '') +
    (G ? '<div class="prof-stats"><span><b>' + G.level.level + '</b>уровень</span><span><b>' + pmgFmtXp(G.xp) + '</b>XP за сезон</span>' +
      '<span><b>' + G.streak.days + '</b>' + pmgPlural(G.streak.days, ['день', 'дня', 'дней']) + ' огонёк</span><span><b>' + have + '</b>из ' + PMG_ACHIEVEMENTS.length + ' достижений</span></div>' : '') +
    '<p class="muted small">Так тебя видят друзья в группе. Оценки, домашку и ФИО не видит никто.</p></div></section>';
}

// Внешность: фото, поза, цвет, наклейка — по одному разделу за раз.
function pmgProfLook() {
  const prof = pmgProfile(), eq = pmgEquipped();
  const part = pmg.lookPart || (prof.photoLocal ? 'pose' : 'photo');
  const me = { id: 'me', nick: prof.nick || 'я', avatar: prof.avatar || 'planet-1', photoUrl: prof.photoLocal || null, equipped: eq };
  const body = eq.body && PMG_FIGS[eq.body] ? eq.body : pmgFigOf(me);
  let h = '<section class="card prof-look"><div class="seg-ctl mini look-nav">' + PMG_LOOK_PARTS.map(([k, l]) => '<button class="' + (part === k ? 'on' : '') + '" data-act="look-part" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
  if (part === 'photo') {
    h += '<div class="look-photo"><label class="btn primary"><input type="file" accept="image/*" data-act="photo-file" hidden>' + (prof.photoLocal ? 'Выбрать другое фото' : 'Загрузить фото') + '</label>' +
      (prof.photoLocal ? '<button class="btn" data-act="photo-delete">Убрать фото</button>' : '') + '</div>' +
      '<p class="muted small">Фото станет головой твоей фигурки. Обрежешь его в круг прямо здесь — оригинал никуда не уходит. Видно только участникам твоих групп. Без фото вместо головы будет наклейка.</p>';
  }
  if (part === 'pose') {
    h += '<p class="muted small">Как стоит твоя фигурка на лесенке группы.</p><div class="fig-grid">' + Object.keys(PMG_FIGS).map((id) => '<button class="fig-pick' + (id === body ? ' on' : '') + '" data-act="equip" data-kind="body" data-v="' + id + '" aria-label="' + pmgEsc(PMG_FIGS[id].n) + '"><span class="fig-pick-art">' + pmgFigure(me, 74, { fig: id }) + '</span><small>' + pmgEsc(PMG_FIGS[id].n) + '</small></button>').join('') + '</div>';
  }
  if (part === 'pen') {
    const pen = eq.pen && PMG_PENS[eq.pen] ? eq.pen : '';
    h += '<p class="muted small">Цвет обводки фигурки — как ручкой в тетради.</p><div class="pen-list">' + Object.entries(PMG_PENS).map(([id, [c, n]]) => '<button class="pen-item' + (id === pen ? ' on' : '') + '" data-act="equip" data-kind="pen" data-v="' + id + '"><i style="--pc:' + c + '"></i>' + pmgEsc(n) + '</button>').join('') + '</div>';
  }
  if (part === 'sticker') {
    const av = ['planet-1'].concat(Array.from({ length: 23 }, (_, i) => 'planet-' + (i + 2)));
    h += '<p class="muted small">' + (prof.photoLocal ? 'Наклейка видна вместо фото, если фото убрать, и в списках рядом с ником.' : 'Голова фигурки и значок рядом с ником.') + '</p><div class="av-grid">' +
      av.map((a) => '<button class="av-pick' + (me.avatar === a ? ' on' : '') + '" data-act="avatar" data-v="' + a + '" aria-label="Наклейка">' + pmgAvatarSvg(a, 40) + '</button>').join('') + '</div>';
  }
  return h + '</section>';
}

// Награды Pass: что надето, что ещё можно выбрать, что откроется дальше.
function pmgProfRewards() {
  const eq = pmgEquipped(), G = pmgGV(), lv = G ? G.level.level : 1;
  const un = pmgUnlocked(lv);
  return '<section class="card prof-rewards"><p class="muted small">Награды открываются с уровнями Pass. Нажми, чтобы надеть.</p>' + PMG_EQUIP_KINDS.map(([kind, label, note]) => {
    const names = pmgEquipNames(kind), cur = eq[kind] || un[kind][0], next = pmgNextUnlock(kind, lv);
    return '<div class="rw-row"><div class="rw-label"><b>' + label + '</b><small class="muted">' + note + '</small></div><div class="rw-opts">' +
      un[kind].map((id) => '<button class="rw-opt' + (cur === id ? ' on' : '') + '" data-act="equip" data-kind="' + kind + '" data-v="' + id + '">' + pmgEsc(names[id] || id) + '</button>').join('') +
      (next ? '<span class="rw-lock" title="Откроется на ' + next.level + '-м уровне">🔒 ' + pmgEsc(next.name.replace(/^[^«]*«|»$/g, '')) + ' — ур. ' + next.level + '</span>' : '') + '</div></div>';
  }).join('') + '</section>';
}

function pmgProfPrivacy() {
  return '<section class="card"><p class="muted small">Включено — друзья в группе это видят. Отдельные оценки, пропуски, замечания и домашку не видит никто и никогда.</p>' +
    '<div class="priv-list">' + pmgPrivacyRows(pmgPrivacyOf(pmgProfile()), 'priv') + '</div></section>';
}

function pmgProfData() {
  return '<section class="card danger-zone"><h3>Удалить мои данные</h3><p class="muted">Удалит профиль, очки и достижения на сервере, фото и участие во всех группах. Оценки и домашка на этом устройстве останутся.</p>' +
    '<button class="btn' + (pmg.confirm === 'delete-me' ? ' danger' : '') + '" data-act="delete-me">' + (pmg.confirm === 'delete-me' ? 'Удалить навсегда? Нажми ещё раз' : 'Удалить мои данные') + '</button></section>';
}

// Один раз выключить на сервере шаги и дуэли, если они остались включены с прошлых версий.
function pmgPrivacyFix() {
  const prof = pmgProfile();
  if (pmg.privFixed || !prof.created || !prof.privacy) return;
  pmg.privFixed = true;
  if (prof.privacy.steps === false && prof.privacy.duels === false) return;
  const priv = pmgPrivacyOf(prof);
  setTimeout(() => pmgSetProfile({ privacy: priv }, { privacy: priv }), 0);
}

async function pmgProfileAct(act, t) {
  const v = t.dataset.v;
  switch (act) {
    case 'prof-sec': pmg.profSec = v; pmg.confirm = null; pmgRender(true, true); return true;
    case 'look-part': pmg.lookPart = v; pmgRender(true, true); return true;
    case 'nick-open': pmg.nickEdit = true; pmgRender(true, true); setTimeout(() => { const x = pmgQ('[data-act="nick-edit"]'); if (x) { x.focus(); x.select(); } }, 30); return true;
    case 'nick-cancel': pmg.nickEdit = false; pmgRender(true, true); return true;
  }
  return false;
}
