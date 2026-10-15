// Gradient Pass: картинки наград, аватаров, медалей и наклеек — всё рисуется SVG-кодом.

let pmgGfxUid = 0;
const pmgUid = (p) => (p || 'g') + (++pmgGfxUid);

// ---------- Аватары: 24 планеты (8 цветов × 3 узора) ----------
const PMG_AV_COLORS = [
  ['#6366F1', '#A5B4FC'], ['#8B5CF6', '#DDD6FE'], ['#14B8A6', '#99F6E4'], ['#F59E0B', '#FDE68A'],
  ['#EF4444', '#FECACA'], ['#0EA5E9', '#BAE6FD'], ['#22C55E', '#BBF7D0'], ['#EC4899', '#FBCFE8']
];
function pmgAvatarSvg(id, size) {
  const n = Math.max(1, Math.min(24, +((/(\d+)/.exec(id || '') || [])[1] || 1))) - 1;
  const [c1, c2] = PMG_AV_COLORS[n % 8], kind = Math.floor(n / 8);
  const g = pmgUid('av');
  let deco = '';
  if (kind === 0) deco = '<ellipse cx="32" cy="34" rx="30" ry="7" fill="none" stroke="' + c2 + '" stroke-width="3" opacity=".85" transform="rotate(-18 32 32)"/>';
  if (kind === 1) deco = '<circle cx="22" cy="24" r="5" fill="' + c1 + '" opacity=".55"/><circle cx="40" cy="38" r="7" fill="' + c1 + '" opacity=".5"/><circle cx="38" cy="20" r="3" fill="' + c1 + '" opacity=".5"/>';
  if (kind === 2) deco = '<path d="M8 26c10 4 38 4 48 0M7 36c12 4 38 4 50 0M11 45c10 3 32 3 42 0" stroke="' + c2 + '" stroke-width="3.2" fill="none" opacity=".75" stroke-linecap="round"/>';
  return '<svg viewBox="0 0 64 64" width="' + (size || 64) + '" height="' + (size || 64) + '" aria-hidden="true"><defs><radialGradient id="' + g + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c1 + '"/></radialGradient>' +
    '<clipPath id="' + g + 'c"><circle cx="32" cy="32" r="24"/></clipPath></defs>' +
    '<circle cx="32" cy="32" r="32" fill="' + c1 + '" opacity=".16"/>' +
    '<circle cx="32" cy="32" r="24" fill="url(#' + g + ')"/>' + (kind === 0 ? deco : '<g clip-path="url(#' + g + 'c)">' + deco + '</g>') +
    '<circle cx="24" cy="23" r="5" fill="#fff" opacity=".35"/></svg>';
}

// Аватар игрока: фото или планета + рамка + аура.
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

// ---------- Значок сезона (шестиугольник) ----------
const PMG_BADGE_COLS = { b10: ['#B45309', '#FCD34D'], b25: ['#64748B', '#E2E8F0'], b40: ['#CA8A04', '#FDE047'], b50: ['#6366F1', '#14B8A6'] };
function pmgSeasonBadge(kind, theme, size) {
  const [a, b] = PMG_BADGE_COLS[kind] || PMG_BADGE_COLS.b10, g = pmgUid('bd');
  const lvl = (kind || 'b10').slice(1);
  const art = theme === 'deep' ? '<path d="M24 26c5-6 13-6 18 0-5 6-13 6-18 0z" fill="#fff" opacity=".9"/><circle cx="38" cy="25" r="1.4" fill="' + a + '"/><path d="M24 26l-5-4v8z" fill="#fff" opacity=".9"/>'
    : theme === 'neon' ? '<path d="M20 34V22h5v12M27 34V17h6v17M35 34V25h7v9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>'
      : '<circle cx="32" cy="26" r="7" fill="#fff" opacity=".95"/><ellipse cx="32" cy="27" rx="13" ry="3.6" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-15 32 27)"/>';
  return '<svg viewBox="0 0 64 64" width="' + (size || 56) + '" height="' + (size || 56) + '" aria-hidden="true"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + b + '"/><stop offset="1" stop-color="' + a + '"/></linearGradient></defs>' +
    '<path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill="url(#' + g + ')" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>' + art +
    '<text x="32" y="51" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="inherit">' + lvl + '</text></svg>';
}

