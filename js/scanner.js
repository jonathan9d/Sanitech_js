/* =====================================================================
   SANITECH — scanner.js
   Pointage QR : même pipeline de décodage (jsQR), deux sources d'image
   (caméra téléphone WebRTC ou ESP32-CAM AI-Thinker).
   ===================================================================== */

const SCAN_SRC_PHONE = 'phone';
const SCAN_SRC_ESP = 'esp32';
const ESP_DEFAULT_ORIGIN = 'http://192.168.4.1';
const SCAN_COOLDOWN_MS = 2400;
const SCAN_DECODE_MAX_W = 640;
const ESP_FAIL_LIMIT = 6;

let scanActive = false;
let scanStream = null;
let scanRAF = null;
let scanTimer = null;
let scanAbort = null;
let scanRot = null;              // { deg: 0|90|180|270, flipH, flipV } orientation du flux
let scanMode = 'auto';
let scanSource = SCAN_SRC_PHONE;
let lastScanCode = '';
let lastScanTime = 0;
let scanHistory = [];
let scanCtx = null;
let scanFrameN = 0;
let scanEspFails = 0;
let scannerInited = false;

function scanOrigin() {
  const el = $('#scan-esp-url');
  const raw = (el && el.value.trim()) || (state.settings && state.settings.espCamUrl) || ESP_DEFAULT_ORIGIN;
  return raw.replace(/\/+$/, '');
}

function persistScanPrefs() {
  if (!state.settings) return;
  state.settings.scanSource = scanSource;
  state.settings.espCamUrl = scanOrigin();
  if (scanRot) state.settings.scanRot = { ...scanRot };
  save();
}

/* ---------- Orientation de l'image (rotation + miroir) ---------- */
function scanRotState() {
  const r = (scanRot && typeof scanRot === 'object') ? scanRot : (state.settings && state.settings.scanRot);
  const deg = (r && +r.deg) || 0;
  return { deg: ((deg % 360) + 360) % 360, flipH: !!(r && r.flipH), flipV: !!(r && r.flipV) };
}
function rotIsNeutral() {
  const r = scanRotState();
  return r.deg === 0 && !r.flipH && !r.flipV;
}
/* Dimensions de sortie après rotation (90°/270° → largeur/hauteur échangées) */
function rotOutDims(w, h) {
  const { deg } = scanRotState();
  return (deg === 90 || deg === 270) ? { w: h, h: w } : { w, h };
}
/* La rotation est-elle visible ? (ESP = toujours en canvas ; téléphone = canvas si orienté) */
function scanNeedsCanvasPreview() {
  return scanSource === SCAN_SRC_ESP || !rotIsNeutral();
}
/* Met à jour l'affichage après un changement d'orientation ou de source */
function updateScanPreviewMode() {
  const video = $('#scan-video');
  const canvas = getScanCanvas();
  const useCanvas = scanNeedsCanvasPreview();
  if (video && scanSource === SCAN_SRC_PHONE) {
    /* En veille le placeholder recouvre tout : on réaffiche le flux après le prochain start() */
    if (scanActive) video.style.display = useCanvas ? 'none' : 'block';
  }
  if (canvas) canvas.classList.toggle('is-preview', !!scanActive && useCanvas);
}
function applyScanOrientation(op) {
  const r = scanRotState();
  scanRot = { deg: r.deg, flipH: r.flipH, flipV: r.flipV };
  if (op === 'ccw') scanRot.deg = (scanRot.deg + 270) % 360;
  else if (op === 'cw') scanRot.deg = (scanRot.deg + 90) % 360;
  else if (op === 'fh') scanRot.flipH = !scanRot.flipH;
  else if (op === 'fv') scanRot.flipV = !scanRot.flipV;
  else if (op === 'reset') { scanRot = { deg: 0, flipH: false, flipV: false }; }
  persistScanPrefs();
  refreshScanOrientationUI();
  updateScanPreviewMode();
  beep('tap');
  const r2 = scanRotState();
  const parts = [];
  if (r2.deg) parts.push(r2.deg + '°');
  if (r2.flipH) parts.push('miroir H');
  if (r2.flipV) parts.push('miroir V');
  toast(parts.length ? 'Orientation : ' + parts.join(' · ') + ' — le scan s\u2019adapte' : 'Orientation réinitialisée', 'rotate_right', 'info');
}
function refreshScanOrientationUI() {
  const r = scanRotState();
  const fh = $('#scan-rot-fh'), fv = $('#scan-rot-fv'), rst = $('#scan-rot-reset');
  if (fh) fh.classList.toggle('on', r.flipH);
  if (fv) fv.classList.toggle('on', r.flipV);
  if (rst) rst.classList.toggle('on', !rotIsNeutral());
  const hf = $('#scan-cam-flip');
  if (hf) hf.classList.toggle('on', r.flipH);
}

