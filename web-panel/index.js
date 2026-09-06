function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('sanitech-theme', next); } catch (e) {}
}

(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('sanitech-theme'); } catch (e) {}
  applyTheme(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
})();

function onSlider(id) {
  document.getElementById('val-' + id).textContent = document.getElementById('in-' + id).value;
}

async function sendSettings() {
  const sprayMs = Math.round(parseFloat(document.getElementById('in-spray').value) * 1000);
  await fetch(`/set?spray=${sprayMs}`);
  showToast("Durée enregistrée !");
}

async function fetchCall(ep) {
  await fetch(ep);
  showToast("Action envoyée");
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (msg) t.textContent = msg;
  t.classList.remove('toast-enter');
  t.classList.add('toast-show');
  setTimeout(() => {
    t.classList.remove('toast-show');
    t.classList.add('toast-enter');
  }, 2000);
}

function sendRGBColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  fetchCall(`/rgb?r=${r}&g=${g}&b=${b}`);
}

function setRGBMode(mName) {
  ['scan', 'rainbow', 'auto', 'off'].forEach(m => {
    const b = document.getElementById('mode-' + m);
    if (b) {
      b.classList.remove('active');
      if (m === mName) b.classList.add('active');
    }
  });
  fetchCall(`/rgb?mode=${mName}`);
}

async function updateStatus() {
  try {
    const resStatus = await fetch('/status');
    const data = await resStatus.json();

    const pumpTxt = document.getElementById('pump-text');
    const pumpDot = document.getElementById('pump-dot');
    pumpTxt.style.color = data.pump ? 'var(--accent)' : 'var(--text-dim)';
    pumpTxt.textContent = data.pump ? 'En cours...' : 'Repos';
    if (pumpDot) {
      pumpDot.style.color = data.pump ? 'var(--accent)' : 'var(--text-dim)';
      pumpDot.classList.toggle('live', !!data.pump);
    }

    const doorTxt = document.getElementById('door-text');
    doorTxt.style.color = data.doorOpen ? 'var(--safe)' : 'var(--danger)';
    doorTxt.textContent = data.doorOpen ? 'Ouverte' : 'Fermée';

    document.getElementById('count').textContent = data.count;
  } catch (e) {}
}

setInterval(updateStatus, 1000);