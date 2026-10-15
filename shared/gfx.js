// Gradient Pass: картинки наград, аватаров, медалей и наклеек — всё рисуется SVG-кодом.

let pmgGfxUid = 0;
const pmgUid = (p) => (p || 'g') + (++pmgGfxUid);

// ---------- Школьный Y2K: общая палитра и рисунки-стикеры ----------
const PMG_Y2K = { ink: '#17141F', pink: '#FF5FB8', blue: '#2F4BFF', lime: '#D4FF3A', violet: '#7B5CFF', orange: '#FF8A3D', teal: '#22C3A6', yellow: '#FFE14D', paper: '#FFFFFF' };
const PMG_Y2K_BG = ['#FF5FB8', '#2F4BFF', '#D4FF3A', '#7B5CFF', '#FF8A3D', '#22C3A6', '#FFE14D', '#FF6B6B'];
// Рисунки в поле 64×64 с чернильной обводкой. c — основной цвет, d — второй.
function pmgY2kArt(kind, c, d) {
  const K = PMG_Y2K.ink, st = ' stroke="' + K + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  switch (kind) {
    case 'smile': return '<circle cx="32" cy="32" r="17" fill="' + c + '"' + st + '/><ellipse cx="26" cy="28" rx="2.4" ry="3.6" fill="' + K + '"/><ellipse cx="38" cy="28" rx="2.4" ry="3.6" fill="' + K + '"/><path d="M23 36c3 5 15 5 18 0" fill="none"' + st + '/>';
    case 'spark': return '<path d="M32 9c2 15 6 19 22 23-16 4-20 8-22 23-2-15-6-19-22-23 16-4 20-8 22-23z" fill="' + c + '"' + st + '/><path d="M50 12l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="' + d + '" stroke="' + K + '" stroke-width="1.6" stroke-linejoin="round"/>';
    case 'fly': return '<path d="M31 32c-6-12-20-14-20-4 0 6 8 8 13 7-6 2-10 7-6 11 4 4 10-1 13-8zM33 32c6-12 20-14 20-4 0 6-8 8-13 7 6 2 10 7 6 11-4 4-10-1-13-8z" fill="' + c + '"' + st + '/><path d="M32 22v24M32 22l-4-6M32 22l4-6" fill="none"' + st + '/><circle cx="20" cy="27" r="2.5" fill="' + d + '"/><circle cx="44" cy="27" r="2.5" fill="' + d + '"/>';
    case 'phone': return '<rect x="21" y="18" width="22" height="34" rx="5" fill="' + c + '"' + st + '/><rect x="25" y="23" width="14" height="11" rx="2" fill="' + d + '"' + st + '/><path d="M38 18v-7" fill="none"' + st + '/><circle cx="38" cy="10" r="2" fill="' + K + '"/><path d="M26 40h3M31 40h3M36 40h2M26 45h3M31 45h3M36 45h2" fill="none" stroke="' + K + '" stroke-width="2.4" stroke-linecap="round"/>';
    case 'cd': return '<circle cx="32" cy="32" r="18" fill="#E7EBF4"' + st + '/><path d="M32 14a18 18 0 0 1 17 12" fill="none" stroke="' + c + '" stroke-width="5"/><path d="M15 38a18 18 0 0 0 12 11" fill="none" stroke="' + d + '" stroke-width="5"/><path d="M47 40a18 18 0 0 1-7 7" fill="none" stroke="#22C3A6" stroke-width="5"/><circle cx="32" cy="32" r="6" fill="#fff"' + st + '/><circle cx="32" cy="32" r="18" fill="none"' + st + '/>';
    case 'heart': return '<path d="M32 50C14 38 12 28 16 22c4-6 12-6 16 1 4-7 12-7 16-1 4 6 2 16-16 28z" fill="' + c + '"' + st + '/><path d="M21 25c1-2 3-3 5-3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
    case 'bolt': return '<path d="M36 8L18 36h12l-4 20 20-30H34z" fill="' + c + '"' + st + '/>';
    case 'pencil': return '<path d="M18 46l26-26 6 6-26 26-9 3z" fill="' + c + '"' + st + '/><path d="M44 20l4-4 6 6-4 4z" fill="' + d + '"' + st + '/><path d="M18 46l6 6M15 55l3-9 6 6z" fill="#F6D9B0"' + st + '/>';
    case 'cherry': return '<path d="M24 40c4-14 10-22 18-26M40 40c0-12 1-20 2-26M42 14c4-2 8-1 10 2" fill="none"' + st + '/><circle cx="24" cy="44" r="8" fill="' + c + '"' + st + '/><circle cx="41" cy="44" r="8" fill="' + c + '"' + st + '/><circle cx="21" cy="41" r="2" fill="#fff"/><circle cx="38" cy="41" r="2" fill="#fff"/>';
    case 'alien': return '<path d="M32 12c12 0 18 9 18 18 0 10-10 22-18 22S14 40 14 30c0-9 6-18 18-18z" fill="' + c + '"' + st + '/><path d="M20 30c4-1 8 2 9 7-5 1-9-2-9-7zM44 30c-4-1-8 2-9 7 5 1 9-2 9-7z" fill="' + K + '"/>';
    case 'eight': return '<circle cx="32" cy="32" r="18" fill="' + K + '"/><circle cx="35" cy="28" r="8" fill="#fff"/><text x="35" y="32.5" text-anchor="middle" font-size="12" font-weight="800" fill="' + K + '" font-family="Arial, sans-serif">8</text><circle cx="25" cy="22" r="3" fill="' + c + '" opacity=".8"/>';
    case 'tape': return '<rect x="12" y="20" width="40" height="26" rx="4" fill="' + c + '"' + st + '/><rect x="18" y="25" width="28" height="11" rx="5" fill="#fff"' + st + '/><circle cx="25" cy="30.5" r="3" fill="' + d + '" stroke="' + K + '" stroke-width="2"/><circle cx="39" cy="30.5" r="3" fill="' + d + '" stroke="' + K + '" stroke-width="2"/><path d="M22 46l3-5h14l3 5" fill="none"' + st + '/>';
    case 'ruler': return '<rect x="10" y="24" width="44" height="16" rx="3" fill="' + c + '"' + st + '/><path d="M16 24v6M22 24v4M28 24v6M34 24v4M40 24v6M46 24v4" stroke="' + K + '" stroke-width="2.2" stroke-linecap="round"/>';
    case 'five': return '<circle cx="32" cy="32" r="18" fill="#fff"' + st + '/><text x="32" y="43" text-anchor="middle" font-size="30" font-weight="800" fill="#E8344B" font-family="\'Comic Sans MS\', \'Segoe Print\', cursive" transform="rotate(-8 32 32)">5</text><path d="M18 46c6 4 22 4 30-2" fill="none" stroke="#E8344B" stroke-width="2.5" stroke-linecap="round"/>';
  }
  return '<circle cx="32" cy="32" r="16" fill="' + c + '"' + st + '/>';
}
const PMG_AV_KINDS = ['smile', 'spark', 'fly', 'phone', 'cd', 'heart', 'bolt', 'pencil', 'cherry', 'alien', 'eight', 'tape'];

