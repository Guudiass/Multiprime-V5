// preload-secure.js

// =====================
// Camuflagem Anti-Detecção de Bots (conservador, sem mexer no UA)
// =====================
Object.defineProperty(navigator, 'webdriver', { get: () => false });

Object.defineProperty(navigator, 'plugins', {
  get: () => [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
  ],
});

try {
  const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
  window.navigator.permissions.query = (parameters) =>
    parameters && parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);
} catch { /* silencioso */ }

const { ipcRenderer } = require('electron');

// =====================
// LOGIN AUTOMÁTICO (inalterado na lógica, com pequenas proteções)
// =====================
let autoLoginCredentials = null;
let loginAttempted = false;

function fillFieldFast(field, value) {
  if (!field || value == null) return false;
  try {
    field.focus();
    field.value = '';
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (error) {
    console.error('[AUTO-LOGIN] Erro ao preencher campo:', error);
    return false;
  }
}

function performAutoLogin() {
  if (!autoLoginCredentials || loginAttempted) return;

  const { usuariodaferramenta, senhadaferramenta } = autoLoginCredentials;
  const emailField =
    document.querySelector('input[id="amember-login"]') ||
    document.querySelector('input[name="amember_login"]') ||
    document.querySelector('input[type="email"]') ||
    document.querySelector('input[placeholder*="Username" i]');

  const passwordField =
    document.querySelector('input[id="amember-pass"]') ||
    document.querySelector('input[name="amember_pass"]') ||
    document.querySelector('input[type="password"]');

  if (emailField && passwordField) {
    const emailFilled = fillFieldFast(emailField, usuariodaferramenta);
    const passwordFilled = fillFieldFast(passwordField, senhadaferramenta);

    if (emailFilled && passwordFilled) {
      loginAttempted = true;
      setTimeout(() => {
        const submitButton =
          document.querySelector('input[type="submit"]') ||
          document.querySelector('button[type="submit"]') ||
          emailField.closest('form')?.querySelector('input[type="submit"]') ||
          emailField.closest('form')?.querySelector('button[type="submit"]');

        if (submitButton) {
          submitButton.click();
          const form = emailField.closest('form');
          if (form) setTimeout(() => form.submit(), 100);
        } else {
          passwordField.focus();
          passwordField.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true })
          );
          const form = passwordField.closest('form');
          if (form) setTimeout(() => form.submit(), 100);
        }

        showNotification('🔐 Login automático executado!');
      }, 300);
    }
  } else {
    // tenta de novo
    setTimeout(() => {
      loginAttempted = false;
      performAutoLogin();
    }, 2000);
  }
}

function attemptAutoLogin() {
  if (!autoLoginCredentials) return;
  const hostname = window.location.hostname;
  if (hostname.includes('noxtools.com')) {
    setTimeout(() => performAutoLogin(), 1500);
  }
}

ipcRenderer.on('set-auto-login-credentials', (_event, credentials) => {
  autoLoginCredentials = credentials;
  loginAttempted = false;
  attemptAutoLogin();
});

// Monitor de navegação
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    loginAttempted = false;
    setTimeout(attemptAutoLogin, 800);
  }
}, 1000);

// Gatilhos de carregamento
window.addEventListener('load', () => setTimeout(attemptAutoLogin, 1200));
document.addEventListener('DOMContentLoaded', () => setTimeout(attemptAutoLogin, 800));

// =====================
// Sincronização de sessão (IndexedDB / Storage) — inalterado, com try/catch
// =====================
ipcRenderer.on('inject-session-data', (_event, sessionData) => {
  (async () => {
    try {
      if (sessionData && typeof sessionData === 'object') {
        if (sessionData.localStorage) {
          for (const [key, value] of Object.entries(sessionData.localStorage)) {
            window.localStorage.setItem(key, value);
          }
        }
        if (sessionData.sessionStorage) {
          for (const [key, value] of Object.entries(sessionData.sessionStorage)) {
            window.sessionStorage.setItem(key, value);
          }
        }
        if (sessionData.indexedDB) {
          await importIndexedDB(sessionData.indexedDB);
        }
      }
    } catch (err) {
      console.error('[PRELOAD] Erro ao injetar dados da sessão:', err);
    }
  })();
});

