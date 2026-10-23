// Gradely Pass: картинки игры — 3D-иконки (Microsoft Fluent Emoji, лицензия MIT, файлы в img/3d).
// Функции те же, что раньше рисовали SVG-стикеры, поэтому все места, где они вызываются, обновились сами.

let pmgGfxUid = 0;
const pmgUid = (p) => (p || 'g') + (++pmgGfxUid);

// Одна 3D-иконка. off — серая (закрыто, ещё не получено).
function pmgE3d(name, size, opts) {
  opts = opts || {};
  const s = size || 32;
  return '<img class="e3d' + (opts.off ? ' off' : '') + (opts.cls ? ' ' + opts.cls : '') + '" src="' + chrome.runtime.getURL('img/3d/' + name + '.png') + '" width="' + s + '" height="' + s + '" alt="" draggable="false" loading="lazy">';
}

// ---------- Аватары: 16 зверят. id прежние (planet-1…planet-24), чтобы не трогать сервер ----------
const PMG_AV_COUNT = 16;
const PMG_AV_BG = ['#E8F2FF', '#FFF1E0', '#EAF8EE', '#F3EEFF', '#FFEDEF', '#E6F7FB', '#FFF8DB', '#EEF0F4'];
function pmgAvatarIndex(id) {
  const n = Math.max(1, +((/(\d+)/.exec(id || '') || [])[1] || 1)) - 1;
  return n % PMG_AV_COUNT;
}
function pmgAvatarSvg(id, size) {
  const n = pmgAvatarIndex(id), s = size || 64;
  return '<span class="av-3d" style="--s:' + s + 'px;background:' + PMG_AV_BG[n % PMG_AV_BG.length] + '">' + pmgE3d('a' + n, Math.round(s * .78)) + '</span>';
}

// Аватар игрока: фото или зверёк + тонкая рамка (награда).
function pmgAvatar(p, size, opts) {
  opts = opts || {};
  const eq = p.equipped || {};
  const frame = opts.frame || eq.frame || 'none';
  const face = p.photoUrl ? '<img src="' + p.photoUrl + '" alt="" draggable="false">' : pmgAvatarSvg(p.avatar, size);
  return '<span class="av frame-' + pmgEsc(frame) + (opts.cls ? ' ' + opts.cls : '') + '" style="--s:' + size + 'px">' +
    '<span class="av-face">' + face + '</span></span>';
}

// «Фигурка» на месте прежних человечков: крупный аватар. Подпись функции прежняя.
function pmgFigure(p, h, opts) {
  opts = opts || {};
  const s = Math.round((h || 120) * .62);
  return '<span class="fig-av' + (opts.lead ? ' lead' : '') + '" style="--s:' + s + 'px">' + pmgAvatar(p, s) +
    (opts.lead ? '<span class="fig-crown">' + pmgE3d('crown', Math.round(s * .42)) + '</span>' : '') + '</span>';
}

// ---------- Огонёк ----------
function pmgFlameSvg(days, size) {
  // Серый — только когда серии нет; с первого дня — настоящий огонь
  return pmgE3d('fire', size || 28, { off: !(days > 0), cls: 'flame' });
}

// ---------- Значок сезона: медали 10, 25, 40-го уровня и кубок 50-го ----------
function pmgSeasonBadge(kind, theme, size) {
  const icon = { b10: 'medal3', b25: 'medal2', b40: 'medal1', b50: 'trophy' }[kind] || 'medal';
  return pmgE3d(icon, size || 56);
}

// ---------- Иконки наград по типу ----------
const PMG_REWARD_3D = { frame: 'gem', title: 'medal', theme: 'palette', bgpack: 'sparkles', skin: 'frame', freeze: 'snowflake', aura: 'glow', anim: 'party' };
function pmgRewardIcon(r, size) {
  const s = size || 40;
  if (r.kind === 'avatar') return pmgAvatarSvg(r.id, s);
  if (r.kind === 'reaction') return pmgReactionIcon(r.id, s);
  if (r.kind === 'badge') return pmgSeasonBadge(r.id, 'sticker', s);
  if (r.kind === 'sticker') return pmgStickerSvg(r.n, r.theme || 'sticker', s);
  return pmgE3d(PMG_REWARD_3D[r.kind] || 'gift', s);
}

