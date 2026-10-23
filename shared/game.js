// Gradely Pass в фоновом скрипте: пересчёт очков, выбор заданий, синхронизация с сервером.
// Результат кладётся в chrome.storage (pmg_game), страницы только рисуют его.

const PMG_GAME_KEYS = ['pmg_mark_seen', 'pmg_cache', 'pmg_settings', 'pmg_done', 'pmg_hw_due', 'pmg_logins', 'pmg_actions', 'pmg_quests', 'pmg_wquests', 'pmg_game', 'pmg_profile', 'pmg_groups', 'pmg_seed'];
let pmgGameBusy = null, pmgGameAgain = false;

async function pmgGameRun(opts) {
  if (pmgGameBusy) { pmgGameAgain = true; return pmgGameBusy; }
  pmgGameBusy = (async () => {
    try { await pmgGameRunOnce(opts || {}); }
    finally {
      pmgGameBusy = null;
      if (pmgGameAgain) { pmgGameAgain = false; await pmgGameRun({ push: true }); }
    }
  })();
  return pmgGameBusy;
}

async function pmgGameRunOnce(opts) {
  const s = await chrome.storage.local.get(PMG_GAME_KEYS);
  if (!s.pmg_cache) return;
  const now = new Date();
  const data = pmgRevive(s.pmg_cache);
  const settings = s.pmg_settings || {};
  const season = pmgSeasonAt(now);
  let seed = s.pmg_seed;
  if (!seed) { seed = Math.random().toString(36).slice(2, 10); await chrome.storage.local.set({ pmg_seed: seed }); }
  const inGroup = !!(s.pmg_groups && s.pmg_groups.length);
  const base = { data, now, threshold: settings.threshold || 0.55, done: s.pmg_done || {}, overrides: s.pmg_hw_due || {}, hwMode: settings.hwMode || 'assigned' };
  // Когда каждая оценка впервые появилась. Первый запуск — даты уроков, дальше — день, когда мы её увидели.
  let seen = s.pmg_mark_seen, seenChanged = false;
  if (!seen) { seen = {}; data.marks.forEach((m) => { const d = pmgParseDate(m.date); if (d) seen[m.id] = pmgIso(d); }); seenChanged = true; }
  else data.marks.forEach((m) => { if (!seen[m.id]) { seen[m.id] = pmgIso(now); seenChanged = true; } });
  if (seenChanged) await chrome.storage.local.set({ pmg_mark_seen: seen });
  base.seen = seen;
  const ctx = pmgGameContext(base);

  // Задания: выбираются один раз и запоминаются
  const quests = s.pmg_quests || {}, wquests = s.pmg_wquests || {};
  let picksChanged = false;
  const todayIso = ctx.todayIso;
  const live = season.phase !== 'over' && season.phase !== 'soon';
  const mon = pmgIso(pmgMonday(ctx.today));
  // Прежде чем выбрать новые задания, забираем с сервера выбор другого устройства:
  // иначе телефон и компьютер выберут каждый свою тройку и одна затрёт другую.
  const needPick = live && ((ctx.isSchool(ctx.today) && !quests[todayIso]) || !wquests[mon]);
  if (needPick && typeof pmgCloudSync === 'function' && typeof pmgCloudEnabled === 'function' && await pmgCloudEnabled()) {
    try {
      await pmgCloudSync();
      const fresh = await chrome.storage.local.get(['pmg_quests', 'pmg_wquests']);
      Object.assign(quests, fresh.pmg_quests || {});
      Object.assign(wquests, fresh.pmg_wquests || {});
    } catch (_) { /* нет связи — выберем сами */ }
  }
  if (live && ctx.isSchool(ctx.today) && !quests[todayIso]) { quests[todayIso] = pmgPickDaily(ctx, todayIso, seed, { inGroup }); picksChanged = true; }
  if (live && !wquests[mon]) { wquests[mon] = pmgPickWeekly(ctx, mon, seed); picksChanged = true; }
  if (picksChanged) {
    const old = pmgIso(new Date(now.getTime() - 150 * 864e5));
    Object.keys(quests).forEach((k) => { if (k < old) delete quests[k]; });
    Object.keys(wquests).forEach((k) => { if (k < old) delete wquests[k]; });
    await chrome.storage.local.set({ pmg_quests: quests, pmg_wquests: wquests });
  }

  let state = s.pmg_game && s.pmg_game.seasonId === season.id ? s.pmg_game : { seasonId: season.id, sent: {}, known: null, gains: [], seenLevel: 0, server: null };
  const level0 = state.view ? state.view.level.level : 1;
  const g = pmgGame({ ...base, season, logins: s.pmg_logins || {}, actions: s.pmg_actions || {}, quests, wquests, level: Math.max(level0, (state.server && state.server.level) || 1), inGroup, restoreUsed: state.restoreUsed });

  // Новые очки для анимаций
  const cur = {}; g.events.forEach((e) => { cur[e.ref] = e.xp; });
  const gains = (state.gains || []).slice(-60);
  if (state.known) {
    g.events.forEach((e) => {
      const was = state.known[e.ref] || 0;
      if (e.xp > was) gains.push({ ref: e.ref, xp: e.xp - was, label: e.label, src: e.src || e.kind, key: e.key, t: Date.now() });
    });
  } else if (g.totalXp > 0) {
    // Первый запуск сезона: одна сводная карточка
    const by = {};
    g.events.forEach((e) => { const k = e.kind; by[k] = (by[k] || 0) + e.xp; });
    gains.push({ ref: 'catchup', xp: g.totalXp, label: 'catchup', src: 'catchup', by, t: Date.now() });
  }

  const lv = pmgLevelInfo(g.totalXp, season.scale);
  const byKind = {}; g.events.forEach((e) => { byKind[e.kind] = (byKind[e.kind] || 0) + e.xp; });
  const monIso = mon, weekXp = g.events.filter((e) => e.day >= monIso).reduce((a, e) => a + e.xp, 0);
  const todayXp = g.events.filter((e) => e.day === todayIso).reduce((a, e) => a + e.xp, 0);
  const seasonMarks = ctx.marks.filter((m) => pmgIso(m.g) >= season.starts && pmgIso(m.g) <= season.ends);
  const view = {
    at: Date.now(), season: { id: season.id, name: season.name, theme: season.theme, phase: season.phase, starts: season.starts, ends: season.ends, scale: season.scale, test: !!season.test, aura: season.aura, album: season.album, next: season.next || null },
    daysLeft: pmgSeasonDaysLeft(season, now), xp: g.totalXp, level: lv, weekXp, todayXp, byKind,
    streak: { days: g.streak.days, best: g.streak.best, mult: g.streak.mult, todayCounted: g.streak.todayCounted, freezes: g.streak.freezes, frozen: g.streak.frozen.slice(-5), restoreOffer: g.streak.restoreOffer, restLeft: g.streak.restLeft, week: g.streak.week },
    quests: { today: g.quests.today, week: g.quests.week, weekKey: g.quests.weekKey, rerolled: !!(quests[todayIso] && quests[todayIso].rerolled), schoolToday: g.schoolToday },
    achievements: g.achievements,
    recent: g.events.slice().sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : 0)).slice(0, 40).map((e) => ({ day: e.day, xp: e.xp, label: e.label, kind: e.kind })),
    stats: { fives: seasonMarks.filter((m) => m.value === 5).length, marks: seasonMarks.length, bestStreak: g.streak.best },
    weak: g.weak ? { id: g.weak.id, name: g.weak.name } : null,
    publicStats: g.publicStats
  };
  // Достижения навсегда: объединяем со всеми прошлыми
  const achAll = new Set(s.pmg_game ? s.pmg_game.achAll || [] : []);
  g.achievements.forEach((c) => { if (!achAll.has(c)) { achAll.add(c); if (state.known) gains.push({ ref: 'ach:' + c, xp: 0, label: 'ach', src: 'ach', code: c, t: Date.now() }); } });
  state = { ...state, known: cur, gains, view, achAll: [...achAll], restoreUsed: state.restoreUsed || g.streak.restoreUsed };

  // Сервер: только если человек сам начал сезон (создал профиль).
  // Очки отправляет одно устройство: компьютер, если он на связи; телефон — только когда компьютера нет.
  if (s.pmg_profile && s.pmg_profile.created && opts.push !== false && await pmgIsXpWriter()) {
    try {
      const sent = state.sent || {};
      const list = [];
      g.events.forEach((e) => { if (!sent[e.ref] || sent[e.ref].xp !== e.xp) list.push({ ref: e.ref, kind: e.kind, day: e.day, xp: e.xp }); });
      Object.keys(sent).forEach((ref) => { if (cur[ref] == null && sent[ref].xp !== 0) list.push({ ref, kind: sent[ref].kind, day: sent[ref].day, xp: 0 }); });
      const st = { streak: g.streak.days, best_streak: g.streak.best, achievements: g.achievements, public_stats: { ...g.publicStats } };
      const need = list.length || !state.server || JSON.stringify(st) !== state.lastState || Date.now() - (state.syncedAt || 0) > 6 * 3600e3;
      if (need) {
        let res = null;
        for (let i = 0; i < Math.max(1, list.length); i += 250) {
          res = await pmgRpc('sync', { p_season: season.id, p_events: list.slice(i, i + 250), p_state: st });
          if (res && res.ok === false) throw new Error(res.error);
        }
        const nsent = { ...sent };
        list.forEach((e) => { nsent[e.ref] = { xp: e.xp, kind: e.kind, day: e.day }; });
        Object.keys(nsent).forEach((r) => { if (nsent[r].xp === 0 && cur[r] == null) delete nsent[r]; });
        state.sent = nsent;
        state.server = { xp: res.xp, level: res.level, stars: res.stars, week_xp: res.week_xp, newAch: res.new_achievements || [] };
        state.syncedAt = Date.now(); state.lastState = JSON.stringify(st); state.syncError = null;
      }
    } catch (e) {
      state.syncError = String(e.message || e);
      if (/no_profile|signed_out/.test(state.syncError)) await chrome.storage.local.set({ pmg_profile: { ...s.pmg_profile, created: false } });
    }
  }
  await chrome.storage.local.set({ pmg_game: state });
  return state;
}

