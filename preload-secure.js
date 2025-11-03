/* eslint-disable no-undef */
const { contextBridge, ipcRenderer } = require('electron');

// ===================================================================
// CONFIGURAÇÕES GERAIS
// ===================================================================
const TOOLBAR_HEIGHT = 44; // altura da barra (px)
const UI_ID = 'multiprime-browser-ui';
const WATCHDOG_MS = 1000; // reinjeção/garantia de visibilidade

// ===================================================================
// SISTEMA DE INJEÇÃO DE SESSÃO
// ===================================================================
let autoLoginCredentials = null;

// Função reutilizável para injetar dados de sessão
function injectSessionData(data, { source = 'async' } = {}) {
  try {
    console.log(`[PRELOAD] Injetando dados de sessão (${source})`, {
      hasLocalStorage: !!data?.localStorage,
      hasSessionStorage: !!data?.sessionStorage,
      hasIndexedDB: !!data?.indexedDB
    });

    // Injetar localStorage
    if (data?.localStorage) {
      try {
        Object.entries(data.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
      } catch (err) {
        console.error('[PRELOAD] Erro localStorage:', err);
      }
    }

    // Injetar sessionStorage
    if (data?.sessionStorage) {
      try {
        Object.entries(data.sessionStorage).forEach(([k, v]) => sessionStorage.setItem(k, v));
      } catch (err) {
        console.error('[PRELOAD] Erro sessionStorage:', err);
      }
    }

    // IndexedDB (placeholder controlado no main; aqui somente log)
    if (data?.indexedDB) {
      console.log('[PRELOAD] IndexedDB data recebido (placeholder)');
    }
  } catch (e) {
    console.warn('[PRELOAD] Falha ao injetar dados de sessão:', e);
  }
}

// 🔸 INJEÇÃO ANTECIPADA (IPC síncrono) — roda o quanto antes no preload
(() => {
  try {
    const initialData = ipcRenderer.sendSync('get-initial-session-data'); // <— síncrono
    if (initialData && typeof initialData === 'object') {
      injectSessionData(initialData, { source: 'sync' });
    } else {
      console.log('[PRELOAD] Sem dados de sessão síncronos ou payload inválido.');
    }
  } catch (e) {
    console.warn('[PRELOAD] Erro no sendSync(get-initial-session-data):', e);
  }
})();

// Listener para credenciais de auto-login
ipcRenderer.on('set-auto-login-credentials', (event, credentials) => {
  console.log('[AUTO-LOGIN] Credenciais recebidas no preload');
  autoLoginCredentials = credentials;
  if (document.readyState === 'complete') setTimeout(() => tryAutoFillLogin(), 500);
});

// Mantém fallback assíncrono (para casos em que o sync não retorne tudo)
window.addEventListener('DOMContentLoaded', () => {
  console.log('[PRELOAD] DOM Carregado. (fallback) solicitando dados de sessão por IPC async…');
  ipcRenderer.send('request-session-data');
  if (autoLoginCredentials) setTimeout(() => tryAutoFillLogin(), 1000);
});

// Recebe injeção via canal assíncrono também (reuso de função)
ipcRenderer.on('inject-session-data', (event, data) => {
  injectSessionData(data, { source: 'async' });
});

// ===================================================================
// AUTO-LOGIN INTELIGENTE
// ===================================================================
function tryAutoFillLogin() {
  if (!autoLoginCredentials) return;
  console.log('[AUTO-LOGIN] Tentando preencher formulário...');
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="login" i]',
    'input[id*="email" i]',
    'input[id*="user" i]',
    'input[id*="login" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="user" i]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]'
  ];
  const passwordSelectors = [
    'input[type="password"]',
    'input[name*="password" i]',
    'input[id*="password" i]',
    'input[placeholder*="password" i]',
    'input[placeholder*="senha" i]',
    'input[autocomplete="current-password"]'
  ];

  let u = null, p = null;
  for (const s of usernameSelectors) { const el = document.querySelector(s); if (el && el.offsetParent !== null) { u = el; break; } }
  for (const s of passwordSelectors) { const el = document.querySelector(s); if (el && el.offsetParent !== null) { p = el; break; } }
  if (!(u && p)) return;

  const fill = (field, value) => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  fill(u, autoLoginCredentials.usuariodaferramenta);
  fill(p, autoLoginCredentials.senhadaferramenta);

  setTimeout(() => {
    const btns = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[name*="login" i]',
      'button[id*="login" i]'
    ];
    for (const s of btns) { const b = document.querySelector(s); if (b && b.offsetParent !== null) { b.click(); break; } }
  }, 400);
}

