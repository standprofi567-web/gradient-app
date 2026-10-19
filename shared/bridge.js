// Мост Gradient: свой сервер в России, который ходит в дневник за тебя.
// Зачем: чтобы оценки обновлялись и уведомления приходили, даже когда компьютер выключен,
// и чтобы приложение на телефоне могло само войти в дневник (через Госуслуги в браузере).
// Здесь — запросы к мосту (работают в фоне расширения и на сайте) и карточка «Вход в дневник».
//
// Как устроено:
//  • Мост получает СВОЙ вход в аккаунт Gradient по одноразовому коду — как ещё одно устройство.
//  • Вход в дневник (токен) приходит одним из путей: расширение передаёт его само после каждого
//    обновления; на телефоне — закладка «Gradient» в браузере, которую нажимаешь на сайте дневника.
//  • Мост раз в 15 минут смотрит дневник, кладёт снимок на сервер и шлёт уведомления о новых оценках.
//  • Всё, что происходит со входом (получен, закончился, ошибки), мост пишет в журнал — он виден здесь.

const PMG_BRIDGE_ON = typeof PMG_BRIDGE_URL !== 'undefined' && !!PMG_BRIDGE_URL;
const PMG_DIARY_SITE = 'https://dnevnik2.petersburgedu.ru';

async function pmgBridgeFetch(path, opts) {
  opts = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) { const s = await pmgSession(!!opts.create); headers.Authorization = 'Bearer ' + s.access_token; }
  let res;
  try {
    res = await pmgFetchT(PMG_BRIDGE_URL + path, { method: opts.body ? 'POST' : 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' }, opts.timeout || 25000);
  } catch (e) { const err = new Error('bridge_down'); err.code = 'bridge_down'; throw err; }
  let body = null; try { body = await res.json(); } catch (_) { /* пусто */ }
  if (!res.ok || !body || body.ok === false) {
    const err = new Error((body && body.error) || ('HTTP ' + res.status)); err.code = (body && body.error) || 'http'; err.body = body; throw err;
  }
  return body;
}

// Состояние моста для экрана: что со входом в дневник и журнал событий.
async function pmgBridgeStatus() {
  if (!PMG_BRIDGE_ON) return { ok: false, error: 'no_bridge' };
  let st;
  try { st = await pmgBridgeFetch('/diary/status'); }
  catch (e) { st = { ok: false, error: e.code || String(e.message || e) }; }
  st.at = Date.now();
  await chrome.storage.local.set({ pmg_bridge: st });
  return st;
}

// Включить: выдать мосту отдельный вход в аккаунт (одноразовый код, как для телефона).
async function pmgBridgeEnable() {
  await pmgSession(true);
  const pc = await pmgRpc('create_pair_code', {}, true);
  if (!pc || !pc.code) throw new Error('pair_failed');
  await pmgBridgeFetch('/diary/connect', { body: { code: pc.code } });
  const st = (await chrome.storage.local.get('pmg_settings')).pmg_settings || {};
  await chrome.storage.local.set({ pmg_settings: { ...st, bridge: true } });
  return pmgBridgeStatus();
}

// Выключить: мост сразу удаляет вход в дневник и свой вход в аккаунт.
async function pmgBridgeDisable() {
  try { await pmgBridgeFetch('/diary/forget', { body: {} }); } catch (_) { /* всё равно выключаем у себя */ }
  const st = (await chrome.storage.local.get('pmg_settings')).pmg_settings || {};
  await chrome.storage.local.set({ pmg_settings: { ...st, bridge: false }, pmg_bridge: null, pmg_bridge_sent: null });
  return { ok: true };
}

// Передать мосту вход в дневник (расширение делает это само после удачного обновления).
async function pmgBridgeSendToken(token, source) {
  if (!PMG_BRIDGE_ON || !token) return { ok: false };
  const st = (await chrome.storage.local.get(['pmg_settings', 'pmg_bridge_sent']));
  if (!(st.pmg_settings && st.pmg_settings.bridge)) return { ok: false, error: 'off' };
  const h = await pmgSha256(token);
  const sent = st.pmg_bridge_sent;
  if (sent && sent.h === h && Date.now() - sent.at < 6 * 3600e3) return { ok: true, same: true };
  const r = await pmgBridgeFetch('/diary/token', { body: { token, source: source || 'extension' } });
  await chrome.storage.local.set({ pmg_bridge_sent: { h, at: Date.now() } });
  pmgBridgeStatus().catch(() => {});
  return r;
}

// Личная закладка для браузера телефона: в ней ключ, по которому мост узнаёт, чей это вход.
async function pmgBridgeKey() {
  const r = await pmgBridgeFetch('/diary/key', { body: {} });
  return { ok: true, key: r.key };
}

// Попросить мост прямо сейчас сходить в дневник. Он сам положит снимок на сервер и вернёт данные.
async function pmgBridgeLoad(studentId) {
  const r = await pmgBridgeFetch('/diary/load', { body: { studentId: studentId || null }, timeout: 60000 });
  if (r.data && r.data.student) {
    await chrome.storage.local.set({ pmg_cache: r.data, pmg_status: { ok: true, at: Date.now(), via: 'bridge' } });
  }
  pmgBridgeStatus().catch(() => {});
  return { ok: true };
}

async function pmgBridgeMessage(msg) {
  switch (msg.op) {
    case 'bridge-status': return pmgBridgeStatus();
    case 'bridge-on': return pmgBridgeEnable();
    case 'bridge-off': return pmgBridgeDisable();
    case 'bridge-key': return pmgBridgeKey();
    case 'bridge-load': return pmgBridgeLoad(msg.studentId);
  }
  return null;
}

// ---------- Карточка «Вход в дневник» (расширение — вкладка «Устройства», телефон — главная и настройки) ----------

const PMG_BR_EVENTS = {
  linked: 'Сервер подключён к аккаунту', token_ext: 'Вход получен от расширения', token_bm: 'Вход получен с телефона (закладка)',
  load_ok: 'Дневник загружен', auth: 'Вход в дневник закончился', net: 'Дневник не ответил', error: 'Ошибка', forget: 'Вход удалён', push: 'Отправлены уведомления'
};

function pmgBrErrText(e) {
  return ({ bridge_down: 'Сервер-мост не отвечает. Возможно, он ещё не запущен или перезагружается.', no_bridge: 'Сервер-мост не настроен.', auth: 'Вход в дневник закончился — войди заново.',
    no_diary: 'Серверу пока не передан вход в дневник.', bad_key: 'Закладка устарела — сделай новую.', not_linked: 'Сервер не подключён к аккаунту — включи вход заново.',
    signed_out: 'Сначала подключи Gradient (код с компьютера или «Начать без компьютера»).', net: 'Дневник не ответил серверу. Попробуем ещё раз через 15 минут.' })[e] || ('Не получилось: ' + (e || 'нет связи'));
}

function pmgBrWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts), mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return mins + ' мин назад';
  const t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return (pmgToday() - new Date(d).setHours(0, 0, 0, 0) === 0 ? 'сегодня' : d.getDate() + ' ' + PMG_MONTHS[d.getMonth()].slice(0, 3)) + ' в ' + t;
}

