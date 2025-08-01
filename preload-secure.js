	// preload-secure.js

// ===================================
// Camuflagem Anti-Detecção de Bots
// ===================================
Object.defineProperty(navigator, 'webdriver', { get: () => false });
Object.defineProperty(navigator, 'plugins', {
    get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ],
});
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

// ===================================
// Lógica de Sessão e IndexedDB
// ===================================
const { ipcRenderer } = require('electron');

ipcRenderer.on('inject-session-data', (event, sessionData) => {
    (async () => {
        try {
            if (sessionData && typeof sessionData === 'object') {
                console.log('[PRELOAD] Recebendo dados da sessão para injeção...');
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
        const databases = await window.indexedDB.databases();
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
                const storeNames = Array.from(db.objectStoreNames);
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
            const dbStoresToImport = Object.keys(dataToImport[dbName]);
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
                    const existingStores = Array.from(dbInstance.objectStoreNames);
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
                    const records = dataToImport[dbName][storeName];
                    records.forEach(record => store.put(record));
                }
            });
            db.close();
        } catch (error) {
            console.error(`[INDEXEDDB IMPORT] Falha crítica na importação de "${dbName}":`, error);
        }
    }
}

console.log('%c[PRELOAD SCRIPT VFINAL] Todas as correções aplicadas!', 'color: #00FF00; font-size: 16px;');

// =================================================================
// ===== BARRA DE TÍTULO OTIMIZADA (VERSÃO FINAL E ROBUSTA) =====
// =================================================================