const loginObserver = new MutationObserver(() => {
  if (autoLoginCredentials && document.querySelector('input[type="password"]')) tryAutoFillLogin();
});

// ===================================================================
// UI DO NAVEGADOR (Barra + Downloads + Toast + Watchdog)
// ===================================================================
function injectBrowserUI() {
  if (document.getElementById(UI_ID)) return;

  const uiContainer = document.createElement('div');
  uiContainer.id = UI_ID;
  uiContainer.style.display = 'block';
  uiContainer.style.visibility = 'visible';

  uiContainer.innerHTML = `
    <div id="mp-titlebar" class="mp-drag">
      <div id="mp-left" class="mp-no-drag">
        <div id="mp-nav-controls" class="mp-no-drag" aria-label="Controles de navegação">
          <button id="mp-back" class="mp-nav-btn" title="Voltar" aria-label="Voltar">←</button>
          <button id="mp-forward" class="mp-nav-btn" title="Avançar" aria-label="Avançar">→</button>
          <button id="mp-reload" class="mp-nav-btn" title="Recarregar" aria-label="Recarregar">↻</button>
        </div>
      </div>
      <div id="mp-center" class="mp-no-drag">
        <div id="mp-url-shell" role="group" aria-label="Barra de endereço">
          <div id="mp-url-leading">
            <img id="mp-favicon" alt="" />
            <span id="mp-lock" title="Conexão">🔒</span>
          </div>
          <input
            type="text"
            id="mp-url-input"
            placeholder="URL atual"
            aria-label="Barra de endereço (somente leitura)"
            readonly
          />
          <div id="mp-url-trailing">
            <span id="mp-connection" title="Status">●</span>
          </div>
        </div>
      </div>
      <div id="mp-right" class="mp-no-drag">
        <button id="mp-downloads-btn" class="mp-pill" aria-pressed="false" title="Downloads">
          Downloads <span id="mp-dl-badge" class="mp-badge" aria-hidden="true" hidden>0</span>
        </button>
        <div id="mp-window-controls" class="mp-no-drag" aria-label="Controles da janela">
          <button id="mp-minimize" class="mp-win-btn" title="Minimizar" aria-label="Minimizar">—</button>
          <button id="mp-maximize" class="mp-win-btn" title="Maximizar" aria-label="Maximizar">▢</button>
          <button id="mp-close" class="mp-win-btn mp-close" title="Fechar" aria-label="Fechar">✕</button>
        </div>
      </div>
    </div>

    <div id="mp-download-manager" aria-label="Gerenciador de downloads">
      <div id="mp-download-header">
        <div class="mp-download-title">Downloads</div>
        <div class="mp-download-actions-right">
          <button id="mp-clear-history" class="mp-download-action" style="display:none;">Limpar Histórico</button>
        </div>
      </div>
      <div id="mp-download-live-list" aria-live="polite"></div>
      <div id="mp-download-history" style="display:none;"></div>
    </div>

    <div id="mp-toast-container" aria-live="polite" aria-atomic="true"></div>
  `;

  const styles = document.createElement('style');
  styles.textContent = `
    #${UI_ID}, #${UI_ID} * { box-sizing: border-box; }
    :root { --mp-offset: ${TOOLBAR_HEIGHT}px; }

    #${UI_ID} {
      position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
      z-index: 2147483647 !important;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto !important; isolation: isolate !important;
      display: block !important; visibility: visible !important;
    }

    #mp-titlebar {
      height: ${TOOLBAR_HEIGHT}px;
      display: grid; grid-template-columns: auto 1fr auto;
      align-items: center; gap: 10px; padding: 6px 10px;
      background: rgba(24, 24, 24, 0.92);
      backdrop-filter: saturate(140%) blur(8px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      user-select: none;
    }
    .mp-drag { -webkit-app-region: drag; }
    .mp-no-drag { -webkit-app-region: no-drag; }

    #mp-left, #mp-right { display: flex; align-items: center; gap: 10px; }

    #mp-nav-controls { display: flex; gap: 6px; }
    .mp-nav-btn {
      width: 32px; height: 32px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: #fff; cursor: pointer; font-size: 16px;
      display: grid; place-items: center; transition: background .15s, border-color .15s, transform .08s;
    }
    .mp-nav-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.16); }
    .mp-nav-btn:active { transform: translateY(1px); }

    #mp-center { min-width: 0; }
    #mp-url-shell {
      display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px;
      height: 32px; padding: 0 10px 0 8px;
      background: rgba(32,32,32,0.95);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
    }
    #mp-url-leading { display:flex; align-items:center; gap:6px; min-width: 0; }
    #mp-favicon { width: 16px; height: 16px; border-radius: 3px; background: rgba(255,255,255,0.12); }
    #mp-lock { font-size: 12px; opacity: .9; }
    #mp-url-input {
      width: 100%; min-width: 0; height: 28px; background: transparent; border: none; outline: none;
      color: #f2f2f2; font-size: 13px; cursor: default;
    }
    #mp-url-input::placeholder { color: rgba(255,255,255,0.45); }
    #mp-url-trailing { display:flex; align-items:center; gap:6px; }
    #mp-connection { font-size: 10px; color: #00d084; }

    #mp-downloads-btn {
      height: 28px; padding: 0 12px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.05); color: #fff; font-size: 12px;
      cursor: pointer; transition: background .15s, border-color .15s, transform .08s, opacity .2s;
    }
    #mp-downloads-btn[aria-pressed="true"] { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); }
    #mp-downloads-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.18); }
    .mp-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 6px;
      margin-left: 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
      background: #0a84ff; color: #fff;
    }
    /* Destaque extra quando o HISTÓRICO estiver aberto */
    #mp-downloads-btn[data-history-open="true"] { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.28); }

    #mp-window-controls { display:flex; align-items:center; gap: 2px; margin-left: 4px; }
    .mp-win-btn {
      width: 38px; height: 28px; border: none; border-radius: 6px;
      background: transparent; color: #fff; cursor: pointer; font-size: 14px;
      display: grid; place-items: center; transition: background .12s, transform .08s;
    }
    .mp-win-btn:hover { background: rgba(255,255,255,0.08); }
    .mp-win-btn:active { transform: translateY(1px); }
    .mp-win-btn.mp-close:hover { background: #d22; }

    /* Download Manager (compacto) */
    #mp-download-manager {
      background: rgba(0,0,0,0.96);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #0a0a0a;
      max-height: 0; overflow: hidden; transition: max-height .24s ease;
      display: block !important; visibility: visible !important;
    }
    #mp-download-manager.active { max-height: 220px; overflow-y: auto; }
    #mp-download-header {
      display:flex; align-items:center; justify-content:space-between;
      padding: 6px 10px; border-bottom: 1px solid #2a2a2a; position: sticky; top: 0;
      background: rgba(0,0,0,0.96); z-index:1;
    }
    #mp-download-header .mp-download-title { color:#fff; font-size:12px; font-weight:600; }
    .mp-download-item { display:flex; align-items:center; gap:8px; padding:6px 10px; border-bottom:1px solid #242424; }
    .mp-download-icon { font-size: 18px; }
    .mp-download-info { flex:1; min-width:0; }
    .mp-download-name { color:#fff; font-size: 12px; font-weight:500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mp-download-progress { display:flex; align-items:center; gap:6px; margin-top:4px; }
    .mp-progress-bar { flex:1; height:3px; background:#2a2a2a; border-radius:2px; overflow:hidden; }
    .mp-progress-fill { height:100%; background: linear-gradient(90deg,#0a84ff 0%, #00d4ff 100%); transition: width .2s ease; border-radius:2px; }
    .mp-progress-text { color:#8a8a8a; font-size: 10px; min-width: 36px; text-align: right; }
    .mp-download-actions { display:flex; gap:6px; }
    .mp-download-action {
      padding: 4px 8px; border-radius: 6px;
      border: 1px solid #404040; background: #2a2a2a; color:#fff;
      cursor: pointer; font-size: 11px; transition: all .12s;
    }
    .mp-download-action:hover { background: #3a3a3a; border-color:#0a84ff; }

    html { margin:0 !important; padding:0 !important; scroll-padding-top: var(--mp-offset) !important; }
    body {
      margin: 0 !important;
      padding-top: ${TOOLBAR_HEIGHT}px !important;
      padding-bottom: max(env(safe-area-inset-bottom, 0px), 24px) !important;
      min-height: calc(100vh - var(--mp-offset)) !important;
      box-sizing: border-box !important;
    }
    html, body { overflow-y: auto !important; }

    *[style*="100vh"], *[style*="100dvh"], *[style*="100svh"], *[style*="100lvh"] {
      min-height: calc(100vh - var(--mp-offset)) !important;
    }

    #mp-toast-container {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483648;
      display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    }
    .mp-toast {
      pointer-events: auto;
      background: rgba(32,32,32,0.95);
      color: #fff; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 10px 12px; font-size: 12px; min-width: 220px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      display: flex; align-items: center; gap: 8px;
      transform: translateY(8px); opacity: 0;
      transition: transform .18s ease, opacity .18s ease;
    }
    .mp-toast.show { transform: translateY(0); opacity: 1; }

    button:focus, input:focus { outline: 2px solid #0a84ff44; outline-offset: 2px; }
  `;

  (document.head || document.documentElement).appendChild(styles);
  (document.body || document.documentElement).prepend(uiContainer);

  console.log('[UI] Barra injetada');
  setupBrowserUIEvents();

  if (document.body) {
    loginObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Correções de corte inferior e listeners
  applyBottomSafePatch();
  window.addEventListener('resize', debounce(applyBottomSafePatch, 120), { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(applyBottomSafePatch, 150), { passive: true });
}

// Watchdog
let watchdogTimer = null;
function startUIWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    const el = document.getElementById(UI_ID);
    if (!el || getComputedStyle(el).display === 'none') {
      console.warn('[UI] Watchdog: reinjetando barra...');
      injectBrowserUI();
    } else {
      el.style.display = 'block';
      el.style.visibility = 'visible';
    }
  }, WATCHDOG_MS);
}