function toLcd(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

function notifyEspLcd(line1, line2) {
  if (scanSource !== SCAN_SRC_ESP) return;
  const body = JSON.stringify({ l1: toLcd(line1), l2: toLcd(line2) });
  fetch(scanOrigin() + '/lcd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store'
  }).catch(() => { });
}

function getScanCanvas() {
  return $('#scan-canvas');
}

function getScan2d(canvas) {
  if (!scanCtx || scanCtx.canvas !== canvas) {
    scanCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return scanCtx;
}

function drawForDecode(source, sw, sh, preview) {
  const canvas = getScanCanvas();
  if (!canvas || sw < 8 || sh < 8) return null;
  const { deg, flipH, flipV } = scanRotState();
  /* Réduction à 640 px max (le décodage jsQR reste rapide) */
  let w = sw, h = sh;
  const m = Math.max(w, h);
  if (m > SCAN_DECODE_MAX_W) {
    w = Math.round(w * SCAN_DECODE_MAX_W / m);
    h = Math.round(h * SCAN_DECODE_MAX_W / m);
  }
  /* Rotation 90°/270° : on échange les dimensions du buffer */
  const out = rotOutDims(w, h);
  if (canvas.width !== out.w) canvas.width = out.w;
  if (canvas.height !== out.h) canvas.height = out.h;
  const ctx = getScan2d(canvas);
  ctx.save();
  ctx.translate(out.w / 2, out.h / 2);
  ctx.rotate(deg * Math.PI / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(source, -w / 2, -h / 2, w, h);
  ctx.restore();
  if (preview) canvas.classList.add('is-preview');
  else canvas.classList.remove('is-preview');
  return ctx.getImageData(0, 0, out.w, out.h);
}

function decodeQr(imageData) {
  if (!imageData || typeof jsQR !== 'function') return '';
  const inv = (scanFrameN++ % 4 === 0) ? 'attemptBoth' : 'dontInvert';
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: inv });
  return (code && code.data) ? code.data.trim() : '';
}

/* ---------- Source : caméra téléphone ---------- */
const ScanPhone = {
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('WebRTC non supporté sur cet appareil.');
    }
    await listScannerCameras();
    const chosenDevice = $('#scan-cam-device') ? $('#scan-cam-device').value : '';
    const constraints = {
      audio: false,
      video: chosenDevice
        ? { deviceId: { exact: chosenDevice } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    scanStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = $('#scan-video');
    if (!video) throw new Error('Élément vidéo introuvable.');
    video.srcObject = scanStream;
    /* Orientation active → aperçu rendu dans le canvas (rotation appliquée au décodage) */
    video.style.display = scanNeedsCanvasPreview() ? 'none' : 'block';
    await video.play();
    const canvas = getScanCanvas();
    if (canvas && !scanNeedsCanvasPreview()) canvas.classList.remove('is-preview');
  },
  grab() {
    const video = $('#scan-video');
    if (!video || video.readyState < 2) return null;
    return drawForDecode(video, video.videoWidth, video.videoHeight, scanNeedsCanvasPreview());
  },
  stop() {
    if (scanStream) {
      scanStream.getTracks().forEach(t => t.stop());
      scanStream = null;
    }
    const video = $('#scan-video');
    if (video) {
      video.srcObject = null;
      video.style.display = '';
    }
  }
};