ipcRenderer.send('request-session-data');

async function exportIndexedDB() {
  try {
    const allData = {};
    const databases = await (window.indexedDB.databases?.() || []);
    if (!databases || databases.length === 0) return {};
    for (const dbInfo of databases) {
      if (!dbInfo.name) continue;
      try {
        const dbData = {};
        const db = await new Promise((resolve, reject) => {
          const request = window.indexedDB.open(dbInfo.name);
          request.onerror = (e) => reject(`Erro ao abrir DB: ${dbInfo.name} - ${e.target.error}`);
          request.onsuccess = (e) => resolve(e.target.result);
        });
        const storeNames = Array.from(db.objectStoreNames || []);
        if (storeNames.length === 0) { db.close(); continue; }
        const tx = db.transaction(storeNames, 'readonly');
        for (const storeName of storeNames) {
          const storeData = await new Promise((resolve, reject) => {
            const request = tx.objectStore(storeName).getAll();
            request.onerror = (e) => reject(`Erro ao ler store: ${storeName} - ${e.target.error}`);
            request.onsuccess = (e) => resolve(e.target.result);
          });
          dbData[storeName] = storeData;
        }
        allData[dbInfo.name] = dbData;
        db.close();
      } catch (dbError) {
        console.error(`[INDEXEDDB EXPORT] Falha ao exportar DB "${dbInfo.name}":`, dbError);
      }
    }
    return allData;
  } catch (error) {
    console.error('[INDEXEDDB EXPORT] Falha crítica na exportação:', error);
    return {};
  }
}

