// Gradient Pass: вкладки «Pass» и «Друзья», профиль, стена стикеров группы и анимации игры.

const PMG_KIND_NAMES = {
  mark: 'Оценки', rush: 'Рывки', comeback: 'Камбэки', up: 'Рост прогноза', final: 'Итоговые', hw: 'Домашка', hwok: 'Домашка с оценкой',
  nodebt: 'Без долгов', present: 'Без пропусков', login: 'Заходы в Gradient', report: 'Отчёт родителям', quest: 'Задания дня',
  wquest: 'Задания недели', ach: 'Достижения', streak5: 'Серии пятёрок', goal: 'Общая цель'
};
const PMG_PRIVACY = [
  ['core', 'Уровень, XP, огонёк, достижения', 'без этого нет игры', true],
  ['photo', 'Моё фото вместо планеты', 'иначе будет аватар'],
  ['shelf', 'Кубки и значки прошлых сезонов', 'полка в профиле'],
  ['study', 'Домашка и пропуски в рейтинге', 'только сколько сделано вовремя и дней без пропусков'],
  ['avg', 'Средний балл за четверть', 'в рейтинге и профиле'],
  ['finals', 'Прогноз итоговых', 'только сколько выходит 5, 4 и 3'],
  ['cheer', 'Уведомления «Подбодрить»', '']
];
const PMG_PRIVACY_DEFAULT = { photo: true, shelf: true, avg: false, finals: false, cheer: true, study: true };

function pmgGameMsg(op, extra) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ ...(extra || {}), kind: 'pmg-game', op }, (r) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(r || { ok: false, error: 'no_reply' });
      });
    } catch (e) { resolve({ ok: false, error: String(e.message || e) }); }
  });
}

