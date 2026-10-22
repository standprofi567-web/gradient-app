// Связь с сервером Gradient (Supabase) через обычный fetch, без сторонних библиотек.
// Работает в фоновом скрипте; страницы обращаются к нему сообщениями.

const PMG_AUTH_KEY = 'pmg_auth';
let pmgAuthPromise = null;

// Запрос с ограничением по времени: без VPN сервер иногда не отвечает вовсе, а не отказывает.
async function pmgFetchT(url, init, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

// Дорога до сервера Gradient: сначала напрямую; если не вышло (нет VPN, обрыв, долго молчит) —
// через мост в России, и следующие полчаса сразу через него.
const pmgRoute = { via: null, until: 0, fails: 0 };
function pmgSbBase() { return pmgRoute.via === 'bridge' && Date.now() < pmgRoute.until ? PMG_BRIDGE_URL + '/sb' : PMG_SB_URL; }
async function pmgSbRequest(path, init) {
  const viaBridge = () => pmgFetchT(PMG_BRIDGE_URL + '/sb' + path, init, 20000);
  if (PMG_BRIDGE_URL && pmgRoute.via === 'bridge' && Date.now() < pmgRoute.until) {
    try { return await viaBridge(); } catch (e) { pmgRoute.via = null; }
  }
  try {
    const r = await pmgFetchT(PMG_SB_URL + path, init, 9000);
    pmgRoute.fails = 0;
    return r;
  } catch (e) {
    if (!PMG_BRIDGE_URL) throw e;
    const r = await viaBridge();
    pmgRoute.via = 'bridge'; pmgRoute.until = Date.now() + 30 * 60e3; pmgRoute.fails++;
    return r;
  }
}

async function pmgSbFetch(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ apikey: PMG_SB_KEY }, opts.headers || {});
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await pmgSbRequest(path, {
    method: opts.method || (opts.json !== undefined || opts.body ? 'POST' : 'GET'),
    headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body, cache: 'no-store'
  });
  const text = await res.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  if (!res.ok) {
    const err = new Error((body && (body.msg || body.message || body.error_description || body.error)) || ('HTTP ' + res.status));
    err.status = res.status; err.body = body; throw err;
  }
  return body;
}

function pmgSaveAuth(s) {
  const auth = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user_id: s.user && s.user.id };
  return chrome.storage.local.set({ [PMG_AUTH_KEY]: auth }).then(() => auth);
}

// Действующий токен: берём сохранённый, при необходимости обновляем. create — создать анонимный вход, если его нет.
async function pmgSession(create) {
  if (pmgAuthPromise) return pmgAuthPromise;
  pmgAuthPromise = (async () => {
    const st = (await chrome.storage.local.get(PMG_AUTH_KEY))[PMG_AUTH_KEY];
    if (st && st.expires_at - 90 > Date.now() / 1000) return st;
    if (st && st.refresh_token) {
      try {
        return await pmgSaveAuth(await pmgSbFetch('/auth/v1/token?grant_type=refresh_token', { json: { refresh_token: st.refresh_token } }));
      } catch (e) {
        if (e.status && e.status < 500) { await chrome.storage.local.remove(PMG_AUTH_KEY); if (!create) throw new Error('signed_out'); }
        else throw e;
      }
    }
    if (!create) throw new Error('signed_out');
    return pmgSaveAuth(await pmgSbFetch('/auth/v1/signup', { json: { data: {} } }));
  })();
  try { return await pmgAuthPromise; } finally { pmgAuthPromise = null; }
}

async function pmgRpc(fn, args, create) {
  const s = await pmgSession(!!create);
  try {
    return await pmgSbFetch('/rest/v1/rpc/' + fn, { token: s.access_token, json: args || {} });
  } catch (e) {
    if (e.status === 401) {
      await chrome.storage.local.set({ [PMG_AUTH_KEY]: { ...s, expires_at: 0 } });
      const s2 = await pmgSession(false);
      return pmgSbFetch('/rest/v1/rpc/' + fn, { token: s2.access_token, json: args || {} });
    }
    throw e;
  }
}

async function pmgSha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pmgDataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'image/jpeg';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function pmgBlobToDataUrl(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return 'data:' + (blob.type || 'image/jpeg') + ';base64,' + btoa(s);
}

// Фото: путь {uid}/avatar-<время>.jpg, чтобы у друзей не залипала старая картинка.
async function pmgUploadPhoto(dataUrl) {
  const s = await pmgSession(false);
  const path = s.user_id + '/avatar-' + Date.now() + '.jpg';
  await pmgSbFetch('/storage/v1/object/avatars/' + path, {
    method: 'POST', token: s.access_token, body: pmgDataUrlToBlob(dataUrl), headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }
  });
  const old = (await chrome.storage.local.get('pmg_photo_path')).pmg_photo_path;
  await pmgRpc('update_profile', { p: { photo_path: path } });
  if (old && old !== path) pmgSbFetch('/storage/v1/object/avatars', { method: 'DELETE', token: s.access_token, json: { prefixes: [old] } }).catch(() => {});
  await chrome.storage.local.set({ pmg_photo_path: path });
  return path;
}

async function pmgDeletePhoto() {
  const s = await pmgSession(false);
  const old = (await chrome.storage.local.get('pmg_photo_path')).pmg_photo_path;
  if (old) await pmgSbFetch('/storage/v1/object/avatars', { method: 'DELETE', token: s.access_token, json: { prefixes: [old] } }).catch(() => {});
  await pmgRpc('update_profile', { p: { photo_path: '' } });
  await chrome.storage.local.remove('pmg_photo_path');
}

// Маленькая копия фото: для лесенки, списков и карточки игрока 128 px хватает,
// а весит она в десятки раз меньше — её можно хранить вместе с группой, и фото видны сразу.
async function pmgThumbDataUrl(blob, size) {
  try {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') throw new Error('no_canvas');
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const c = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k)));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return await pmgBlobToDataUrl(await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 }));
  } catch (_) { return pmgBlobToDataUrl(blob); }
}

// Фото друзей: подписанные ссылки → картинки data: (страница дневника не грузит чужие адреса).
const pmgPhotoCache = new Map();
// Кэш картинок в памяти не растёт бесконечно: самые старые записи выбрасываем.
function pmgCacheTrim(map, max) { while (map.size > max) map.delete(map.keys().next().value); }
async function pmgPhotos(paths) {
  const need = [...new Set(paths.filter(Boolean))].filter((p) => !pmgPhotoCache.has(p));
  if (need.length) {
    const s = await pmgSession(false);
    const signed = await pmgSbFetch('/storage/v1/object/sign/avatars', { token: s.access_token, json: { expiresIn: 600, paths: need } });
    await Promise.all((signed || []).map(async (it) => {
      if (!it.signedURL) return;
      try {
        const res = await pmgSbRequest('/storage/v1' + it.signedURL, {});
        if (res.ok) { pmgPhotoCache.set(it.path, await pmgThumbDataUrl(await res.blob(), 128)); pmgCacheTrim(pmgPhotoCache, 60); }
      } catch (_) { /* без фото покажем аватар */ }
    }));
  }
  const out = {};
  paths.forEach((p) => { if (pmgPhotoCache.has(p)) out[p] = pmgPhotoCache.get(p); });
  return out;
}

async function pmgSignOutLocal() {
  await chrome.storage.local.remove([PMG_AUTH_KEY, 'pmg_photo_path', 'pmg_profile']);
}
