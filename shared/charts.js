// Графики на чистом SVG. Анимации описаны в ui.css и выключаются при «уменьшить движение».

function pmgEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pmgMarkClass(v) {
  return v == null ? 'm0' : 'm' + Math.max(2, Math.min(5, v));
}

// Кольцо со средним баллом: заполненность — где средний между 2 и 5.
function pmgRing(avg, rounded, size) {
  size = size || 64;
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const frac = avg == null ? 0 : Math.max(0, Math.min(1, (avg - 2) / 3));
  const off = c * (1 - frac);
  return '<svg class="ring ' + pmgMarkClass(rounded) + '" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Средний ' + pmgFmtAvg(avg) + '">' +
    '<circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"/>' +
    '<circle class="ring-arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" style="--c:' + c.toFixed(1) + ';--off:' + off.toFixed(1) + '" stroke-dasharray="' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
    '<text x="50%" y="52%" class="ring-text" style="font-size:' + Math.round(size * 0.25) + 'px" dominant-baseline="central" text-anchor="middle">' + pmgFmtAvg(avg) + '</text></svg>';
}

// Линия «как менялся средний» + точки самих оценок + границы оценок.
// extra — воображаемые оценки из режима «что если», рисуются пунктиром.
function pmgLineChart(marks, extra, threshold, w, h) {
  w = w || 640; h = h || 240;
  const pad = { l: 34, r: 74, t: 14, b: 26 };
  const all = marks.map((m) => m.value).concat(extra || []);
  if (!all.length) return '<div class="empty">Оценок за этот период пока нет.</div>';
  const run = pmgRunning(all);
  const n = all.length;
  const X = (i) => pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : i * (w - pad.l - pad.r) / (n - 1));
  const Y = (v) => pad.t + (5.2 - v) * (h - pad.t - pad.b) / 3.4;

  let g = '';
  // Сетка 2..5
  for (let v = 2; v <= 5; v++) {
    g += '<line class="grid" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>';
    g += '<text class="axis" x="' + (pad.l - 10) + '" y="' + Y(v) + '" dominant-baseline="central" text-anchor="end">' + v + '</text>';
  }
  // Границы оценок
  for (let t = 3; t <= 5; t++) {
    const y = Y(t - 1 + threshold);
    g += '<line class="bound" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + y + '" y2="' + y + '"/>';
    g += '<text class="bound-label" x="' + (w - pad.r + 6) + '" y="' + y + '" dominant-baseline="central">порог «' + t + '»</text>';
  }
  // Сами оценки — точки
  all.forEach((v, i) => {
    const hyp = i >= marks.length;
    g += '<circle class="dot ' + pmgMarkClass(v) + (hyp ? ' hyp' : '') + '" cx="' + X(i) + '" cy="' + Y(v) + '" r="4.5"/>';
  });
  // Средний
  const real = run.slice(0, marks.length);
  if (real.length > 1) {
    const line = real.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    g = '<defs><linearGradient id="pmg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="area-top"/><stop offset="1" class="area-bot"/></linearGradient></defs>' + g;
    g += '<path class="area" d="' + line + ' L' + X(real.length - 1).toFixed(1) + ' ' + Y(2) + ' L' + X(0).toFixed(1) + ' ' + Y(2) + ' Z"/>';
    g += '<path class="pen" pathLength="1" d="' + line + '"/>';
  }
  if (extra && extra.length) {
    const start = Math.max(0, marks.length - 1);
    g += '<path class="pen hyp" d="' + run.slice(start).map((v, i) => (i ? 'L' : 'M') + X(start + i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ') + '"/>';
  }
  const last = run[run.length - 1];
  g += '<circle class="pen-end" cx="' + X(n - 1) + '" cy="' + Y(last) + '" r="5"/>';
  // Невидимые зоны наведения
  all.forEach((v, i) => {
    const m = marks[i];
    const tip = m ? (m.date + ', ' + m.typeName + ': ' + v + (m.comment ? ' (' + m.comment + ')' : '')) : 'Воображаемая оценка: ' + v;
    g += '<rect class="hit" x="' + (X(i) - 10) + '" y="' + pad.t + '" width="20" height="' + (h - pad.t - pad.b) + '" data-tip="' + pmgEsc(tip + '\nСредний после неё: ' + pmgFmtAvg(run[i])) + '"/>';
  });
  return '<svg class="line-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Как менялся средний балл">' + g + '</svg>';
}

// Сколько каких оценок: горизонтальные полосы.
function pmgDistBars(dist) {
  const max = Math.max(1, dist[5], dist[4], dist[3], dist[2] + (dist[1] || 0));
  return '<div class="dist">' + [5, 4, 3, 2].map((k, i) => {
    const v = k === 2 ? dist[2] + (dist[1] || 0) : dist[k];
    return '<div class="dist-row"><span class="mark ' + pmgMarkClass(k) + '">' + k + '</span>' +
      '<span class="dist-track"><span class="dist-bar ' + pmgMarkClass(k) + '" style="--w:' + (v / max * 100).toFixed(1) + '%;--d:' + i * 70 + 'ms"></span></span>' +
      '<span class="dist-n">' + v + '</span></div>';
  }).join('') + '</div>';
}

// Сплошная полоса из частей (для причин пропусков).
function pmgStacked(parts) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return '<div class="stacked" role="img" aria-label="' + pmgEsc(parts.map((p) => p.label + ': ' + p.value).join(', ')) + '">' +
    parts.filter((p) => p.value).map((p, i) => '<span class="seg ' + p.cls + '" style="--w:' + (p.value / total * 100).toFixed(2) + '%;--d:' + i * 90 + 'ms" title="' + pmgEsc(p.label + ': ' + p.value) + '"></span>').join('') +
    '</div><div class="legend">' + parts.map((p) => '<span><i class="sw ' + p.cls + '"></i>' + pmgEsc(p.label) + ' <b>' + p.value + '</b></span>').join('') + '</div>';
}