// Аватары: 24 стикера (12 рисунков × 2 расцветки). id остались прежними: planet-1…planet-24.
function pmgAvatarSvg(id, size) {
  const n = Math.max(1, Math.min(24, +((/(\d+)/.exec(id || '') || [])[1] || 1))) - 1;
  const kind = PMG_AV_KINDS[n % 12], alt = n >= 12;
  const bg = PMG_Y2K_BG[(n * 3 + (alt ? 1 : 0)) % PMG_Y2K_BG.length];
  const fills = { smile: PMG_Y2K.yellow, spark: alt ? PMG_Y2K.lime : '#fff', fly: alt ? PMG_Y2K.lime : PMG_Y2K.pink, phone: alt ? PMG_Y2K.pink : '#C9CFDD', cd: PMG_Y2K.pink, heart: alt ? PMG_Y2K.lime : '#FF4D6D', bolt: PMG_Y2K.yellow, pencil: PMG_Y2K.yellow, cherry: '#FF3B5C', alien: PMG_Y2K.lime, eight: PMG_Y2K.pink, tape: alt ? PMG_Y2K.lime : PMG_Y2K.orange };
  const c = fills[kind], d = alt ? PMG_Y2K.blue : PMG_Y2K.pink;
  const bgc = (bg === c) ? PMG_Y2K.violet : bg;
  return '<svg viewBox="0 0 64 64" width="' + (size || 64) + '" height="' + (size || 64) + '" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="' + bgc + '"/>' +
    '<g transform="translate(32 32) scale(.82) translate(-32 -32)">' + pmgY2kArt(kind, c, d) + '</g></svg>';
}

