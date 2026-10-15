// Связка компьютера и телефона через сервер Gradient.
// Расширение отправляет снимок дневника; оба устройства обмениваются галочками домашки, входами, заданиями и настройками;
// шаги и этажи приходят с iPhone через Команду. Работает и в фоне расширения, и на сайте.

// Словари: сливаются по записям. В pmg_done снятая галочка уходит как 0.
// pmg_own_hw — своя домашка {id: {id, subject, subjectId, text, due, created, edited, deleted}};
// pmg_hw_photos — фото к любой домашке {ключ домашки: [{p: путь, t: время, x: убрано}]}.
const PMG_CLOUD_MAPS = { pmg_done: 'done', pmg_logins: 'logins', pmg_actions: 'actions', pmg_quests: 'quests', pmg_wquests: 'wquests', pmg_mark_seen: 'seen', pmg_own_hw: 'own_hw', pmg_hw_photos: 'hw_photos' };
// Целиком: побеждает последнее изменение.
const PMG_CLOUD_LWW = { pmg_hw_due: 'hw_due', pmg_settings: 'settings', pmg_profile: 'profile' };
const PMG_HEALTH_DAYS = 400;

// Сравнение без учёта порядка ключей (сервер их переставляет).
function pmgJson(x) {
  if (x === undefined || x === null) return 'null';
  if (Array.isArray(x)) return '[' + x.map(pmgJson).join(',') + ']';
  if (typeof x === 'object') return '{' + Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + pmgJson(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
function pmgCloudSettings(s) {
  if (!s) return undefined;
  const { cloud, ...rest } = s;
  return rest;
}

// Что из профиля можно хранить на сервере (фото-превью остаётся на устройстве).
function pmgCloudProfile(p) {
  if (!p) return undefined;
  const { photoLocal, ...rest } = p;
  return rest;
}

async function pmgCloudEnabled() {
  if (typeof PMG_WEB !== 'undefined' && PMG_WEB) return true;
  const s = await chrome.storage.local.get('pmg_settings');
  return !!(s.pmg_settings && s.pmg_settings.cloud);
}

// Обмен состоянием: отправить свои изменения, забрать чужие.
let pmgCloudBusy = null;
async function pmgCloudSync() {
  if (pmgCloudBusy) return pmgCloudBusy;
  pmgCloudBusy = (async () => {
    const keys = Object.keys(PMG_CLOUD_MAPS).concat(Object.keys(PMG_CLOUD_LWW), ['pmg_cloud_base', 'pmg_seed']);
    const s = await chrome.storage.local.get(keys);
    const base = s.pmg_cloud_base || { maps: {}, lww: {}, seed: null };
    const patch = {}, lww = {};
    Object.entries(PMG_CLOUD_MAPS).forEach(([lk, rk]) => {
      const loc = s[lk] || {}, b = base.maps[rk] || {}, d = {};
      Object.keys(loc).forEach((k) => { if (pmgJson(loc[k]) !== pmgJson(b[k])) d[k] = loc[k]; });
      if (lk === 'pmg_done') Object.keys(b).forEach((k) => { if (!(k in loc) && b[k]) d[k] = 0; });
      if (Object.keys(d).length) patch[rk] = d;
    });
    Object.entries(PMG_CLOUD_LWW).forEach(([lk, rk]) => {
      const loc = lk === 'pmg_profile' ? pmgCloudProfile(s[lk]) : lk === 'pmg_settings' ? pmgCloudSettings(s[lk]) : s[lk];
      if (loc === undefined) return;
      const b = base.lww[rk];
      if (pmgJson(loc) !== pmgJson(b ? b.v : undefined)) lww[rk] = { v: loc, t: Date.now() };
    });
    if (s.pmg_seed && !base.seed) lww.seed = { v: s.pmg_seed, t: -Date.now() }; // отрицательное время: побеждает первый

    const res = Object.keys(patch).length || Object.keys(lww).length
      ? await pmgRpc('merge_state', { p_patch: patch, p_lww: lww })
      : await pmgRpc('get_state', {});
    const st = (res && res.state) || {};

    // Применяем общее состояние у себя
    const out = {}, nbase = { maps: {}, lww: {}, seed: st.seed ? st.seed.v : null };
    Object.entries(PMG_CLOUD_MAPS).forEach(([lk, rk]) => {
      const r = st[rk] || {};
      nbase.maps[rk] = r;
      let val = { ...r };
      if (lk === 'pmg_done') val = Object.fromEntries(Object.entries(r).filter(([, v]) => v));
      if (pmgJson(val) !== pmgJson(s[lk] || {})) out[lk] = val;
    });
    Object.entries(PMG_CLOUD_LWW).forEach(([lk, rk]) => {
      if (!st[rk]) return;
      nbase.lww[rk] = st[rk];
      let v = st[rk].v;
      if (lk === 'pmg_profile') v = { ...(v || {}), photoLocal: s.pmg_profile ? s.pmg_profile.photoLocal : undefined };
      if (lk === 'pmg_settings') v = { ...(s.pmg_settings || {}), ...(v || {}), cloud: true };
      if (pmgJson(v) !== pmgJson(s[lk])) out[lk] = v;
    });
    if (st.seed && st.seed.v !== s.pmg_seed) out.pmg_seed = st.seed.v;
    out.pmg_cloud_base = nbase;
    out.pmg_cloud_at = Date.now();
    await chrome.storage.local.set(out);
    return { ok: true, changed: Object.keys(out).filter((k) => k !== 'pmg_cloud_base' && k !== 'pmg_cloud_at') };
  })();
  try { return await pmgCloudBusy; } finally { pmgCloudBusy = null; }
}

// Расширение → сервер: снимок дневника (оценки, домашка, расписание).
async function pmgCloudPushSnapshot(data) {
  if (!data) return { ok: false };
  const r = await pmgRpc('push_snapshot', { p_data: data }, true);
  await chrome.storage.local.set({ pmg_cloud_pushed: Date.now() });
  return r;
}

// Сайт ← сервер: снимок дневника.
async function pmgCloudPullSnapshot() {
  const r = await pmgRpc('get_snapshot', {});
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'no_snapshot' };
  await chrome.storage.local.set({ pmg_cache: r.data, pmg_status: { ok: true, at: new Date(r.updated_at).getTime(), via: 'cloud' } });
  return { ok: true, at: r.updated_at };
}

// Шаги, этажи и прочее за последние PMG_HEALTH_DAYS дней.
async function pmgHealthPull() {
  const from = new Date(Date.now() - PMG_HEALTH_DAYS * 864e5);
  const days = await pmgRpc('get_health', { p_from: pmgIso(from) });
  const info = await pmgRpc('health_key_info', {});
  await chrome.storage.local.set({ pmg_health: { at: Date.now(), days: days || [], key: info || { has: false } } });
  return { ok: true, n: (days || []).length };
}

async function pmgHealthNewKey() {
  const key = await pmgRpc('new_health_key', {}, true);
  await pmgHealthPull().catch(() => {});
  return { ok: true, key };
}

async function pmgPairCode() {
  const r = await pmgRpc('create_pair_code', {}, true);
  return r;
}

// Телефон: войти в аккаунт компьютера по коду.
async function pmgPairClaim(code) {
  const res = await fetch(PMG_SB_URL + '/functions/v1/pair', {
    method: 'POST', headers: { apikey: PMG_SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
  });
  let body = null; try { body = await res.json(); } catch (_) { /* пусто */ }
  if (!body || !body.ok) return { ok: false, error: (body && body.error) || ('HTTP ' + res.status) };
  const s = body.session;
  await chrome.storage.local.set({ [PMG_AUTH_KEY]: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user_id: s.user_id } });
  return { ok: true };
}

// Полный обмен для устройства: что можно — забрать и отправить.
async function pmgCloudAll(opts) {
  opts = opts || {};
  const out = {};
  if (opts.snapshot) out.snapshot = await pmgCloudPushSnapshot(opts.snapshot).catch((e) => ({ ok: false, error: String(e.message || e) }));
  if (opts.pull) out.pull = await pmgCloudPullSnapshot().catch((e) => ({ ok: false, error: String(e.message || e) }));
  out.state = await pmgCloudSync().catch((e) => ({ ok: false, error: String(e.message || e) }));
  out.health = await pmgHealthPull().catch((e) => ({ ok: false, error: String(e.message || e) }));
  return out;
}

// ---------- Фото к домашке ----------
async function pmgHwPhotoUpload(dataUrl) {
  const s = await pmgSession(false);
  const path = s.user_id + '/hw/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
  await pmgSbFetch('/storage/v1/object/hw-photos/' + path, {
    method: 'POST', token: s.access_token, body: pmgDataUrlToBlob(dataUrl), headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }
  });
  return path;
}