function pmgGV() { return pmg.game && pmg.game.view; }
function pmgProfile() { return pmg.profile || {}; }
function pmgEquipped() { return pmgProfile().equipped || {}; }
function pmgAgo(ts) {
  if (!ts) return '';
  const d = pmgToday() - new Date(new Date(ts).setHours(0, 0, 0, 0));
  const n = Math.round(d / 864e5);
  return n <= 0 ? 'сегодня' : n === 1 ? 'вчера' : n + ' ' + pmgPlural(n, ['день', 'дня', 'дней']) + ' назад';
}
function pmgFmtXp(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function pmgErrText(e) {
  return ({
    not_found: 'Такого кода нет. Проверь буквы и цифры.', closed: 'Создатель закрыл вступление в эту группу.', full: 'В группе уже 30 человек.',
    too_many_groups: 'Можно состоять максимум в 3 группах.', student_taken: 'На этого ученика уже есть профиль Gradient на другом компьютере.',
    owner_must_transfer: 'Сначала передай роль создателя другому участнику.', forbidden: 'Это может только создатель группы.', too_many_helpers: 'Помощников может быть не больше двух.',
    signed_out: 'Вход в Gradient потерялся. Начни сезон заново.', off: 'Этот игрок выключил «Подбодрить».'
  })[e] || ('Не получилось: ' + e);
}

// ---------- Полоска XP под шапкой ----------
function pmgXpLine() {
  const G = pmgGV();
  if (!G) return '';
  const f = G.level.need ? G.level.into / G.level.need : 0;
  return '<button class="xpline" data-act="tab" data-tab="pass" data-tip="Уровень ' + G.level.level + ' · ' + pmgFmtXp(G.level.into) + ' из ' + pmgFmtXp(G.level.need) + ' XP">' +
    '<span class="xpl-lv">' + G.level.level + '</span><span class="xpl-bar"><i style="width:' + (f * 100).toFixed(1) + '%"></i></span></button>';
}

// ---------- Вкладка Pass ----------
function pmgPassView() {
  const G = pmgGV();
  if (!G) {
    if (!pmg.gameAsked) { pmg.gameAsked = true; pmgGameMsg('run'); }
    return '<section class="card pass-empty"><div class="loader"><span></span><span></span><span></span></div><p>Считаю очки сезона…</p></section>';
  }
  const S = G.season, L = G.level, prof = pmgProfile();
  let h = '';
  if (S.phase === 'soon') h += '<div class="pass-banner">Сезон «' + pmgEsc(S.name) + '» начнётся ' + pmgShortIso(S.starts) + '.</div>';
  if (S.phase === 'over') h += '<div class="pass-banner">Сезон «' + pmgEsc(S.name) + '» закончился. ' + (S.next ? 'Следующий, «' + pmgEsc(S.next.name) + '», стартует ' + pmgShortIso(S.next.starts) + '.' : '') + '</div>';
  if (S.test && S.phase !== 'over') h += '<div class="pass-banner test"><b>Тестовый сезон</b> до ' + pmgShortIso(S.ends) + ': проверяем вход, группу и рейтинг с друзьями. Настоящий сезон «' + pmgEsc(S.next ? S.next.name : 'Стикербомб') + '» стартует ' + (S.next ? pmgShortIso(S.next.starts) : '5 ноября') + ' вместе со II четвертью, очки обнулятся.</div>';

  // Шапка
  const phaseName = { warmup: 'Разгон: задания дня ×1,25', final: 'Финишная прямая: задания недели ×1,5', main: '', over: 'Итоги сезона', soon: '' }[S.phase] || '';
  const st = G.streak;
  h += '<section class="pass-hero glare">' + pmgLevelRing(L.level, L.need ? L.into / L.need : 1, 116, L.stars) +
    '<div class="ph-main"><div class="ph-season"><span class="ph-name">Сезон «' + pmgEsc(S.name) + '»</span>' +
    (S.phase !== 'over' && S.phase !== 'soon' ? '<span class="muted"> · ' + (G.daysLeft === 0 ? 'последний день' : 'осталось ' + G.daysLeft + ' ' + pmgPlural(G.daysLeft, ['день', 'дня', 'дней'])) + '</span>' : '') + '</div>' +
    '<div class="ph-xp"><b data-count-int="' + Math.round(G.xp) + '">' + pmgFmtXp(G.xp) + '</b> XP' +
    (L.level < 50 ? '<span class="muted"> · до ' + (L.level + 1) + '-го уровня ' + pmgFmtXp(L.need - L.into) + '</span>' : '<span class="muted"> · до звезды ' + pmgFmtXp(L.need - L.into) + '</span>') + '</div>' +
    '<div class="xpbar"><i style="width:' + (L.need ? L.into / L.need * 100 : 100).toFixed(1) + '%"></i></div>' +
    '<div class="ph-chips">' +
    '<span class="chip flame-chip' + (st.todayCounted ? ' lit' : '') + '" data-tip="' + (st.todayCounted ? 'Сегодня огонёк горит' : 'Чтобы огонёк горел сегодня, хватит одного: открыть Gradient, отметить домашку, получить 4 или 5 или выполнить задание дня') + '. Выходные и болезнь огонёк не трогают; один пропущенный учебный день в неделю прощается сам' + (st.restLeft === false ? ' (на этой неделе уже использован)' : '') + '">' + pmgFlameSvg(st.days, 22) +
    '<b>' + st.days + '</b> ' + pmgPlural(st.days, ['день', 'дня', 'дней']) + (st.mult > 1 ? ' · ×' + String(st.mult).replace('.', ',') : '') + '</span>' +
    (st.freezes ? '<span class="chip" data-tip="Заморозка спасёт огонёк, если день не засчитан">' + pmgRewardIcon({ kind: 'freeze' }, 18) + ' ×' + st.freezes + '</span>' : '') +
    '<span class="chip">сегодня <b>+' + pmgFmtXp(G.todayXp) + '</b></span><span class="chip">неделя <b>' + pmgFmtXp(G.weekXp) + '</b></span>' +
    (phaseName ? '<span class="chip accent">' + phaseName + '</span>' : '') + '</div></div></section>';

  if (st.restoreOffer) h += '<section class="card restore"><b>Огонёк из ' + st.restoreOffer.value + ' дней погас.</b> Выполни все 3 задания дня сегодня — и серия вернётся. Так можно один раз за сезон.</section>';
  if (!prof.created) {
    h += '<section class="card start-cta"><div><b>Играй с друзьями</b><p class="muted">Очки уже считаются. Начни сезон, чтобы попасть в рейтинг группы.</p></div>' +
      '<button class="btn primary" data-act="tab" data-tab="friends">Начать</button></section>';
  }

  h += pmgTrack(G);
  h += pmgQuestsBlock(G);
  h += pmgMiniBoard();
  h += '<div class="two">' + pmgRecentBlock(G) + pmgBreakdownBlock(G) + '</div>';
  h += pmgAchBlock(G);
  h += pmgAlbumBlock(G);
  h += pmgSeasonsBlock(G);
  return '<div class="pass">' + h + '</div>';
}

function pmgShortIso(iso) { const d = pmgDateOf(iso); return d.getDate() + ' ' + PMG_MONTHS[d.getMonth()]; }

// Дорожка наград
function pmgTrack(G) {
  const L = G.level.level, sel = pmg.passNode || Math.min(50, L + (pmgRewardsAt(L + 1, G.season)[0].kind === 'sticker' ? 1 : 1));
  let nodes = '';
  for (let l = 1; l <= 50; l++) {
    const rw = pmgRewardsAt(l, G.season), big = rw[0].kind !== 'sticker';
    const main = rw.find((r) => r.kind === 'frame') || rw.find((r) => r.kind === 'aura') || rw[0];
    nodes += '<button class="tn' + (big ? ' big' : '') + (l <= L ? ' got' : '') + (l === L ? ' cur' : '') + (l === sel ? ' sel' : '') + '" data-act="pass-node" data-v="' + l + '" aria-label="Уровень ' + l + ': ' + pmgEsc(rw.map((r) => r.name).join(', ')) + '">' +
      '<span class="tn-ic">' + pmgRewardIcon(main, big ? 34 : 24) + '</span><span class="tn-l">' + l + '</span></button>';
  }
  const fill = Math.max(0, (L - 1) / 49 * 100);
  return '<section class="card track-card"><div class="card-head"><h3>Награды сезона</h3><span class="muted">' + L + ' из 50 · всё бесплатно и только для красоты</span></div>' +
    '<div class="track-scroll"><div class="track" style="--fill:' + fill.toFixed(2) + '%">' + nodes + '</div></div>' + pmgNodePreview(G, sel) + '</section>';
}

function pmgNodePreview(G, l) {
  const rw = pmgRewardsAt(l, G.season), got = l <= G.level.level, eq = pmgEquipped();
  const equipable = { frame: 1, title: 1, theme: 1, aura: 1, skin: 1, bgpack: 1, avatar: 1 };
  return '<div class="node-prev' + (got ? ' got' : '') + '"><div class="np-lv">' + (got ? 'Получено' : 'Уровень ' + l) + '</div><ul>' +
    rw.map((r) => {
      const on = r.kind === 'avatar' ? pmgProfile().avatar === r.id : eq[r.kind] === r.id;
      return '<li><span class="np-ic">' + pmgRewardIcon(r, 40) + '</span><span class="np-t">' + pmgEsc(r.name) + '<small>' + pmgRewardHint(r) + '</small></span>' +
        (got && equipable[r.kind] ? '<button class="btn small' + (on ? ' on' : '') + '" data-act="equip" data-kind="' + r.kind + '" data-v="' + (on ? '' : r.id) + '">' + (on ? 'Надето' : 'Надеть') + '</button>' : '') + '</li>';
    }).join('') + '</ul></div>';
}

function pmgRewardHint(r) {
  return ({ frame: 'обводка аватара в рейтинге и на стене группы', title: 'подпись под ником', theme: 'цвет акцента Gradient', bgpack: 'значки фона панели', skin: 'вид твоей карточки в группе',
    reaction: 'новая реакция для ленты', freeze: 'спасает огонёк в пропущенный день', aura: 'свечение вокруг твоего стикера', badge: 'остаётся на полке навсегда',
    avatar: 'аватар-стикер', anim: 'эффект при новом уровне', sticker: 'в альбом сезона' })[r.kind] || '';
}

// Задания
function pmgQuestsBlock(G) {
  const tab = pmg.questTab || 'day';
  const S = G.season, warm = S.phase === 'warmup', mult = G.streak.mult;
  let body = '';
  if (tab === 'day') {
    const list = G.quests.today;
    if (!G.quests.schoolToday || !list) body = '<p class="muted">Сегодня не учебный день — задания дня появятся в следующий учебный день.</p>';
    else body = list.map((q, i) => pmgQuestRow(q, Math.round(q.xp * (warm ? 1.25 : 1) * mult), ['study', 'hw', 'easy'][i], !G.quests.rerolled && !q.done)).join('') +
      '<p class="muted small">Невыполненные задания сгорают в полночь без штрафа. Одно задание в день можно заменить.</p>';
  } else {
    const list = G.quests.week;
    body = list ? list.map((q) => pmgQuestRow(q, q.xp, null, false)).join('') : '<p class="muted">Задания недели появятся в понедельник.</p>';
  }
  const doneN = (G.quests.today || []).filter((q) => q.done).length;
  return '<section class="card quests"><div class="card-head"><h3>Задания</h3><div class="seg-ctl mini">' +
    '<button class="' + (tab === 'day' ? 'on' : '') + '" data-act="qtab" data-v="day">Дня ' + doneN + '/3</button>' +
    '<button class="' + (tab === 'week' ? 'on' : '') + '" data-act="qtab" data-v="week">Недели</button></div></div>' + body + '</section>';
}

function pmgQuestRow(q, xp, group, canReroll) {
  const p = q.goal ? Math.min(1, q.progress / q.goal) : 0;
  const label = q.id === 'w_raise' ? (q.progress / 100).toFixed(2).replace('.', ',') + ' из 0,15' : q.goal > 1 ? q.progress + ' из ' + q.goal : '';
  return '<div class="quest' + (q.done ? ' done' : '') + '" data-q="' + q.id + '"><span class="q-check">' + (q.done ? PMG_TICK : '') + '</span>' +
    '<div class="q-main"><div class="q-txt">' + pmgEsc(q.text) + (q.note ? '<small>' + pmgEsc(q.note) + '</small>' : '') + '</div>' +
    '<div class="q-bar"><i style="width:' + (p * 100).toFixed(0) + '%"></i></div>' + (label ? '<small class="q-prog">' + label + '</small>' : '') + '</div>' +
    '<span class="q-xp">+' + xp + '</span>' +
    (canReroll ? '<button class="icon-btn small" data-act="reroll" data-v="' + group + '" data-tip="Заменить задание (раз в день)" aria-label="Заменить задание">' + pmgIcon('refresh') + '</button>' : '') + '</div>';
}

function pmgMiniBoard() {
  const gid = pmgCurGroup();
  if (!gid) return '';
  const b = pmg.boards && pmg.boards[gid];
  if (!b || !b.board || !b.board.players) return '';
  const pl = b.board.players.slice(0, 5);
  const me = b.board.players.find((p) => p.me);
  const goal = b.goal && b.goal.ok ? b.goal : null;
  return '<section class="card mini-board"><div class="card-head"><h3>Неделя в группе</h3><button class="link" data-act="tab" data-tab="friends">Арена и лента</button></div><ol class="mb-list">' +
    pl.map((p, i) => '<li class="' + (p.me ? 'me' : '') + '"><span class="mb-pos">' + (i + 1) + '</span>' + pmgAvatar(p, 28) + '<span class="mb-nick">' + pmgEsc(p.nick) + '</span><b>' + pmgFmtXp(p.week_xp) + '</b></li>').join('') +
    (me && !pl.includes(me) ? '<li class="me"><span class="mb-pos">' + (b.board.players.indexOf(me) + 1) + '</span>' + pmgAvatar(me, 28) + '<span class="mb-nick">' + pmgEsc(me.nick) + '</span><b>' + pmgFmtXp(me.week_xp) + '</b></li>' : '') + '</ol>' +
    (goal ? pmgGoalBar(goal, b.board.players) : '') + '</section>';
}

function pmgRecentBlock(G) {
  const list = G.recent.slice(0, 12);
  return '<section class="card recent"><div class="card-head"><h3>Последние очки</h3></div>' +
    (list.length ? '<ul class="xp-list">' + list.map((e) => '<li><span>' + pmgEsc(e.label) + '<small>' + pmgShortIso(e.day) + '</small></span><b>' + (e.xp ? '+' + e.xp : '0') + '</b></li>').join('') + '</ul>'
      : '<p class="muted">Очков пока нет. Они придут за оценки, домашку, задания и огонёк.</p>') + '</section>';
}

function pmgBreakdownBlock(G) {
  const rows = Object.entries(G.byKind).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  return '<section class="card breakdown"><div class="card-head"><h3>Откуда очки</h3></div>' +
    (rows.length ? '<ul class="bd-list">' + rows.map(([k, v], i) => '<li style="--i:' + i + '"><span>' + (PMG_KIND_NAMES[k] || k) + '</span><span class="bd-bar"><i style="width:' + (v / max * 100).toFixed(1) + '%"></i></span><b>' + pmgFmtXp(v) + '</b></li>').join('') + '</ul>' : '<p class="muted">Пока пусто.</p>') +
    '<p class="muted small">Пятёрок за сезон: ' + G.stats.fives + ' · лучший огонёк: ' + G.stats.bestStreak + '</p></section>';
}

function pmgAchBlock(G) {
  const have = new Set((pmg.game && pmg.game.achAll) || G.achievements);
  return '<section class="card ach-card"><div class="card-head"><h3>Достижения</h3><span class="muted">' + PMG_ACHIEVEMENTS.filter((a) => have.has(a.code)).length + ' из ' + PMG_ACHIEVEMENTS.length + ' · остаются навсегда</span></div><div class="ach-grid">' +
    PMG_ACHIEVEMENTS.map((a) => {
      const got = have.has(a.code), hidden = a.secret && !got;
      return '<div class="ach' + (got ? ' got' : '') + ' r-' + a.rarity + '" data-tip="' + pmgEsc(hidden ? 'Секретное достижение' : a.desc) + ' · ' + PMG_ACH_XP[a.rarity] + ' XP">' + pmgMedalSvg(a, 44, !got) +
        '<span>' + pmgEsc(hidden ? '???' : a.name) + '</span></div>';
    }).join('') + '</div></section>';
}

function pmgAlbumBlock(G) {
  const names = PMG_STICKERS[G.season.theme] || PMG_STICKERS.sticker;
  const n = PMG_STICKER_LEVELS.filter((l) => l <= G.level.level).length;
  return '<section class="card album"><div class="card-head"><h3>Альбом «' + pmgEsc(G.season.album || G.season.name) + '»</h3><span class="muted">' + n + ' из ' + PMG_STICKER_LEVELS.length + '</span></div><div class="album-grid">' +
    PMG_STICKER_LEVELS.map((l, i) => {
      const got = l <= G.level.level;
      return '<div class="slot' + (got ? ' got' : '') + '" style="--i:' + i + '" data-tip="' + pmgEsc((got ? names[i] : '???') + ' · уровень ' + l) + '">' + (got ? pmgStickerSvg(i, G.season.theme, 52) : '<span class="slot-l">' + l + '</span>') + '</div>';
    }).join('') + '</div></section>';
}

function pmgSeasonsBlock(G) {
  const list = PMG_SEASONS.filter((s) => !s.test);
  return '<section class="card seasons"><div class="card-head"><h3>Сезоны года</h3></div><div class="season-row">' +
    list.map((s) => {
      const cur = s.id === G.season.id, past = s.ends < pmgIso(new Date());
      return '<div class="season-card th-' + s.theme + (cur ? ' cur' : '') + (past ? ' past' : '') + '"><div class="sc-art">' + pmgSeasonBadge('b50', s.theme, 44) + '</div>' +
        '<b>' + pmgEsc(s.name) + '</b><small>' + pmgShortIso(s.starts) + ' — ' + pmgShortIso(s.ends) + '</small><small>аура 50-го уровня: «' + pmgEsc(s.aura) + '»</small></div>';
    }).join('') + '</div></section>';
}

// ---------- Вкладка «Друзья» ----------
function pmgCurGroup() {
  const gs = pmg.groups || [];
  if (!gs.length) return null;
  if (!pmg.gid || !gs.some((g) => g.id === pmg.gid)) pmg.gid = gs[0].id;
  return pmg.gid;
}

function pmgFriendsView() {
  const prof = pmgProfile();
  if (!prof.created) return pmgStartView();
  const gs = pmg.groups || [];
  if (pmg.joinFlow || !gs.length) return pmgJoinView();
  const gid = pmgCurGroup(), g = gs.find((x) => x.id === gid);
  const live = pmg.groupData && pmg.groupData.gid === gid ? pmg.groupData : null;
  const cached = pmg.boards && pmg.boards[gid];
  const data = live || cached;
  if (!live && !pmg.groupLoading) pmgLoadGroup(gid);
  let h = '<div class="friends">';
  h += '<div class="grp-bar">' + gs.map((x) => '<button class="grp-chip' + (x.id === gid ? ' on' : '') + '" data-act="grp" data-v="' + x.id + '">' + pmgEsc(x.name) + '<small>' + x.members + '</small></button>').join('') +
    (gs.length < 3 ? '<button class="grp-chip add" data-act="join-open" aria-label="Ещё группа">+</button>' : '') + '</div>';
  h += '<section class="grp-head card"><div><h2>' + pmgEsc(g.name) + '</h2><span class="muted">' + g.members + ' ' + pmgPlural(g.members, ['участник', 'участника', 'участников']) + ' · ' + ({ owner: 'ты создатель', helper: 'ты помощник', member: 'ты участник' })[g.role] + '</span></div>' +
    (g.code ? '<div class="code-box"><span class="muted">Код приглашения</span><button class="code" data-act="copy-code" data-v="' + g.code + '" data-tip="Скопировать">' + g.code + '</button></div>' : '') + '</section>';
  if (!data) return h + '<section class="card"><div class="loader"><span></span><span></span><span></span></div><p class="muted">Загружаю группу…</p></section></div>';
  if (pmg.groupError) h += '<p class="err">' + pmgEsc(pmg.groupError) + '</p>';
  // Свою фигурку и фото показываем сразу, не дожидаясь сервера
  const players = ((data.board && data.board.players) || []).map((p) => p.me ? { ...p, equipped: { ...(p.equipped || {}), ...pmgEquipped() }, photoUrl: pmgProfile().photoLocal || p.photoUrl } : p);
  h += pmgArena(players, data);
  h += pmgPlayerCard(players);
  const fv = pmg.friendsView && pmg.friendsView !== 'me' ? pmg.friendsView : 'board';
  h += '<nav class="seg-ctl sub-tabs">' + [['board', 'Рейтинг'], ['feed', 'Лента'], ['members', 'Участники']].map(([k, l]) => '<button class="' + (fv === k ? 'on' : '') + '" data-act="fview" data-v="' + k + '">' + l + '</button>').join('') +
    '<button data-act="tab" data-tab="profile">Мой профиль →</button></nav>';
  if (fv === 'board') h += pmgBoardBlock(players, data);
  if (fv === 'feed') h += pmgFeedBlock(data);
  if (fv === 'members') h += pmgMembersBlock(players, g);
  return h + '</div>';
}

function pmgStartView() {
  const first = pmg.data && pmg.data.student && pmg.data.student.name ? pmg.data.student.name.split(/\s+/)[0] : '';
  return '<section class="card onboard"><div class="ob-art">' + pmgAvatarSvg('planet-1', 72) + pmgAvatarSvg('planet-6', 56) + pmgAvatarSvg('planet-16', 64) + '</div>' +
    '<h2 class="y2k-chrome">Gradient Pass</h2><p class="ob-season"><span class="y2k-tape">сезон «' + pmgEsc((pmgGV() && pmgGV().season.name) || 'Стикербомб') + '»</span></p><p>Стена стикеров группы, рейтинг недели, лента достижений и цель на всю группу. Друзья видят твой уровень, очки и достижения — <b>но не оценки</b>.</p>' +
    '<ul class="ob-points"><li>Никаких паролей: вход создаётся сам, анонимно.</li><li>На сервер уходят только очки — без предметов, оценок, домашки и ФИО.</li><li>Удалить все свои данные можно одной кнопкой.</li></ul>' +
    '<label class="field"><span>Твой ник в группе</span><input class="in" data-act="nick-in" maxlength="16" placeholder="от 3 до 16 символов" value="' + pmgEsc(pmg.nickDraft != null ? pmg.nickDraft : first) + '"></label>' +
    (pmg.obError ? '<p class="err">' + pmgEsc(pmg.obError) + '</p>' : '') +
    '<button class="btn primary big" data-act="start-season"' + (pmg.busy ? ' disabled' : '') + '>' + (pmg.busy ? 'Создаю профиль…' : 'Начать сезон') + '</button></section>';
}

function pmgJoinView() {
  const j = pmg.join || (pmg.join = { step: 'choose' });
  const back = (pmg.groups || []).length ? '<button class="link" data-act="join-cancel">← К своей группе</button>' : '';
  if (j.step === 'choose') {
    return '<div class="friends">' + back + '<div class="two"><section class="card join-card"><h3>Вступить по коду</h3><p class="muted">Код выглядит так: KOT-482. Его даёт создатель группы.</p>' +
      '<input class="in code-in" data-act="code-in" maxlength="7" placeholder="ABC-123" value="' + pmgEsc(j.code || '') + '">' +
      '<button class="btn primary" data-act="peek"' + (pmg.busy ? ' disabled' : '') + '>Найти группу</button></section>' +
      '<section class="card join-card"><h3>Создать группу</h3><p class="muted">Получишь код и разошлёшь его друзьям. До 30 человек.</p>' +
      '<input class="in" data-act="gname-in" maxlength="40" placeholder="Например, Космонавты 8Б" value="' + pmgEsc(j.name || '') + '">' +
      '<button class="btn" data-act="create-group"' + (pmg.busy ? ' disabled' : '') + '>Создать</button></section></div>' +
      (j.error ? '<p class="err">' + pmgEsc(j.error) + '</p>' : '') + '</div>';
  }
  // Шаг: группа найдена → лицо и галочки
  const pk = j.peek, prof = pmgProfile(), priv = j.privacy || (j.privacy = pmgPrivacyOf(prof));
  return '<div class="friends">' + '<button class="link" data-act="join-back">← Другой код</button>' +
    '<section class="card join-found"><div class="jf-head"><span class="jf-ic">' + pmgAvatarSvg('planet-9', 48) + '</span><div><h3>' + pmgEsc(pk.name) + '</h3>' +
    '<span class="muted">создатель ' + pmgEsc(pk.owner_nick || '—') + ' · ' + pk.members + ' ' + pmgPlural(pk.members, ['участник', 'участника', 'участников']) + '</span></div></div></section>' +
    '<section class="card"><h3>Что увидят друзья</h3><div class="priv-list">' + pmgPrivacyRows(priv, 'jpriv') + '</div>' +
    '<p class="muted small">Отдельные оценки, пропуски, замечания и домашку не видит никто и никогда. Это, фото и фигурку можно поменять потом во вкладке «Профиль».</p></section>' +
    (j.error ? '<p class="err">' + pmgEsc(j.error) + '</p>' : '') +
    '<button class="btn primary big" data-act="join"' + (pmg.busy ? ' disabled' : '') + '>' + (pmg.busy ? 'Вступаю…' : 'Вступить') + '</button></div>';
}

function pmgPrivacyRows(priv, act) {
  return PMG_PRIVACY.map(([k, l, note, fixed]) => '<label class="priv' + (fixed ? ' fixed' : '') + '"><input type="checkbox" data-act="' + act + '" data-k="' + k + '"' + (fixed || priv[k] ? ' checked' : '') + (fixed ? ' disabled' : '') + '><span class="sw"></span><span class="pv-t">' + l + (note ? '<small>' + note + '</small>' : '') + '</span></label>').join('');
}

// ---------- Лесенка группы: фигурки с фото вместо головы стоят на ступеньках по месту ----------
const PMG_PENS = { ink: ['#17141F', 'Чёрная ручка'], blue: ['#2F4BFF', 'Синяя ручка'], pink: ['#FF2E93', 'Розовая гелевая'], violet: ['#7A3BF0', 'Фиолетовая'], green: ['#0B9B6A', 'Зелёная'], orange: ['#F26A1B', 'Оранжевый маркер'], teal: ['#0891B2', 'Бирюзовая'], red: ['#E11D48', 'Красная, как у учителя'] };
const PMG_FIG_POOL = ['walk', 'cross', 'easy', 'point', 'polka', 'rest', 'shirt', 'blazer', 'walk2', 'cross2', 'point2', 'rest2', 'dance2', 'blazer2'];
function pmgFigOf(p, lead) {
  const eq = p.equipped || {};
  if (eq.body && PMG_FIGS[eq.body]) return eq.body;
  if (lead) return 'dance';
  return PMG_FIG_POOL[(pmgHash(String(p.id || p.nick)) >>> 0) % PMG_FIG_POOL.length];
}
function pmgPenOf(p) {
  const eq = p.equipped || {};
  if (eq.pen && PMG_PENS[eq.pen]) return PMG_PENS[eq.pen][0];
  const keys = Object.keys(PMG_PENS);
  return PMG_PENS[keys[(pmgHash(String(p.id || p.nick)) >>> 3) % keys.length]][0];
}
// Фигурка с головой-фото. h — высота в пикселях.
function pmgFigure(p, h, opts) {
  opts = opts || {};
  const id = opts.fig || pmgFigOf(p, opts.lead), f = PMG_FIGS[id] || PMG_FIGS.walk;
  const [x0, y0, w0, h0] = f.vb, k = h / h0, w = Math.round(w0 * k);
  const H = PMG_FIG_HEAD, hs = Math.round(H.r * 2 * k);
  const hx = ((H.cx - x0) / w0 * 100).toFixed(2), hy = ((H.cy - y0) / h0 * 100).toFixed(2);
  return '<span class="fig" style="--fw:' + w + 'px;--fh:' + h + 'px;color:' + (opts.pen || pmgPenOf(p)) + '">' +
    '<svg class="fig-body" viewBox="' + f.vb.join(' ') + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + f.g + '</svg>' +
    '<span class="fig-head" style="left:' + hx + '%;top:' + hy + '%">' + pmgAvatar(p, hs) + '</span></span>';
}

// rows: [{ p, v, label, sleep }] — по убыванию; рисуем слева направо снизу вверх, лидер справа на самой высокой ступеньке.
function pmgStairs(rows, o) {
  o = o || {};
  const n = rows.length;
  if (!n) return '';
  const rise = n > 1 ? Math.min(26, Math.max(10, 150 / (n - 1))) : 0;
  const base = 66, top = base + rise * (n - 1);
  const theme = (pmgGV() && pmgGV().season.theme) || 'sticker';
  const lead = rows[0] && !rows[0].sleep && rows[0].v > 0 ? rows[0].p.id : null;
  const fresh = o.animate ? ' hop' : '';
  let cols = '';
  rows.slice().reverse().forEach((r, ri) => {
    const place = n - ri, p = r.p, isLead = p.id === lead;
    const hgt = r.sleep ? base : base + rise * (n - place);
    const pl = r.sleep ? 'zz' : place;
    cols += '<button class="st-col' + (p.me ? ' me' : '') + (r.sleep ? ' sleep' : '') + (isLead ? ' lead' : '') + (o.sel === p.id ? ' sel' : '') + (place <= 3 && !r.sleep ? ' p' + place : '') +
      '" style="--i:' + ri + ';--bh:' + Math.round(hgt) + 'px" data-act="' + (o.act || 'pl') + '" data-v="' + pmgEsc(p.id) + '" aria-label="' + pmgEsc(p.nick) + ', ' + (r.sleep ? 'давно не заходил' : place + '-е место') + (r.label ? ', ' + pmgEsc(r.label) : '') + '">' +
      '<span class="st-who">' + (isLead ? '<span class="st-crown">' + pmgReactionIcon('crown', 26) + '</span>' : '') +
      (p.me ? '<span class="st-me">ты</span>' : '') + (r.gain ? '<span class="st-gain">+' + pmgFmtXp(r.gain) + '</span>' : '') + (r.sleep ? '<span class="st-zz">z<i>z</i><b>z</b></span>' : '') +
      pmgFigure(p, o.figH || (pmg.mode === 'page' && typeof PMG_WEB === 'undefined' ? 136 : 116), { lead: isLead }) + '</span>' +
      '<span class="st-step"><b class="st-n">' + pl + '</b><span class="st-nick">' + pmgEsc(p.nick) + '</span>' + (r.label ? '<span class="st-v">' + pmgEsc(r.label) + '</span>' : '') + '</span></button>';
  });
  return '<div class="stairs th-' + theme + fresh + '" style="--n:' + n + ';--top:' + Math.round(top) + 'px"><div class="st-scroll" data-stairs="' + pmgEsc(o.key || '') + '"><div class="st-row">' + cols + '</div></div></div>';
}
// После отрисовки: прокрутить лесенку так, чтобы было видно себя (или вернуть прокрутку, которую человек выбрал сам)
function pmgStairsAfter(root) {
  (root || document).querySelectorAll('.st-scroll').forEach((el) => {
    const key = el.dataset.stairs || '';
    pmg.stairsScroll = pmg.stairsScroll || {};
    if (pmg.stairsScroll[key] != null) el.scrollLeft = pmg.stairsScroll[key];
    else { const me = el.querySelector('.st-col.me') || el.querySelector('.st-col.lead'); if (me) el.scrollLeft = me.offsetLeft - el.clientWidth / 2 + me.offsetWidth / 2; }
    el.addEventListener('scroll', () => { pmg.stairsScroll[key] = el.scrollLeft; }, { passive: true });
  });
}

// Группа в расширении: лесенка по XP недели (после сезона — по XP за сезон)
function pmgArena(players, data) {
  const over = pmgGV() && pmgGV().season.phase === 'over';
  const key = over ? 'xp' : 'week_xp';
  const now = Date.now();
  const prev = pmg.boards && pmg.boards[data.gid] && pmg.boards[data.gid].prevWeek;
  const awake = players.filter((p) => now - new Date(p.last_seen).getTime() < 14 * 864e5 || p.me);
  const rows = awake.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).map((p) => ({ p, v: p[key] || 0, label: pmgFmtXp(p[key] || 0) + ' XP',
    gain: prev && prev[p.id] != null && p.week_xp > prev[p.id] ? p.week_xp - prev[p.id] : 0 }));
  players.filter((p) => !awake.includes(p)).forEach((p) => rows.push({ p, v: 0, label: 'спит', sleep: true }));
  const animate = pmg.stairsSeen !== data.gid;
  pmg.stairsSeen = data.gid;
  return '<section class="arena-wrap card stairs-card"><div class="card-head"><h3>' + (over ? 'Итоги сезона' : 'Лесенка недели') + '</h3><span class="muted small">нажми на фигурку</span></div>' +
    pmgStairs(rows, { sel: pmg.arenaSel, key: 'g:' + data.gid, animate }) +
    '<p class="muted small arena-note">' + (over ? 'Места — по XP за весь сезон.' : 'Чем больше XP с понедельника, тем выше ступенька. В понедельник все снова внизу.') + '</p></section>';
}