// Аватар игрока: фото или стикер + рамка + аура.
function pmgAvatar(p, size, opts) {
  opts = opts || {};
  const eq = p.equipped || {};
  const frame = opts.frame || eq.frame || 'none';
  const face = p.photoUrl ? '<img src="' + p.photoUrl + '" alt="" draggable="false">' : pmgAvatarSvg(p.avatar, size);
  return '<span class="av frame-' + pmgEsc(frame) + (opts.cls ? ' ' + opts.cls : '') + '" style="--s:' + size + 'px">' +
    '<span class="av-face">' + face + '</span></span>';
}

// ---------- Огонёк ----------
function pmgFlameSvg(days, size) {
  const tier = days >= 21 ? 4 : days >= 14 ? 3 : days >= 7 ? 2 : days >= 3 ? 1 : 0;
  const cols = [['#9CA3AF', '#D1D5DB'], ['#F97316', '#FDBA74'], ['#EF4444', '#FDBA74'], ['#8B5CF6', '#5EEAD4'], ['#6366F1', '#5EEAD4']][tier];
  const g = pmgUid('fl');
  return '<svg class="flame t' + tier + '" viewBox="0 0 32 32" width="' + (size || 28) + '" height="' + (size || 28) + '" aria-hidden="true">' +
    '<defs><linearGradient id="' + g + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + cols[0] + '"/><stop offset="1" stop-color="' + cols[1] + '"/></linearGradient></defs>' +
    (tier >= 4 ? '<circle cx="16" cy="18" r="13" fill="none" stroke="' + cols[1] + '" stroke-width="1.5" opacity=".6" class="fl-ring"/>' : '') +
    '<path class="fl-body" d="M16 3c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 3.5-8 .3 2 1.3 3.4 2.6 3.9C15 10 14 7 16 3z" fill="url(#' + g + ')"/>' +
    '<path d="M16 15c.6 2.6 3.5 3.7 3.5 6.6a3.5 3.5 0 0 1-7 0c0-1.9 1.1-3 2-3.9.2 1 .7 1.6 1.2 1.8-.2-1.6.1-3 .3-4.5z" fill="#fff" opacity=".55"/>' +
    (tier >= 2 ? '<circle cx="8" cy="9" r="1" fill="' + cols[1] + '" class="spark"/><circle cx="25" cy="12" r="1.2" fill="' + cols[1] + '" class="spark s2"/>' : '') + '</svg>';
}