/* ---------- Source : ESP32-CAM (JPEG HTTP) ---------- */
const ScanEsp = {
  async start() {
    const origin = scanOrigin();
    persistScanPrefs();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    let info = null;
    try {
      const res = await fetch(origin + '/status', { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      info = await res.json();
    } catch (e) {
      const aborted = e && e.name === 'AbortError';
      throw new Error(aborted
        ? 'Délai dépassé : connectez cet appareil au Wi-Fi SANITECH (mot de passe 12345678), puis réessayez.'
        : 'ESP32-CAM injoignable à ' + origin + '. Rejoignez le Wi-Fi SANITECH / 12345678.');
    } finally {
      clearTimeout(t);
    }
    if (info && info.camera === false) {
      throw new Error('La caméra ESP32 n\'est pas initialisée. Vérifiez le module OV2640 puis redémarrez la carte.');
    }
    const video = $('#scan-video');
    if (video) video.style.display = 'none';
    setEspStatus(true, info && info.lcd === false
      ? 'Caméra OK — LCD non détecté (SDA 14 / SCL 15)'
      : 'Connecté à ' + origin.replace(/^https?:\/\//, ''));
    notifyEspLcd('SANITECH', 'Pret a scanner');
  },
  async grab() {
    if (scanAbort) scanAbort.abort();
    scanAbort = new AbortController();
    const t = setTimeout(() => scanAbort.abort(), 4000);
    try {
      const res = await fetch(scanOrigin() + '/capture?t=' + Date.now(), {
        signal: scanAbort.signal,
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('capture ' + res.status);
      const blob = await res.blob();
      if (!blob || blob.size < 200) throw new Error('jpeg vide');
      let bmp;
      if (typeof createImageBitmap === 'function') {
        bmp = await createImageBitmap(blob);
      } else {
        bmp = await blobToImage(blob);
      }
      const imageData = drawForDecode(bmp, bmp.width, bmp.height, true);
      if (bmp.close) bmp.close();
      return imageData;
    } finally {
      clearTimeout(t);
    }
  },
  stop() {
    if (scanAbort) {
      scanAbort.abort();
      scanAbort = null;
    }
    const video = $('#scan-video');
    if (video) video.style.display = '';
    const canvas = getScanCanvas();
    if (canvas) canvas.classList.remove('is-preview');
  }
};

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('jpeg illisible')); };
    img.src = url;
  });
}

function currentSource() {
  return scanSource === SCAN_SRC_ESP ? ScanEsp : ScanPhone;
}

function applySourceUi() {
  const phone = scanSource === SCAN_SRC_PHONE;
  const camBar = $('#scan-cam-device');
  const camWrap = camBar && camBar.closest('.scanner-phone-tools');
  const espBar = $('#scan-esp-bar');
  if (camWrap) camWrap.style.display = phone ? '' : 'none';
  if (espBar) espBar.hidden = phone;
  $$('#scan-sources .chip').forEach(c => c.classList.toggle('active', c.dataset.source === scanSource));
  refreshScanOrientationUI();
}

function setEspStatus(ok, msg) {
  const el = $('#scan-esp-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('ok', !!ok);
  el.classList.toggle('err', ok === false);
}

function setStandby(html) {
  const standby = $('#scan-standby');
  if (!standby) return;
  standby.style.display = 'flex';
  standby.innerHTML = html;
}

function setScanningChrome(on) {
  const standby = $('#scan-standby');
  const frame = $('#scan-target-frame');
  const btn = $('#btn-toggle-scan');
  if (standby) standby.style.display = on ? 'none' : 'flex';
  if (frame) {
    frame.classList.toggle('scanning', on);
    if (!on) frame.classList.remove('detected', 'error-detected');
  }
  if (btn) {
    btn.classList.toggle('danger', on);
    btn.classList.toggle('primary', !on);
    btn.innerHTML = on
      ? '<span class="scan-live-dot"></span><span class="mi">stop</span> Arrêter le scan'
      : '<span class="mi">play_arrow</span> Démarrer le scan';
  }
}

function initScannerTab() {
  if (scannerInited) return;
  scannerInited = true;

  if (state.settings && state.settings.scanSource === SCAN_SRC_ESP) scanSource = SCAN_SRC_ESP;
  if (state.settings && state.settings.scanRot) scanRot = { ...state.settings.scanRot };
  const urlIn = $('#scan-esp-url');
  if (urlIn && state.settings && state.settings.espCamUrl) urlIn.value = state.settings.espCamUrl;
  applySourceUi();

  const btnToggle = $('#btn-toggle-scan');
  if (btnToggle) {
    btnToggle.onclick = () => {
      if (scanActive) stopScanner();
      else startScanner();
    };
  }

  $$('#scan-sources .chip').forEach(c => {
    c.addEventListener('click', () => {
      const next = c.dataset.source === SCAN_SRC_ESP ? SCAN_SRC_ESP : SCAN_SRC_PHONE;
      if (next === scanSource) return;
      const was = scanActive;
      if (was) stopScanner();
      scanSource = next;
      persistScanPrefs();
      applySourceUi();
      beep('tap');
      toast(scanSource === SCAN_SRC_ESP
        ? 'Source : ESP32-CAM — connectez-vous au Wi-Fi SANITECH'
        : 'Source : caméra de l\'appareil',
        scanSource === SCAN_SRC_ESP ? 'router' : 'photo_camera', 'info');
      if (was) startScanner();
    });
  });

  const camSelect = $('#scan-cam-device');
  if (camSelect) {
    camSelect.addEventListener('change', () => {
      if (scanActive && scanSource === SCAN_SRC_PHONE) {
        stopScanner();
        startScanner();
      }
      beep('tap');
    });
  }

  const flipBtn = $('#scan-cam-flip');
  if (flipBtn) flipBtn.onclick = () => applyScanOrientation('fh');

  /* Barre d'orientation : rotation 90° + miroirs horizontal / vertical + remise à zéro */
  const rotMap = { 'scan-rot-ccw': 'ccw', 'scan-rot-cw': 'cw', 'scan-rot-fh': 'fh', 'scan-rot-fv': 'fv', 'scan-rot-reset': 'reset' };
  Object.keys(rotMap).forEach(id => {
    const el = $('#' + id);
    if (el) el.onclick = () => applyScanOrientation(rotMap[id]);
  });

  const pingBtn = $('#scan-esp-ping');
  if (pingBtn) pingBtn.onclick = () => probeEspManual();

  refreshScanOrientationUI();

  const urlEl = $('#scan-esp-url');
  if (urlEl) {
    urlEl.addEventListener('change', () => {
      persistScanPrefs();
      if (scanActive && scanSource === SCAN_SRC_ESP) {
        stopScanner();
        startScanner();
      }
    });
  }
  /* Mode forcé retiré : le scan bascule automatiquement Entrée ↔ Sortie. */
  scanMode = 'auto';
}

async function probeEspManual() {
  persistScanPrefs();
  beep('tap');
  setEspStatus(null, 'Test de connexion…');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(scanOrigin() + '/status', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const info = await res.json();
    const lcd = info.lcd ? 'LCD OK' : 'LCD absent';
    const cam = info.camera === false ? 'caméra HS' : 'caméra OK';
    setEspStatus(info.camera !== false, cam + ' · ' + lcd + ' · ' + (info.clients || 0) + ' client(s)');
    toast('ESP32-CAM joignable', 'check_circle', 'ok');
    beep('success');
  } catch (e) {
    setEspStatus(false, 'Injoignable — Wi-Fi SANITECH / 12345678 requis');
    toast('Impossible de joindre l\'ESP32-CAM', 'wifi_off', 'err');
    beep('error');
  }
}

async function listScannerCameras() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devs = await navigator.mediaDevices.enumerateDevices();
    const videoDevs = devs.filter(d => d.kind === 'videoinput');
    const sel = $('#scan-cam-device');
    if (!sel) return;
    if (videoDevs.length > 0) {
      sel.innerHTML = videoDevs.map((d, i) => {
        const isBack = d.label && (d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('arrière') || d.label.toLowerCase().includes('environment'));
        return `<option value="${esc(d.deviceId)}" ${isBack ? 'selected' : ''}>${esc(d.label || ('Caméra ' + (i + 1)))}</option>`;
      }).join('');
    } else {
      sel.innerHTML = '<option value="">Caméra par défaut</option>';
    }
  } catch (e) { }
}

