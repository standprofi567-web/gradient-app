// Вкладка «Устройства»: телефон (код и QR), список устройств и связь с дневником.

const PMG_SITE = 'https://gradient.klxshvpn.ru/';
const PMG_IS_WEB = typeof PMG_WEB !== 'undefined' && PMG_WEB;

function pmgFmtInt(n) { return n == null ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function pmgDaysBack(n, from) { const out = []; const base = from ? new Date(from) : pmgToday(); for (let i = n - 1; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); out.push(pmgIso(d)); } return out; }

// Вкладка расширения «Устройства»: связь с телефоном, связь с дневником и список устройств.
function pmgDevicesView() {
  const cloud = pmg.settings && pmg.settings.cloud;
  let h = '<div class="health devs">';
  h += pmgPairCard(!cloud);
  if (typeof pmgBridgeCard === 'function') h += pmgBridgeCard();
  if (cloud) h += pmgDevicesBlock();
  return h + '</div>';
}

function pmgTimeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts), mins = Math.round((Date.now() - d) / 60000);
  if (mins < 2) return 'только что';
  if (mins < 60) return mins + ' мин назад';
  const day = pmgAgo(d);
  return (day === 'сегодня' ? 'сегодня' : day) + ' в ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const PMG_DEV_ICON = {
  pc: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

// Список устройств аккаунта. Общий для расширения и приложения.
function pmgDevicesBlock() {
  const D = pmg.devices || {};
  const list = D.devices || [];
  const row = (icon, title, sub, extra) => '<li class="dev"><span class="dev-ic">' + icon + '</span><div class="dev-main"><b>' + title + '</b><small class="muted">' + sub + '</small></div>' + (extra || '') + '</li>';
  let h = '<section class="card devs-list"><div class="card-head"><h3>Устройства</h3>' + (D.at ? '<span class="muted small">обновлено ' + pmgTimeAgo(D.at) + '</span>' : '') + '</div><ul>';
  list.forEach((d) => {
    const me = d.id === D.me;
    const isPhone = /iPhone|Android|iPad/.test(d.platform || '');
    const extra = me ? '<span class="dev-me">это устройство</span>'
      : pmg.confirm === 'rev:' + d.id ? '<button class="btn small danger" data-act="dev-revoke" data-v="' + pmgEsc(d.id) + '">Точно отключить?</button>'
      : '<button class="btn small" data-act="dev-revoke" data-v="' + pmgEsc(d.id) + '">Отключить</button>';
    h += row(isPhone ? PMG_DEV_ICON.phone : PMG_DEV_ICON.pc, pmgEsc(d.kind === 'web' ? 'Приложение Gradient' : 'Расширение Gradient'),
      pmgEsc(d.platform || '') + ' · ' + (me ? 'сейчас' : 'был ' + pmgTimeAgo(d.last_seen)), extra);
  });
  if (!list.length) h += '<li class="dev empty muted">Пока ни одного устройства. Подключи телефон — и он появится здесь.</li>';
  h += '</ul>';
  if (D.snapshot_at) h += '<p class="muted small dev-note">Последний снимок дневника на сервере: ' + pmgTimeAgo(D.snapshot_at) + '.</p>';
  if (PMG_IS_WEB) h += '<div class="hl-dev-act">' + (pmg.confirm === 'signout' ? '<button class="btn small danger" data-act="hl-signout">Точно выйти?</button>' : '<button class="btn small" data-act="hl-signout">Выйти на этом телефоне</button>') + '</div>';
  else h += '<div class="hl-dev-act">' + (pmg.confirm === 'cloud-off' ? '<button class="btn small danger" data-act="hl-cloud-off">Точно выключить?</button>' : '<button class="btn small" data-act="hl-cloud-off">Выключить связь с телефоном</button>') +
    '<span class="muted small">Оценки перестанут отправляться на сервер.</span></div>';
  return h + '</section>';
}

