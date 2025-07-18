// preload-secure.js – V8.14 – V8.10 + Exceção para Canva

// Camuflagem Anti-Detecção de Bots
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

console.log('%c[PRELOAD SCRIPT V8.18] V8.10 + Exceções: Canva, Leonardo, Placeit, HailuoAI & Vectorizer!', 'color: #00FF00; font-size: 16px;');

// ===== BARRA OTIMIZADA COM PROTEÇÃO ANTI-TOOLTIP =====

(() => {
    const TITLE_BAR_HEIGHT = 40;
    const CONTAINER_ID = 'secure-browser-titlebar-2025';
    let isInitialized = false;
    const downloads = new Map();
    let container = null;
    let shadowRoot = null;

    function createTitleBar() {
        if (isInitialized || document.getElementById(CONTAINER_ID)) return;
        isInitialized = true;

        try {
            container = document.createElement('div');
            container.id = CONTAINER_ID;
            container.setAttribute('data-secure-browser', 'true');
            
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: ${TITLE_BAR_HEIGHT}px;
                z-index: 2147483647;
                pointer-events: none;
                isolation: isolate;
                display: block !important;
                visibility: visible !important;
            `;

            shadowRoot = container.attachShadow({ mode: 'closed' });

            const style = document.createElement('style');
            style.textContent = `
                :host { 
                    all: initial; 
                    display: block !important; 
                    position: fixed !important; 
                    top: 0 !important; 
                    left: 0 !important; 
                    width: 100% !important; 
                    height: ${TITLE_BAR_HEIGHT}px !important; 
                }
                
                .bar { 
                    width: 100%; 
                    height: 100%; 
                    background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%); 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    padding: 0 10px; 
                    box-sizing: border-box; 
                    border-bottom: 1px solid #1a252f; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2); 
                    -webkit-app-region: drag; 
                    pointer-events: auto; 
                    font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                    color: #ecf0f1; 
                    user-select: none; 
                }
                
                .bar * { 
                    -webkit-app-region: no-drag; 
                    pointer-events: auto; 
                }
                
                .group { 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                }
                
                .url-box { 
                    flex: 1; 
                    display: flex; 
                    align-items: center; 
                    gap: 10px; 
                    padding: 0 20px; 
                }
                
                .status { 
                    width: 8px; 
                    height: 8px; 
                    border-radius: 50%; 
                    background: ${navigator.onLine ? '#2ecc71' : '#e74c3c'}; 
                }
                
                .url { 
                    flex: 1; 
                    height: 26px; 
                    background: rgba(0,0,0,0.2); 
                    border: 1px solid #2c3e50; 
                    border-radius: 13px; 
                    color: #ecf0f1; 
                    padding: 0 12px; 
                    font-size: 12px; 
                    text-align: center; 
                    outline: none; 
                }
                
                button { 
                    width: 30px; 
                    height: 30px; 
                    background: transparent; 
                    color: #ecf0f1; 
                    border: none; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 18px; 
                    transition: background 0.2s; 
                    padding: 0; 
                    margin: 0; 
                    outline: none;
                    
                    /* PROTEÇÃO ANTI-TOOLTIP */
                    position: relative;
                    overflow: hidden;
                }
                
                /* Efeito hover protegido */
                button:hover { 
                    background: rgba(255,255,255,0.1); 
                }
                
                button.close:hover { 
                    background: #e74c3c; 
                }
                
                .nav { 
                    font-size: 22px; 
                }
                
                /* Proteção adicional contra tooltips do site */
                button::before {
                    content: '';
                    position: absolute;
                    top: -5px;
                    left: -5px;
                    right: -5px;
                    bottom: -5px;
                    z-index: 10;
                    pointer-events: none;
                }
                
                .downloads-menu { 
                    display: none; 
                    position: absolute; 
                    top: 100%; 
                    right: 10px; 
                    width: 330px; 
                    max-height: 450px; 
                    background: #34495e; 
                    border: 1px solid #2c3e50; 
                    border-radius: 0 0 8px 8px; 
                    box-shadow: 0 8px 20px rgba(0,0,0,0.35); 
                    overflow-y: auto; 
                    color: #ecf0f1; 
                    font-size: 13px; 
                    padding: 8px; 
                    box-sizing: border-box; 
                }
                
                .downloads-menu.open { 
                    display: block; 
                }
                
                .downloads-menu:empty::before { 
                    content: 'Nenhum download iniciado'; 
                    display: block; 
                    text-align: center; 
                    padding: 20px; 
                    color: #bdc3c7; 
                }
                
                .dl-item { 
                    padding: 10px; 
                    border-bottom: 1px solid #2c3e50; 
                }
                
                .dl-item:last-child { 
                    border-bottom: none; 
                }
                
                .dl-info { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 6px; 
                }
                
                .dl-name { 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                    white-space: nowrap; 
                    max-width: 220px; 
                }
                
                .dl-progress { 
                    height: 5px; 
                    background: rgba(0,0,0,0.3); 
                    border-radius: 3px; 
                    overflow: hidden; 
                }
                
                .dl-bar { 
                    height: 100%; 
                    background: #3498db; 
                    transition: width 0.3s; 
                }
                
                .dl-bar.done { 
                    background: #2ecc71; 
                }
                
                .dl-actions { 
                    margin-top: 8px; 
                    display: flex; 
                    gap: 15px; 
                    font-size: 12px; 
                }
                
                .dl-action { 
                    color: #3498db; 
                    cursor: pointer; 
                    text-decoration: none; 
                }
                
                .dl-action:hover { 
                    color: #5dade2; 
                    text-decoration: underline; 
                }
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

            if (document.body) document.body.appendChild(container);
            else document.documentElement.appendChild(container);

            applyLayoutAdjustment();
            setupAntiTooltipProtection(); // FUNÇÃO DE PROTEÇÃO COM EXCEÇÃO CANVA
            setupEvents();
            setupIpcListeners();
            ipcRenderer.send('request-initial-url');
            setupDomMonitoring();

            console.log('[SECURE BROWSER] Barra inicializada - V8.18 (V8.10 + Exceções: Canva, Leonardo, Placeit, HailuoAI & Vectorizer)');

        } catch (error) {
            console.error('[SECURE BROWSER] Erro ao criar barra:', error);
        }
    }

    // ========== PROTEÇÃO ANTI-TOOLTIP COM EXCEÇÕES PARA SITES ESPECÍFICOS ==========
    function setupAntiTooltipProtection() {
        // *** VERIFICA SE É UM DOS SITES COM EXCEÇÃO ***
        const isCanva = window.location.hostname.includes('canva.com');
        const isLeonardo = window.location.hostname.includes('leonardo.ai');
        const isPlaceit = window.location.hostname.includes('placeit.net');
        const isHailuo = window.location.hostname.includes('hailuoai.video');
        const isVectorizer = window.location.hostname.includes('vectorizer.ai');
        
        if (isCanva || isLeonardo || isPlaceit || isHailuo || isVectorizer) {
            let siteName = '';
            if (isCanva) siteName = 'Canva';
            else if (isLeonardo) siteName = 'Leonardo.ai';
            else if (isPlaceit) siteName = 'Placeit.net';
            else if (isHailuo) siteName = 'HailuoAI Video';
            else if (isVectorizer) siteName = 'Vectorizer.ai';
            
            console.log(`[SECURE BROWSER] ${siteName} detectado - Tooltips liberados`);
            
            // Nos sites com exceção, só remove atributos dos nossos botões, SEM bloquear tooltips do site
            const observer = new MutationObserver(() => {
                if (shadowRoot) {
                    const buttons = shadowRoot.querySelectorAll('button');
                    buttons.forEach(btn => {
                        btn.removeAttribute('title');
                        btn.removeAttribute('aria-label');
                        btn.removeAttribute('data-tooltip');
                        btn.removeAttribute('data-title');
                    });
                }
            });
            
            if (shadowRoot) {
                observer.observe(shadowRoot, { childList: true, subtree: true, attributes: true });
            }
            return; // SAI SEM APLICAR BLOQUEIOS NOS SITES COM EXCEÇÃO
        }
        
        // *** RESTO IGUAL À V8.10 PARA TODOS OS OUTROS SITES ***
        
        // Bloqueia tooltips e popups que podem aparecer sobre a barra
        const antiTooltipStyle = document.createElement('style');
        antiTooltipStyle.id = 'secure-browser-anti-tooltip';
        antiTooltipStyle.textContent = `
            /* Bloqueia qualquer tooltip ou popup que possa aparecer na área da barra */
            body > *:not(#${CONTAINER_ID}) {
                /* Impede que elementos do site apareçam sobre nossa barra */
                z-index: 2147483646 !important;
            }
            
            /* Bloqueia tooltips comuns */
            [role="tooltip"],
            .tooltip,
            .tooltiptext,
            .ui-tooltip,
            [data-tooltip],
            [title]:hover::after,
            [title]:hover::before {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Proteção específica para a área da nossa barra */
            body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: ${TITLE_BAR_HEIGHT}px;
                z-index: 2147483646;
                pointer-events: none;
                background: transparent;
            }
        `;
        
        (document.head || document.documentElement).appendChild(antiTooltipStyle);
        
        // Remove atributos que podem gerar tooltips nos nossos botões
        const observer = new MutationObserver(() => {
            if (shadowRoot) {
                const buttons = shadowRoot.querySelectorAll('button');
                buttons.forEach(btn => {
                    // Remove qualquer atributo que possa gerar tooltip
                    btn.removeAttribute('title');
                    btn.removeAttribute('aria-label');
                    btn.removeAttribute('data-tooltip');
                    btn.removeAttribute('data-title');
                });
            }
        });
        
        if (shadowRoot) {
            observer.observe(shadowRoot, { childList: true, subtree: true, attributes: true });
        }
        
        // Intercepta eventos de mouseover na nossa barra para prevenir tooltips
        if (container) {
            container.addEventListener('mouseover', (e) => {
                e.stopPropagation();
                e.preventDefault();
            }, true);
            
            container.addEventListener('mouseenter', (e) => {
                // Remove qualquer tooltip visível quando o mouse entra na nossa barra
                const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, .ui-tooltip');
                tooltips.forEach(tooltip => {
                    tooltip.style.display = 'none';
                    tooltip.style.visibility = 'hidden';
                    tooltip.style.opacity = '0';
                });
            }, true);
        }
    }

    function applyLayoutAdjustment() {
        let styleEl = document.getElementById('secure-browser-layout-adjust');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'secure-browser-layout-adjust';
            (document.head || document.documentElement).appendChild(styleEl);
        }
        
        styleEl.textContent = `
            :root {
                --secure-browser-titlebar-height: ${TITLE_BAR_HEIGHT}px;
            }

            html {
                position: relative !important;
                top: var(--secure-browser-titlebar-height) !important;
                height: calc(100vh - var(--secure-browser-titlebar-height)) !important;
                overflow-y: auto !important;
            }
            
            body {
                min-height: 100% !important;
                height: auto !important;
            }
        `;
    }

    function adjustFixedHeaders() {
        const elements = document.querySelectorAll('body *');
        for (const el of elements) {
            if (el.id === CONTAINER_ID || el.closest(`#${CONTAINER_ID}`) || el.dataset.adjusted === 'true') {
                continue;
            }
            try {
                const style = window.getComputedStyle(el);
                const position = style.getPropertyValue('position');
                const top = style.getPropertyValue('top');
                if ((position === 'fixed' || position === 'sticky') && top === '0px') {
                    el.style.setProperty('top', `${TITLE_BAR_HEIGHT}px`, 'important');
                    el.dataset.adjusted = 'true';
                }
            } catch (e) { /* Ignora erros */ }
        }
    }

    function setupDomMonitoring() {
        const observer = new MutationObserver(() => {
            if (!document.getElementById(CONTAINER_ID)) {
                console.log('[SECURE BROWSER] Barra removida, recriando...');
                isInitialized = false;
                createTitleBar();
            }
            if (!document.getElementById('secure-browser-layout-adjust')) {
                applyLayoutAdjustment();
            }
            if (!document.getElementById('secure-browser-anti-tooltip')) {
                setupAntiTooltipProtection();
            }
            adjustFixedHeaders();
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(() => {
                    if (!document.getElementById(CONTAINER_ID)) {
                        isInitialized = false;
                        createTitleBar();
                    }
                }, 100);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    function setupEvents() {
        if (!shadowRoot) return;
        const bar = shadowRoot.querySelector('.bar');
        const urlInput = shadowRoot.querySelector('.url');
        const downloadsMenu = shadowRoot.querySelector('.downloads-menu');

        bar.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const action = button.dataset.action;
            if (!action) return;
            
            // Para qualquer propagação que possa interferir
            e.stopPropagation();
            e.preventDefault();
            
            switch (action) {
                case 'back': ipcRenderer.send('navigate-back'); break;
                case 'forward': ipcRenderer.send('navigate-forward'); break;
                case 'reload': ipcRenderer.send('navigate-reload'); break;
                case 'downloads': downloadsMenu.classList.toggle('open'); break;
                case 'export': exportSession(); break;
                case 'minimize': ipcRenderer.send('minimize-secure-window'); break;
                case 'maximize': ipcRenderer.send('maximize-secure-window'); break;
                case 'close': ipcRenderer.send('close-secure-window'); break;
            }
        });

        // Proteção contra eventos que podem gerar tooltips
        bar.addEventListener('mouseover', (e) => {
            if (e.target.tagName === 'BUTTON') {
                e.stopPropagation();
                e.preventDefault();
                
                // Remove qualquer tooltip que possa estar visível
                const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, .ui-tooltip');
                tooltips.forEach(tooltip => {
                    tooltip.style.display = 'none';
                });
            }
        });

        shadowRoot.addEventListener('click', (e) => {
            if (!e.target.closest('.downloads-menu') && !e.target.closest('[data-action="downloads"]')) {
                downloadsMenu.classList.remove('open');
            }
        });

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                let url = e.target.value.trim();
                if (url && !url.startsWith('http')) url = 'https://' + url;
                if (url) ipcRenderer.send('navigate-to-url', url);
            }
        });

        const updateStatus = () => {
            const status = shadowRoot.querySelector('.status');
            if (status) status.style.background = navigator.onLine ? '#2ecc71' : '#e74c3c';
        };
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
    }

    async function exportSession() {
        const getStorageAsObject = (storage) => {
            const obj = {};
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key) obj[key] = storage.getItem(key);
            }
            return obj;
        };
        const localStorageData = getStorageAsObject(window.localStorage);
        const sessionStorageData = getStorageAsObject(window.sessionStorage);
        const indexedDBData = await exportIndexedDB();
        ipcRenderer.send('initiate-full-session-export', { localStorageData, sessionStorageData, indexedDBData });
    }

    function setupIpcListeners() {
        ipcRenderer.on('url-updated', (event, url) => {
            if (shadowRoot) {
                const urlInput = shadowRoot.querySelector('.url');
                if (urlInput) urlInput.value = url;
            }
        });
        ipcRenderer.on('download-started', (event, { id, filename }) => {
            downloads.set(id, { filename, progress: 0, state: 'active' });
            updateDownloadsUI();
            showNotification(`Download iniciado: ${filename}`);
        });
        ipcRenderer.on('download-progress', (event, { id, progress }) => {
            const download = downloads.get(id);
            if (download?.state === 'active') {
                download.progress = progress;
                updateDownloadsUI();
            }
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

    function updateDownloadsUI() {
        if (!shadowRoot) return;
        const menu = shadowRoot.querySelector('.downloads-menu');
        if (!menu) return;
        menu.innerHTML = '';
        downloads.forEach((dl) => {
            const item = document.createElement('div');
            item.className = 'dl-item';
            let status = `${dl.progress}%`;
            if (dl.state === 'completed') status = 'Concluído';
            else if (dl.state === 'cancelled') status = 'Cancelado';
            else if (dl.state === 'interrupted') status = 'Falha';
            const barClass = dl.state === 'completed' ? 'done' : '';
            item.innerHTML = `<div class="dl-info"><span class="dl-name" title="${dl.filename}">${dl.filename}</span><span>${status}</span></div><div class="dl-progress"><div class="dl-bar ${barClass}" style="width: ${dl.progress}%"></div></div>`;
            if (dl.state === 'completed' && dl.path) {
                const actions = document.createElement('div');
                actions.className = 'dl-actions';
                actions.innerHTML = `<a class="dl-action" data-path="${dl.path}" data-action="open">Abrir</a><a class="dl-action" data-path="${dl.path}" data-action="show">Mostrar na pasta</a>`;
                actions.addEventListener('click', (e) => {
                    const target = e.target;
                    if (target.classList.contains('dl-action')) {
                        const path = target.dataset.path;
                        const action = target.dataset.action;
                        if (action === 'open') ipcRenderer.send('open-download', path);
                        else if (action === 'show') ipcRenderer.send('show-download-in-folder', path);
                    }
                });
                item.appendChild(actions);
            }
            menu.appendChild(item);
        });
    }

    function showNotification(text) {
        const notif = document.createElement('div');
        notif.style.cssText = `position: fixed; bottom: 20px; right: -400px; background: #2c3e50; color: #ecf0f1; padding: 12px 20px; border-radius: 6px; border-left: 4px solid #3498db; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 2147483646; font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; transition: right 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);`;
        notif.textContent = text;
        document.body.appendChild(notif);
        requestAnimationFrame(() => { notif.style.right = '20px'; });
        setTimeout(() => { notif.style.right = '-400px'; setTimeout(() => notif.remove(), 500); }, 4000);
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        createTitleBar();
    } else {
        document.addEventListener('DOMContentLoaded', createTitleBar, { once: true });
    }

    setInterval(() => {
        if (!document.getElementById(CONTAINER_ID)) {
            isInitialized = false;
            createTitleBar();
        }
    }, 1000);
})();