// Закладка: читает вход с открытого сайта дневника и отправляет его мосту вместе с личным ключом.
function pmgBookmarklet(key) {
  const js = "(function(){var t=sessionStorage.getItem('X-JWT-Token-FOREIGN')||sessionStorage.getItem('X-JWT-Token');" +
    "if(!/petersburgedu/.test(location.host)){alert('Gradient: открой сначала сайт дневника');return}" +
    "if(!t){alert('Gradient: сначала войди в дневник');return}" +
    "fetch('" + PMG_BRIDGE_URL + "/diary/token',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key:'" + key + "',token:decodeURIComponent(t),source:'bookmarklet'})})" +
    ".then(function(r){return r.json()}).then(function(j){alert(j.ok?'Gradient: вход передан ✓ Возвращайся в приложение':'Gradient: '+(j.error==='bad_key'?'закладка устарела, сделай новую':j.error==='auth'?'дневник не пустил, войди ещё раз':j.error))})" +
    ".catch(function(){alert('Gradient: нет связи с сервером')})})()";
  return 'javascript:' + encodeURIComponent(js).replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/%3D/g, '=').replace(/%3B/g, ';').replace(/%2B/g, '+');
}

function pmgBridgeCard(opts) {
  opts = opts || {};
  if (!PMG_BRIDGE_ON) return '';
  const on = !!(pmg.settings && pmg.settings.bridge);
  const B = pmg.bridge || null;
  const web = typeof PMG_IS_WEB !== 'undefined' && PMG_IS_WEB;
  let h = '<section class="card br-card' + (opts.alert ? ' alert' : '') + '"><div class="card-head"><h3>Вход в дневник</h3>' +
    (on ? '<button class="icon-btn' + (pmg.brBusy ? ' spin' : '') + '" data-act="br-refresh" aria-label="Обновить" data-tip="Проверить ещё раз">' + pmgIcon('refresh') + '</button>' : '') + '</div>';
  if (!on) {
    h += '<p>' + (web ? 'Чтобы оценки и домашка приходили на телефон без компьютера' : 'Чтобы оценки обновлялись и уведомления приходили, даже когда компьютер выключен') +
      ', их может забирать <b>сервер Gradient в России</b>: раз в 15 минут он сам смотрит дневник с твоим входом.</p>' +
      '<p class="muted small">Для этого сервер хранит вход в дневник (зашифрованным) и видит то же, что ты в дневнике. Пароль от Госуслуг он не видит и не получает. Выключить можно в любой момент — вход сразу удалится с сервера.</p>' +
      '<div class="row-btns"><button class="btn primary" data-act="br-on"' + (pmg.brBusy ? ' disabled' : '') + '>' + (pmg.brBusy ? 'Подключаю…' : 'Разрешить и включить') + '</button></div>';
    if (pmg.brErr) h += '<p class="err">' + pmgEsc(pmgBrErrText(pmg.brErr)) + '</p>';
    return h + '</section>';
  }
  const D = (B && B.diary) || {};
  const down = B && B.ok === false;
  const good = B && B.ok !== false && D.has && D.state === 'ok';
  const needLogin = B && B.ok !== false && (!D.has || D.state === 'auth');
  // Строка состояния
  let line, cls;
  if (!B) { line = 'Проверяю…'; cls = ''; }
  else if (down) { line = pmgBrErrText(B.error); cls = 'bad'; }
  else if (good) { line = 'Работает' + (D.lastOk ? ' · дневник загружен ' + pmgBrWhen(D.lastOk) : '') + (D.exp ? ' · вход действует до ' + new Date(D.exp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : ''); cls = 'ok'; }
  else if (needLogin) { line = D.has ? 'Вход в дневник закончился ' + pmgBrWhen(D.lastErrorAt) + '. Войди заново.' : 'Серверу ещё не передан вход в дневник.'; cls = 'bad'; }
  else { line = D.lastError ? pmgBrErrText(D.lastError) + (D.lastErrorAt ? ' (' + pmgBrWhen(D.lastErrorAt) + ')' : '') : 'Ждёт первой проверки'; cls = 'warn'; }
  h += '<p class="br-state ' + cls + '"><i></i>' + pmgEsc(line) + '</p>';

  // Панель входа: Госуслуги → закладка (телефон) или просто открыть дневник (компьютер)
  if (needLogin || opts.alert) {
    h += '<div class="br-login"><a class="btn primary big br-gos" href="' + PMG_DIARY_SITE + '/" target="_blank" rel="noopener"><span class="gos-ic" aria-hidden="true">Г</span>Войти через Госуслуги</a>';
    if (web) {
      h += '<ol class="br-steps"><li>Нажми кнопку выше и войди в дневник через Госуслуги, как обычно.</li>' +
        '<li>Когда откроется дневник, нажми в браузере закладку <b>«Gradient»</b>. Появится «вход передан ✓».</li>' +
        '<li>Вернись сюда и нажми <b>«Обновить»</b>.</li></ol>' +
        (pmg.brKey ? pmgBookmarkletHelp(pmg.brKey) : '<button class="btn small" data-act="br-key"' + (pmg.brBusy ? ' disabled' : '') + '>Сделать закладку «Gradient»</button><span class="muted small"> — один раз на этом телефоне</span>');
    } else {
      h += '<p class="muted small">Войди в дневник на этом компьютере — Gradient сам передаст вход серверу, и дальше всё будет работать без компьютера.</p>';
    }
    h += '</div>';
  }
  h += '<div class="row-btns"><button class="btn' + (good ? '' : ' primary') + '" data-act="br-load"' + (pmg.brBusy ? ' disabled' : '') + '>' + (pmg.brBusy === 'load' ? 'Загружаю…' : 'Обновить') + '</button>' +
    (pmg.mode === 'drawer' ? '<button class="btn" data-act="page-reload" data-tip="Если дневник завис или выкинул из входа">Перезагрузить страницу дневника</button>' : '') +
    '<button class="link sm" data-act="br-log">' + (pmg.brLog ? 'Скрыть журнал' : 'Журнал') + '</button></div>';
  if (pmg.brErr) h += '<p class="err">' + pmgEsc(pmgBrErrText(pmg.brErr)) + '</p>';
  if (pmg.brLog) {
    const ev = (B && B.events) || [];
    h += '<ul class="br-log">' + (ev.length ? ev.slice(0, 12).map((e) => '<li class="' + (e.ok === false ? 'bad' : '') + '"><time>' + pmgEsc(pmgBrWhen(e.t)) + '</time><span>' + pmgEsc(PMG_BR_EVENTS[e.kind] || e.kind) + (e.text ? ' — ' + pmgEsc(e.text) : '') + '</span></li>').join('') : '<li class="muted">Пока пусто.</li>') + '</ul>' +
      '<div class="row-btns">' + (pmg.confirm === 'br-off' ? '<button class="btn small danger" data-act="br-off">Точно выключить и удалить вход?</button>' : '<button class="btn small" data-act="br-off">Выключить вход через сервер</button>') + '</div>';
  }
  return h + '</section>';
}

function pmgBookmarkletHelp(key) {
  const code = pmgBookmarklet(key);
  const ios = /iPhone|iPad/.test(navigator.userAgent || '');
  return '<details class="br-bm" open><summary>Как сделать закладку «Gradient»</summary>' +
    '<div class="hl-copy"><code>' + pmgEsc(code.slice(0, 60)) + '…</code><button class="btn small" data-act="br-copy" data-v="' + pmgEsc(code) + '">Копировать</button></div>' +
    (ios
      ? '<ol class="br-steps"><li>Нажми «Копировать».</li><li>В Safari открой любую страницу, нажми «Поделиться» → <b>«Добавить закладку»</b>, назови <b>Gradient</b>, сохрани.</li>' +
        '<li>Открой закладки (значок книжки) → «Изменить» → закладка Gradient → в поле адреса удали всё и вставь скопированное.</li></ol>'
      : '<ol class="br-steps"><li>Нажми «Копировать».</li><li>В Chrome нажми ☆ (добавить в закладки), потом «Изменить». Название — <b>Gradient</b>, в поле адреса вставь скопированное.</li>' +
        '<li>На сайте дневника набери в адресной строке <b>Gradient</b> и выбери закладку со звёздочкой.</li></ol>') +
    '<p class="muted small">В закладке твой личный ключ — никому её не отправляй. Если потеряешь, сделай новую: старая перестанет работать.</p></details>';
}

async function pmgBridgeAct(act, t) {
  const done = () => { pmg.brBusy = null; pmgRender(true, true); };
  switch (act) {
    case 'br-on': {
      pmg.brBusy = 'on'; pmg.brErr = null; pmgRender(true, true);
      const r = await pmgGameMsg('bridge-on');
      if (!r || r.ok === false) pmg.brErr = (r && r.error) || 'bridge_down';
      else { pmg.settings.bridge = true; pmg.bridge = r; }
      done(); return true;
    }
    case 'br-off': {
      if (pmg.confirm !== 'br-off') { pmg.confirm = 'br-off'; pmgRender(true, true); return true; }
      pmg.confirm = null; await pmgGameMsg('bridge-off'); pmg.settings.bridge = false; pmg.bridge = null; pmg.brKey = null; pmgRender(true, true); return true;
    }
    case 'br-refresh': {
      pmg.brBusy = 'status'; pmgRender(true, true);
      const r = await pmgGameMsg('bridge-status'); pmg.bridge = r; done(); return true;
    }
    case 'br-load': {
      pmg.brBusy = 'load'; pmg.brErr = null; pmgRender(true, true);
      const r = await pmgGameMsg('bridge-load', { studentId: pmg.settings.studentId });
      if (!r || r.ok === false) pmg.brErr = (r && r.error) || 'bridge_down';
      else pmgToast('Дневник обновлён');
      const st = await pmgGameMsg('bridge-status'); pmg.bridge = st;
      done(); return true;
    }
    case 'br-key': {
      pmg.brBusy = 'key'; pmgRender(true, true);
      const r = await pmgGameMsg('bridge-key');
      if (r && r.ok) pmg.brKey = r.key; else pmg.brErr = (r && r.error) || 'bridge_down';
      done(); return true;
    }
    case 'br-copy': {
      try { await navigator.clipboard.writeText(t.dataset.v); pmgToast('Скопировано — теперь вставь в закладку'); } catch (_) { pmgToast('Не получилось скопировать'); }
      return true;
    }
    case 'br-log': pmg.brLog = !pmg.brLog; pmgRender(true, true); return true;
    case 'page-reload': location.reload(); return true;
  }
  return false;
}
