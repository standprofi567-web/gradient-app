// Gradient на сайте: подменяем API расширения (chrome.storage, chrome.runtime), чтобы общий код работал в браузере.
var PMG_WEB = true;
(function () {
  const PFX = 'gx:';
  const listeners = [];
  const mem = {};
  const read = (k) => {
    if (k in mem) return mem[k];
    try { const v = localStorage.getItem(PFX + k); mem[k] = v == null ? undefined : JSON.parse(v); } catch (_) { mem[k] = undefined; }
    return mem[k];
  };
  const write = (k, v) => {
    mem[k] = v;
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) { console.warn('Gradient: не хватило места для', k, e); }
  };
  const drop = (k) => { mem[k] = undefined; try { localStorage.removeItem(PFX + k); } catch (_) { /* ничего */ } };
  const allKeys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PFX)) out.push(k.slice(PFX.length)); } } catch (_) { /* ничего */ } return out; };
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  function emit(ch) {
    if (!Object.keys(ch).length) return;
    setTimeout(() => listeners.forEach((f) => { try { f(ch, 'local'); } catch (e) { console.error(e); } }), 0);
  }
  const local = {
    get(keys, cb) {
      let ks;
      if (keys == null) ks = allKeys();
      else if (typeof keys === 'string') ks = [keys];
      else if (Array.isArray(keys)) ks = keys;
      else ks = Object.keys(keys);
      const out = {};
      ks.forEach((k) => {
        const v = read(k);
        if (v !== undefined) out[k] = clone(v);
        else if (keys && typeof keys === 'object' && !Array.isArray(keys)) out[k] = keys[k];
      });
      if (cb) setTimeout(() => cb(out), 0);
      return Promise.resolve(out);
    },
    set(obj, cb) {
      const ch = {};
      Object.entries(obj).forEach(([k, v]) => { const old = read(k); write(k, clone(v)); ch[k] = { oldValue: old, newValue: clone(v) }; });
      emit(ch);
      if (cb) setTimeout(cb, 0);
      return Promise.resolve();
    },
    remove(keys, cb) {
      const ks = typeof keys === 'string' ? [keys] : keys;
      const ch = {};
      ks.forEach((k) => { const old = read(k); if (old !== undefined) { drop(k); ch[k] = { oldValue: old }; } });
      emit(ch);
      if (cb) setTimeout(cb, 0);
      return Promise.resolve();
    },
    clear() { allKeys().forEach(drop); return Promise.resolve(); }
  };
  window.chrome = {
    storage: { local, onChanged: { addListener: (f) => listeners.push(f) } },
    runtime: {
      lastError: undefined,
      getURL: (p) => p,
      getManifest: () => ({ version: window.PMG_WEB_VERSION || 'web' }),
      sendMessage(msg, cb) {
        const p = (window.pmgWebMessage ? window.pmgWebMessage(msg) : Promise.resolve({ ok: false, error: 'not_ready' }))
          .catch((e) => ({ ok: false, error: String((e && e.message) || e) }));
        if (cb) { p.then((r) => cb(r)); return undefined; }
        return p;
      },
      onMessage: { addListener() {} }
    }
  };
})();