// ===================================================================
// EVENTOS DA UI
// ===================================================================
function setupBrowserUIEvents() {
  document.getElementById('mp-close')?.addEventListener('click', () => ipcRenderer.send('close-secure-window'));
  document.getElementById('mp-minimize')?.addEventListener('click', () => ipcRenderer.send('minimize-secure-window'));
  document.getElementById('mp-maximize')?.addEventListener('click', () => ipcRenderer.send('maximize-secure-window'));

  document.getElementById('mp-back')?.addEventListener('click', () => ipcRenderer.send('navigate-back'));
  document.getElementById('mp-forward')?.addEventListener('click', () => ipcRenderer.send('navigate-forward'));
  document.getElementById('mp-reload')?.addEventListener('click', () => ipcRenderer.send('navigate-reload'));

  const urlInput = document.getElementById('mp-url-input');
  if (urlInput) {
    urlInput.setAttribute('readonly', 'true');
    urlInput.addEventListener('keydown', (e) => e.preventDefault());
    urlInput.addEventListener('paste', (e) => e.preventDefault());
  }
  ipcRenderer.send('request-initial-url');

  const downloadsBtn = document.getElementById('mp-downloads-btn');
  if (downloadsBtn) {
    downloadsBtn.addEventListener('click', () => {
      const mgr = document.getElementById('mp-download-manager');
      if (!mgr) return;
      const active = mgr.classList.toggle('active');
      downloadsBtn.setAttribute('aria-pressed', String(active));
      if (active) toggleHistory(false);
    });
  }

  document.getElementById('mp-clear-history')?.addEventListener('click', () => {
    saveDownloadHistory([]);
    renderHistory();
    updateDownloadsBadge();
  });
}