// ---------- Подключить телефон (расширение) ----------
function pmgPairCard(promo) {
  const pc = pmg.pairCode;
  let h = '<section class="card hl-dev' + (promo ? ' promo' : '') + '"><div class="card-head"><h3>' + (promo ? 'Gradient на телефоне' : 'Подключить телефон') + '</h3></div>';
  if (promo) h += '<p class="muted">Приложение на телефоне: оценки, домашка (можно добавлять свою, с фото доски), отчёты и Gradient Pass с огоньком и заданиями. Работает на iPhone и Android. Оценки будут храниться на сервере в закрытом разделе — видишь их только ты.</p>';
  if (pc && pc.expires > Date.now()) {
    const link = PMG_SITE + '#pair=' + pc.raw;
    let qr = '';
    try { const q = qrcode(0, 'M'); q.addData(link); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } catch (_) { /* без QR */ }
    const left = Math.max(0, Math.ceil((pc.expires - Date.now()) / 60000));
    h += '<div class="pair"><div class="pair-qr">' + qr + '</div><div class="pair-txt"><p>Наведи камеру телефона на QR-код или открой <b>' + PMG_SITE.replace('https://', '').replace(/\/$/, '') + '</b> и введи код:</p>' +
      '<div class="pair-code">' + pmgEsc(pc.code) + '</div><p class="muted small">Код одноразовый, действует ещё ' + left + ' мин.</p>' +
      '<p class="muted small">iPhone: в Safari «Поделиться» → «На экран Домой». Android: в Chrome меню ⋮ → «Добавить на главный экран».</p></div></div>';
  } else {
    h += '<div class="hl-dev-act"><button class="btn primary" data-act="hl-pair"' + (pmg.busy ? ' disabled' : '') + '>' + (pmg.busy ? 'Готовлю код…' : promo ? 'Подключить телефон' : 'Показать код для ещё одного телефона') + '</button></div>';
  }
  if (pmg.pairError) h += '<p class="err">' + pmgEsc(pmg.pairError) + '</p>';
  return h + '</section>';
}

// ---------- Действия ----------
async function pmgDevicesAct(act, t) {
  const v = t.dataset.v;
  switch (act) {
    case 'hl-pair': {
      pmg.busy = true; pmg.pairError = null; pmgRender(true, true);
      const r = await pmgGameMsg('pair-code');
      pmg.busy = false;
      if (r && r.ok) {
        pmg.pairCode = { code: r.code, raw: r.code.replace('-', ''), expires: new Date(r.expires_at).getTime() };
        clearInterval(pmg.pairTimer);
        const webBefore = ((pmg.devices && pmg.devices.devices) || []).filter((d) => d.kind === 'web').length;
        let ticks = 0;
        pmg.pairTimer = setInterval(async () => {
          ticks++;
          if (!pmg.pairCode || pmg.pairCode.expires < Date.now()) { clearInterval(pmg.pairTimer); pmgRender(true, true); return; }
          // Ждём, пока телефон войдёт по коду
          const d = await pmgGameMsg('devices');
          const now = ((pmg.devices && pmg.devices.devices) || []).filter((x) => x.kind === 'web').length;
          if (d && d.ok && now > webBefore) { clearInterval(pmg.pairTimer); pmg.pairCode = null; pmgToast('Телефон подключён'); }
          if (pmg.tab === 'devices' && (ticks % 6 === 0 || !pmg.pairCode)) pmgRender(true, true);
        }, 5000);
      } else pmg.pairError = 'Не получилось: ' + pmgErrText((r && r.error) || 'network');
      pmgRender(true, true); return true;
    }
    case 'hl-cloud-off': {
      if (pmg.confirm !== 'cloud-off') { pmg.confirm = 'cloud-off'; pmgRender(true, true); return true; }
      pmg.confirm = null; await pmgGameMsg('cloud-off'); pmgRender(true, true); return true;
    }
    case 'dev-revoke': {
      if (pmg.confirm !== 'rev:' + v) { pmg.confirm = 'rev:' + v; pmgRender(true, true); return true; }
      pmg.confirm = null; await pmgGameMsg('device-revoke', { id: v }); pmgRender(true, true); return true;
    }
    case 'hl-sync': {
      t.disabled = true; t.textContent = 'Обновляю…';
      await pmgRefresh();
      return true;
    }
    case 'hl-signout': {
      if (pmg.confirm !== 'signout') { pmg.confirm = 'signout'; pmgRender(true, true); return true; }
      pmg.confirm = null;
      if (typeof pmgWebSignOut === 'function') pmgWebSignOut();
      return true;
    }
  }
  return false;
}