function pmgPlayerCard(players) {
  const p = players.find((x) => x.id === pmg.arenaSel);
  if (!p) return '';
  const eq = p.equipped || {};
  const title = eq.title && eq.title !== 'none' ? PMG_TITLE_NAMES[eq.title] : '';
  const ach = (p.achievements || []).slice(0, 3).map((c) => PMG_ACHIEVEMENTS.find((a) => a.code === c)).filter(Boolean);
  const top = players.slice().sort((a, b) => (b.week_xp || 0) - (a.week_xp || 0))[0];
  return '<section class="card player-card skin-' + pmgEsc(eq.skin || 'default') + '"><div class="pc-head"><span class="pc-fig">' + pmgFigure(p, 96, { lead: top === p && (p.week_xp || 0) > 0 }) + '</span><div><b>' + pmgEsc(p.nick) + '</b>' + (title ? '<small class="title">' + pmgEsc(title) + '</small>' : '') +
    '<small class="muted">уровень ' + p.level + (p.stars ? ' · ★ ' + p.stars : '') + ' · ' + pmgFmtXp(p.week_xp) + ' XP за неделю · огонёк ' + p.streak + '</small></div>' +
    '<button class="icon-btn" data-act="pl" data-v="" aria-label="Закрыть">' + pmgIcon('close') + '</button></div>' +
    (ach.length ? '<div class="pc-ach">' + ach.map((a) => '<span data-tip="' + pmgEsc(a.desc) + '">' + pmgMedalSvg(a, 30) + pmgEsc(a.name) + '</span>').join('') + '</div>' : '') +
    (p.avg != null || p.finals ? '<div class="pc-stats">' + (p.avg != null ? '<span>средний <b>' + pmgFmtAvg(p.avg) + '</b></span>' : '') + (p.finals ? '<span>прогноз: ' + [5, 4, 3].map((k) => '<span class="mark ' + pmgMarkClass(k) + '">' + k + '</span>×' + (p.finals[k] || 0)).join(' ') + '</span>' : '') + '</div>' : '') +
    (!p.me ? '<div class="pc-actions">' + (p.cheer ? '<button class="btn small" data-act="cheer" data-v="' + p.id + '">Подбодрить</button>' : '') + '</div>' : '') + '</section>';
}

