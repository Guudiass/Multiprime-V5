/* eslint-disable no-undef */ 
// preload-secure.js

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

// ===== SISTEMA DE LOGIN AUTOMÁTICO =====
let autoLoginCredentials = null;
let loginAttempted = false;

function fillFieldFast(field, value) {
    if (!field || !value) return false;
    try {
        field.focus();
        field.value = '';
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[AUTO-LOGIN] ✅ Campo preenchido: ${field.id || field.name} = ${value}`);
        return true;
    } catch (error) {
        console.error('[AUTO-LOGIN] ❌ Erro ao preencher campo:', error);
        return false;
    }
}

function performAutoLogin() {
    if (!autoLoginCredentials || loginAttempted) return;
    const { usuariodaferramenta, senhadaferramenta } = autoLoginCredentials;
    console.log('[AUTO-LOGIN] 🚀 Iniciando login automático...');

    const emailField = document.querySelector('input[id="amember-login"]') ||
        document.querySelector('input[name="amember_login"]') ||
        document.querySelector('input[type="email"]') ||
        document.querySelector('input[placeholder*="Username" i]');

    const passwordField = document.querySelector('input[id="amember-pass"]') ||
        document.querySelector('input[name="amember_pass"]') ||
        document.querySelector('input[type="password"]');

    if (emailField && passwordField) {
        const emailFilled = fillFieldFast(emailField, usuariodaferramenta);
        const passwordFilled = fillFieldFast(passwordField, senhadaferramenta);

        if (emailFilled && passwordFilled) {
            loginAttempted = true;
            setTimeout(() => {
                const submitButton = document.querySelector('input[type="submit"]') ||
                    document.querySelector('button[type="submit"]');
                if (submitButton) submitButton.click();
            }, 300);
        }
    }
}

ipcRenderer.on('set-auto-login-credentials', (event, credentials) => {
    autoLoginCredentials = credentials;
    loginAttempted = false;
    setTimeout(() => performAutoLogin(), 1500);
});

window.addEventListener('load', () => setTimeout(performAutoLogin, 2000));
document.addEventListener('DOMContentLoaded', () => setTimeout(performAutoLogin, 1000));

// ===== INJEÇÃO DE SESSÃO =====
ipcRenderer.on('inject-session-data', (event, sessionData) => {
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
            }
        } catch (err) {
            console.error('[PRELOAD] Erro ao injetar dados da sessão:', err);
        }
    })();
});

ipcRenderer.send('request-session-data');

console.log('%c[PRELOAD SCRIPT] Moderno e Funcionando!', 'color: #00FF00; font-size: 16px;');

// ===== BARRA MODERNA OTIMIZADA =====

(() => {
    const TITLE_BAR_HEIGHT = 44; // ALTURA ATUALIZADA
    const CONTAINER_ID = 'multiprime-browser-ui'; // ID ATUALIZADO
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
                    background: rgba(24, 24, 24, 0.92);
                    backdrop-filter: saturate(140%) blur(8px);
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    align-items: center; 
                    gap: 10px; 
                    padding: 6px 10px; 
                    box-sizing: border-box; 
                    border-bottom: 1px solid rgba(255,255,255,0.06); 
                    -webkit-app-region: drag; 
                    pointer-events: auto; 
                    font: 13px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                    color: #ecf0f1; 
                    user-select: none; 
                }
                
                .bar * { -webkit-app-region: no-drag; pointer-events: auto; }
                
                .group { display: flex; align-items: center; gap: 8px; }
                
                .nav { 
                    width: 32px; 
                    height: 32px; 
                    background: rgba(255,255,255,0.04); 
                    color: #fff; 
                    border: 1px solid rgba(255,255,255,0.08); 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-size: 16px; 
                    display: grid; 
                    place-items: center; 
                    transition: background 0.15s, border-color 0.15s; 
                    padding: 0; 
                    margin: 0; 
                }
                .nav:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.16); }
                
                .url-box { 
                    flex: 1; 
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    align-items: center; 
                    gap: 8px; 
                    padding: 0 10px 0 8px;
                    height: 32px;
                    background: rgba(32,32,32,0.95);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 10px;
                }
                
                .url-leading { display: flex; align-items: center; gap: 6px; }
                .favicon { width: 16px; height: 16px; border-radius: 3px; }
                .lock { font-size: 12px; opacity: 0.9; }
                
                .status { width: 8px; height: 8px; border-radius: 50%; background: ${navigator.onLine ? '#00d084' : '#e74c3c'}; }
                
                .url { 
                    flex: 1; 
                    height: 28px; 
                    background: transparent; 
                    border: none; 
                    color: #f2f2f2; 
                    padding: 0; 
                    font-size: 13px; 
                    text-align: left; 
                    outline: none; 
                }
                
                button { 
                    width: 32px; 
                    height: 32px; 
                    background: transparent; 
                    color: #ecf0f1; 
                    border: none; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 16px; 
                    transition: background 0.15s; 
                    padding: 0; 
                    margin: 0; 
                }
                button:hover { background: rgba(255,255,255,0.1); }
                button.close:hover { background: #e74c3c; }
                
                .downloads-btn {
                    height: 28px;
                    padding: 0 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.08);
                    background: rgba(255,255,255,0.05);
                    font-size: 12px;
                    width: auto;
                }
                
                .downloads-menu { 
                    display: none; 
                    position: absolute; 
                    top: 100%; 
                    right: 10px; 
                    width: 330px; 
                    max-height: 450px; 
                    background: rgba(0,0,0,0.96); 
                    border: 1px solid #2a2a2a; 
                    border-radius: 8px; 
                    box-shadow: 0 8px 20px rgba(0,0,0,0.35); 
                    overflow-y: auto; 
                    color: #ecf0f1; 
                    font-size: 13px; 
                    padding: 8px; 
                    box-sizing: border-box; 
                }
                .downloads-menu.open { display: block; }
                .downloads-menu:empty::before { 
                    content: 'Nenhum download iniciado'; 
                    display: block; 
                    text-align: center; 
                    padding: 20px; 
                    color: #bdc3c7; 
                }
                
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
                    position: fixed;
                    bottom: 20px;
                    right: -400px;
                    background: rgba(32,32,32,0.95);
                    color: #ecf0f1;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.08);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
                    z-index: 2147483647;
                    font-size: 12px;
                    transition: right 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                    pointer-events: none;
                }
                .notification-popup.visible { right: 20px; }
            `;
            shadowRoot.appendChild(style);

            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.innerHTML = `
                <div class="group">
                    <button class="nav" data-action="back">←</button>
                    <button class="nav" data-action="forward">→</button>
                    <button class="nav" data-action="reload">↻</button>
                </div>
                <div class="url-box">
                    <div class="url-leading">
                        <img class="favicon" alt="" />
                        <span class="lock">🔒</span>
                    </div>
                    <input type="text" class="url" readonly>
                    <div class="status"></div>
                </div>
                <div class="group">
                    <button class="downloads-btn" data-action="downloads">Downloads</button>
                    <button data-action="minimize">−</button>
                    <button data-action="maximize">☐</button>
                    <button class="close" data-action="close">×</button>
                </div>
                <div class="downloads-menu"></div>
            `;
            shadowRoot.appendChild(bar);

            if (document.body) document.body.appendChild(container);
            else document.documentElement.appendChild(container);

            applyLayoutAdjustment();
            setupEvents();
            setupIpcListeners();
            ipcRenderer.send('request-initial-url');
            setupDomMonitoring();

        } catch (error) {
            console.error('[SECURE BROWSER] Erro ao criar barra:', error);
        }
    }

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
                if (notif.parentNode === shadowRoot) shadowRoot.removeChild(notif);
            }, 400);
        }, 3000);
    }

    function applyLayoutAdjustment() {
        let styleEl = document.getElementById('multiprime-layout-adjust');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'multiprime-layout-adjust';
            (document.head || document.documentElement).appendChild(styleEl);
        }

        // Correção específica para sites problemáticos
        const hostname = window.location.hostname;
        const isVectorizer = hostname.includes('vectorizer');
        const isMotionArray = hostname.includes('motionarray');
        const isPlaceit = hostname.includes('placeit');
        const isProblematicSite = isVectorizer || isMotionArray ||
            isPlaceit ||
            hostname.includes('canva');

        console.log(`[TOOLBAR] Aplicando layout para: ${hostname} (isVectorizer: ${isVectorizer})`);

        if (isPlaceit) {
            // Placeit - Empurrar TODO o site para baixo (não só o header)
            styleEl.textContent = `
                :root { --toolbar-offset: ${TITLE_BAR_HEIGHT}px; }
                html { 
                    position: relative !important; 
                    top: ${TITLE_BAR_HEIGHT}px !important; 
                    height: calc(100vh - ${TITLE_BAR_HEIGHT}px) !important; 
                    overflow-y: auto !important; 
                } 
                body { 
                    min-height: 100% !important; 
                    height: auto !important; 
                }
            `;
            console.log('[TOOLBAR] Placeit - TODO o site empurrado para baixo!');
        } else if (isVectorizer) {
            // Vectorizer
            styleEl.textContent = `
                :root { --toolbar-offset: ${TITLE_BAR_HEIGHT}px; }
                html, body { 
                    margin: 0 !important;
                    padding: 0 !important;
                }
                #App-App {
                    top: ${TITLE_BAR_HEIGHT}px !important;
                }
                * {
                    scroll-padding-top: ${TITLE_BAR_HEIGHT}px !important;
                }
            `;
            console.log('[TOOLBAR] CSS minimalista aplicado - sem sobreposições!');
        } else if (isMotionArray) {
            // MotionArray
            styleEl.textContent = `
                :root { --toolbar-offset: ${TITLE_BAR_HEIGHT}px; }
                body { 
                    padding-top: ${TITLE_BAR_HEIGHT}px !important; 
                    min-height: calc(100vh - ${TITLE_BAR_HEIGHT}px) !important;
                    box-sizing: border-box !important;
                    margin: 0 !important;
                }
                [style*="position: fixed"][style*="top: 0"],
                [style*="position:fixed"][style*="top:0"] {
                    top: ${TITLE_BAR_HEIGHT}px !important;
                }
            `;
            console.log('[TOOLBAR] CSS do MotionArray aplicado!');
        } else if (isProblematicSite) {
            // Outros problemáticos
            styleEl.textContent = `
                :root { --toolbar-offset: ${TITLE_BAR_HEIGHT}px; }
                body { 
                    padding-top: ${TITLE_BAR_HEIGHT}px !important; 
                    min-height: calc(100vh - ${TITLE_BAR_HEIGHT}px) !important;
                    box-sizing: border-box !important;
                    margin-top: 0 !important;
                }
                body > *:first-child {
                    margin-top: 0 !important;
                }
                [style*="position: fixed"][style*="top: 0"],
                [style*="position:fixed"][style*="top:0"] {
                    top: ${TITLE_BAR_HEIGHT}px !important;
                }
            `;
        } else {
            // Padrão
            styleEl.textContent = `
                :root { --toolbar-offset: ${TITLE_BAR_HEIGHT}px; } 
                html { 
                    position: relative !important; 
                    top: var(--toolbar-offset) !important; 
                    height: calc(100vh - var(--toolbar-offset)) !important; 
                    overflow-y: auto !important; 
                } 
                body { 
                    min-height: 100% !important; 
                    height: auto !important; 
                }
            `;
        }

        // ===== EXCEÇÃO SORA E RUNWAY: esconder tooltips =====
        if (hostname.includes('sora') || hostname.includes('runway')) {
            const siteLabel = hostname.includes('sora') ? 'SORA' : 'RUNWAY';
            let tooltipsStyle = document.getElementById('tooltips-hide');
            if (!tooltipsStyle) {
                tooltipsStyle = document.createElement('style');
                tooltipsStyle.id = 'tooltips-hide';
                (document.head || document.documentElement).appendChild(tooltipsStyle);
            }

            tooltipsStyle.textContent = `
                /* Esconde tooltips do Radix e similares no Sora/Runway */
                [data-radix-tooltip-content],
                [data-radix-tooltip-content-wrapper],
                [role="tooltip"],
                [data-tooltip],
                [data-balloon],
                .tooltip {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
            `;
            console.log(`🧩 [${siteLabel} PATCH] Tooltips desativados com sucesso`);
        }
    }

    function setupDomMonitoring() {
        const observer = new MutationObserver(() => {
            if (!document.getElementById(CONTAINER_ID)) { isInitialized = false; createTitleBar(); }
            if (!document.getElementById('multiprime-layout-adjust')) applyLayoutAdjustment();
            adjustFixedElements(); // Ajusta elementos fixed/sticky continuamente
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // Ajusta imediatamente e depois periodicamente
        adjustFixedElements();

        const hostname = window.location.hostname;
        const interval = (hostname.includes('vectorizer') || hostname.includes('motionarray')) ? 1000 : 2000;
        setInterval(adjustFixedElements, interval);
    }

    function adjustFixedElements() {
        const hostname = window.location.hostname;
        const isPlaceit = hostname.includes('placeit');
        
        // ===== EXCEÇÃO PLACEIT: NÃO AJUSTAR NADA =====
        if (isPlaceit) {
            console.log('[TOOLBAR] Placeit detectado - NÃO ajustando elementos fixed');
            return; // Sai completamente, não mexe em nada
        }
        
        const isVectorizer = hostname.includes('vectorizer');
        const isSora = hostname.includes('sora');
        const isRunway = hostname.includes('runway');

        if (isVectorizer) {
            // Para Vectorizer, ajustar apenas o container principal
            const appContainer = document.getElementById('App-App');
            if (appContainer) {
                const style = window.getComputedStyle(appContainer);
                if (style.position === 'fixed') {
                    const currentTop = parseFloat(style.top) || 0;
                    if (currentTop < TITLE_BAR_HEIGHT && !appContainer.hasAttribute('data-toolbar-adjusted')) {
                        appContainer.style.setProperty('top', `${TITLE_BAR_HEIGHT}px`, 'important');
                        appContainer.setAttribute('data-toolbar-adjusted', 'true');
                        console.log('[TOOLBAR] ✅ Container principal ajustado para', TITLE_BAR_HEIGHT, 'px');
                    }
                }
            }
            return; // Para Vectorizer, só isso
        }

        const selectors = [
            'header', 'nav', '[role="banner"]', '[role="navigation"]',
            '[class*="header"]', '[class*="Header"]', '[class*="navbar"]',
            '[class*="nav-bar"]', '[class*="topbar"]', '[class*="top-bar"]',
            '[class*="toolbar"]', '[class*="Toolbar"]',
            '[style*="position: fixed"]', '[style*="position:fixed"]',
            '[style*="position: sticky"]', '[style*="position:sticky"]'
        ];

        document.querySelectorAll(selectors.join(',')).forEach(el => {
            if (el.id === CONTAINER_ID || el.closest(`#${CONTAINER_ID}`)) return;
            if (el.hasAttribute('data-adjusted-by-toolbar')) return;

            // ===== EXCEÇÃO SORA E RUNWAY: NÃO mexer nos poppers do Radix =====
            if ((isSora || isRunway) && el.hasAttribute('data-radix-popper-content-wrapper')) return;

            try {
                const style = window.getComputedStyle(el);
                const position = style.position;

                if (position === 'fixed' || position === 'sticky') {
                    const currentTop = parseFloat(style.top) || 0;
                    const threshold = 5;

                    if (currentTop >= -5 && currentTop < threshold) {
                        const newTop = TITLE_BAR_HEIGHT + Math.max(0, currentTop);
                        el.style.setProperty('top', `${newTop}px`, 'important');
                        el.setAttribute('data-adjusted-by-toolbar', 'true');
                        console.log(`[TOOLBAR] Ajustado elemento:`, el.className || el.tagName, `de ${currentTop}px para ${newTop}px`);
                    }
                }
            } catch (e) { }
        });
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

        const updateStatus = () => {
            if (shadowRoot) {
                const s = shadowRoot.querySelector('.status');
                if (s) s.style.background = navigator.onLine ? '#00d084' : '#e74c3c';
            }
        };
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
    }

    function setupIpcListeners() {
        ipcRenderer.on('url-updated', (event, url) => {
            if (shadowRoot) {
                const urlInput = shadowRoot.querySelector('.url');
                if (urlInput) urlInput.value = url;

                // Atualizar favicon e lock
                try {
                    const u = new URL(url);
                    const lock = shadowRoot.querySelector('.lock');
                    const fav = shadowRoot.querySelector('.favicon');

                    if (lock) lock.textContent = u.protocol === 'https:' ? '🔒' : '⚠️';
                    if (fav) {
                        fav.src = `${u.origin}/favicon.ico`;
                        fav.onerror = () => fav.removeAttribute('src');
                    }
                } catch (e) { }
            }

            // Reaplica ajustes de layout quando a URL muda
            setTimeout(() => {
                applyLayoutAdjustment();
                adjustFixedElements();
            }, 500);
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
            if (download) { download.state = state; download.path = path; download.progress = (state === 'completed') ? 100 : download.progress; updateDownloadsUI(); }
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
            item.innerHTML = `<div class="dl-info"><span class="dl-name" title="${dl.filename}">${dl.filename}</span><span>${status}</span></div><div class="dl-progress"><div class="dl-bar ${dl.state === 'completed' ? 'done' : ''}" style="width: ${dl.progress}%"></div></div>`;
            if (dl.state === 'completed' && dl.path) {
                const actions = document.createElement('div');
                actions.className = 'dl-actions';
                actions.innerHTML = `<a class="dl-action" data-path="${dl.path}" data-action="open">Abrir</a><a class="dl-action" data-path="${dl.path}" data-action="show">Mostrar na pasta</a>`;
                actions.addEventListener('click', (e) => {
                    const target = e.target.closest('.dl-action');
                    if (target) ipcRenderer.send(target.dataset.action === 'open' ? 'open-download' : 'show-download-in-folder', target.dataset.path);
                });
                item.appendChild(actions);
            }
            menu.appendChild(item);
        });
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        createTitleBar();
    } else {
        document.addEventListener('DOMContentLoaded', createTitleBar, { once: true });
    }

    // Ajustes adicionais quando tudo carregar
    window.addEventListener('load', () => {
        setTimeout(() => {
            applyLayoutAdjustment();
            adjustFixedElements();
        }, 500);
    });

    // Reajusta em mudanças de tamanho
    window.addEventListener('resize', () => {
        adjustFixedElements();
    });
})();

console.log('%c[SECURE WINDOW] Pronto!', 'color: cyan; font-weight: bold;');