async function startScanner() {
  const video = $('#scan-video');
  if (!video) return;

  try {
    scanEspFails = 0;
    scanFrameN = 0;
    await currentSource().start();
    scanActive = true;
    setScanningChrome(true);
    beep('pop');
    toast(scanSource === SCAN_SRC_ESP
      ? 'Scanner ESP32-CAM — présentez un badge'
      : 'Scanner activé — Prêt à lire les badges QR',
      'qr_code_scanner', 'ok');
    scanTick();
  } catch (err) {
    scanActive = false;
    currentSource().stop();
    setScanningChrome(false);
    const msg = (err && err.message) ? err.message : 'Impossible d\'activer la source vidéo.';
    const hint = scanSource === SCAN_SRC_ESP
      ? 'Paramètres Wi-Fi de cet appareil → réseau SANITECH, mot de passe 12345678, puis relancez le scan.'
      : 'Autorisez l\'accès à la caméra dans les paramètres du navigateur ou de l\'application.';
    setStandby(`<span class="mi" style="font-size:42px;color:var(--danger)">videocam_off</span><p><b>${esc(msg)}</b><br><small>${esc(hint)}</small></p>`);
    beep('error');
    toast(scanSource === SCAN_SRC_ESP ? 'ESP32-CAM indisponible' : 'Impossible d\'activer la caméra', 'videocam_off', 'err');
    if (scanSource === SCAN_SRC_ESP) setEspStatus(false, 'Hors ligne');
  }
}