// Atualização de URL/ícone/cadeado
ipcRenderer.on('url-updated', (event, url) => {
  const urlInput = document.getElementById('mp-url-input');
  const lock = document.getElementById('mp-lock');
  const fav = document.getElementById('mp-favicon');
  const connection = document.getElementById('mp-connection');

  if (urlInput) urlInput.value = url || '';
  try {
    const u = new URL(url);
    if (lock) lock.textContent = u.protocol === 'https:' ? '🔒' : '⚠️';
    if (fav) {
      const icon = `${u.origin}/favicon.ico`;
      fav.src = icon;
      fav.onerror = () => { fav.removeAttribute('src'); };
    }
    if (connection) {
      connection.style.color = (u.protocol === 'https:') ? '#00d084' : '#ff9f00';
      connection.title = (u.protocol === 'https:') ? 'Conexão segura' : 'Conexão não segura';
    }
  } catch {
    if (lock) lock.textContent = '⚠️';
  }

  applyBottomSafePatch();
});

// ===================================================================
// DOWNLOADS + TOAST
// ===================================================================
const DL_HISTORY_KEY = 'mp-download-history-v1';

function loadDownloadHistory() { try { const raw = localStorage.getItem(DL_HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function saveDownloadHistory(items) { try { localStorage.setItem(DL_HISTORY_KEY, JSON.stringify(items.slice(0, 500))); } catch {} }
function addHistoryItem({ filename, path, state, finishedAt }) {
  const items = loadDownloadHistory();
  items.unshift({ filename, path: path || null, state, finishedAt: finishedAt || new Date().toISOString() });
  saveDownloadHistory(items);
}
function humanDate(iso) { try { return new Date(iso).toLocaleString('pt-BR', { hour12: false }); } catch { return iso; } }

function renderHistory() {
  const historyEl = document.getElementById('mp-download-history');
  if (!historyEl) return;
  const items = loadDownloadHistory();
  if (!items.length) {
    historyEl.innerHTML = `
      <div class="mp-download-item">
        <div class="mp-download-icon">📭</div>
        <div class="mp-download-info"><div class="mp-download-name">Sem itens no histórico</div></div>
      </div>`;
    return;
  }
  historyEl.innerHTML = items.map((it, idx) => `
    <div class="mp-download-item" data-idx="${idx}">
      <div class="mp-download-icon">${it.state === 'completed' ? '✅' : '❌'}</div>
      <div class="mp-download-info">
        <div class="mp-download-name" title="${sanitizeText(it.filename)}">${sanitizeText(it.filename)}</div>
        <div class="mp-download-progress" style="margin-top:4px;">
          <div class="mp-progress-text">${humanDate(it.finishedAt)}</div>
        </div>
      </div>
      <div class="mp-download-actions">
        <button class="mp-download-action" data-action="open" ${it.path ? '' : 'disabled'}>Abrir</button>
        <button class="mp-download-action" data-action="show" ${it.path ? '' : 'disabled'}>Mostrar</button>
      </div>
    </div>
  `).join('');

  historyEl.querySelectorAll('.mp-download-item').forEach(row => {
    const idx = Number(row.getAttribute('data-idx'));
    const item = loadDownloadHistory()[idx];
    row.querySelector('[data-action="open"]')?.addEventListener('click', () => { if (item?.path) ipcRenderer.send('open-download', item.path); });
    row.querySelector('[data-action="show"]')?.addEventListener('click', () => { if (item?.path) ipcRenderer.send('show-download-in-folder', item.path); });
  });
}

function toggleHistory(show) {
  const historyEl    = document.getElementById('mp-download-history');
  const liveEl       = document.getElementById('mp-download-live-list');
  const clearBtn     = document.getElementById('mp-clear-history');
  const mgr          = document.getElementById('mp-download-manager');
  const downloadsBtn = document.getElementById('mp-downloads-btn');
  if (!historyEl || !liveEl) return;

  const willShow = typeof show === 'boolean' ? show : (historyEl.style.display === 'none');

  historyEl.style.display = willShow ? 'block' : 'none';
  liveEl.style.display    = willShow ? 'none'  : 'block';
  if (clearBtn) clearBtn.style.display = willShow ? 'inline-block' : 'none';

  if (mgr) mgr.classList.add('active');

  if (downloadsBtn) {
    downloadsBtn.setAttribute('data-history-open', String(willShow));
    if (willShow) downloadsBtn.setAttribute('aria-pressed', 'true');
  }

  if (willShow) renderHistory();
}

function updateDownloadsBadge() {
  const badge = document.getElementById('mp-dl-badge');
  if (!badge) return;
  const activeCount = activeDownloads.size;
  const historyCount = loadDownloadHistory().length;
  const total = activeCount || historyCount || 0;
  if (total > 0) {
    badge.textContent = String(activeCount || historyCount);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function showToast(message, { actions = [] } = {}) {
  const container = document.getElementById('mp-toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'mp-toast';
  el.innerHTML = `
    <div class="mp-toast-icon">📥</div>
    <div class="mp-toast-text">${message}</div>
    <div class="mp-toast-actions"></div>
  `;
  const actionsEl = el.querySelector('.mp-toast-actions');
  actions.forEach(({ label, onClick }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick?.(); removeToast(); });
    actionsEl.appendChild(btn);
  });
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const removeToast = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 180); };
  const t = setTimeout(removeToast, 4000);
  el.addEventListener('mouseenter', () => clearTimeout(t));
  el.addEventListener('mouseleave', () => setTimeout(removeToast, 1500));
}

const activeDownloads = new Map();
const downloadManager = () => document.getElementById('mp-download-manager');
const liveList = () => document.getElementById('mp-download-live-list');

ipcRenderer.on('download-started', (event, { id, filename }) => {
  console.log('[DOWNLOAD] Iniciado:', filename);
  const mgr = downloadManager(); if (mgr) mgr.classList.add('active');

  const btn = document.getElementById('mp-downloads-btn');
  if (btn) btn.setAttribute('aria-pressed', 'true');

  showToast(`Download iniciado: <strong>${sanitizeText(filename)}</strong>`, {
    actions: [{ label: 'Ver', onClick: () => { const mgrEl = downloadManager(); if (mgrEl) mgrEl.classList.add('active'); } }]
  });

  const list = liveList(); if (!list) return;
  const row = document.createElement('div');
  row.className = 'mp-download-item';
  row.id = `download-${id}`;
  row.innerHTML = `
    <div class="mp-download-icon">📥</div>
    <div class="mp-download-info">
      <div class="mp-download-name">${sanitizeText(filename)}</div>
      <div class="mp-download-progress">
        <div class="mp-progress-bar"><div class="mp-progress-fill" style="width:0%"></div></div>
        <div class="mp-progress-text">0%</div>
      </div>
    </div>
    <div class="mp-download-actions" style="display:none;">
      <button class="mp-download-action" data-action="open">Abrir</button>
      <button class="mp-download-action" data-action="show">Mostrar</button>
    </div>
  `;
  list.appendChild(row);
  activeDownloads.set(id, { filename, element: row, path: null });

  const mgrEl = downloadManager();
  if (mgrEl) mgrEl.classList.add('active');
  updateDownloadsBadge();
});

ipcRenderer.on('download-progress', (event, { id, progress }) => {
  const d = activeDownloads.get(id);
  if (d) {
    const fill = d.element.querySelector('.mp-progress-fill');
    const txt = d.element.querySelector('.mp-progress-text');
    if (fill) fill.style.width = `${progress}%`;
    if (txt) txt.textContent = `${progress}%`;
  }
});

ipcRenderer.on('download-complete', (event, { id, state, path }) => {
  const d = activeDownloads.get(id);
  if (d) {
    d.path = path;
    const icon = d.element.querySelector('.mp-download-icon');
    const fill = d.element.querySelector('.mp-progress-fill');
    const txt = d.element.querySelector('.mp-download-progress .mp-progress-text');
    const actions = d.element.querySelector('.mp-download-actions');

    if (state === 'completed') {
      if (icon) icon.textContent = '✅';
      if (fill) fill.style.width = '100%';
      if (txt) txt.textContent = '100%';
      if (actions) {
        actions.style.display = 'flex';
        actions.querySelector('[data-action="open"]')?.addEventListener('click', () => ipcRenderer.send('open-download', path));
        actions.querySelector('[data-action="show"]')?.addEventListener('click', () => ipcRenderer.send('show-download-in-folder', path));
      }
      addHistoryItem({ filename: d.filename, path, state: 'completed', finishedAt: new Date().toISOString() });
    } else {
      if (icon) icon.textContent = '❌';
      if (txt) txt.textContent = 'Falhou';
      addHistoryItem({ filename: d.filename, path: null, state: 'failed', finishedAt: new Date().toISOString() });
    }

    setTimeout(() => {
      d.element.style.opacity = '0';
      d.element.style.transition = 'opacity .4s';
      setTimeout(() => {
        d.element.remove();
        activeDownloads.delete(id);
        const mgr = downloadManager();
        const historyShown = document.getElementById('mp-download-history')?.style.display === 'block';
        if (mgr && !historyShown && activeDownloads.size === 0) {
          const downloadsBtn = document.getElementById('mp-downloads-btn');
          if (downloadsBtn?.getAttribute('aria-pressed') !== 'true') mgr.classList.remove('active');
        }
        updateDownloadsBadge();
      }, 400);
    }, 8000);
  } else {
    updateDownloadsBadge();
  }
});

// Sanitização simples
function sanitizeText(str) {
  try { return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  catch { return str; }
}

// ===================================================================
// ANTI-SOBREPOSIÇÃO (headers/modais fixed/sticky) — top only
// ===================================================================
(() => {
  const OFFSET = TOOLBAR_HEIGHT;
  const adjusted = new WeakSet();
  const isInside = (el) => !!el.closest(`#${UI_ID}`);
  const shouldSkip = (el) => !el || el.nodeType !== 1 || isInside(el) || (() => {
    const r = el.getBoundingClientRect?.(); return !r || (r.width === 0 && r.height === 0);
  })();

  function bump(el) {
    if (shouldSkip(el) || adjusted.has(el)) return;
    const cs = getComputedStyle(el);
    const pos = cs.position;
    if (pos !== 'fixed' && pos !== 'sticky') return;

    // Ajuste apenas para colisões superiores
    const topStr = cs.top;
    const topIsAuto = topStr === 'auto';
    const topPx = topIsAuto ? NaN : parseFloat(topStr || '0');
    const collidesByTop = (!isNaN(topPx) && topPx <= OFFSET + 0.5) || (pos === 'sticky' && (topIsAuto || topStr === '0px'));
    const isBottomAnchored = cs.bottom === '0px'; // não mexer em footers

    if (collidesByTop && !isBottomAnchored) {
      if (!isNaN(topPx)) {
        el.style.top = (topPx + OFFSET) + 'px';
      } else {
        const t = cs.transform === 'none' ? '' : cs.transform;
        el.style.transform = `translateY(${OFFSET}px) ${t.includes('matrix') || t.includes('translate') ? '' : t}`.trim();
        el.style.willChange = 'transform';
      }
      el.style.setProperty('scroll-margin-top', `${OFFSET}px`, 'important');
      adjusted.add(el);
    }
  }

  function scan(root) {
    if (root.querySelectorAll) {
      root.querySelectorAll([
        '[class*="modal"]','[class*="popup"]','[class*="dialog"]','[class*="drawer"]',
        '[class*="toast"]','[class*="banner"]','[class*="header"]','[class*="fixed"]',
        '[data-modal]','[role="dialog"]','[role="alertdialog"]','[role="banner"]','[role="tooltip"]'
      ].join(',')).forEach(bump);
    }
    bump(root);
  }

  const obs = new MutationObserver((muts) => muts.forEach(m => {
    if (m.type === 'childList') m.addedNodes.forEach(scan);
    else if (m.type === 'attributes') bump(m.target);
  }));

  function start() {
    if (!document.body) return;
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style'] });
    scan(document.body);
  }

  ['load','resize','orientationchange'].forEach(evt => {
    window.addEventListener(evt, () => { if (document.body) scan(document.body); }, { passive: true });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

// ===================================================================
// PATCH CONTRA “CORTE” INFERIOR (Bottom-Safe)
// ===================================================================
function applyBottomSafePatch() {
  try {
    const doc = document.documentElement;
    const body = document.body || document.documentElement;

    const scrollH = doc.scrollHeight;
    const innerH  = window.innerHeight;
    const cssHtml = getComputedStyle(doc);
    const cssBody = getComputedStyle(body);
    const overflowLocked = (cssHtml.overflowY === 'hidden' || cssBody.overflowY === 'hidden');

    if (overflowLocked && scrollH > innerH + 4) {
      doc.style.overflowY = 'auto';
      body.style.overflowY = 'auto';
    }

    body.style.minHeight = `calc(100vh - ${TOOLBAR_HEIGHT}px)`;

    const existingPB = parseInt(cssBody.paddingBottom || '0', 10) || 0;
    if (existingPB < 24) body.style.paddingBottom = `max(env(safe-area-inset-bottom, 0px), 24px)`;

    document.querySelectorAll('*[style*="100vh"], *[style*="100dvh"], *[style*="100svh"], *[style*="100lvh"]').forEach(el => {
      if (el.id && (el.id.includes('modal') || el.id.includes('dialog'))) return;
      el.style.minHeight = `calc(100vh - ${TOOLBAR_HEIGHT}px)`;
    });

  } catch (e) {
    console.warn('[BottomSafe] falha ao aplicar patch:', e);
  }
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ===================================================================
// INICIALIZAÇÃO + WATCHDOG
// ===================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { injectBrowserUI(); startUIWatchdog(); }, { once: true });
} else {
  injectBrowserUI(); startUIWatchdog();
}
window.addEventListener('load', () => {
  if (!document.getElementById(UI_ID)) injectBrowserUI();
  applyBottomSafePatch();
});

// ===================================================================
// API EXPOSTA
// ===================================================================
contextBridge.exposeInMainWorld('electronAPI', {
  // Navegação
  navigateBack:   () => ipcRenderer.send('navigate-back'),
  navigateForward:() => ipcRenderer.send('navigate-forward'),
  navigateReload: () => ipcRenderer.send('navigate-reload'),
  navigateToUrl:  (url) => ipcRenderer.send('navigate-to-url', url),

  // Janela
  minimizeWindow: () => ipcRenderer.send('minimize-secure-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-secure-window'),
  closeWindow:    () => ipcRenderer.send('close-secure-window'),

  // Downloads
  openDownload:         (path) => ipcRenderer.send('open-download', path),
  showDownloadInFolder: (path) => ipcRenderer.send('show-download-in-folder', path),

  // Histórico de downloads
  getDownloadHistory:   () => loadDownloadHistory(),
  clearDownloadHistory: () => { saveDownloadHistory([]); renderHistory(); },
  showDownloadHistory:  () => { const mgr = document.getElementById('mp-download-manager'); if (mgr) mgr.classList.add('active'); toggleHistory(true); },

  // Listeners
  onUrlUpdated:       (cb) => ipcRenderer.on('url-updated', (e, url) => cb(url)),
  onDownloadStarted:  (cb) => ipcRenderer.on('download-started', (e, d) => cb(d)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (e, d) => cb(d)),
  onDownloadComplete: (cb) => ipcRenderer.on('download-complete', (e, d) => cb(d))
});

console.log('[PRELOAD-SECURE] Injeção síncrona de sessão ativa. Sem auto-refresh. 🚀');