// Кто отправляет очки на сервер. Иначе телефон со старым снимком дневника откатывает огонёк и цифры,
// которые прислал компьютер. Телефон отправляет сам, только если расширение не появлялось 3 дня.
async function pmgIsXpWriter() {
  if (!(typeof PMG_WEB !== 'undefined' && PMG_WEB)) return true;
  const d = (await chrome.storage.local.get('pmg_devices')).pmg_devices;
  const list = (d && d.devices) || [];
  return !list.some((x) => x.kind === 'extension' && x.last_seen && Date.now() - new Date(x.last_seen).getTime() < 3 * 864e5);
}

async function pmgRecordLogin() {
  const s = await chrome.storage.local.get('pmg_logins');
  const iso = pmgIso(new Date());
  const logins = s.pmg_logins || {};
  if (logins[iso]) return false;
  logins[iso] = Date.now();
  const old = pmgIso(new Date(Date.now() - 200 * 864e5));
  Object.keys(logins).forEach((k) => { if (k < old) delete logins[k]; });
  await chrome.storage.local.set({ pmg_logins: logins });
  return true;
}

async function pmgRecordAction(key) {
  const s = await chrome.storage.local.get('pmg_actions');
  const a = s.pmg_actions || {};
  if (a[key]) return false;
  a[key] = Date.now();
  const old = pmgIso(new Date(Date.now() - 200 * 864e5));
  Object.keys(a).forEach((k) => { const m = /:(\d{4}-\d{2}-\d{2})$/.exec(k); if (m && m[1] < old) delete a[k]; });
  await chrome.storage.local.set({ pmg_actions: a });
  return true;
}