function stopScanner() {
  scanActive = false;
  if (scanRAF) {
    cancelAnimationFrame(scanRAF);
    scanRAF = null;
  }
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  ScanPhone.stop();
  ScanEsp.stop();
  scanCtx = null;

  setStandby(`<span class="mi" style="font-size:48px;color:var(--muted);opacity:.6">qr_code_scanner</span><p><b>Caméra en veille</b><br><small>${scanSource === SCAN_SRC_ESP
    ? 'Connectez-vous au Wi-Fi SANITECH puis appuyez sur « Démarrer le scan ».'
    : 'Appuyez sur « Démarrer le scan » pour activer le flux vidéo en direct.'}</small></p>`);
  setScanningChrome(false);
  beep('tap');
}

async function scanTick() {
  if (!scanActive) return;
  try {
    const imageData = await currentSource().grab();
    if (imageData) {
      const text = decodeQr(imageData);
      if (text) handleScannedCode(text);
    }
    scanEspFails = 0;
  } catch (e) {
    if (!scanActive) return;
    if (scanSource === SCAN_SRC_ESP) {
      scanEspFails++;
      setEspStatus(false, 'Perte de trame (' + scanEspFails + '/' + ESP_FAIL_LIMIT + ')');
      if (scanEspFails >= ESP_FAIL_LIMIT) {
        stopScanner();
        setStandby(`<span class="mi" style="font-size:42px;color:var(--danger)">wifi_off</span><p><b>Lien ESP32-CAM perdu</b><br><small>Reconnectez-vous au Wi-Fi SANITECH (12345678) puis relancez le scan.</small></p>`);
        notifyEspLcd('LIEN PERDU', 'Reconnectez-vous');
        toast('Connexion ESP32-CAM interrompue', 'wifi_off', 'err');
        return;
      }
    }
  }
  if (!scanActive) return;
  if (scanSource === SCAN_SRC_PHONE) {
    scanRAF = requestAnimationFrame(() => { scanTick(); });
  } else {
    scanTimer = setTimeout(() => { scanTick(); }, 30);
  }
}

