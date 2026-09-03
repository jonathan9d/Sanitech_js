/* =====================================================================
   SANITECH — stats.js
   Statistiques, graphiques, widgets personnalisables.
   ===================================================================== */
/* ================= STATS & WIDGETS ================= */
let chartMode = 'bar', chartProg = 1, hoverIdx = -1, chartRAF = null;
const KPIS = {
  pres: { label: 'Présents actuellement', icon: 'location_on', cls: 'g' },
  in: { label: 'Entrées du jour', icon: 'login', cls: 'b' },
  out: { label: 'Sorties du jour', icon: 'logout', cls: 'b' },
  total: { label: 'Effectif actif', icon: 'group', cls: '' },
  assid: { label: 'Taux d\u2019assiduité', icon: 'verified', cls: 'g' },
  hours: { label: 'Heures cumulées (jour)', icon: 'timer', cls: 'g' },
  late: { label: 'Retards du jour', icon: 'warning', cls: '' },
  ot: { label: 'Heures supp (jour)', icon: 'more_time', cls: 'b' }
};
function chartData() {
  const N = state.settings.period || 14;
  const days = []; for (let i = N - 1; i >= 0; i--) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); days.push(d) }
  const inA = days.map(() => 0), outA = days.map(() => 0), map = {};
  days.forEach((d, i) => map[dayKey(d.getTime())] = i);
  for (const l of state.logs) { const k = dayKey(l.ts); if (k in map) { l.type === 'in' ? inA[map[k]]++ : outA[map[k]]++ } }
  return { days, inA, outA };
}
const ease = t => 1 - Math.pow(1 - t, 3);
function animateChart() {
  if (chartRAF) cancelAnimationFrame(chartRAF);
  const t0 = performance.now();
  (function step(t) { chartProg = Math.min(1, (t - t0) / 750); drawChart(); if (chartProg < 1) chartRAF = requestAnimationFrame(step) })(t0);
}
function cssVar(n, fb) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb }
function drawChart() {
  const cv = $('#chart'); if (!cv || !$('#page-stats').classList.contains('active')) return;
  const W = cv.parentElement.clientWidth, H = 230, dpr = window.devicePixelRatio || 1;
  if (W <= 0) return;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const [cIn, cOut] = seriesColors();
  const cM = cssVar('--muted', '#8ba3be'), cL = cssVar('--line', '#d9e5f1');
  const { days, inA, outA } = chartData();
  const padL = 30, padR = 8, padT = 14, padB = 26, n = days.length;
  const iw = (W - padL - padR) / n;
  const maxV = Math.max(4, ...inA, ...outA);
  const yMax = Math.max(4, Math.ceil(maxV / 4) * 4), rows = 4;
  const p = ease(chartProg);
  if (chartMode === 'donut') { drawDonut(x, W, H, cIn, cOut, cM, cL, p); return }
  x.font = '700 10px Inter, system-ui, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
  for (let r = 0; r <= rows; r++) {
    const v = yMax / rows * r, y = padT + (H - padT - padB) * (1 - r / rows);
    x.strokeStyle = cL; x.lineWidth = 1; x.globalAlpha = r === 0 ? 1 : .55;
    x.beginPath(); x.moveTo(padL, y); x.lineTo(W - padR, y); x.stroke(); x.globalAlpha = 1;
    x.fillStyle = cM; x.fillText(v, padL - 7, y);
  }
  x.textAlign = 'center';
  const todayK = dayKey(Date.now()), step = Math.max(1, Math.ceil(n / 10));
  days.forEach((d, i) => {
    if (n > 14 && i % step !== 0 && i !== n - 1) return;
    const cx = padL + i * iw + iw / 2;
    x.fillStyle = dayKey(d.getTime()) === todayK ? cOut : cM;
    x.font = (dayKey(d.getTime()) === todayK ? '700' : '400') + ' 9.5px Inter, system-ui, sans-serif';
    x.fillText(d.getDate(), cx, H - 9);
  });
  const valY = v => padT + (H - padT - padB) * (1 - (v / yMax) * p);
  if (chartMode === 'bar') {
    const bw = Math.min(9, iw * 0.26), gap = Math.min(3, iw * 0.14);
    for (let i = 0; i < n; i++) {
      const cx = padL + i * iw + iw / 2, x0 = cx - bw - gap / 2, x1 = cx + gap / 2;
      const hi = (H - padT - padB) * (inA[i] / yMax) * p, ho = (H - padT - padB) * (outA[i] / yMax) * p;
      x.fillStyle = cIn; x.globalAlpha = i === hoverIdx ? 1 : .92; rr(x, x0, padT + (H - padT - padB) - hi, bw, hi, 3); x.fill();
      x.fillStyle = cOut; rr(x, x1, padT + (H - padT - padB) - ho, bw, ho, 3); x.fill(); x.globalAlpha = 1;
    }
  } else {
    const pts = a => a.map((v, i) => [padL + i * iw + iw / 2, valY(v)]);
    const draw = (pts2, col, fill, dash) => {
      x.beginPath(); x.moveTo(pts2[0][0], pts2[0][1]);
      for (let i = 1; i < pts2.length; i++) { const [a, b] = [pts2[i - 1], pts2[i]]; x.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }
      x.lineTo(pts2[pts2.length - 1][0], pts2[pts2.length - 1][1]);
      if (fill) {
        x.save(); x.lineTo(pts2[pts2.length - 1][0], H - padB); x.lineTo(pts2[0][0], H - padB); x.closePath();
        const g = x.createLinearGradient(0, padT, 0, H - padB); g.addColorStop(0, col + '44'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fill(); x.restore();
        x.beginPath(); x.moveTo(pts2[0][0], pts2[0][1]);
        for (let i = 1; i < pts2.length; i++) { const [a, b] = [pts2[i - 1], pts2[i]]; x.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }
        x.lineTo(pts2[pts2.length - 1][0], pts2[pts2.length - 1][1]);
      }
      x.strokeStyle = col; x.lineWidth = 2.4; x.lineJoin = 'round';
      x.setLineDash(dash ? [7, 5] : []); x.stroke(); x.setLineDash([]);
      pts2.forEach((pt, i) => {
        x.beginPath(); x.arc(pt[0], pt[1], i === hoverIdx ? 4.5 : 2.2, 0, 7); x.fillStyle = col; x.fill();
        if (i === hoverIdx) { x.strokeStyle = cssVar('--surface', '#fff'); x.lineWidth = 2; x.stroke() }
      });
    };
    draw(pts(inA), cIn, true, false); draw(pts(outA), cOut, false, state.settings.cb);
  }
  if (hoverIdx >= 0) {
    const cx = padL + hoverIdx * iw + iw / 2;
    x.strokeStyle = cM; x.setLineDash([4, 4]); x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx, padT); x.lineTo(cx, H - padB); x.stroke(); x.setLineDash([]);
  }
}
function rr(x, a, b, w, h, r) { if (h <= 0) return; r = Math.min(r, h / 2, w / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.lineTo(a + w, b + h); x.lineTo(a, b + h); x.arcTo(a, b, a + r, b, r); x.closePath() }
/* 3e représentation : anneau entrées / sorties de la période */
function drawDonut(x, W, H, cIn, cOut, cM, cL, p) {
  const { days, inA, outA } = chartData();
  const tIn = inA.reduce((a, b) => a + b, 0), tOut = outA.reduce((a, b) => a + b, 0), tot = tIn + tOut;
  const cx = W / 2, cy = H / 2 - 6, R = Math.min(W, H) / 2 - 40, lw = Math.max(20, Math.min(30, W * .07));
  x.lineWidth = lw; x.lineCap = 'round';
  x.strokeStyle = cL; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
  if (tot > 0) {
    const aIn = tIn / tot * Math.PI * 2 * p, aOut = tOut / tot * Math.PI * 2 * p, a0 = -Math.PI / 2;
    x.strokeStyle = cIn; x.beginPath(); x.arc(cx, cy, R, a0, a0 + aIn); x.stroke();
    x.strokeStyle = cOut; x.beginPath(); x.arc(cx, cy, R, a0 + aIn, a0 + aIn + aOut); x.stroke();
  }
  x.textAlign = 'center';
  x.fillStyle = cssVar('--text', '#e9f2fc'); x.font = '700 30px "Space Grotesk", Inter, sans-serif';
  x.fillText(String(Math.round(tot * p)), cx, cy + 2);
  x.fillStyle = cM; x.font = '700 10px Inter, sans-serif';
  x.fillText('mouvements', cx, cy + 20);
  x.textAlign = 'left'; x.fillStyle = cIn; x.font = '700 12px Inter, sans-serif';
  x.fillText('● ' + tIn + ' entrées', cx - R - 4, cy + R + lw / 2 + 18);
  x.textAlign = 'right'; x.fillStyle = cOut;
  x.fillText(tOut + ' sorties ●', cx + R + 4, cy + R + lw / 2 + 18);
}
function setChartSeg(mode) {
  chartMode = mode;
  ['#seg-bar', '#seg-line', '#seg-donut'].forEach(s => {
    const el = $(s); if (el) el.classList.toggle('on', s === '#seg-' + mode);
  });
  beep('tap'); animateChart();
}
const sb = $('#seg-bar'), sl = $('#seg-line'), sd = $('#seg-donut');
if (sb) sb.onclick = () => setChartSeg('bar');
if (sl) sl.onclick = () => setChartSeg('line');
if (sd) sd.onclick = () => setChartSeg('donut');
$('#pchips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  state.settings.period = +c.dataset.p; save();
  $$('#pchips .chip').forEach(x => x.classList.toggle('active', x === c));
  beep('tap'); renderStats(); animateChart();
});
function tween(el, to) { if (!el) return; const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / 850); el.textContent = Math.round(to * ease(k)); if (k < 1) requestAnimationFrame(f) })(t0) }
function tweenDur(el, ms) { if (!el) return; const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / 850); el.textContent = fmtDur(ms * ease(k)); if (k < 1) requestAnimationFrame(f) })(t0) }
function animRing(target) {
  const r = $('#k-ring'), b = $('#k-assid'); if (!r || !b) return;
  const col = state.settings.cb ? '#2f6df6' : 'var(--green)';
  const t0 = performance.now();
  (function f(t) {
    const k = ease(Math.min(1, (t - t0) / 900)); const v = target * k;
    r.style.background = `conic-gradient(${col} ${v * 3.6}deg, var(--surface3) 0)`;
    b.textContent = Math.round(v) + '%';
    if (k < 1) requestAnimationFrame(f)
  })(t0);
}
function assiduite(days) {
  const act = state.users.filter(u => !u.archived);
  if (!act.length) return 0;
  const ids = new Set(act.map(u => u.id)), seen = new Set();
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  for (const l of state.logs) { if (l.type === 'in' && ids.has(l.userId) && l.ts >= start.getTime()) seen.add(l.userId + '|' + dayKey(l.ts)) }
  return Math.min(100, Math.round(seen.size / (act.length * days) * 100));
}
function renderStats() {
  const act = state.users.filter(u => !u.archived), tk = dayKey(Date.now()), P = state.settings.period;
  const thr = state.settings.otThreshold * 3600e3;
  const vals = {
    pres: act.filter(u => u.presence === 'in').length,
    in: state.logs.filter(l => l.type === 'in' && dayKey(l.ts) === tk).length,
    out: state.logs.filter(l => l.type === 'out' && dayKey(l.ts) === tk).length,
    total: act.length,
    assid: assiduite(P),
    hours: act.reduce((s, u) => s + hoursFor(u, dayStartTs(), Date.now()), 0),
    late: state.logs.filter(l => l.type === 'in' && l.late && dayKey(l.ts) === tk).length,
    ot: act.reduce((s, u) => s + Math.max(0, hoursFor(u, dayStartTs(), Date.now()) - thr), 0)
  };
  const list = (state.settings.kpis || []).filter(k => k.on && KPIS[k.id]);
  $('#kpis').innerHTML = list.map(k => {
    const m = KPIS[k.id];
    if (k.id === 'assid') return `<div class="kpi" style="display:flex;align-items:center;gap:13px"><div class="ring" id="k-ring"><b id="k-assid">0%</b></div><small style="margin:0">Assiduité<br>(${P} j)</small><span class="mi kic" style="color:var(--green)">verified</span></div>`;
    if (k.id === 'hours') return `<div class="kpi g"><span class="mi kic">timer</span><b id="k-hours" style="font-size:23px">0h00</b><small>${m.label}</small></div>`;
    if (k.id === 'ot') return `<div class="kpi b"><span class="mi kic">more_time</span><b id="k-ot" style="font-size:23px">0h00</b><small>${m.label}</small></div>`;
    return `<div class="kpi ${m.cls}"><span class="mi kic">${m.icon}</span><b id="k-${k.id}">0</b><small>${m.label}</small></div>`;
  }).join('') || '<div class="empty" style="grid-column:1/-1"><h4>Aucun widget</h4><p>Ajoutez des widgets via le bouton <span class="mi" style="font-size:14px;vertical-align:-2px">tune</span>.</p></div>';
  list.forEach(k => {
    if (k.id === 'assid') animRing(vals.assid);
    else if (k.id === 'hours') tweenDur($('#k-hours'), vals.hours);
    else if (k.id === 'ot') tweenDur($('#k-ot'), vals.ot);
    else tween($('#k-' + k.id), vals[k.id]);
  });
  $$('#pchips .chip').forEach(x => x.classList.toggle('active', +x.dataset.p === P));
  const d = chartData();
  $('#chrange').textContent = d.days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + d.days[d.days.length - 1].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const [cIn, cOut] = seriesColors();
  $('#lg-in').style.background = cIn; $('#lg-out').style.background = cOut;
  const wk = Date.now() - 7 * 864e5, m = {};
  state.logs.forEach(l => { if (l.ts >= wk) m[l.userId] = (m[l.userId] || 0) + 1 });
  const top = Object.entries(m).map(([id2, c]) => ({ u: state.users.find(u => u.id === id2), c })).filter(x => x.u).sort((a, b) => b.c - a.c).slice(0, 5);
  const max = top.length ? top[0].c : 1;
  $('#mlist').innerHTML = top.length ? top.map(t => `<div class="mrow">${avatarHTML(t.u, 30)}<span class="nm">${esc(t.u.prenom)} ${esc(t.u.nom)}</span><div class="mbar"><i data-w="${Math.round(t.c / max * 100)}"></i></div><span class="cnt">${t.c}</span></div>`).join('')
    : '<p style="color:var(--muted);font-weight:400;font-size:13px">Aucune activité cette semaine.</p>';
  requestAnimationFrame(() => $$('#mlist .mbar i').forEach(b => b.style.width = b.dataset.w + '%'));
}
$('#btn-widgets').onclick = () => { renderWidgets(); openSheet($('#sheet-widgets')) };
function renderWidgets() {
  const arr = state.settings.kpis;
  $('#wlist').innerHTML = arr.map((k, i) => {
    const m = KPIS[k.id]; if (!m) return '';
    return`<div class="wrow">
      <span class="sicon ${k.on ? 'b' : ''}" ${k.on ? '' : 'style="background:var(--surface3);color:var(--muted)"'}><span class="mi">${m.icon}</span></span>
      <span class="stxt"><b>${m.label}</b><small>${k.on ? 'Affiché' : 'Masqué'}</small></span>
      <button class="ibtn rip" data-w="${i}" data-d="up" ${i === 0 ? 'disabled' : ''}><span class="mi">arrow_upward</span></button>
      <button class="ibtn rip" data-w="${i}" data-d="down" ${i === arr.length - 1 ? 'disabled' : ''}><span class="mi">arrow_downward</span></button>
      <span class="switch"><input type="checkbox" data-w="${i}" data-d="tgl" ${k.on ? 'checked' : ''}><i></i></span>
    </div>`;
  }).join('');
  $$('#wlist [data-w]').forEach(el => {
    const h = () => {
      const i = +el.dataset.w, arr2 = state.settings.kpis;
      if (el.dataset.d === 'up' && i > 0) { [arr2[i - 1], arr2[i]] = [arr2[i], arr2[i - 1]] }
      else if (el.dataset.d === 'down' && i < arr2.length - 1) { [arr2[i + 1], arr2[i]] = [arr2[i], arr2[i + 1]] }
      else if (el.dataset.d === 'tgl') { arr2[i].on = el.checked }
      save(); beep('tap'); renderWidgets();
      if (tab === 'stats' && $('#page-stats').classList.contains('active')) renderStats();
    };
    if (el.tagName === 'INPUT') el.addEventListener('change', h); else el.addEventListener('click', h);
  });
}