async function pmgReroll(group) {
  const s = await chrome.storage.local.get(['pmg_cache', 'pmg_settings', 'pmg_done', 'pmg_hw_due', 'pmg_quests', 'pmg_seed', 'pmg_groups']);
  const iso = pmgIso(new Date());
  const q = s.pmg_quests || {};
  const pick = q[iso];
  if (!pick || pick.rerolled) return false;
  const idx = { study: 0, hw: 1, easy: 2 }[group];
  const settings = s.pmg_settings || {};
  const ctx = pmgGameContext({ data: pmgRevive(s.pmg_cache), now: new Date(), done: s.pmg_done || {}, overrides: s.pmg_hw_due || {}, hwMode: settings.hwMode || 'assigned' });
  const nq = pmgPickDaily(ctx, iso, s.pmg_seed, { only: group, exclude: [pick.ids[idx]], salt: 'r', inGroup: !!(s.pmg_groups && s.pmg_groups.length) });
  if (!nq || nq.id === pick.ids[idx]) return false;
  pick.ids[idx] = nq.id; pick.rerolled = true;
  await chrome.storage.local.set({ pmg_quests: q });
  return true;
}

// ---------- Профиль и группы ----------
async function pmgStartSeason(nick) {
  const s = await chrome.storage.local.get(['pmg_cache', 'pmg_profile']);
  const sid = s.pmg_cache && s.pmg_cache.student ? s.pmg_cache.student.id : null;
  const hash = sid ? await pmgSha256('gradient:' + sid) : null;
  const r = await pmgRpc('ensure_profile', { p_nick: nick, p_student_hash: hash }, true);
  if (!r.ok) throw new Error(r.error);
  await pmgRpc('update_profile', { p: { nick } });
  await chrome.storage.local.set({ pmg_profile: { ...(s.pmg_profile || {}), nick, created: true, at: Date.now() } });
  await pmgGameRun({ push: true });
  await pmgRefreshGroups();
  return true;
}