function handleScannedCode(rawText) {
  if (!rawText) return;
  const now = Date.now();

  let badgeCode = rawText;
  if (badgeCode.toUpperCase().startsWith('SANITECH;')) {
    badgeCode = badgeCode.slice(9).trim();
  }

  if (badgeCode === lastScanCode && (now - lastScanTime) < SCAN_COOLDOWN_MS) {
    return;
  }

  lastScanCode = badgeCode;
  lastScanTime = now;

  const frame = $('#scan-target-frame');

  const cleanCode = badgeCode.toUpperCase();
  const user = state.users.find(u =>
    u.uid.toUpperCase() === cleanCode ||
    u.id === badgeCode ||
    ('SAN-' + u.uid).toUpperCase() === cleanCode ||
    u.uid.toUpperCase() === ('SAN-' + cleanCode) ||
    u.email.toUpperCase() === cleanCode
  );

  if (!user) {
    if (frame) {
      frame.classList.remove('detected');
      frame.classList.add('error-detected');
      setTimeout(() => frame && frame.classList.remove('error-detected'), 1600);
    }
    beep('error');
    renderScanError(rawText, badgeCode);
    notifyEspLcd('BADGE INCONNU', badgeCode);
    return;
  }

  if (user.archived) {
    if (frame) {
      frame.classList.remove('detected');
      frame.classList.add('error-detected');
      setTimeout(() => frame && frame.classList.remove('error-detected'), 1600);
    }
    beep('error');
    renderScanArchived(user);
    notifyEspLcd('ARCHIVE', (user.prenom || '') + ' ' + (user.nom || ''));
    return;
  }

  if (frame) {
    frame.classList.remove('error-detected');
    frame.classList.add('detected');
    setTimeout(() => frame && frame.classList.remove('detected'), 1500);
  }

  let punchType = user.presence === 'in' ? 'out' : 'in';
  if (scanMode === 'in') punchType = 'in';
  if (scanMode === 'out') punchType = 'out';

  const isAlreadyIn = punchType === 'in' && user.presence === 'in';
  const isAlreadyOut = punchType === 'out' && user.presence === 'out';

  finishPunch(user.id, punchType, 'scanner', null, { silent: false });
  renderScanSuccess(user, punchType, { isAlreadyIn, isAlreadyOut });

  const late = punchType === 'in' && isLate();
  const l1 = punchType === 'in' ? (late ? 'ENTREE RETARD' : 'ENTREE OK') : 'SORTIE OK';
  notifyEspLcd(l1, (user.prenom || '') + ' ' + (user.nom || ''));
}