function pmgBoardBlock(players, data) {
  const mode = pmg.boardMode || 'week';
  const key = mode === 'week' ? 'week_xp' : 'xp';
  const list = players.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const goal = data.goal && data.goal.ok ? data.goal : null;
  return '<section class="card board"><div class="card-head"><h3>Рейтинг</h3><div class="seg-ctl mini">' +
    [['week', 'Неделя'], ['season', 'Сезон']].map(([k, l]) => '<button class="' + (mode === k ? 'on' : '') + '" data-act="bmode" data-v="' + k + '">' + l + '</button>').join('') + '</div></div>' +
    '<ol class="board-list">' + list.map((p, i) => {
      const eq = p.equipped || {};
      return '<li class="' + (p.me ? 'me' : '') + '" style="--i:' + i + '"><span class="bl-pos' + (i < 3 && (p[key] || 0) > 0 ? ' top' + (i + 1) : '') + '">' + (i + 1) + '</span>' + pmgAvatar(p, 36) +
        '<span class="bl-name"><b>' + pmgEsc(p.nick) + '</b><small>' + (eq.title && eq.title !== 'none' ? pmgEsc(PMG_TITLE_NAMES[eq.title]) + ' · ' : '') + 'ур. ' + p.level + (p.streak ? ' · ' + pmgFlameSvg(p.streak, 13) + p.streak : '') + '</small></span>' +
        '<b class="bl-xp">' + pmgFmtXp(p[key]) + '</b></li>';
    }).join('') + '</ol>' + (mode === 'week' ? '<p class="muted small">Неделя обнуляется в понедельник в 00:00. Трое лучших недели получают кубок.</p>' : '') +
    (goal ? pmgGoalBar(goal, players) : '') + '</section>';
}