async function pmgRefreshGroups() {
  const groups = await pmgRpc('my_groups', {});
  await chrome.storage.local.set({ pmg_groups: groups || [] });
  return groups;
}

async function pmgGroupData(gid) {
  const [board, feed, goal, cheers] = await Promise.all([
    pmgRpc('leaderboard', { p_group: gid }), pmgRpc('group_feed', { p_group: gid, p_limit: 40 }),
    pmgRpc('group_goal', { p_group: gid }), pmgRpc('take_cheers', {})
  ]);
  const players = (board && board.players) || [];
  const photos = await pmgPhotos(players.map((p) => p.photo).filter(Boolean)).catch(() => ({}));
  players.forEach((p) => { p.photoUrl = p.photo ? photos[p.photo] || null : null; });
  const out = { gid, at: Date.now(), board, feed: feed || [], goal, cheers: cheers || [] };
  const store = (await chrome.storage.local.get('pmg_boards')).pmg_boards || {};
  const prev = store[gid];
  // Превью фото маленькие — храним их с группой, чтобы при следующем открытии фото были сразу
  store[gid] = { ...out, board: { ...board, players: players.map((p) => ({ ...p })) }, prevWeek: prev ? Object.fromEntries((prev.board.players || []).map((p) => [p.id, p.week_xp])) : null };
  await chrome.storage.local.set({ pmg_boards: store });
  return out;
}