// ---------- Значок сезона: хромовая звезда-вспышка с номером ----------
const PMG_BADGE_COLS = { b10: ['#C2793A', '#FFD9A8'], b25: ['#8C96AA', '#FFFFFF'], b40: ['#E2A100', '#FFF3A3'], b50: ['#FF5FB8', '#D4FF3A'] };
function pmgSeasonBadge(kind, theme, size) {
  const [a, b] = PMG_BADGE_COLS[kind] || PMG_BADGE_COLS.b10, g = pmgUid('bd');
  const lvl = (kind || 'b10').slice(1);
  let pts = '';
  for (let i = 0; i < 24; i++) { const r = i % 2 ? 22 : 30, an = (i / 24) * Math.PI * 2 - Math.PI / 2; pts += (32 + r * Math.cos(an)).toFixed(1) + ',' + (32 + r * Math.sin(an)).toFixed(1) + ' '; }
  return '<svg viewBox="0 0 64 64" width="' + (size || 56) + '" height="' + (size || 56) + '" aria-hidden="true"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + b + '"/><stop offset=".45" stop-color="' + a + '"/><stop offset=".55" stop-color="' + b + '"/><stop offset="1" stop-color="' + a + '"/></linearGradient></defs>' +
    '<polygon points="' + pts + '" fill="url(#' + g + ')" stroke="#17141F" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<circle cx="32" cy="32" r="14" fill="#17141F"/><text x="32" y="37.5" text-anchor="middle" font-size="15" font-weight="700" fill="' + b + '" font-family="\'PMG Pixel\', monospace">' + lvl + '</text></svg>';
}

// ---------- Иконки наград по типу ----------
function pmgRewardIcon(r, size) {
  const s = size || 40, g = pmgUid('rw');
  const wrap = (inner, defs) => '<svg viewBox="0 0 40 40" width="' + s + '" height="' + s + '" aria-hidden="true"><defs>' +
    '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5FB8"/><stop offset=".55" stop-color="#7B5CFF"/><stop offset="1" stop-color="#2F4BFF"/></linearGradient>' + (defs || '') + '</defs>' + inner + '</svg>';
  const fc = { novice: '#94A3B8', bronze: '#C2793A', silver: '#CBD5E1', wave: '#38BDF8', gold: '#EAB308', platinum: '#E5E7EB', gradient: 'url(#' + g + ')' };
  switch (r.kind) {
    case 'frame': return wrap('<circle cx="20" cy="20" r="13" fill="none" stroke="' + (fc[r.id] || 'url(#' + g + ')') + '" stroke-width="5"/>' + (r.id === 'wave' ? '<circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity=".7"/>' : '') + '<circle cx="20" cy="20" r="7.5" fill="currentColor" opacity=".18"/>');
    case 'avatar': return pmgAvatarSvg(r.id, s);
    case 'title': return wrap('<path d="M7 13h20l6 7-6 7H7z" fill="url(#' + g + ')"/><circle cx="12" cy="20" r="2" fill="#fff"/>');
    case 'theme': {
      const tc = { mint: ['#10B981', '#5EEAD4'], sunset: ['#F97316', '#EC4899'], midnight: ['#1E1B4B', '#6366F1'], aurora: ['#22D3EE', '#A855F7'] }[r.id] || ['#6366F1', '#14B8A6'];
      return wrap('<circle cx="20" cy="20" r="14" fill="' + tc[0] + '"/><path d="M20 6a14 14 0 0 1 0 28z" fill="' + tc[1] + '"/><circle cx="20" cy="20" r="14" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>');
    }
    case 'bgpack': return wrap('<rect x="6" y="6" width="28" height="28" rx="7" fill="url(#' + g + ')" opacity=".9"/>' +
      (r.id === 'chem' ? '<path d="M17 12v6l-5 9h16l-5-9v-6" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/>' : r.id === 'formulas' ? '<text x="20" y="25" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="inherit">π·x²</text>' : '<path d="M20 10c1 6 3 8 9 10-6 2-8 4-9 10-1-6-3-8-9-10 6-2 8-4 9-10z" fill="#fff"/>'));
    case 'skin': return wrap('<rect x="7" y="9" width="26" height="22" rx="4" fill="' + (r.id === 'holo' ? 'url(#' + g + ')' : '#fff') + '" stroke="#94A3B8"/>' + (r.id === 'notebook' ? '<path d="M7 15h26M7 20h26M7 25h26" stroke="#93C5FD"/><path d="M12 9v22" stroke="#F87171"/>' : '<path d="M11 14l18 12" stroke="#fff" stroke-width="3" opacity=".6"/>'));
    case 'reaction': return '<span class="rw-emoji" style="font-size:' + Math.round(s * .55) + 'px">' + pmgReactionIcon(r.id, Math.round(s * .7)) + '</span>';
    case 'freeze': return wrap('<g stroke="#38BDF8" stroke-width="2.6" stroke-linecap="round"><path d="M20 6v28M8 13l24 14M8 27l24-14"/><path d="M16 8l4 3 4-3M16 32l4-3 4 3"/></g>');
    case 'aura': return wrap('<circle cx="20" cy="20" r="15" fill="url(#' + g + ')" opacity=".25"/><circle cx="20" cy="20" r="11" fill="none" stroke="url(#' + g + ')" stroke-width="2.4" stroke-dasharray="' + (r.id === 'orbit' ? '3 4' : '0') + '"/><circle cx="20" cy="20" r="6" fill="url(#' + g + ')"/>');
    case 'badge': return pmgSeasonBadge(r.id, 'sticker', s);
    case 'anim': return wrap('<path d="M20 6l2.5 8.5L31 17l-8.5 2.5L20 28l-2.5-8.5L9 17l8.5-2.5z" fill="url(#' + g + ')"/><circle cx="31" cy="30" r="2" fill="#14B8A6"/><circle cx="9" cy="31" r="1.4" fill="#8B5CF6"/>');
    case 'sticker': return pmgStickerSvg(r.n, r.theme || 'sticker', s);
  }
  return wrap('<circle cx="20" cy="20" r="12" fill="url(#' + g + ')"/>');
}