function pmgGoalBar(goal, players) {
  const total = Math.max(1, goal.target), prog = goal.progress || 0;
  const by = goal.by_member || {};
  const segs = players.filter((p) => by[p.id]).map((p, i) => '<i style="width:' + Math.min(100, by[p.id] / total * 100).toFixed(2) + '%;--h:' + (230 + i * 37) % 360 + '" data-tip="' + pmgEsc(p.nick) + ': ' + pmgFmtXp(by[p.id]) + ' XP"></i>').join('');
  const done = prog >= total;
  return '<div class="goal' + (done ? ' done' : '') + '"><div class="goal-head"><b>Общая цель недели</b><span>' + pmgFmtXp(prog) + ' / ' + pmgFmtXp(total) + ' XP</span></div><div class="goal-bar">' + segs + '</div>' +
    '<p class="muted small">' + (done ? 'Цель выполнена! Каждый, кто набрал от 500 XP за неделю, получит 300 XP.' : 'Наберите вместе — каждому, кто сам набрал от 500 XP, достанется по 300 XP.') + '</p></div>';
}

function pmgFeedText(f) {
  const n = '<b>' + pmgEsc(f.nick) + '</b>', p = f.payload || {};
  if (f.kind === 'joined') return n + ' теперь в группе';
  if (f.kind === 'level') return n + ' · уровень ' + p.level;
  if (f.kind === 'stars') return n + ' · ' + p.stars + ' ★ после 50-го уровня';
  if (f.kind === 'streak') return n + ' · огонёк ' + p.days + ' ' + pmgPlural(p.days, ['день', 'дня', 'дней']) + ' подряд';
  if (f.kind === 'achievement') { const a = PMG_ACHIEVEMENTS.find((x) => x.code === p.code); return n + ' · достижение «' + pmgEsc(a ? a.name : p.code) + '»'; }
  return n + ' · ' + pmgEsc(f.kind);
}

function pmgFeedBlock(data) {
  const feed = data.feed || [];
  const unlocked = pmgUnlocked(pmgGV() ? pmgGV().level.level : 1).reaction;
  return '<section class="card feed"><div class="card-head"><h3>Лента</h3><span class="muted">только события игры, оценок здесь нет</span></div>' +
    (feed.length ? '<ul class="feed-list">' + feed.map((f, i) => {
      const a = f.kind === 'achievement' ? PMG_ACHIEVEMENTS.find((x) => x.code === (f.payload || {}).code) : null;
      const ic = a ? pmgMedalSvg(a, 32) : f.kind === 'streak' ? pmgFlameSvg((f.payload || {}).days || 7, 28) : f.kind === 'level' ? pmgRewardIcon({ kind: 'anim' }, 30) : pmgAvatarSvg('planet-' + (1 + (pmgHash(f.nick) % 24)), 30);
      const rx = f.reactions || {};
      return '<li style="--i:' + i + '"><span class="fd-ic">' + ic + '</span><div class="fd-main"><span>' + pmgFeedText(f) + '</span><small class="muted">' + pmgAgo(f.created_at) + '</small>' +
        '<div class="reacts">' + unlocked.map((k) => '<button class="react' + (f.my_reaction === k ? ' on' : '') + '" data-act="react" data-feed="' + f.id + '" data-v="' + (f.my_reaction === k ? '' : k) + '" data-tip="' + PMG_REACTIONS[k] + '">' + pmgReactionIcon(k, 16) + (rx[k] ? '<span>' + rx[k] + '</span>' : '') + '</button>').join('') + '</div></div></li>';
    }).join('') + '</ul>' : '<p class="muted">Здесь появятся уровни, достижения и огоньки друзей.</p>') + '</section>';
}