async function importIndexedDB(dataToImport) {
  if (!dataToImport || Object.keys(dataToImport).length === 0) return;
  for (const dbName in dataToImport) {
    try {
      const dbStoresToImport = Object.keys(dataToImport[dbName] || {});
      if (dbStoresToImport.length === 0) continue;

      if (dbName.includes('captions')) {
        console.log(`[INDEXEDDB] Pulando importação para DB do captions: ${dbName}`);
        continue;
      }

      const db = await new Promise((resolve, reject) => {
        const request = window.indexedDB.open(dbName, Date.now());
        request.onerror = (e) => reject(`Erro ao abrir/criar DB: ${dbName} - ${e.target.error}`);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onupgradeneeded = (e) => {
          const dbInstance = e.target.result;
          const existingStores = Array.from(dbInstance.objectStoreNames || []);
          dbStoresToImport.forEach(storeName => {
            if (!existingStores.includes(storeName)) {
              dbInstance.createObjectStore(storeName);
            }
          });
        };
      });

      await new Promise((resolve, reject) => {
        const tx = db.transaction(dbStoresToImport, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(`Falha na transação de escrita: ${e.target.error}`);
        for (const storeName of dbStoresToImport) {
          const store = tx.objectStore(storeName);
          store.clear();
          const records = dataToImport[dbName][storeName] || [];
          records.forEach(record => {
            try { store.put(record); } catch { /* ignora registro ruim */ }
          });
        }
      });
      db.close();
    } catch (error) {
      console.error(`[INDEXEDDB IMPORT] Falha crítica na importação de "${dbName}":`, error);
    }
  }
}

console.log('%c[PRELOAD SCRIPT OTIMIZADO] Layout seguro e anti-tooltip conservador!', 'color: #00FF00; font-size: 14px;');

// =====================
// BARRA (Titlebar) — mais compatível com sites
// =====================
(() => {
  const TITLE_BAR_HEIGHT = 40;
  const CONTAINER_ID = 'secure-browser-titlebar-2025';
  const HTML_CLASS = 'with-secure-titlebar';
  let isInitialized = false;
  const downloads = new Map();
  let container = null;
  let shadowRoot = null;

  // Throttle helper
  function throttle(fn, wait = 100) {
    let last = 0, timer = null;
    return (...args) => {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        last = now;
        fn.apply(null, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(null, args);
        }, remaining);
      }
    };
  }

  function createTitleBar() {
    if (isInitialized || document.getElementById(CONTAINER_ID)) return;
    isInitialized = true;

    try {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.setAttribute('data-secure-browser', 'true');

      // Importante: container não afeta layout da página (overlay)
      container.style.cssText = `
        position: fixed;
        inset: 0 auto auto 0;
        width: 100%;
        height: ${TITLE_BAR_HEIGHT}px;
        z-index: 2147483647;
        pointer-events: none; /* barra por dentro tem auto */
        isolation: isolate;
      `;

      shadowRoot = container.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        :host { all: initial; display: block; position: fixed; top: 0; left: 0; width: 100%; height: ${TITLE_BAR_HEIGHT}px; }
        .bar {
          width: 100%; height: 100%;
          background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 10px; box-sizing: border-box;
          border-bottom: 1px solid #1a252f;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          -webkit-app-region: drag;
          pointer-events: auto;
          font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #ecf0f1; user-select: none;
        }
        .bar * { -webkit-app-region: no-drag; pointer-events: auto; }
        .group { display: flex; align-items: center; gap: 8px; }
        .url-box { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 20px; }
        .status { width: 8px; height: 8px; border-radius: 50%; background: ${navigator.onLine ? '#2ecc71' : '#e74c3c'}; }
        .url { flex: 1; height: 26px; background: rgba(0,0,0,0.2); border: 1px solid #2c3e50; border-radius: 13px; color: #ecf0f1; padding: 0 12px; font-size: 12px; text-align: center; outline: none; }
        button { width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s; padding: 0; margin: 0; outline: none; position: relative; overflow: hidden; }
        button:hover { background: rgba(255,255,255,0.1); }
        button.close:hover { background: #e74c3c; }
        .nav { font-size: 22px; }
        .downloads-menu {
          display: none; position: absolute; top: 100%; right: 10px; width: 330px; max-height: 450px;
          background: #34495e; border: 1px solid #2c3e50; border-radius: 0 0 8px 8px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.35); overflow-y: auto; color: #ecf0f1; font-size: 13px; padding: 8px; box-sizing: border-box;
        }
        .downloads-menu.open { display: block; }
        .downloads-menu:empty::before { content: 'Nenhum download iniciado'; display: block; text-align: center; padding: 20px; color: #bdc3c7; }
        .dl-item { padding: 10px; border-bottom: 1px solid #2c3e50; }
        .dl-item:last-child { border-bottom: none; }
        .dl-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .dl-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
        .dl-progress { height: 5px; background: rgba(0,0,0,0.3); border-radius: 3px; overflow: hidden; }
        .dl-bar { height: 100%; background: #3498db; transition: width 0.3s; }
        .dl-bar.done { background: #2ecc71; }
        .dl-actions { margin-top: 8px; display: flex; gap: 15px; font-size: 12px; }
        .dl-action { color: #3498db; cursor: pointer; text-decoration: none; }
        .dl-action:hover { color: #5dade2; text-decoration: underline; }
        .notification-popup {
          position: fixed; bottom: 20px; right: -400px;
          background-color: #2c3e50; color: #ecf0f1; padding: 12px 20px; border-radius: 6px;
          border-left: 4px solid #3498db; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
          z-index: 2147483647; font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          transition: right 0.5s cubic-bezier(0.68,-0.55,0.27,1.55); pointer-events: none;
        }
        .notification-popup.visible { right: 20px; }
      `;
      shadowRoot.appendChild(style);

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.innerHTML = `
        <div class="group">
          <button class="nav" data-action="back" title="Voltar">←</button>
          <button class="nav" data-action="forward" title="Avançar">→</button>
          <button data-action="reload" title="Recarregar">↻</button>
        </div>
        <div class="url-box">
          <div class="status" aria-hidden="true"></div>
          <input type="text" class="url" readonly>
        </div>
        <div class="group">
          <button data-action="downloads" title="Downloads">📥</button>
          <button data-action="minimize" title="Minimizar">−</button>
          <button data-action="maximize" title="Maximizar">☐</button>
          <button class="close" data-action="close" title="Fechar">×</button>
        </div>
        <div class="downloads-menu"></div>
      `;
      shadowRoot.appendChild(bar);

      // Insere antes do body para não “puxar” layout
      (document.body || document.documentElement).appendChild(container);

      // Ajuste de layout MUITO conservador
      applyLayoutReservation();
      setupAntiTooltipProtection();
      setupEvents();
      setupIpcListeners();
      ipcRenderer.send('request-initial-url');
      setupDomMonitoring();
    } catch (error) {
      console.error('[SECURE BROWSER] Erro ao criar barra:', error);
    }
  }

  // ---------------------
  // Notificações discretas
  // ---------------------
  function showNotification(text) {
    if (!shadowRoot) return;
    const notif = document.createElement('div');
    notif.className = 'notification-popup';
    notif.textContent = text;
    shadowRoot.appendChild(notif);
    requestAnimationFrame(() => notif.classList.add('visible'));
    setTimeout(() => {
      notif.classList.remove('visible');
      setTimeout(() => { try { shadowRoot.removeChild(notif); } catch {} }, 500);
    }, 4000);
  }

  // ===========================================================
  // ANTI-TOOLTIP (Conservador): somente leonardo.ai por padrão
  // ===========================================================
  function setupAntiTooltipProtection() {
    const host = window.location.hostname;

    // Lista de exceções em que NÃO fazemos nada (mantém site intacto)
    const allowedHostnames = ['canva.com', 'placeit.net', 'hailuoai.video', 'vectorizer.ai', 'gamma.app'];
    if (allowedHostnames.some(h => host.includes(h))) {
      return;
    }

    // Modo específico para leonardo.ai (mantido)
    if (host.includes('leonardo.ai')) {
      const tooltipSelectors = [
        '[role="tooltip"]',
        '.MuiTooltip-tooltip',
        '.MuiTooltip-popper',
        '[class*="tooltip"]',
        '[class*="Tooltip"]'
      ].join(',');

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            const findAndHide = (el) => {
              if (!el.matches) return;

              if (el.matches(tooltipSelectors) && el.textContent.includes('Download image')) {
                el.style.setProperty('display', 'none', 'important');
              }
              if (el.matches('[role="dialog"]')) {
                const t = el.textContent || '';
                if (t.includes('Upgrade') || t.includes('limit')) {
                  el.style.setProperty('display', 'none', 'important');
                }
              }
              // filhos
              el.querySelectorAll(tooltipSelectors).forEach(child => {
                if ((child.textContent || '').includes('Download image')) {
                  child.style.setProperty('display', 'none', 'important');
                }
              });
            };

            findAndHide(node);
          }
        }
      });

      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      return;
    }

    // ⚠️ Nada global aqui (o antigo CSS que escondia tooltips em todo site foi removido)
  }

  // ===========================================================
  // RESERVA DE ESPAÇO (sem mexer em <html> / viewport / overflow)
  // ===========================================================
  function applyLayoutReservation() {
    // adiciona uma classe para escopo e um padding-top no body
    document.documentElement.classList.add(HTML_CLASS);

    let styleEl = document.getElementById('secure-browser-layout-reservation');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'secure-browser-layout-reservation';
      styleEl.textContent = `
        .${HTML_CLASS} body { padding-top: ${TITLE_BAR_HEIGHT}px !important; }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    // Ajusta apenas headers fixos legitimos; sem transform
    safeAdjustOnlyHeaders();
  }

  // --- NOVO: seleção restrita de headers e ajuste via 'top' (sem transform) ---
  function safeAdjustOnlyHeaders() {
    const candidates = [];

    const headerSelectors = [
      'header',
      '[role="banner"]',
      'nav[role="navigation"]',
      '.header',
      '.topbar',
      '.navbar',
      '.app-header',
    ].join(',');

    document.querySelectorAll(headerSelectors).forEach((el) => {
      try {
        if (el.dataset.sbSkip === 'true') return;

        const cs = window.getComputedStyle(el);
        const pos = cs.position;
        if (pos !== 'fixed' && pos !== 'sticky') return;

        const top = parseFloat(cs.top || '0');
        if (isNaN(top) || top > 1) return;

        const z = parseInt(cs.zIndex, 10);
        const rect = el.getBoundingClientRect();

        const looksLikeHeader =
          rect.height <= 140 &&
          (isNaN(z) || z < 3000);

        if (!looksLikeHeader) return;

        // evita ajustar headers que contenham modais/tooltip/toasts
        if (el.querySelector('[role="dialog"],[aria-modal="true"],.modal,.MuiModal-root,[data-reach-dialog-overlay],[role="tooltip"],.tooltip,.toast,.snackbar')) {
          return;
        }

        if (el.dataset.sbAdjusted !== 'true') {
          el.dataset.sbAdjusted = 'true';
          el.dataset.sbPrevTop = cs.top || '0px';
          const newTop = (top || 0) + TITLE_BAR_HEIGHT;
          el.style.top = `${newTop}px`;
        }
      } catch { /* silencioso */ }
    });
  }

  function revertHeaderAdjustments() {
    document.querySelectorAll('[data-sb-adjusted="true"]').forEach((el) => {
      try {
        const prevTop = el.dataset.sbPrevTop || '0px';
        el.style.top = prevTop;
        delete el.dataset.sbPrevTop;
        el.dataset.sbAdjusted = 'false';
      } catch { /* silencioso */ }
    });
  }

  // Recalcula em eventos relevantes, com throttle
  const reevaluate = throttle(() => {
    revertHeaderAdjustments();
    safeAdjustOnlyHeaders();
  }, 200);

  function setupDomMonitoring() {
    const mo = new MutationObserver(throttle(() => {
      if (!document.getElementById(CONTAINER_ID)) { isInitialized = false; createTitleBar(); }
      if (!document.getElementById('secure-browser-layout-reservation')) applyLayoutReservation();
      // Reavaliar sobreposição após mutações grandes
      reevaluate();
    }, 250));

    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Reage a resize/scroll (com throttle)
    window.addEventListener('resize', reevaluate, { passive: true });
    window.addEventListener('scroll', throttle(() => {
      if (window.scrollY < 200) reevaluate();
    }, 200), { passive: true });

    // ResizeObserver para headers dinâmicos
    try {
      const ro = new ResizeObserver(reevaluate);
      ro.observe(document.body);
    } catch { /* não obrigatório */ }
  }

  // ---------------------
  // Eventos da barra / IPC
  // ---------------------
  function setupEvents() {
    if (!shadowRoot) return;
    const barEl = shadowRoot.querySelector('.bar');
    barEl.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      e.stopPropagation(); e.preventDefault();
      const action = button.dataset.action;
      switch (action) {
        case 'back': ipcRenderer.send('navigate-back'); break;
        case 'forward': ipcRenderer.send('navigate-forward'); break;
        case 'reload': ipcRenderer.send('navigate-reload'); break;
        case 'downloads': shadowRoot.querySelector('.downloads-menu').classList.toggle('open'); break;
        case 'export': exportSession(); break;
        case 'minimize': ipcRenderer.send('minimize-secure-window'); break;
        case 'maximize': ipcRenderer.send('maximize-secure-window'); break;
        case 'close': ipcRenderer.send('close-secure-window'); break;
      }
    });

    shadowRoot.addEventListener('click', (e) => {
      if (!e.target.closest('.downloads-menu') && !e.target.closest('[data-action="downloads"]')) {
        shadowRoot.querySelector('.downloads-menu').classList.remove('open');
      }
    });

    const updateStatus = () => {
      if (!shadowRoot) return;
      const s = shadowRoot.querySelector('.status');
      if (s) s.style.background = navigator.onLine ? '#2ecc71' : '#e74c3c';
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
  }

  async function exportSession() {
    const getStorage = (s) => {
      const o = {};
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k) o[k] = s.getItem(k);
      }
      return o;
    };
    ipcRenderer.send('initiate-full-session-export', {
      localStorageData: getStorage(window.localStorage),
      sessionStorageData: getStorage(window.sessionStorage),
      indexedDBData: await exportIndexedDB()
    });
  }

  function setupIpcListeners() {
    ipcRenderer.on('url-updated', (_event, url) => {
      const urlInput = shadowRoot?.querySelector('.url');
      if (urlInput) urlInput.value = url;
    });

    ipcRenderer.on('download-started', (_event, { id, filename }) => {
      downloads.set(id, { filename, progress: 0, state: 'active' });
      updateDownloadsUI();
      showNotification(`Download iniciado: ${filename}`);
    });

    ipcRenderer.on('download-progress', (_event, { id, progress }) => {
      const dl = downloads.get(id);
      if (dl?.state === 'active') {
        dl.progress = progress;
        updateDownloadsUI();
      }
    });

    ipcRenderer.on('download-complete', (_event, { id, state, path }) => {
      const dl = downloads.get(id);
      if (dl) {
        dl.state = state;
        dl.path = path;
        dl.progress = (state === 'completed') ? 100 : dl.progress;
        updateDownloadsUI();
      }
    });
  }

  function updateDownloadsUI() {
    const menu = shadowRoot?.querySelector('.downloads-menu');
    if (!menu) return;
    menu.innerHTML = '';
    downloads.forEach((dl) => {
      const item = document.createElement('div');
      item.className = 'dl-item';
      let status = `${Math.max(0, Math.min(100, Math.round(dl.progress || 0)))}%`;
      if (dl.state === 'completed') status = 'Concluído';
      else if (dl.state === 'cancelled') status = 'Cancelado';
      else if (dl.state === 'interrupted') status = 'Falha';

      item.innerHTML = `
        <div class="dl-info">
          <span class="dl-name" title="${dl.filename}">${dl.filename}</span>
          <span>${status}</span>
        </div>
        <div class="dl-progress">
          <div class="dl-bar ${dl.state === 'completed' ? 'done' : ''}" style="width: ${Math.max(0, Math.min(100, dl.progress || 0))}%"></div>
        </div>
      `;

      if (dl.state === 'completed' && dl.path) {
        const actions = document.createElement('div');
        actions.className = 'dl-actions';
        actions.innerHTML = `
          <a class="dl-action" data-path="${dl.path}" data-action="open">Abrir</a>
          <a class="dl-action" data-path="${dl.path}" data-action="show">Mostrar na pasta</a>
        `;
        actions.addEventListener('click', (e) => {
          const target = e.target.closest('.dl-action');
          if (!target) return;
          ipcRenderer.send(target.dataset.action === 'open' ? 'open-download' : 'show-download-in-folder', target.dataset.path);
        });
        item.appendChild(actions);
      }

      menu.appendChild(item);
    });
  }

  // Inicialização
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    createTitleBar();
  } else {
    document.addEventListener('DOMContentLoaded', createTitleBar, { once: true });
  }
})();