// ---------- Иконки наград по типу ----------
function pmgRewardIcon(r, size) {
  const s = size || 40, g = pmgUid('rw');
  const wrap = (inner, defs) => '<svg viewBox="0 0 40 40" width="' + s + '" height="' + s + '" aria-hidden="true"><defs>' +
    '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#14B8A6"/></linearGradient>' + (defs || '') + '</defs>' + inner + '</svg>';
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
      (r.id === 'chem' ? '<path d="M17 12v6l-5 9h16l-5-9v-6" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/>' : r.id === 'formulas' ? '<text x="20" y="25" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="inherit">π·x²</text>' : '<circle cx="16" cy="17" r="4" fill="#fff"/><circle cx="27" cy="26" r="2" fill="#fff"/><circle cx="26" cy="12" r="1.3" fill="#fff"/>'));
    case 'skin': return wrap('<rect x="7" y="9" width="26" height="22" rx="4" fill="' + (r.id === 'holo' ? 'url(#' + g + ')' : '#fff') + '" stroke="#94A3B8"/>' + (r.id === 'notebook' ? '<path d="M7 15h26M7 20h26M7 25h26" stroke="#93C5FD"/><path d="M12 9v22" stroke="#F87171"/>' : '<path d="M11 14l18 12" stroke="#fff" stroke-width="3" opacity=".6"/>'));
    case 'reaction': return '<span class="rw-emoji" style="font-size:' + Math.round(s * .55) + 'px">' + pmgReactionIcon(r.id, Math.round(s * .7)) + '</span>';
    case 'freeze': return wrap('<g stroke="#38BDF8" stroke-width="2.6" stroke-linecap="round"><path d="M20 6v28M8 13l24 14M8 27l24-14"/><path d="M16 8l4 3 4-3M16 32l4-3 4 3"/></g>');
    case 'aura': return wrap('<circle cx="20" cy="20" r="15" fill="url(#' + g + ')" opacity=".25"/><circle cx="20" cy="20" r="11" fill="none" stroke="url(#' + g + ')" stroke-width="2.4" stroke-dasharray="' + (r.id === 'orbit' ? '3 4' : '0') + '"/><circle cx="20" cy="20" r="6" fill="url(#' + g + ')"/>');
    case 'badge': return pmgSeasonBadge(r.id, 'cosmos', s);
    case 'anim': return wrap('<path d="M20 6l2.5 8.5L31 17l-8.5 2.5L20 28l-2.5-8.5L9 17l8.5-2.5z" fill="url(#' + g + ')"/><circle cx="31" cy="30" r="2" fill="#14B8A6"/><circle cx="9" cy="31" r="1.4" fill="#8B5CF6"/>');
    case 'sticker': return pmgStickerSvg(r.n, 'cosmos', s);
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