function pmgMembersBlock(players, g) {
  const list = players.slice().sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
  const owner = g.role === 'owner', helper = g.role === 'helper';
  const now = Date.now();
  let h = '<section class="card members"><div class="card-head"><h3>Участники</h3><span class="muted">в порядке вступления</span></div><ul class="mem-list">';
  list.forEach((p) => {
    const sleep = now - new Date(p.last_seen).getTime() > 14 * 864e5;
    const role = { owner: 'создатель', helper: 'помощник', member: 'участник' }[p.role];
    h += '<li class="' + (sleep ? 'sleep' : '') + (p.me ? ' me' : '') + '">' + pmgAvatar(p, 36) + '<span class="mem-name"><b>' + pmgEsc(p.nick) + '</b><small>' + role + ' · в группе с ' + new Date(p.joined_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + '</small></span>' +
      '<span class="mem-lv">ур. ' + p.level + (p.stars ? ' ★' + p.stars : '') + '</span><span class="mem-fl">' + pmgFlameSvg(p.streak, 14) + p.streak + '</span><span class="mem-seen">' + (sleep ? 'спит' : pmgAgo(p.last_seen)) + '</span>';
    if ((owner || helper) && !p.me && p.role !== 'owner') {
      const acts = [];
      if (owner) acts.push(p.role === 'helper' ? ['member', 'Снять помощника'] : ['helper', 'Сделать помощником']);
      acts.push(['hide_photo', 'Скрыть фото']);
      if (owner) acts.push(['reset_season', 'Обнулить сезон'], ['owner', 'Передать роль создателя'], ['kick', 'Убрать из группы']);
      h += '<details class="mem-menu"><summary aria-label="Действия">⋯</summary><div>' + acts.map(([a, l]) => {
        const key = a + ':' + p.id, armed = pmg.confirm === key;
        return '<button class="' + (armed ? 'danger' : '') + '" data-act="admin" data-v="' + a + '" data-target="' + p.id + '">' + (armed ? 'Точно? Нажми ещё раз' : l) + '</button>';
      }).join('') + '</div></details>';
    }
    h += '</li>';
  });
  h += '</ul>';
  if (owner) {
    h += '<div class="owner-tools"><button class="btn small" data-act="admin" data-v="regen_code">Новый код</button>' +
      '<button class="btn small" data-act="admin" data-v="' + (g.join_open ? 'close' : 'open') + '">' + (g.join_open ? 'Закрыть вступление' : 'Открыть вступление') + '</button>' +
      '<button class="btn small" data-act="rename-open">Переименовать</button>' +
      '<button class="btn small' + (pmg.confirm === 'delete:' + g.id ? ' danger' : '') + '" data-act="admin" data-v="delete">' + (pmg.confirm === 'delete:' + g.id ? 'Удалить группу? Нажми ещё раз' : 'Удалить группу') + '</button></div>' +
      (pmg.renaming ? '<div class="rename"><input class="in" data-act="rename-in" maxlength="40" value="' + pmgEsc(g.name) + '"><button class="btn small primary" data-act="rename-save">Сохранить</button></div>' : '');
  }
  if (helper) h += '<div class="owner-tools"><button class="btn small" data-act="admin" data-v="regen_code">Новый код</button></div>';
  h += '<div class="owner-tools"><button class="btn small' + (pmg.confirm === 'leave:' + g.id ? ' danger' : '') + '" data-act="leave">' + (pmg.confirm === 'leave:' + g.id ? 'Выйти? Нажми ещё раз' : 'Выйти из группы') + '</button></div>';
  return h + '</section>';
}

// ---------- Загрузка группы ----------
async function pmgLoadGroup(gid) {
  pmg.groupLoading = true;
  const r = await pmgGameMsg('group', { gid });
  pmg.groupLoading = false;
  if (r && r.ok) { pmg.groupData = r.data; pmg.groupError = null; }
  else pmg.groupError = pmgErrText((r && r.error) || 'network');
  if (pmg.tab === 'friends' || pmg.tab === 'pass') pmgRender(true, true);
}

let pmgPollTimer = null;
function pmgPassPoll() {
  clearInterval(pmgPollTimer);
  pmgPollTimer = setInterval(() => {
    if (!(pmg.open || pmg.mode === 'page') || document.hidden) return;
    if (pmg.tab === 'friends' && pmgCurGroup() && !pmg.groupLoading && !pmg.crop) pmgLoadGroup(pmgCurGroup());
  }, 60000);
}

// ---------- Действия ----------
async function pmgSetProfile(p, local) {
  pmg.profile = { ...pmgProfile(), ...local };
  await pmgStorageSet({ pmg_profile: pmg.profile });
  if (pmgProfile().created && p) {
    const r = await pmgGameMsg('profile', { p, local: {} });
    if (!r.ok) pmg.groupError = pmgErrText(r.error);
  }
}

async function pmgPassAct(act, t) {
  const v = t.dataset.v;
  switch (act) {
    case 'pass-node': pmg.passNode = +v; pmgRender(true, true); return true;
    case 'qtab': pmg.questTab = v; pmgRender(true, true); return true;
    case 'reroll': { t.disabled = true; const r = await pmgGameMsg('reroll', { group: v }); if (!r.ok) t.disabled = false; return true; }
    case 'equip': {
      const kind = t.dataset.kind;
      if (kind === 'avatar') { await pmgSetProfile({ avatar: v || 'planet-1' }, { avatar: v || 'planet-1' }); pmgRender(true, true); return true; }
      const eq = { ...pmgEquipped(), [kind]: v || undefined };
      await pmgSetProfile({ equipped: eq }, { equipped: eq });
      pmgApplyTheme(); pmgRender(true, true); return true;
    }
    case 'start-season': {
      const inp = pmgQ('[data-act="nick-in"]'), nick = (inp ? inp.value : '').trim();
      if (nick.length < 3) { pmg.obError = 'Ник — от 3 до 16 символов.'; pmgRender(true, true); return true; }
      pmg.busy = true; pmg.obError = null; pmg.nickDraft = nick; pmgRender(true, true);
      const r = await pmgGameMsg('start', { nick });
      pmg.busy = false;
      if (!r.ok) pmg.obError = pmgErrText(r.error);
      else { pmg.profile = { ...pmgProfile(), nick, created: true }; pmg.join = { step: 'choose' }; }
      pmgRender(true, true); return true;
    }
    case 'join-open': pmg.joinFlow = true; pmg.join = { step: 'choose' }; pmgRender(true, true); return true;
    case 'join-cancel': pmg.joinFlow = false; pmgRender(true, true); return true;
    case 'join-back': pmg.join = { step: 'choose', code: pmg.join.code }; pmgRender(true, true); return true;
    case 'peek': {
      const code = ((pmgQ('[data-act="code-in"]') || {}).value || '').trim().toUpperCase();
      pmg.join.code = code;
      if (!/^[A-Z]{3}-?\d{3}$/.test(code)) { pmg.join.error = 'Код — три буквы и три цифры, например KOT-482.'; pmgRender(true, true); return true; }
      const norm = code.includes('-') ? code : code.slice(0, 3) + '-' + code.slice(3);
      pmg.busy = true; pmgRender(true, true);
      const r = await pmgGameMsg('peek', { code: norm });
      pmg.busy = false;
      if (r && r.ok) { pmg.join = { step: 'found', code: norm, peek: r }; if (!r.open) pmg.join.error = pmgErrText('closed'); }
      else pmg.join.error = pmgErrText((r && r.error) || 'network');
      pmgRender(true, true); return true;
    }
    case 'create-group': {
      const name = ((pmgQ('[data-act="gname-in"]') || {}).value || '').trim();
      pmg.join.name = name;
      if (name.length < 2) { pmg.join.error = 'Название — от 2 до 40 символов.'; pmgRender(true, true); return true; }
      pmg.busy = true; pmgRender(true, true);
      const r = await pmgGameMsg('create-group', { name });
      pmg.busy = false;
      if (r && r.ok) { pmg.joinFlow = false; pmg.join = null; pmg.gid = r.group.id; pmg.groupData = null; pmg.arrive = true; setTimeout(() => { pmg.arrive = false; }, 2000); }
      else pmg.join.error = pmgErrText((r && r.error) || 'network');
      pmgRender(true, true); return true;
    }
    case 'join': {
      pmg.busy = true; pmgRender(true, true);
      const r = await pmgGameMsg('join', { code: pmg.join.code, privacy: pmg.join.privacy });
      pmg.busy = false;
      if (r && r.ok) {
        pmg.profile = { ...pmgProfile(), privacy: { ...pmgProfile().privacy, ...pmg.join.privacy } };
        await pmgStorageSet({ pmg_profile: pmg.profile });
        pmg.joinFlow = false; pmg.gid = r.group.id; pmg.join = null; pmg.groupData = null; pmg.arrive = true;
        setTimeout(() => { pmg.arrive = false; }, 2000);
      } else pmg.join.error = pmgErrText((r && r.error) || 'network');
      pmgRender(true, true); return true;
    }
    case 'grp': pmg.gid = v; pmg.groupData = null; pmg.arenaSel = null; pmgRender(true, true); return true;
    case 'fview': pmg.friendsView = v; pmgRender(true, true); return true;
    case 'bmode': pmg.boardMode = v; pmgRender(true, true); return true;
    case 'pl': pmg.arenaSel = v || null; pmgRender(true, true); return true;
    case 'copy-code': {
      try { await navigator.clipboard.writeText(v); t.dataset.tip = 'Скопировано'; t.classList.add('copied'); setTimeout(() => t.classList.remove('copied'), 1200); } catch (_) { /* нет доступа к буферу */ }
      return true;
    }
    case 'cheer': {
      t.disabled = true;
      const r = await pmgGameMsg('cheer', { to: v });
      t.textContent = r && r.ok ? 'Отправлено' : pmgErrText((r && r.error) || 'network');
      return true;
    }
    case 'react': {
      const r = await pmgGameMsg('react', { feed: +t.dataset.feed, reaction: v });
      if (r && r.ok) pmgLoadGroup(pmgCurGroup());
      return true;
    }
    case 'admin': {
      const gid = pmgCurGroup(), target = t.dataset.target || null;
      const key = target ? v + ':' + target : v + ':' + gid;
      const needConfirm = ['kick', 'reset_season', 'owner', 'delete'].includes(v);
      if (needConfirm && pmg.confirm !== key) { pmg.confirm = key; pmgRender(true, true); return true; }
      pmg.confirm = null;
      const r = await pmgGameMsg('admin', { gid, action: v, target });
      if (!r || !r.ok) pmg.groupError = pmgErrText((r && r.error) || 'network'); else pmg.groupError = null;
      if (v === 'delete') { pmg.gid = null; pmg.groupData = null; }
      else pmgLoadGroup(gid);
      pmgRender(true, true); return true;
    }
    case 'rename-open': pmg.renaming = !pmg.renaming; pmgRender(true, true); return true;
    case 'rename-save': {
      const name = ((pmgQ('[data-act="rename-in"]') || {}).value || '').trim();
      pmg.renaming = false;
      await pmgGameMsg('admin', { gid: pmgCurGroup(), action: 'rename', value: name });
      pmgRender(true, true); return true;
    }
    case 'leave': {
      const gid = pmgCurGroup(), key = 'leave:' + gid;
      if (pmg.confirm !== key) { pmg.confirm = key; pmgRender(true, true); return true; }
      pmg.confirm = null;
      const r = await pmgGameMsg('leave', { gid });
      if (!r || !r.ok) pmg.groupError = pmgErrText((r && r.error) || 'network'); else { pmg.gid = null; pmg.groupData = null; }
      pmgRender(true, true); return true;
    }
    case 'delete-me': {
      if (pmg.confirm !== 'delete-me') { pmg.confirm = 'delete-me'; pmgRender(true, true); return true; }
      pmg.confirm = null;
      const r = await pmgGameMsg('delete-me');
      if (r && r.ok) { pmg.profile = { ...pmgProfile(), created: false, photoLocal: null }; await pmgStorageSet({ pmg_profile: pmg.profile }); pmg.groups = []; pmg.groupData = null; }
      else pmg.groupError = pmgErrText((r && r.error) || 'network');
      pmgRender(true, true); return true;
    }
    case 'nick-save': {
      const nick = ((pmgQ('[data-act="nick-edit"]') || {}).value || '').trim();
      if (nick.length < 3) { pmgToast('Ник — от 3 до 16 символов'); return true; }
      pmg.nickEdit = false;
      await pmgSetProfile({ nick }, { nick }); pmgRender(true, true);
      if (pmgCurGroup()) pmgLoadGroup(pmgCurGroup());
      return true;
    }
    case 'avatar': {
      await pmgSetProfile({ avatar: v }, { avatar: v });
      if (pmgProfile().photoLocal) { /* фото важнее аватара — аватар виден, если фото убрать */ }
      pmgRender(true, true); return true;
    }
    case 'photo-delete': {
      pmg.profile = { ...pmgProfile(), photoLocal: null }; await pmgStorageSet({ pmg_profile: pmg.profile });
      if (pmgProfile().created) await pmgGameMsg('photo-delete');
      pmgRender(true, true); return true;
    }
    case 'crop-save': return pmgCropSave(), true;
    case 'crop-cancel': pmg.crop = null; pmgRender(true, true); return true;
    case 'gain-close': pmgGainsClose(); return true;
    case 'streak-close': pmgStreakClose(); return true;
    case 'lvl-close': pmgLevelClose(); return true;
  }
  return false;
}

async function pmgPassChange(e) {
  const t = e.target, act = t.dataset.act;
  if (act === 'jpriv') { pmg.join.privacy[t.dataset.k] = t.checked; return true; }
  if (act === 'priv') {
    const priv = { ...pmgPrivacyOf(pmgProfile()), [t.dataset.k]: t.checked };
    await pmgSetProfile({ privacy: priv }, { privacy: priv });
    return true;
  }
  if (act === 'photo-file' && t.files && t.files[0]) {
    const f = t.files[0];
    if (!/^image\//.test(f.type)) return true;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { pmg.crop = { img, url, x: 0, y: 0, z: 1 }; pmgRender(true, true); };
    img.src = url;
    return true;
  }
  if (act === 'crop-zoom') { if (pmg.crop) { pmg.crop.z = +t.value; pmgCropApply(); } return true; }
  return false;
}

function pmgPassInput(e) {
  const t = e.target;
  if (t.dataset.act === 'crop-zoom' && pmg.crop) { pmg.crop.z = +t.value; pmgCropApply(); }
  if (t.dataset.act === 'code-in') { const p = t.selectionStart; t.value = t.value.toUpperCase(); t.setSelectionRange(p, p); }
}

// ---------- Обрезка фото ----------
function pmgCropModal() {
  if (!pmg.crop) return '';
  return '<div class="crop-modal" role="dialog" aria-label="Фото профиля"><div class="crop-box card"><h3>Подвинь и приблизь</h3>' +
    '<div class="crop-stage"><img class="crop-img" src="' + pmg.crop.url + '" alt="" draggable="false"><span class="crop-mask"></span></div>' +
    '<input type="range" min="1" max="3" step="0.01" value="' + pmg.crop.z + '" data-act="crop-zoom" aria-label="Приближение">' +
    '<div class="row-btns"><button class="btn" data-act="crop-cancel">Отмена</button><button class="btn primary" data-act="crop-save"' + (pmg.busy ? ' disabled' : '') + '>' + (pmg.busy ? 'Сохраняю…' : 'Сохранить') + '</button></div>' +
    (pmg.cropError ? '<p class="err">' + pmgEsc(pmg.cropError) + '</p>' : '') + '</div></div>';
}

function pmgCropGeom() {
  const c = pmg.crop, S = 240;
  const base = S / Math.min(c.img.naturalWidth, c.img.naturalHeight);
  const sc = base * c.z;
  const w = c.img.naturalWidth * sc, h = c.img.naturalHeight * sc;
  const maxX = (w - S) / 2, maxY = (h - S) / 2;
  c.x = Math.max(-maxX, Math.min(maxX, c.x)); c.y = Math.max(-maxY, Math.min(maxY, c.y));
  return { S, sc, w, h };
}

function pmgCropApply() {
  const el = pmgQ('.crop-img');
  if (!el || !pmg.crop) return;
  const g = pmgCropGeom();
  el.style.width = g.w + 'px'; el.style.height = g.h + 'px';
  el.style.transform = 'translate(calc(-50% + ' + pmg.crop.x + 'px), calc(-50% + ' + pmg.crop.y + 'px))';
}

function pmgCropBind() {
  const stage = pmgQ('.crop-stage');
  if (!stage || stage.dataset.bound) return;
  stage.dataset.bound = 1;
  pmgCropApply();
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox: pmg.crop.x, oy: pmg.crop.y }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; pmg.crop.x = drag.ox + e.clientX - drag.x; pmg.crop.y = drag.oy + e.clientY - drag.y; pmgCropApply(); });
  stage.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); pmg.crop.z = Math.max(1, Math.min(3, pmg.crop.z - e.deltaY * 0.002)); const r = pmgQ('[data-act="crop-zoom"]'); if (r) r.value = pmg.crop.z; pmgCropApply(); }, { passive: false });
}