function renderScanSuccess(user, punchType, meta = {}) {
  const box = $('#scan-result-card');
  if (!box) return;

  const isEntry = punchType === 'in';
  const isLatePunch = isEntry && isLate();
  const timeStr = fmtTime(Date.now());
  const hoursToday = hoursFor(user, dayStartTs(), Date.now());

  const statusLabel = isEntry ? 'Entrée validée' : 'Sortie validée';
  const statusClass = isEntry ? 'in' : 'out';

  box.innerHTML = `
    <div class="scan-res-card ok reveal">
      <div class="scan-res-top">
        ${avatarHTML(user, 54)}
        <div class="scan-res-info">
          <h4>${esc(user.prenom)} ${esc(user.nom)}</h4>
          <p><span class="mi">badge</span>${esc(user.uid)} · ${esc(user.role)}${user.dept ? ' · ' + esc(user.dept) : ''}</p>
        </div>
        <span class="pill ${statusClass}">
          <span class="mi">${isEntry ? 'login' : 'logout'}</span>
          ${statusLabel}
        </span>
      </div>
      <div class="scan-res-details">
        <div class="scan-res-stat">
          <small>Heure du scan</small>
          <b>${timeStr}</b>
        </div>
        <div class="scan-res-stat">
          <small>Heures aujourd'hui</small>
          <b>${fmtDur(hoursToday)}</b>
        </div>
        <div class="scan-res-stat">
          <small>Statut actuel</small>
          <b style="color:${isEntry ? 'var(--green)' : 'var(--blue)'}">${isEntry ? 'Présent(e)' : 'Sorti(e)'}</b>
        </div>
      </div>
      ${isLatePunch ? '<div class="scan-res-alert"><span class="mi">warning</span> Arrivée signalée en retard</div>' : ''}
    </div>
  `;

  addRecentScanItem({
    user,
    type: punchType,
    time: timeStr,
    late: isLatePunch
  });
}

function renderScanError(raw, badgeCode) {
  const box = $('#scan-result-card');
  if (!box) return;

  box.innerHTML = `
    <div class="scan-res-card err reveal">
      <div class="scan-res-top">
        <div class="scan-res-err-icon"><span class="mi">person_off</span></div>
        <div class="scan-res-info">
          <h4 style="color:var(--danger)">Badge non reconnu</h4>
          <p>Code détecté : <b style="font-family:var(--font-d);letter-spacing:1px">${esc(badgeCode || raw)}</b></p>
        </div>
        <span class="pill susp"><span class="mi">error</span>Introuvable</span>
      </div>
      <div class="scan-res-err-msg">
        <span class="mi">info</span>
        <span>Aucun utilisateur associé à cet identifiant dans la base de données.</span>
      </div>
    </div>
  `;
}

function renderScanArchived(user) {
  const box = $('#scan-result-card');
  if (!box) return;

  box.innerHTML = `
    <div class="scan-res-card warn reveal">
      <div class="scan-res-top">
        ${avatarHTML(user, 54)}
        <div class="scan-res-info">
          <h4>${esc(user.prenom)} ${esc(user.nom)}</h4>
          <p><span class="mi">archive</span>Utilisateur archivé (${esc(user.uid)})</p>
        </div>
        <span class="pill out"><span class="mi">block</span>Désactivé</span>
      </div>
      <div class="scan-res-err-msg" style="background:var(--warn-soft);color:var(--warn)">
        <span class="mi">warning</span>
        <span>Ce membre est archivé. Le pointage automatique est désactivé.</span>
      </div>
    </div>
  `;
}

function addRecentScanItem(item) {
  scanHistory.unshift(item);
  if (scanHistory.length > 12) scanHistory.pop();
  renderScanHistory();
}

function renderScanHistory() {
  const list = $('#scan-history-list');
  if (!list) return;
  if (!scanHistory.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:12.5px;text-align:center;padding:12px">Aucun scan récent.</p>';
    return;
  }
  list.innerHTML = scanHistory.map(s => `
    <div class="scan-hist-row">
      ${avatarHTML(s.user, 32)}
      <div class="scan-hist-meta">
        <b>${esc(s.user.prenom)} ${esc(s.user.nom)}</b>
        <small>${s.user.uid} · ${s.time}</small>
      </div>
      <span class="pill ${s.type === 'in' ? 'in' : 'out'}" style="font-size:10px;padding:3px 7px">
        <span class="mi" style="font-size:11px">${s.type === 'in' ? 'login' : 'logout'}</span>
        ${s.type === 'in' ? 'Entrée' : 'Sortie'}
      </span>
    </div>
  `).join('');
}