// ---------- Реакции ----------
function pmgReactionIcon(id, size) {
  const s = size || 18;
  const p = {
    fire: '<path d="M12 2c.8 3.6 5 5.6 5 10.6a5 5 0 0 1-10 0c0-2.9 1.4-4.3 2.5-5.7.2 1.4.9 2.4 1.9 2.8C11 7.1 10.6 4.9 12 2z" fill="#F97316"/>',
    power: '<path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="#EAB308"/>',
    wow: '<circle cx="12" cy="12" r="9" fill="#8B5CF6"/><circle cx="9" cy="10" r="1.3" fill="#fff"/><circle cx="15" cy="10" r="1.3" fill="#fff"/><ellipse cx="12" cy="15.5" rx="2.2" ry="2.6" fill="#fff"/>',
    clap: '<path d="M7 13l5-7 1.5 1-3 5 6-6 1.3 1.2-4.6 5.4 4.6-3.6 1.1 1.3-6 6.4a5 5 0 0 1-7 .3z" fill="#14B8A6"/><path d="M15 3l1-2M18 5l2-1M12 3V1" stroke="#14B8A6" stroke-width="1.5" stroke-linecap="round"/>',
    rocket: '<path d="M14 3c4 0 7 3 7 7l-7 7-4-4z" fill="#6366F1"/><circle cx="15.5" cy="8.5" r="1.6" fill="#fff"/><path d="M10 13l-4 1 3-4M11 14l-1 4 4-3" fill="#8B5CF6"/><path d="M7 17l-3 4" stroke="#F97316" stroke-width="2" stroke-linecap="round"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" fill="#EAB308"/><path d="M5 20h14" stroke="#CA8A04" stroke-width="2"/>'
  }[id] || '';
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true">' + p + '</svg>';
}