async function pmgCropSave() {
  const c = pmg.crop; if (!c) return;
  const g = pmgCropGeom(), OUT = 512, k = OUT / g.S;
  const cv = document.createElement('canvas'); cv.width = OUT; cv.height = OUT;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT, OUT);
  // Центр картинки смещён на (x, y) относительно центра круга
  ctx.drawImage(c.img, (OUT - g.w * k) / 2 + c.x * k, (OUT - g.h * k) / 2 + c.y * k, g.w * k, g.h * k);
  let q = 0.85, data = cv.toDataURL('image/jpeg', q);
  while (data.length > 190000 && q > 0.4) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); }
  // Маленькая копия для своего экрана
  const sm = document.createElement('canvas'); sm.width = 160; sm.height = 160; sm.getContext('2d').drawImage(cv, 0, 0, 160, 160);
  const local = sm.toDataURL('image/jpeg', 0.85);
  pmg.busy = true; pmg.cropError = null; pmgRender(true, true);
  let ok = true;
  if (pmgProfile().created) {
    const r = await pmgGameMsg('photo', { dataUrl: data });
    ok = r && r.ok;
    if (!ok) pmg.cropError = pmgErrText((r && r.error) || 'network');
  }
  pmg.busy = false;
  if (ok) {
    URL.revokeObjectURL(c.url); pmg.crop = null;
    pmg.profile = { ...pmgProfile(), photoLocal: local };
    await pmgStorageSet({ pmg_profile: pmg.profile });
    if (pmgCurGroup()) pmgLoadGroup(pmgCurGroup());
  }
  pmgRender(true, true);
}

// ---------- Анимации игры ----------
function pmgPassAfterRender() {
  if (pmg.crop) pmgCropBind();
  const track = pmgQ('.track-scroll');
  if (track && !track.dataset.placed) {
    track.dataset.placed = 1;
    const cur = track.querySelector('.tn.sel') || track.querySelector('.tn.cur');
    if (cur) track.scrollLeft = cur.offsetLeft - track.clientWidth / 2 + cur.offsetWidth / 2;
    track.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  }
  pmgStairsAfter(pmg.root);
  pmgPlayGains();
}

// ---------- Огонёк дня: сцена «как в Duolingo» при первом заходе за день ----------
const PMG_STREAK_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function pmgStreakCaption(k) {
  const n = k.days;
  const mile = { 1: 'Огонёк зажёгся. Загляни завтра — он подрастёт.', 3: 'Три дня подряд — огонёк разгорается.', 7: 'Целая неделя! Огонёк стал красным.',
    14: 'Две недели без перерыва. Это уже привычка.', 21: 'Три недели! Огонёк сменил цвет.', 30: 'Месяц подряд. Мало кто так может.', 50: 'Полсотни дней. Легенда класса.', 100: 'Сто дней подряд. Без слов.' };
  if (mile[n]) return mile[n];
  if (n % 10 === 0) return n + ' дней — круглое число. Так держать.';
  if (k.restLeft) return 'Пропустишь один день на неделе — сработает передышка.';
  if (k.freezes) return 'Если пропустишь день, огонёк спасёт заморозка (' + k.freezes + ').';
  return 'Передышку на этой неделе уже потратил — заходи завтра обязательно.';
}
function pmgStreakDot(st, i) {
  const ic = st === 'on' || st === 'today' ? pmgFlameSvg(7, 18) : st === 'frozen' ? '<svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 2v16M3 6l14 8M3 14l14-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' :
    st === 'rest' ? '<b>z</b>' : st === 'miss' ? '<svg viewBox="0 0 20 20" width="12" height="12"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' : '';
  return '<li class="sk-d ' + st + '" style="--i:' + i + '"><span class="sk-dot">' + ic + '</span><small>' + PMG_STREAK_WEEK[i] + '</small></li>';
}
function pmgStreakScene(k, done) {
  const panel = pmgQ('.panel'); if (!panel) return done();
  const n = k.days, from = Math.max(0, n - 1), calm = pmgReduced();
  const week = (k.week || []).map((d) => ({ ...d }));
  const todayIdx = week.findIndex((d) => d.iso === pmgIso(new Date()));
  const el = document.createElement('div');
  el.className = 'streak-scene' + (calm ? ' calm' : '') + (n >= 7 ? ' hot' : '');
  const sparks = Array.from({ length: 14 }, (_, i) => '<i style="--a:' + (i * 360 / 14) + 'deg;--d:' + (60 + (i % 3) * 18) + 'px;--c:' + ['#FF5FB8', '#FFE14D', '#D4FF3A', '#2F4BFF'][i % 4] + '"></i>').join('');
  el.innerHTML = '<div class="sk-box" role="dialog" aria-label="Огонёк: ' + n + ' ' + pmgPlural(n, ['день', 'дня', 'дней']) + ' подряд">' +
    '<div class="sk-flame"><div class="sk-burst">' + sparks + '</div>' + pmgFlameSvg(Math.max(n, 3), 120) + '</div>' +
    '<div class="sk-num"><span class="sk-roll"><b>' + from + '</b><b>' + n + '</b></span></div>' +
    '<div class="sk-label">' + pmgPlural(n, ['день', 'дня', 'дней']) + ' подряд</div>' +
    (week.length ? '<ol class="sk-week">' + week.map((d, i) => pmgStreakDot(i === todayIdx && !calm ? 'today' : d.st, i)).join('') + '</ol>' : '') +
    '<p class="sk-cap">' + pmgEsc(pmgStreakCaption(k)) + (k.mult > 1 ? '<br><small>Бонус к опыту ×' + k.mult + '</small>' : '') + '</p>' +
    '<button class="btn primary" data-act="streak-close">Продолжить</button></div>';
  panel.appendChild(el);
  pmg.streakDone = done;
  if (calm) return;
  setTimeout(() => el.classList.add('lit'), 650);
  setTimeout(() => { const d = el.querySelectorAll('.sk-d')[todayIdx]; if (d) { d.className = 'sk-d on pop'; } }, 1150);
}
function pmgStreakClose() {
  const el = pmgQ('.streak-scene');
  if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 300); }
  if (pmg.streakDone) { const d = pmg.streakDone; pmg.streakDone = null; setTimeout(d, 320); }
}
// Показать сцену, если сегодня огонёк уже засчитан, а сцену ещё не видели. true — сцена показана.
function pmgMaybeStreak() {
  const st = pmg.game, k = st && st.view && st.view.streak, today = pmgIso(new Date());
  if (!k || !k.todayCounted || !k.days || pmg.streakSeenDay === today || pmg.streakBusy || pmg.gainBusy || pmgQ('.lvl-up, .gains-card')) return false;
  pmg.streakBusy = true;
  chrome.storage.local.get('pmg_streak_anim').then(({ pmg_streak_anim: seen }) => {
    pmg.streakSeenDay = today;
    if (seen === today || !(pmg.open || pmg.mode === 'page')) { pmg.streakBusy = false; pmgPlayGains(); return; }
    chrome.storage.local.set({ pmg_streak_anim: today });
    pmgStreakScene(k, () => { pmg.streakBusy = false; pmgPlayGains(); });
  });
  return true;
}

