/* =====================================================================
   SANITECH — qr.js
   Générateur de QR codes (implémentation locale, sans dépendance).
   ===================================================================== */
/* ================= GÉNÉRATEUR QR ================= */
const QR = (() => {
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d } for (let i = 255; i < 512; i++)EXP[i] = EXP[i - 255] })();
  const mul = (a, b) => (a && b) ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
  function rsGen(n) { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]) } g = ng } return g }
  function rs(data, ecLen) { const gen = rsGen(ecLen); const res = new Uint8Array(data.length + ecLen); res.set(data); for (let i = 0; i < data.length; i++) { const f = res[i]; if (!f) continue; for (let j = 0; j < gen.length; j++)if (gen[j]) res[i + j] ^= EXP[(LOG[gen[j]] + LOG[f]) % 255] } return res.slice(data.length) }
  function fmtBits(ecc, mask) { let d = (ecc << 3) | mask; let r = d << 10; for (let i = 14; i >= 10; i--)if ((r >> i) & 1) r ^= 0x537 << (i - 10); return ((d << 10) | r) ^ 0x5412 }
  function matrix(text) {
    const bytes = new TextEncoder().encode(text);
    const CAPS = [17, 32, 53, 78, 106], DC = [19, 34, 55, 80, 108], EC = [7, 10, 15, 20, 26];
    let v = 0; while (v < 5 && bytes.length > CAPS[v]) v++;
    if (bytes.length > CAPS[4]) return null;
    const ver = v + 1, dc = DC[v], ec = EC[v], size = 17 + 4 * ver;
    const bits = []; const push = (val, n) => { for (let i = n - 1; i >= 0; i--)bits.push((val >> i) & 1) };
    push(4, 4); push(bytes.length, 8); bytes.forEach(b => push(b, 8));
    const total = dc * 8;
    for (let i = 0; i < 4 && bits.length < total; i++)bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let x = 0; for (let j = 0; j < 8; j++)x = (x << 1) | bits[i + j]; data.push(x) }
    const PD = [0xEC, 0x11]; let pi = 0; while (data.length < dc) data.push(PD[pi++ % 2]);
    const all = data.concat([...rs(new Uint8Array(data), ec)]);
    const M = [], F = []; for (let r = 0; r < size; r++) { M.push(new Uint8Array(size)); F.push(new Uint8Array(size)) }
    const set = (r, c, val) => { if (r < 0 || c < 0 || r >= size || c >= size) return; M[r][c] = val ? 1 : 0; F[r][c] = 1 };
    const finder = (r0, c0) => { for (let dr = -1; dr <= 7; dr++)for (let dc = -1; dc <= 7; dc++) { const r = r0 + dr, c = c0 + dc; if (r < 0 || c < 0 || r >= size || c >= size) continue; const on = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) || (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4); set(r, c, on) } };
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
    if (ver >= 2) { const p = [6, size - 7]; for (const r of p) for (const c of p) { if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue; for (let dr = -2; dr <= 2; dr++)for (let dc = -2; dc <= 2; dc++)set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1) } }
    const drawFmt = val => {
      const gb = i => (val >> i) & 1;
      for (let i = 0; i <= 5; i++)set(8, i, gb(i));
      set(8, 7, gb(6)); set(8, 8, gb(7)); set(7, 8, gb(8));
      for (let i = 9; i < 15; i++)set(14 - i, 8, gb(i));
      for (let i = 0; i < 8; i++)set(size - 1 - i, 8, gb(i));
      for (let i = 8; i < 15; i++)set(8, size - 15 + i, gb(i));
      set(size - 8, 8, 1)
    };
    drawFmt(0);
    const ab = []; all.forEach(b => { for (let i = 7; i >= 0; i--)ab.push((b >> i) & 1) });
    let bi = 0, dir = -1, row = size - 1;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let cc = 0; cc < 2; cc++) { const c = col - cc; if (!F[row][c]) { let bitv = bi < ab.length ? ab[bi++] : 0; if (((row + c) % 2) === 0) bitv ^= 1; M[row][c] = bitv } }
        row += dir; if (row < 0 || row >= size) { row -= dir; dir = -dir; break }
      }
    }
    drawFmt(fmtBits(1, 0));
    return M;
  }
  return { matrix };
})();
function drawQR(canvas, text, scale = 6) {
  const m = QR.matrix(text); if (!m) return;
  const s = m.length, q = 4;
  canvas.width = canvas.height = (s + q * 2) * scale;
  const x = canvas.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, canvas.width, canvas.height);
  x.fillStyle = '#0a2140';
  for (let r = 0; r < s; r++)for (let c = 0; c < s; c++)if (m[r][c]) x.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
}
let qrUser = null;
function openQR(u) {
  qrUser = u;
  drawQR($('#qr-canvas'), 'SANITECH;' + u.uid, 6);
  $('#qr-name').textContent = u.prenom + ' ' + u.nom;
  $('#qr-uid').textContent = u.uid;
  /* Un utilisateur archivé ne peut plus pointer entrée / sortie */
  const archived = !!u.archived;
  $('#qr-in').style.display = archived ? 'none' : '';
  $('#qr-out').style.display = archived ? 'none' : '';
  const note = document.getElementById('qr-note');
  if (note) note.style.display = archived ? 'block' : 'none';
  openSheet($('#sheet-qr'));
}
$('#qr-in').onclick = () => { if (qrUser) { closeSheet(); forcePunch(qrUser.id, 'in', 'badge') } };
$('#qr-out').onclick = () => { if (qrUser) { closeSheet(); forcePunch(qrUser.id, 'out', 'badge') } };