// ---------- Медали достижений ----------
const PMG_ACH_GLYPH = {
  flag: '<path d="M14 10v20M14 11h11l-3 4 3 4H14" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  three: '<text x="20" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="inherit">5·5·5</text>',
  check: '<path d="M12 20.5l5 5 11-11" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  page: '<rect x="13" y="10" width="14" height="19" rx="2" fill="#fff"/><path d="M16 15h8M16 19h8M16 23h5" stroke-width="1.6" stroke="currentColor"/>',
  swords: '<path d="M11 11l14 14M29 11L15 25M12 25l3 3M28 25l-3 3" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  team: '<circle cx="15" cy="16" r="3.5" fill="#fff"/><circle cx="25" cy="16" r="3.5" fill="#fff"/><path d="M9 28c0-4 3-6 6-6s6 2 6 6M19 28c0-4 3-6 6-6s6 2 6 6" fill="#fff"/>',
  up: '<path d="M10 26l7-7 4 4 9-9M24 14h6v6" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  book: '<path d="M10 12c4-1.5 7-1 10 1 3-2 6-2.5 10-1v15c-4-1.5-7-1-10 1-3-2-6-2.5-10-1z" fill="#fff"/><path d="M20 13v15" stroke="currentColor" stroke-width="1.4"/>',
  grid: '<g fill="#fff"><rect x="11" y="11" width="5" height="5" rx="1"/><rect x="18" y="11" width="5" height="5" rx="1"/><rect x="25" y="11" width="5" height="5" rx="1"/><rect x="11" y="18" width="5" height="5" rx="1"/><rect x="18" y="18" width="5" height="5" rx="1"/><rect x="25" y="18" width="5" height="5" rx="1"/><rect x="11" y="25" width="5" height="5" rx="1"/><rect x="18" y="25" width="5" height="5" rx="1"/></g>',
  flame: '<path d="M20 8c1 4.5 6 7 6 13a6 6 0 0 1-12 0c0-3.5 1.7-5.2 3-6.8.3 1.7 1.1 2.9 2.3 3.4-.3-3 .2-6 .7-9.6z" fill="#fff"/>',
  five: '<text x="20" y="26" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" font-family="inherit">5×5</text>',
  stairs: '<path d="M10 29h6v-6h6v-6h6v-6" fill="none" stroke="#fff" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>',
  sun: '<circle cx="20" cy="22" r="5" fill="#fff"/><path d="M20 11v3M11 22h3M26 22h3M13.6 15.6l2 2M26.4 15.6l-2 2M10 28h20" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  star: '<path d="M20 9l3.3 6.9 7.5 1-5.5 5.2 1.4 7.5L20 26l-6.7 3.6 1.4-7.5-5.5-5.2 7.5-1z" fill="#fff"/>',
  flame2: '<path d="M20 7c1 4.5 6 7 6 13a6 6 0 0 1-12 0c0-3.5 1.7-5.2 3-6.8.3 1.7 1.1 2.9 2.3 3.4-.3-3 .2-6 .7-9.6z" fill="#fff"/><circle cx="20" cy="22" r="13" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 3"/>',
  shield: '<path d="M20 9l9 3v7c0 6-4 9.5-9 11.5-5-2-9-5.5-9-11.5v-7z" fill="#fff"/><path d="M16 20l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  crown: '<path d="M10 15l5 4 5-8 5 8 5-4-2 12H12z" fill="#fff"/>'
};
const PMG_RARITY_COLS = { common: ['#64748B', '#94A3B8'], rare: ['#2563EB', '#60A5FA'], epic: ['#7C3AED', '#C084FC'] };
function pmgMedalSvg(a, size, locked) {
  const g = pmgUid('md');
  const [c1, c2] = locked ? ['#CBD5E1', '#E2E8F0'] : PMG_RARITY_COLS[a.rarity];
  const glyph = locked && a.secret ? '<text x="20" y="25" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" font-family="inherit">?</text>' : (PMG_ACH_GLYPH[a.icon] || '');
  return '<svg viewBox="0 0 40 40" width="' + (size || 44) + '" height="' + (size || 44) + '" aria-hidden="true" style="color:' + c1 + '"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient></defs>' +
    (locked ? '<circle cx="20" cy="20" r="17" fill="none" stroke="' + c1 + '" stroke-width="1.6" stroke-dasharray="3 3"/><g opacity=".9" style="color:' + c1 + '">' + glyph.replace(/#fff/g, c1) + '</g>'
      : '<circle cx="20" cy="20" r="18" fill="url(#' + g + ')"/><circle cx="20" cy="20" r="15" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>' + glyph) + '</svg>';
}

// ---------- Наклейки альбома: 10 рисунков × 3 вида (обычная, с блёстками, голо) ----------
// Подложка наклейки: 1–10 обычные, 11–20 с блёстками, 21–29 голографические.
const PMG_STICKER_KINDS = ['smile', 'spark', 'fly', 'phone', 'cd', 'heart', 'bolt', 'pencil', 'ruler', 'five'];
function pmgStickerSvg(n, theme, size) {
  const s = size || 56, g = pmgUid('st');
  const kind = PMG_STICKER_KINDS[n % 10], tier = Math.floor(n / 10);
  const c = [PMG_Y2K.pink, PMG_Y2K.yellow, PMG_Y2K.lime, PMG_Y2K.blue, PMG_Y2K.orange, PMG_Y2K.teal, PMG_Y2K.violet][n % 7];
  const d = [PMG_Y2K.blue, PMG_Y2K.pink, PMG_Y2K.lime][n % 3];
  const pixel = theme === 'pixel', chrome = theme === 'chrome';
  const base = pixel ? '<rect x="5" y="5" width="54" height="54" fill="#fff" stroke="#17141F" stroke-width="3"/><rect x="9" y="9" width="46" height="46" fill="' + (tier === 2 ? 'url(#' + g + 'h)' : '#F2F4FF') + '"/>'
    : '<circle cx="32" cy="32" r="29" fill="#fff" stroke="#17141F" stroke-width="2.5"/><circle cx="32" cy="32" r="24.5" fill="' + (tier === 2 || chrome ? 'url(#' + g + 'h)' : '#F4F6FF') + '"/>';
  const spark = (x, y, r) => '<path d="M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z"/>';
  const glitter = tier >= 1 ? '<g fill="#fff" stroke="#17141F" stroke-width="1.3" stroke-linejoin="round">' + spark(14, 15, 6) + spark(51, 19, 5) + (tier === 2 ? spark(49, 50, 5.5) : '') + '</g>' : '';
  return '<svg class="sticker-svg" viewBox="0 0 64 64" width="' + s + '" height="' + s + '" aria-hidden="true"' + (pixel ? ' shape-rendering="crispEdges"' : '') + '><defs>' +
    '<linearGradient id="' + g + 'h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD6F0"/><stop offset=".35" stop-color="#C9F7FF"/><stop offset=".65" stop-color="#EFFFB8"/><stop offset="1" stop-color="#E3D6FF"/></linearGradient>' +
    '<filter id="' + g + '" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.5" dy="2" stdDeviation="0" flood-color="#17141F" flood-opacity=".9"/></filter></defs>' +
    '<g filter="url(#' + g + ')">' + base + '<g transform="translate(32 32) scale(.74) translate(-32 -32)">' + pmgY2kArt(kind, c, d) + '</g>' + glitter + '</g></svg>';
}

// ---------- Кольцо уровня ----------
function pmgLevelRing(level, frac, size, stars) {
  const s = size || 112, r = 46, c = 2 * Math.PI * r, g = pmgUid('lr');
  return '<div class="lvl-ring" style="--s:' + s + 'px"><svg viewBox="0 0 104 104" width="' + s + '" height="' + s + '" aria-hidden="true">' +
    '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5FB8"/><stop offset=".55" stop-color="#7B5CFF"/><stop offset="1" stop-color="#2F4BFF"/></linearGradient></defs>' +
    '<circle cx="52" cy="52" r="' + r + '" fill="none" class="lr-track" stroke-width="8"/>' +
    '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="url(#' + g + ')" stroke-width="8" stroke-linecap="round" class="lr-arc" transform="rotate(-90 52 52)" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1) + '" style="--c:' + c.toFixed(1) + '"/></svg>' +
    '<div class="lr-in"><small>уровень</small><b class="lr-num">' + level + '</b>' + (stars ? '<small class="lr-stars">★ ' + stars + '</small>' : '') + '</div></div>';
}
