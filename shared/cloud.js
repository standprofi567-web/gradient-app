// Связка компьютера и телефона через сервер Gradient.
// Расширение отправляет снимок дневника; оба устройства обмениваются галочками домашки, входами, заданиями и настройками.
// Работает и в фоне расширения, и на сайте.

// Словари: сливаются по записям. В pmg_done снятая галочка уходит как 0.
// pmg_own_hw — своя домашка {id: {id, subject, subjectId, text, due, created, edited, deleted}};
// pmg_hw_photos — фото к любой домашке {ключ домашки: [{p: путь, t: время, x: убрано}]}.
const PMG_CLOUD_MAPS = { pmg_done: 'done', pmg_logins: 'logins', pmg_actions: 'actions', pmg_quests: 'quests', pmg_wquests: 'wquests', pmg_mark_seen: 'seen', pmg_own_hw: 'own_hw', pmg_hw_photos: 'hw_photos' };
// Целиком: побеждает последнее изменение.
const PMG_CLOUD_LWW = { pmg_hw_due: 'hw_due', pmg_settings: 'settings', pmg_profile: 'profile' };

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

async function pmgPairCode() {
  const r = await pmgRpc('create_pair_code', {}, true);
  return r;
}

// Телефон: войти в аккаунт компьютера по коду.
async function pmgPairClaim(code) {
  const res = await pmgSbRequest('/functions/v1/pair', {
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
  out.devices = await pmgDevicesSync(typeof PMG_WEB !== 'undefined' && PMG_WEB ? 'web' : 'extension').catch((e) => ({ ok: false, error: String(e.message || e) }));
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
      const entry = { path: '/storage/v1' + it.signedURL, exp: now + 50 * 60e3 };
      if (asData) { try { const r = await pmgSbRequest(entry.path, {}); if (r.ok) entry.data = await pmgBlobToDataUrl(await r.blob()); } catch (_) { /* без превью */ } }
      pmgHwUrlCache.set(it.path, entry);
      pmgCacheTrim(pmgHwUrlCache, 40);
    }));
  }
  const out = {};
  // Ссылку отдаём через ту дорогу, что сейчас работает (напрямую или через мост)
  paths.forEach((p) => { const c = pmgHwUrlCache.get(p); if (c) out[p] = asData ? c.data || null : pmgSbBase() + c.path; });
  return out;
}

// ---------- Устройства ----------
function pmgPlatform() {
  const ua = navigator.userAgent || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Устройство';
  const br = navigator.brave ? 'Brave' : /YaBrowser/.test(ua) ? 'Яндекс Браузер' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return br ? os + ' · ' + br : os;
}

async function pmgDeviceId() {
  const s = await chrome.storage.local.get('pmg_device_id');
  if (s.pmg_device_id) return s.pmg_device_id;
  const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await chrome.storage.local.set({ pmg_device_id: id });
  return id;
}

// Отметиться на сервере и забрать список устройств аккаунта.
async function pmgDevicesSync(kind) {
  const id = await pmgDeviceId();
  const plat = pmgPlatform();
  const reg = await pmgRpc('register_device', { p_id: id, p_kind: kind, p_platform: plat, p_name: (kind === 'web' ? 'Приложение · ' : 'Расширение · ') + plat });
  const list = await pmgRpc('list_devices', {});
  await chrome.storage.local.set({ pmg_devices: { at: Date.now(), me: id, ...(list || {}) } });
  return { ok: true, revoked: !!(reg && reg.revoked) };
}

async function pmgDeviceRevoke(id) {
  await pmgRpc('revoke_device', { p_id: id });
  const list = await pmgRpc('list_devices', {});
  const s = await chrome.storage.local.get('pmg_devices');
  await chrome.storage.local.set({ pmg_devices: { ...(s.pmg_devices || {}), at: Date.now(), ...(list || {}) } });
  return { ok: true };
}

// ---------- Уведомления на телефон (Web Push) ----------
const PMG_VAPID = 'BFqxvGZaS79YEs3SFQeRlDkU9tjkyD_qdSNJopiy-FQLmIDETUH5HHiqXgL6thK4XMk3gXIn7VmrSoKjLKwua2U';
// Расширение: разослать новости на телефоны этого аккаунта (сервер шлёт только на свои подписки).
async function pmgCloudPush(items) {
  if (!items || !items.length) return { ok: true, sent: 0 };
  const s = await pmgSession(false);
  return pmgSbFetch('/functions/v1/push', { token: s.access_token, json: { items: items.slice(0, 5) } });
}
async function pmgPushTest() {
  const s = await pmgSession(false);
  return pmgSbFetch('/functions/v1/push', { token: s.access_token, json: { test: true } });
}
// Сайт: состояние подписки на этом устройстве
async function pmgPushState() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad/.test(ua);
  const standalone = !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let subscribed = false;
  if (supported) {
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); subscribed = !!sub && Notification.permission === 'granted'; } catch (_) { /* нет */ }
  }
  return { supported, ios, standalone, subscribed, permission: supported ? Notification.permission : 'unsupported' };
}
function pmgB64u(s) { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
async function pmgPushSubscribe() {
  const st = await pmgPushState();
  if (!st.supported) return { ok: false, error: st.ios && !st.standalone ? 'ios_home' : 'unsupported' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, error: 'denied' };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pmgB64u(PMG_VAPID) });
  const j = sub.toJSON();
  await pmgRpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_device: await pmgDeviceId() });
  await chrome.storage.local.set({ pmg_push_on: true });
  pmgPushTest().catch(() => {});
  return { ok: true };
}
async function pmgPushUnsubscribe() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { await pmgRpc('push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } catch (_) { /* ничего */ }
  await chrome.storage.local.set({ pmg_push_on: false });
  return { ok: true };
}