// Одна точка входа для страниц.
async function pmgGameMessage(msg) {
  if (msg.op && msg.op.startsWith('bridge-') && typeof pmgBridgeMessage === 'function') return pmgBridgeMessage(msg);
  switch (msg.op) {
    case 'run': await pmgGameRun({ push: true }); return { ok: true };
    case 'login': {
      if (typeof pmgCloudEnabled === 'function' && await pmgCloudEnabled()) { await pmgCloudSync().catch(() => {}); pmgDevicesSync('extension').catch(() => {}); }
      if (await pmgRecordLogin()) await pmgGameRun({ push: true });
      return { ok: true };
    }
    // Связка с телефоном
    case 'cloud-on': {
      const st = (await chrome.storage.local.get('pmg_settings')).pmg_settings || {};
      await chrome.storage.local.set({ pmg_settings: { ...st, cloud: true } });
      const c = (await chrome.storage.local.get('pmg_cache')).pmg_cache;
      const r = await pmgCloudAll({ snapshot: c });
      return { ok: !r.snapshot || r.snapshot.ok !== false, detail: r };
    }
    case 'cloud-off': {
      const st = (await chrome.storage.local.get('pmg_settings')).pmg_settings || {};
      await chrome.storage.local.set({ pmg_settings: { ...st, cloud: false } });
      return { ok: true };
    }
    case 'pair-code': {
      const st = (await chrome.storage.local.get('pmg_settings')).pmg_settings || {};
      if (!st.cloud) { await chrome.storage.local.set({ pmg_settings: { ...st, cloud: true } }); }
      const c = (await chrome.storage.local.get('pmg_cache')).pmg_cache;
      if (c) await pmgCloudPushSnapshot(c);
      await pmgCloudSync().catch(() => {});
      await pmgDevicesSync('extension').catch(() => {});
      return pmgPairCode();
    }
    case 'hw-photo-upload': return { ok: true, path: await pmgHwPhotoUpload(msg.dataUrl) };
    case 'hw-photo-urls': return { ok: true, urls: await pmgHwPhotoUrls(msg.paths || [], !(typeof PMG_WEB !== 'undefined' && PMG_WEB)) };
    case 'devices': return pmgDevicesSync('extension');
    case 'device-revoke': return pmgDeviceRevoke(msg.id);
    case 'cloud-sync': return pmgCloudAll({ pull: typeof PMG_WEB !== 'undefined' && PMG_WEB });
    case 'action': if (await pmgRecordAction(msg.key)) await pmgGameRun({ push: true }); return { ok: true };
    case 'reroll': { const ok = await pmgReroll(msg.group); if (ok) await pmgGameRun({ push: true }); return { ok }; }
    case 'ack': {
      const st = (await chrome.storage.local.get('pmg_game')).pmg_game;
      if (st) { st.gains = (st.gains || []).filter((x) => x.t > msg.upTo); if (msg.level) st.seenLevel = msg.level; await chrome.storage.local.set({ pmg_game: st }); }
      return { ok: true };
    }
    case 'start': await pmgStartSeason(msg.nick); return { ok: true };
    case 'profile': {
      await pmgRpc('update_profile', { p: msg.p });
      const pr = (await chrome.storage.local.get('pmg_profile')).pmg_profile || {};
      await chrome.storage.local.set({ pmg_profile: { ...pr, ...msg.local } });
      return { ok: true };
    }
    case 'photo': return { ok: true, path: await pmgUploadPhoto(msg.dataUrl) };
    case 'photo-delete': await pmgDeletePhoto(); return { ok: true };
    case 'groups': return { ok: true, groups: await pmgRefreshGroups() };
    case 'create-group': { const r = await pmgRpc('create_group', { p_name: msg.name }); await pmgRefreshGroups(); return r; }
    case 'peek': return pmgRpc('peek_group', { p_code: msg.code });
    case 'join': {
      const r = await pmgRpc('join_group', { p_code: msg.code, p_privacy: msg.privacy || null });
      if (r && r.ok) { await pmgRefreshGroups(); await pmgGameRun({ push: true }); }
      return r;
    }
    case 'leave': { const r = await pmgRpc('leave_group', { p_group: msg.gid }); await pmgRefreshGroups(); return r; }
    case 'admin': { const r = await pmgRpc('group_admin', { p_group: msg.gid, p_action: msg.action, p_target: msg.target || null, p_value: msg.value || null }); await pmgRefreshGroups(); return r; }
    case 'group': return { ok: true, data: await pmgGroupData(msg.gid) };
    case 'react': {
      await pmgRpc('react', { p_feed: msg.feed, p_kind: msg.reaction || '' });
      if (msg.reaction && await pmgRecordAction('cheer:' + pmgIso(new Date()))) pmgGameRun({ push: true });
      return { ok: true };
    }
    case 'cheer': { const r = await pmgRpc('cheer', { p_to: msg.to }); if (r && r.ok) { await pmgRecordAction('cheer:' + pmgIso(new Date())); pmgGameRun({ push: true }); } return r; }
    case 'delete-me': {
      await pmgDeletePhoto().catch(() => {});
      await pmgRpc('delete_me', {});
      await pmgSignOutLocal();
      await chrome.storage.local.remove(['pmg_groups', 'pmg_boards']);
      const st = (await chrome.storage.local.get('pmg_game')).pmg_game;
      if (st) { st.sent = {}; st.server = null; await chrome.storage.local.set({ pmg_game: st }); }
      return { ok: true };
    }
  }
  return { ok: false, error: 'unknown_op' };
}