// Подписанные ссылки на фото (живут час). asData — превратить в data: (для страницы дневника, где чужие адреса не грузятся).
const pmgHwUrlCache = new Map();
async function pmgHwPhotoUrls(paths, asData) {
  const now = Date.now();
  const need = [...new Set(paths.filter(Boolean))].filter((p) => { const c = pmgHwUrlCache.get(p); return !c || c.exp < now || (asData && !c.data); });
  if (need.length) {
    const s = await pmgSession(false);
    const signed = await pmgSbFetch('/storage/v1/object/sign/hw-photos', { token: s.access_token, json: { expiresIn: 3600, paths: need } });
    await Promise.all((signed || []).map(async (it) => {
      if (!it.signedURL) return;
      const url = PMG_SB_URL + '/storage/v1' + it.signedURL;
      const entry = { url, exp: now + 50 * 60e3 };
      if (asData) { try { const r = await fetch(url); if (r.ok) entry.data = await pmgBlobToDataUrl(await r.blob()); } catch (_) { /* без превью */ } }
      pmgHwUrlCache.set(it.path, entry);
    }));
  }
  const out = {};
  paths.forEach((p) => { const c = pmgHwUrlCache.get(p); if (c) out[p] = asData ? c.data || null : c.url; });
  return out;
}