// Очередь начислений: «+60» летит в полоску XP, сводка, новый уровень.
function pmgPlayGains() {
  const st = pmg.game;
  if (!st || !st.view || !(pmg.open || pmg.mode === 'page') || pmg.gainBusy || pmg.streakBusy) return;
  if (pmgMaybeStreak()) return;
  const seen = pmg.gainsSeen || 0;
  const fresh = (st.gains || []).filter((g) => g.t > seen);
  const lv = st.view.level.level;
  const seenLevel = st.seenLevel || 0;
  if (!fresh.length) { if (seenLevel && lv > seenLevel) pmgLevelUp(seenLevel, lv); else if (!seenLevel) pmgGameMsg('ack', { upTo: 0, level: lv }); return; }
  pmg.gainBusy = true;
  const upTo = Math.max(...fresh.map((g) => g.t));
  pmg.gainsSeen = upTo;
  const done = () => {
    pmg.gainBusy = false;
    pmgGameMsg('ack', { upTo, level: seenLevel && lv > seenLevel ? 0 : lv });
    if (seenLevel && lv > seenLevel) pmgLevelUp(seenLevel, lv);
    else setTimeout(pmgMaybeStreak, 500);
  };
  const catchup = fresh.find((g) => g.src === 'catchup');
  const total = fresh.reduce((a, g) => a + g.xp, 0);
  if (pmgReduced()) { pmgToast('+' + total + ' XP'); return done(); }
  if (catchup || fresh.length > 4) return pmgGainsCard(fresh, catchup, done);
  fresh.forEach((g, i) => setTimeout(() => pmgFlyXp(g), i * 160));
  setTimeout(done, fresh.length * 160 + 700);
}

function pmgFlyXp(g) {
  const panel = pmgQ('.panel'), line = pmgQ('.xpline .xpl-bar');
  if (!panel || !line) return;
  let from = null;
  if (g.key) { const inp = pmg.root.querySelector('input[data-act="done"][data-key="' + g.key + '"]'); if (inp) from = (inp.closest('.hwc, .hw') || inp).getBoundingClientRect(); }
  const pr = panel.getBoundingClientRect(), to = line.getBoundingClientRect();
  if (!from) from = { left: pr.left + pr.width / 2 - 30, top: pr.top + pr.height * 0.45, width: 60, height: 20 };
  const el = document.createElement('div');
  el.className = 'xp-fly';
  el.textContent = '+' + g.xp;
  const x0 = from.left + from.width / 2 - pr.left, y0 = from.top + from.height / 2 - pr.top;
  const x1 = to.left + to.width * 0.6 - pr.left, y1 = to.top + to.height / 2 - pr.top;
  el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
  panel.appendChild(el);
  const mx = (x0 + x1) / 2 + 40, my = Math.min(y0, y1) - 60;
  const t0 = performance.now(), dur = 600;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * mx + e * e * x1;
    const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * my + e * e * y1;
    el.style.transform = 'translate(' + (x - x0) + 'px,' + (y - y0) + 'px) scale(' + (1 - e * 0.4) + ')';
    el.style.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
    if (k < 1) requestAnimationFrame(step);
    else { el.remove(); const xl = pmgQ('.xpline'); if (xl) { xl.classList.remove('bump'); void xl.offsetWidth; xl.classList.add('bump'); } }
  };
  requestAnimationFrame(step);
}

function pmgToast(text) {
  const panel = pmgQ('.panel'); if (!panel) return;
  const el = document.createElement('div'); el.className = 'pass-toast'; el.textContent = text;
  panel.appendChild(el); setTimeout(() => el.remove(), 2200);
}

function pmgGainsCard(fresh, catchup, done) {
  const panel = pmgQ('.panel'); if (!panel) return done();
  let lines;
  if (catchup) lines = Object.entries(catchup.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [PMG_KIND_NAMES[k] || k, v]);
  else {
    const by = {}; fresh.forEach((g) => { const k = g.label.replace(/ · .*/, ''); by[k] = (by[k] || 0) + g.xp; });
    lines = Object.entries(by).sort((a, b) => b[1] - a[1]);
  }
  const total = fresh.reduce((a, g) => a + g.xp, 0);
  const el = document.createElement('div');
  el.className = 'gains-card';
  el.innerHTML = '<div class="gc-box"><div class="gc-title">' + (catchup ? 'Сезон уже идёт — вот твои очки' : 'Новые очки') + '</div><ul>' +
    lines.slice(0, 8).map(([l, v], i) => '<li style="--i:' + i + '"><span>' + pmgEsc(l) + '</span><b>+' + pmgFmtXp(v) + '</b></li>').join('') + '</ul>' +
    '<div class="gc-total">+<b class="gc-num">0</b> XP</div><button class="btn small" data-act="gain-close">Отлично</button></div>';
  panel.appendChild(el);
  pmg.gainDone = done;
  const num = el.querySelector('.gc-num');
  const t0 = performance.now() + lines.length * 80, dur = 900;
  const step = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); num.textContent = pmgFmtXp(total * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  pmg.gainTimer = setTimeout(pmgGainsClose, catchup ? 4200 : 2600);
}

function pmgGainsClose() {
  clearTimeout(pmg.gainTimer);
  const el = pmgQ('.gains-card');
  if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 350); }
  const xl = pmgQ('.xpline'); if (xl) { xl.classList.remove('bump'); void xl.offsetWidth; xl.classList.add('bump'); }
  if (pmg.gainDone) { const d = pmg.gainDone; pmg.gainDone = null; d(); }
}

function pmgLevelUp(from, to) {
  const panel = pmgQ('.panel'); if (!panel || pmgQ('.lvl-up')) return;
  const G = pmgGV();
  const rewards = []; for (let l = from + 1; l <= to; l++) pmgRewardsAt(l, G.season).forEach((r) => rewards.push({ ...r, l }));
  const show = rewards.filter((r) => r.kind !== 'sticker').concat(rewards.filter((r) => r.kind === 'sticker')).slice(0, 6);
  const el = document.createElement('div');
  el.className = 'lvl-up' + (pmgReduced() ? ' calm' : '');
  const sparks = Array.from({ length: 18 }, (_, i) => '<i style="--a:' + (i * 20) + 'deg;--c:' + ['#6366F1', '#8B5CF6', '#14B8A6'][i % 3] + '"></i>').join('');
  el.innerHTML = '<div class="lu-box"><div class="lu-burst">' + sparks + '</div><div class="lu-ring"><b class="lu-num">' + from + '</b></div>' +
    '<div class="lu-title">Уровень ' + to + (to - from > 1 ? '<small>+' + (to - from) + ' ' + pmgPlural(to - from, ['уровень', 'уровня', 'уровней']) + '</small>' : '') + '</div>' +
    '<div class="lu-cards">' + show.map((r, i) => '<div class="lu-card" style="--i:' + i + '"><div class="lu-back">' + PMG_LOGO + '</div><div class="lu-front">' + pmgRewardIcon(r, 52) + '<span>' + pmgEsc(r.name) + '</span>' +
      (['frame', 'title', 'theme', 'aura', 'skin', 'bgpack'].includes(r.kind) ? '<button class="btn small" data-act="equip" data-kind="' + r.kind + '" data-v="' + r.id + '">Надеть</button>' : '') + '</div></div>').join('') + '</div>' +
    '<button class="btn primary" data-act="lvl-close">Дальше</button></div>';
  panel.appendChild(el);
  const num = el.querySelector('.lu-num');
  if (!pmgReduced()) {
    let cur = from;
    const tick = () => { if (cur < to) { cur++; num.textContent = cur; num.classList.remove('roll'); void num.offsetWidth; num.classList.add('roll'); setTimeout(tick, Math.max(90, 500 / (to - from))); } };
    setTimeout(tick, 650);
  } else num.textContent = to;
  pmg.lvlTo = to;
}

function pmgLevelClose() {
  const el = pmgQ('.lvl-up');
  if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 300); }
  if (pmg.lvlTo) { pmgGameMsg('ack', { upTo: pmg.gainsSeen || 0, level: pmg.lvlTo }); if (pmg.game) pmg.game.seenLevel = pmg.lvlTo; pmg.lvlTo = 0; }
  setTimeout(pmgMaybeStreak, 500);
}