// Полукруглая шкала среднего от 2 до 5 для главного экрана.
function pmgGauge(avg, rounded, animate) {
  const w = 240, h = 132, cx = 120, cy = 120, r = 100;
  const frac = avg == null ? 0 : Math.max(0, Math.min(1, (avg - 2) / 3));
  const len = Math.PI * r;
  const arc = 'M' + (cx - r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy;
  let ticks = '';
  for (let v = 2; v <= 5; v++) {
    const a = Math.PI * (1 - (v - 2) / 3);
    const x1 = cx + Math.cos(a) * (r + 10), y1 = cy - Math.sin(a) * (r + 10);
    ticks += '<text class="g-tick" x="' + x1.toFixed(1) + '" y="' + (y1 + (v === 2 || v === 5 ? 14 : 0)).toFixed(1) + '" text-anchor="' + (v === 2 ? 'end' : v === 5 ? 'start' : 'middle') + '">' + v + '</text>';
  }
  return '<svg class="gauge ' + pmgMarkClass(rounded) + (animate ? ' anim' : '') + '" viewBox="-14 -14 ' + (w + 28) + ' ' + (h + 14) + '" aria-hidden="true">' +
    '<defs><linearGradient id="pmg-g" x1="0" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>' +
    '<path class="g-track" d="' + arc + '"/>' +
    '<path class="g-arc" d="' + arc + '" stroke="url(#pmg-g)" style="--len:' + len.toFixed(1) + ';--off:' + (len * (1 - frac)).toFixed(1) + '" stroke-dasharray="' + len.toFixed(1) + '"/>' +
    ticks + '</svg>';
}

// Средняя годовая по учебным годам: вертикальные столбики.
function pmgYearsChart(points) {
  if (!points.length) return '';
  const w = 560, h = 190, pad = { l: 8, r: 8, t: 26, b: 30 };
  const bw = Math.min(64, (w - pad.l - pad.r) / points.length - 18);
  const step = (w - pad.l - pad.r) / points.length;
  const Y = (v) => pad.t + (5 - v) * (h - pad.t - pad.b) / 2.2; // шкала 2,8…5
  let g = '<line class="grid" x1="0" x2="' + w + '" y1="' + (h - pad.b) + '" y2="' + (h - pad.b) + '"/>';
  points.forEach((p, i) => {
    const x = pad.l + step * i + (step - bw) / 2, y = Y(p.avg), bh = h - pad.b - y;
    g += '<rect class="ybar' + (p.current ? ' cur' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(2, bh).toFixed(1) + '" rx="6" style="--d:' + i * 80 + 'ms" data-tip="' + pmgEsc(p.label + ': ' + pmgFmtAvg(p.avg) + (p.current ? ' (прогноз по текущим оценкам)' : ', ' + p.count + ' ' + pmgPlural(p.count, ['предмет', 'предмета', 'предметов']))) + '"/>';
    g += '<text class="yval" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" text-anchor="middle">' + pmgFmtAvg(p.avg) + '</text>';
    g += '<text class="axis" x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle">' + pmgEsc(p.label) + '</text>';
  });
  return '<svg class="years-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Средняя годовая оценка по годам">' + g + '</svg>';
}