// ---------- Наклейки ----------
function pmgStickerSvg(n, theme, size) {
  const s = size || 56, g = pmgUid('st');
  const pal = [['#6366F1', '#C7D2FE'], ['#8B5CF6', '#EDE9FE'], ['#14B8A6', '#CCFBF1'], ['#F59E0B', '#FEF3C7'], ['#EC4899', '#FCE7F3'], ['#0EA5E9', '#E0F2FE'], ['#EF4444', '#FEE2E2']];
  const [c, bg] = pal[n % pal.length];
  const kind = n % 10;
  const art = {
    cosmos: [
      '<circle cx="32" cy="32" r="12" fill="' + c + '"/><circle cx="28" cy="28" r="3" fill="#fff" opacity=".5"/><circle cx="37" cy="36" r="2" fill="#fff" opacity=".4"/>',
      '<path d="M32 14c6 5 7 14 4 22h-8c-3-8-2-17 4-22z" fill="' + c + '"/><circle cx="32" cy="26" r="3" fill="#fff"/><path d="M28 36l-5 6 6-2M36 36l5 6-6-2" fill="' + c + '"/><path d="M30 38h4l-2 8z" fill="#F97316"/>',
      '<circle cx="32" cy="32" r="10" fill="' + c + '"/><ellipse cx="32" cy="33" rx="19" ry="5" fill="none" stroke="' + c + '" stroke-width="3" transform="rotate(-18 32 32)"/>',
      '<circle cx="38" cy="26" r="7" fill="' + c + '"/><path d="M32 30L14 46M34 33L20 48M30 27L14 38" stroke="' + c + '" stroke-width="3" stroke-linecap="round" opacity=".6"/>',
      '<rect x="27" y="27" width="10" height="10" rx="2" fill="' + c + '"/><path d="M14 26h12v12H14zM38 26h12v12H38z" fill="' + c + '" opacity=".6"/><path d="M32 27v-8M29 19h6" stroke="' + c + '" stroke-width="2"/>',
      '<circle cx="32" cy="32" r="13" fill="#EF4444"/><circle cx="27" cy="28" r="3" fill="#B91C1C" opacity=".6"/><circle cx="37" cy="37" r="4" fill="#B91C1C" opacity=".5"/>',
      '<g fill="' + c + '"><circle cx="16" cy="24" r="2.4"/><circle cx="24" cy="22" r="2.4"/><circle cx="31" cy="26" r="2.4"/><circle cx="38" cy="30" r="2.4"/><circle cx="40" cy="40" r="2.4"/><circle cx="50" cy="38" r="2.4"/><circle cx="50" cy="28" r="2.4"/></g><path d="M16 24l8-2 7 4 7 4 2 10 10-2v-10l-12 2" fill="none" stroke="' + c + '" stroke-width="1.4"/>',
      '<circle cx="32" cy="28" r="11" fill="#fff" stroke="' + c + '" stroke-width="3"/><rect x="25" y="23" width="14" height="9" rx="4" fill="' + c + '"/><path d="M22 46c0-6 4-9 10-9s10 3 10 9" fill="' + c + '"/>',
      '<path d="M18 38l22-12 3 6-22 12z" fill="' + c + '"/><path d="M30 38l-4 10M30 38l6 10" stroke="' + c + '" stroke-width="2.4"/><circle cx="44" cy="28" r="3" fill="' + c + '"/>',
      '<path d="M32 16l4 10 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1z" fill="' + c + '"/>'
    ]
  };
  const list = art[theme] || art.cosmos;
  return '<svg class="sticker-svg" viewBox="0 0 64 64" width="' + s + '" height="' + s + '" aria-hidden="true"><defs><filter id="' + g + '" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity=".25"/></filter></defs>' +
    '<g filter="url(#' + g + ')"><circle cx="32" cy="32" r="28" fill="#fff"/><circle cx="32" cy="32" r="24" fill="' + bg + '"/>' + list[kind] +
    (n >= 10 ? '<circle cx="' + (14 + (n * 7) % 36) + '" cy="' + (14 + (n * 11) % 36) + '" r="1.6" fill="' + c + '"/>' : '') +
    (n >= 20 ? '<circle cx="' + (50 - (n * 5) % 30) + '" cy="' + (48 - (n * 3) % 30) + '" r="1.3" fill="' + c + '"/>' : '') + '</g></svg>';
}

// ---------- Кольцо уровня ----------
function pmgLevelRing(level, frac, size, stars) {
  const s = size || 112, r = 46, c = 2 * Math.PI * r, g = pmgUid('lr');
  return '<div class="lvl-ring" style="--s:' + s + 'px"><svg viewBox="0 0 104 104" width="' + s + '" height="' + s + '" aria-hidden="true">' +
    '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs>' +
    '<circle cx="52" cy="52" r="' + r + '" fill="none" class="lr-track" stroke-width="8"/>' +
    '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="url(#' + g + ')" stroke-width="8" stroke-linecap="round" class="lr-arc" transform="rotate(-90 52 52)" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1) + '" style="--c:' + c.toFixed(1) + '"/></svg>' +
    '<div class="lr-in"><small>уровень</small><b class="lr-num">' + level + '</b>' + (stars ? '<small class="lr-stars">★ ' + stars + '</small>' : '') + '</div></div>';
}