// ---------- Реакции ----------
const PMG_REACTION_3D = { fire: 'fire', power: 'muscle', wow: 'wow', clap: 'clap', rocket: 'rocket', crown: 'crown' };
function pmgReactionIcon(id, size) {
  return pmgE3d(PMG_REACTION_3D[id] || 'heart', size || 18);
}

// ---------- Достижения ----------
const PMG_ACH_3D = { flag: 'target', three: 'hundred', check: 'check', page: 'memo', swords: 'medal', team: 'party', up: 'chart', book: 'books',
  grid: 'cap', flame: 'fire', five: 'star', stairs: 'chart', sun: 'alarm', star: 'glow', flame2: 'fire', shield: 'gem', crown: 'crown' };
function pmgMedalSvg(a, size, locked) {
  if (locked && a.secret) return pmgE3d('locked', size || 44, { off: true });
  return pmgE3d(PMG_ACH_3D[a.icon] || 'medal', size || 44, { off: locked });
}

// ---------- Альбом сезона: коллекция 3D-предметов вместо наклеек ----------
const PMG_ALBUM_3D = ['star', 'books', 'rocket', 'bulb', 'brain', 'cap', 'memo', 'alarm', 'chart', 'target', 'gem', 'crown', 'gift', 'palette',
  'party', 'hundred', 'glow', 'sparkles', 'leaf', 'calendar', 'bell', 'heart', 'snowflake', 'medal', 'medal3', 'medal2', 'medal1', 'trophy', 'fire'];
function pmgStickerSvg(n, theme, size) {
  return pmgE3d(PMG_ALBUM_3D[n % PMG_ALBUM_3D.length], size || 56);
}

// ---------- Кольцо уровня ----------
function pmgLevelRing(level, frac, size, stars) {
  const s = size || 112, r = 46, c = 2 * Math.PI * r, g = pmgUid('lr');
  return '<div class="lvl-ring" style="--s:' + s + 'px"><svg viewBox="0 0 104 104" width="' + s + '" height="' + s + '" aria-hidden="true">' +
    '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5AC8FA"/><stop offset="1" stop-color="#0A84FF"/></linearGradient></defs>' +
    '<circle cx="52" cy="52" r="' + r + '" fill="none" class="lr-track" stroke-width="10"/>' +
    '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="url(#' + g + ')" stroke-width="10" stroke-linecap="round" class="lr-arc" transform="rotate(-90 52 52)" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1) + '" style="--c:' + c.toFixed(1) + '"/></svg>' +
    '<div class="lr-in"><small>уровень</small><b class="lr-num">' + level + '</b>' + (stars ? '<small class="lr-stars">★ ' + stars + '</small>' : '') + '</div></div>';
}

// ---------- Кольца недели, как в «Фитнесе»: XP, задания дня, домашка на завтра ----------
// rings: [{ frac, color }] — снаружи внутрь.
function pmgRings(rings, size) {
  const s = size || 132, w = Math.max(8, Math.round(s * .1)), gap = 2;
  let h = '';
  rings.forEach((r, i) => {
    const rad = s / 2 - w / 2 - i * (w + gap), c = 2 * Math.PI * rad, f = Math.max(0, Math.min(1, r.frac || 0));
    // Цвет через style: атрибуты SVG не понимают CSS-переменные вроде var(--ring-1)
    h += '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + rad.toFixed(1) + '" fill="none" style="stroke:' + r.color + ';stroke-opacity:.18" stroke-width="' + w + '"/>' +
      '<circle class="fit-arc" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + rad.toFixed(1) + '" fill="none" stroke-width="' + w + '" stroke-linecap="round" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"' +
      ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(1) + '" style="stroke:' + r.color + ';--c:' + c.toFixed(1) + '"/>';
  });
  return '<svg class="rings" viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '" aria-hidden="true">' + h + '</svg>';
}