(() => {
    // --- Variáveis de controle ---
    const TITLE_BAR_HEIGHT = 40;
    const CONTAINER_ID = 'secure-browser-titlebar-2025';
    let isInitialized = false;
    const downloads = new Map();
    let container = null;
    let shadowRoot = null;
    let currentUrl = ''; // ARQUITETURA: Variável para guardar a URL mais recente

    // --- Funções principais ---

    // ARQUITETURA: Função dedicada para atualizar a exibição da URL na barra
    function updateUrlDisplay() {
        if (shadowRoot) {
            const urlInput = shadowRoot.querySelector('.url');
            if (urlInput) {
                urlInput.value = currentUrl;
            }
        }
    }

    function createTitleBar() {
        if (isInitialized || document.getElementById(CONTAINER_ID)) return;
        isInitialized = true;

        try {
            container = document.createElement('div');
            container.id = CONTAINER_ID;
            container.setAttribute('data-secure-browser', 'true');
            container.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: ${TITLE_BAR_HEIGHT}px;
                z-index: 2147483647; pointer-events: none; isolation: isolate;
                display: block !important; visibility: visible !important;
            `;

            shadowRoot = container.attachShadow({ mode: 'closed' });

            const style = document.createElement('style');
            style.textContent = `
                :host { all: initial; display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: ${TITLE_BAR_HEIGHT}px !important; }
                .bar { width: 100%; height: 100%; background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%); display: flex; align-items: center; justify-content: space-between; padding: 0 10px; box-sizing: border-box; border-bottom: 1px solid #1a252f; box-shadow: 0 2px 5px rgba(0,0,0,0.2); -webkit-app-region: drag; pointer-events: auto; font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #ecf0f1; user-select: none; }
                .bar * { -webkit-app-region: no-drag; pointer-events: auto; }
                .group { display: flex; align-items: center; gap: 8px; }
                .url-box { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 20px; }
                .status { width: 8px; height: 8px; border-radius: 50%; background: ${navigator.onLine ? '#2ecc71' : '#e74c3c'}; }
                .url { flex: 1; height: 26px; background: rgba(0,0,0,0.2); border: 1px solid #2c3e50; border-radius: 13px; color: #ecf0f1; padding: 0 12px; font-size: 12px; text-align: center; outline: none; }
                button { width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s; padding: 0; margin: 0; outline: none; position: relative; overflow: hidden; }
                button:hover { background: rgba(255,255,255,0.1); }
                button.close:hover { background: #e74c3c; }
                .nav { font-size: 22px; }
                .downloads-menu { display: none; position: absolute; top: 100%; right: 10px; width: 330px; max-height: 450px; background: #34495e; border: 1px solid #2c3e50; border-radius: 0 0 8px 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.35); overflow-y: auto; color: #ecf0f1; font-size: 13px; padding: 8px; box-sizing: border-box; }
                .downloads-menu.open { display: block; }
                .downloads-menu:empty::before { content: 'Nenhum download iniciado'; display: block; text-align: center; padding: 20px; color: #bdc3c7; }
                .dl-item { padding: 10px; border-bottom: 1px solid #2c3e50; } .dl-item:last-child { border-bottom: none; }
                .dl-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
                .dl-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
                .dl-progress { height: 5px; background: rgba(0,0,0,0.3); border-radius: 3px; overflow: hidden; }
                .dl-bar { height: 100%; background: #3498db; transition: width 0.3s; }
                .dl-bar.done { background: #2ecc71; }
                .dl-actions { margin-top: 8px; display: flex; gap: 15px; font-size: 12px; }
                .dl-action { color: #3498db; cursor: pointer; text-decoration: none; }
                .dl-action:hover { color: #5dade2; text-decoration: underline; }
                .notification-popup { position: fixed; bottom: 20px; right: -400px; background-color: #2c3e50; color: #ecf0f1; padding: 12px 20px; border-radius: 6px; border-left: 4px solid #3498db; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 2147483647; font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; transition: right 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55); pointer-events: none; }
                .notification-popup.visible { right: 20px; }
            `;
            shadowRoot.appendChild(style);

            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.innerHTML = `
                <div class="group"><button class="nav" data-action="back">←</button><button class="nav" data-action="forward">→</button><button data-action="reload">↻</button></div>
                <div class="url-box"><div class="status"></div><input type="text" class="url" readonly></div>
                <div class="group"><button data-action="downloads">📥</button><button data-action="minimize">−</button><button data-action="maximize">☐</button><button class="close" data-action="close">×</button></div>
                <div class="downloads-menu"></div>
            `;
            shadowRoot.appendChild(bar);

            // FIX: Anexar ao documentElement para evitar que frameworks (React, etc.) limpem a barra
            document.documentElement.appendChild(container);

            updateUrlDisplay(); // ARQUITETURA: Garante que a URL seja exibida assim que a barra for criada
            
            applyLayoutAdjustment();
            setupAntiTooltipProtection();
            setupEvents();
            setupDomMonitoring();

        } catch (error) {
            console.error('[SECURE BROWSER] Erro ao criar barra:', error);
        }
    }

    function setupIpcListeners() {
        ipcRenderer.on('url-updated', (event, url) => {
            // ARQUITETURA: Apenas guarda a URL e chama a função de atualização
            currentUrl = url;
            updateUrlDisplay();
        });

        ipcRenderer.on('download-started', (event, { id, filename }) => {
            downloads.set(id, { filename, progress: 0, state: 'active' });
            updateDownloadsUI();
            showNotification(`Download iniciado: ${filename}`);
        });
        ipcRenderer.on('download-progress', (event, { id, progress }) => {
            const download = downloads.get(id);
            if (download?.state === 'active') { download.progress = progress; updateDownloadsUI(); }
        });
        ipcRenderer.on('download-complete', (event, { id, state, path }) => {
            const download = downloads.get(id);
            if (download) {
                download.state = state;
                download.path = path;
                download.progress = (state === 'completed') ? 100 : download.progress;
                updateDownloadsUI();
            }
        });
    }

    // --- Funções Auxiliares (sem grandes alterações) ---

    function showNotification(text) {
        if (!shadowRoot) return;
        const notif = document.createElement('div');
        notif.className = 'notification-popup';
        notif.textContent = text;
        shadowRoot.appendChild(notif);
        requestAnimationFrame(() => notif.classList.add('visible'));
        setTimeout(() => {
            notif.classList.remove('visible');
            setTimeout(() => {
                if (notif.parentNode === shadowRoot) {
                   shadowRoot.removeChild(notif);
                }
            }, 500);
        }, 4000);
    }

    // ✅ NOVA VERSÃO FINAL (USAR ESTA)
	function applyLayoutAdjustment() {
    let styleEl = document.getElementById('secure-browser-layout-adjust');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'secure-browser-layout-adjust';
        (document.head || document.documentElement).appendChild(styleEl);
    }
    
    // Esta é a correção final de layout que resolve a barra de rolagem.
    styleEl.textContent = `
        :root {
            --secure-browser-titlebar-height: ${TITLE_BAR_HEIGHT}px;
        }

        html {
            /* Impede a barra de rolagem no elemento raiz para que a nossa barra não a cubra. */
            overflow: hidden !important;
        }

        body {
            /* Transforma o body no container de rolagem principal. */
            overflow-y: auto !important;
            height: 100vh !important;

            /* Mantém nosso ajuste para a barra de título. */
            padding-top: var(--secure-browser-titlebar-height) !important;

            /* Essencial para que o padding não aumente a altura total de 100vh. */
            box-sizing: border-box !important;
        }
    `;
	}

    function adjustFixedHeaders() {
        const elements = document.querySelectorAll('body *');
        for (const el of elements) {
            if (el.id === CONTAINER_ID || el.closest(`#${CONTAINER_ID}`) || el.dataset.adjusted === 'true') continue;
            try {
                const style = window.getComputedStyle(el);
                if ((style.position === 'fixed' || style.position === 'sticky') && style.top === '0px') {
                    el.style.setProperty('top', `${TITLE_BAR_HEIGHT}px`, 'important');
                    el.dataset.adjusted = 'true';
                }
            } catch (e) { /* Ignora */ }
        }
    }

    function setupDomMonitoring() {
        const observer = new MutationObserver(() => {
            if (!document.getElementById(CONTAINER_ID)) { isInitialized = false; initialize(); }
            if (!document.getElementById('secure-browser-layout-adjust')) applyLayoutAdjustment();
            adjustFixedHeaders();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    
    function setupEvents() {
        if (!shadowRoot) return;
        shadowRoot.querySelector('.bar').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            e.stopPropagation(); e.preventDefault();
            const action = button.dataset.action;
            switch (action) {
                case 'back': ipcRenderer.send('navigate-back'); break;
                case 'forward': ipcRenderer.send('navigate-forward'); break;
                case 'reload': ipcRenderer.send('navigate-reload'); break;
                case 'downloads': shadowRoot.querySelector('.downloads-menu').classList.toggle('open'); break;
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
        const updateStatus = () => { if(shadowRoot) { const s = shadowRoot.querySelector('.status'); if(s) s.style.background = navigator.onLine ? '#2ecc71' : '#e74c3c'; } };
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
    }
    
    function updateDownloadsUI() {
        if (!shadowRoot) return;
        const menu = shadowRoot.querySelector('.downloads-menu');
        if (!menu) return;
        menu.innerHTML = '';
        downloads.forEach((dl) => {
            const item = document.createElement('div');
            item.className = 'dl-item';
            let status = `${dl.progress}%`;
            if (dl.state === 'completed') status = 'Concluído'; else if (dl.state === 'cancelled') status = 'Cancelado'; else if (dl.state === 'interrupted') status = 'Falha';
            item.innerHTML = `<div class="dl-info"><span class="dl-name" title="${dl.filename}">${dl.filename}</span><span>${status}</span></div><div class="dl-progress"><div class="dl-bar ${dl.state === 'completed' ? 'done' : ''}" style="width: ${dl.progress}%"></div></div>`;
            if (dl.state === 'completed' && dl.path) {
                const actions = document.createElement('div');
                actions.className = 'dl-actions';
                actions.innerHTML = `<a class="dl-action" data-path="${dl.path}" data-action="open">Abrir</a><a class="dl-action" data-path="${dl.path}" data-action="show">Mostrar na pasta</a>`;
                actions.addEventListener('click', (e) => {
                    const target = e.target.closest('.dl-action');
                    if(target) ipcRenderer.send(target.dataset.action === 'open' ? 'open-download' : 'show-download-in-folder', target.dataset.path);
                });
                item.appendChild(actions);
            }
            menu.appendChild(item);
        });
    }

    function setupAntiTooltipProtection() {
        const isEnvatoElements = window.location.hostname.includes('envato.com');
        if (isEnvatoElements) {
            console.log(`[SECURE BROWSER] Envato detectado - Proteção invasiva de tooltip desativada.`);
            return;
        }
        if(document.getElementById('secure-browser-anti-tooltip')) return;
        const antiTooltipStyle = document.createElement('style');
        antiTooltipStyle.id = 'secure-browser-anti-tooltip';
        antiTooltipStyle.textContent = `[role="tooltip"], .tooltip, .ui-tooltip, [data-tooltip] { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }`;
        (document.head || document.documentElement).appendChild(antiTooltipStyle);
    }
    
    // --- Lógica de Inicialização ---

    function initialize() {
        // FIX: Usa requestAnimationFrame para evitar "pisca-pisca"
        requestAnimationFrame(() => {
            if (isInitialized || document.getElementById(CONTAINER_ID)) return;
            createTitleBar();
            applyLayoutAdjustment();
        });
    }

    // ARQUITETURA: Configura listeners imediatamente
    setupIpcListeners();
    ipcRenderer.send('request-initial-url');

    // ARQUITETURA: Tenta inicializar em múltiplos estágios para máxima compatibilidade
    initialize();
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
    window.addEventListener('load', initialize, { once: true });

})();