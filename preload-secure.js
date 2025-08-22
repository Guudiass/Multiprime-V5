// preload-secure.js CORRIGIDO (v3 - Ajuste Fino)

console.log('%c[PRELOAD] Iniciando sistema seguro...', 'color: #00FF00; font-size: 16px;');

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

// Função para preencher campos rapidamente
function fillFieldFast(field, value) {
    if (!field || !value) return false;
    
    try {
        field.focus();
        field.value = '';
        field.value = value;
        
        // Dispara eventos necessários
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`[AUTO-LOGIN] ✅ Campo preenchido: ${field.id || field.name} = ${value}`);
        return true;
    } catch (error) {
        console.error('[AUTO-LOGIN] ❌ Erro ao preencher campo:', error);
        return false;
    }
}

// Função principal de login
function performAutoLogin() {
    if (!autoLoginCredentials || loginAttempted) return;
    
    const { usuariodaferramenta, senhadaferramenta } = autoLoginCredentials;
    
    console.log('[AUTO-LOGIN] 🚀 Iniciando login automático...');
    console.log('[AUTO-LOGIN] 📧 Usuário:', usuariodaferramenta);
    console.log('[AUTO-LOGIN] 🌐 URL:', window.location.href);
    
    // Busca campos específicos do noxtools.com
    const emailField = document.querySelector('input[id="amember-login"]') || 
                      document.querySelector('input[name="amember_login"]') ||
                      document.querySelector('input[type="email"]') ||
                      document.querySelector('input[placeholder*="Username" i]');
                      
    const passwordField = document.querySelector('input[id="amember-pass"]') || 
                         document.querySelector('input[name="amember_pass"]') ||
                         document.querySelector('input[type="password"]');
    
    if (emailField && passwordField) {
        console.log('[AUTO-LOGIN] ✅ Campos encontrados!');
        
        // Preenche os campos
        const emailFilled = fillFieldFast(emailField, usuariodaferramenta);
        const passwordFilled = fillFieldFast(passwordField, senhadaferramenta);
        
        if (emailFilled && passwordFilled) {
            loginAttempted = true;
            
            // Procura o botão de submit
            setTimeout(() => {
                const submitButton = document.querySelector('input[type="submit"]') ||
                                   document.querySelector('button[type="submit"]') ||
                                   emailField.closest('form')?.querySelector('input[type="submit"]') ||
                                   emailField.closest('form')?.querySelector('button[type="submit"]');
                
                if (submitButton) {
                    console.log('[AUTO-LOGIN] 🔘 Clicando no botão submit...');
                    submitButton.click();
                    
                    // Também tenta submit no formulário
                    const form = emailField.closest('form');
                    if (form) {
                        setTimeout(() => form.submit(), 100);
                    }
                } else {
                    console.log('[AUTO-LOGIN] 🔘 Tentando Enter no campo senha...');
                    passwordField.focus();
                    passwordField.dispatchEvent(new KeyboardEvent('keydown', { 
                        key: 'Enter', 
                        keyCode: 13, 
                        bubbles: true 
                    }));
                    
                    // Fallback: submit direto do formulário
                    const form = passwordField.closest('form');
                    if (form) {
                        setTimeout(() => form.submit(), 100);
                    }
                }
                
                showNotification('🔐 Login automático executado!');
                
            }, 300);
        }
    } else {
        console.log('[AUTO-LOGIN] ❌ Campos não encontrados');
        
        // Debug: mostra todos os inputs
        const allInputs = document.querySelectorAll('input');
        console.log('[AUTO-LOGIN] 📋 Inputs na página:');
        allInputs.forEach((input, i) => {
            console.log(`  ${i}: type="${input.type}" id="${input.id}" name="${input.name}" placeholder="${input.placeholder}"`);
        });
        
        // Tenta novamente em 2 segundos
        setTimeout(() => {
            loginAttempted = false;
            performAutoLogin();
        }, 2000);
    }
}

// Função para tentar login quando site for detectado
function attemptAutoLogin() {
    if (!autoLoginCredentials) {
        console.log('[AUTO-LOGIN] ⚠️  Nenhuma credencial disponível');
        return;
    }
    
    const hostname = window.location.hostname;
    console.log('[AUTO-LOGIN] 🌐 Verificando site:', hostname);
    
    if (hostname.includes('noxtools.com')) {
        console.log('[AUTO-LOGIN] ✅ Site noxtools.com detectado!');
        
        // Aguarda um pouco para a página carregar
        setTimeout(() => {
            performAutoLogin();
        }, 1500);
    } else {
        console.log('[AUTO-LOGIN] ❌ Não é noxtools.com, ignorando');
    }
}

// Recebe credenciais do processo principal
ipcRenderer.on('set-auto-login-credentials', (event, credentials) => {
    autoLoginCredentials = credentials;
    loginAttempted = false;
    
    console.log('[AUTO-LOGIN] 🔑 Credenciais recebidas!');
    console.log('[AUTO-LOGIN] 👤 Usuário:', credentials.usuariodaferramenta);
    console.log('[AUTO-LOGIN] 🔒 Senha:', credentials.senhadaferramenta ? '***DEFINIDA***' : 'VAZIA');
    
    // Tenta login imediatamente
    attemptAutoLogin();
});

// Monitora navegação
let currentUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        loginAttempted = false;
        console.log('[AUTO-LOGIN] 🔄 URL mudou:', currentUrl);
        setTimeout(attemptAutoLogin, 1000);
    }
}, 1000);

// Tenta login quando página carregar
window.addEventListener('load', () => {
    console.log('[AUTO-LOGIN] 📄 Página carregada');
    setTimeout(attemptAutoLogin, 2000);
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('[AUTO-LOGIN] 📋 DOM carregado');
    setTimeout(attemptAutoLogin, 1000);
});

// ===== SISTEMA DE SESSÕES =====
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

// Funções de IndexedDB
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

// ===== BARRA DE TÍTULO SUPER ROBUSTA =====
(() => {
    const TITLE_BAR_HEIGHT = 40;
    const CONTAINER_ID = 'secure-browser-titlebar-ultimate';
    let titleBarContainer = null;
    let isCreated = false;
    const downloads = new Map();

    // Função para mostrar notificação
    function showNotification(text) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed !important;
            top: 50px !important;
            right: 20px !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
            z-index: 2147483647 !important;
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
            transform: translateX(400px) !important;
            border: none !important;
            backdrop-filter: blur(10px) !important;
        `;
        notif.textContent = text;
        
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.transform = 'translateX(0) !important';
        }, 100);
        
        setTimeout(() => {
            notif.style.transform = 'translateX(400px) !important';
            setTimeout(() => {
                if (notif.parentNode) notif.parentNode.removeChild(notif);
            }, 400);
        }, 4000);
    }

    // Cria a barra de título
    function createTitleBar() {
        if (isCreated) return;
        
        console.log('[TITLE BAR] 🔨 Criando barra super robusta...');
        
        try {
            const existing = document.getElementById(CONTAINER_ID);
            if (existing) existing.remove();
            
            titleBarContainer = document.createElement('div');
            titleBarContainer.id = CONTAINER_ID;
            titleBarContainer.setAttribute('data-secure-bar', 'true');
            
            titleBarContainer.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: ${TITLE_BAR_HEIGHT}px !important;
                z-index: 2147483647 !important;
                pointer-events: auto !important;
                background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%) !important;
                border-bottom: 1px solid #1a252f !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 0 10px !important;
                box-sizing: border-box !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                font-size: 14px !important;
                color: #ecf0f1 !important;
                user-select: none !important;
                -webkit-app-region: drag !important;
            `;
            
            titleBarContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag;">
                    <button id="btn-back" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: background 0.2s;" title="Voltar">←</button>
                    <button id="btn-forward" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: background 0.2s;" title="Avançar">→</button>
                    <button id="btn-reload" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s;" title="Recarregar">↻</button>
                </div>
                
                <div style="flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 20px; -webkit-app-region: no-drag;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${navigator.onLine ? '#2ecc71' : '#e74c3c'};"></div>
                    <input type="text" id="url-display" readonly style="flex: 1; height: 26px; background: rgba(0,0,0,0.2); border: 1px solid #2c3e50; border-radius: 13px; color: #ecf0f1; padding: 0 12px; font-size: 12px; text-align: center; outline: none; cursor: default;" value="${window.location.href}">
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag;">
                    <button id="btn-downloads" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.2s;" title="Downloads">📥</button>
                    <button id="btn-minimize" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s;" title="Minimizar">−</button>
                    <button id="btn-maximize" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s;" title="Maximizar">☐</button>
                    <button id="btn-close" style="width: 30px; height: 30px; background: transparent; color: #ecf0f1; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s;" title="Fechar" onmouseover="this.style.background='#e74c3c'" onmouseout="this.style.background='transparent'">×</button>
                </div>
            `;
            
            const buttons = titleBarContainer.querySelectorAll('button:not(#btn-close)');
            buttons.forEach(btn => {
                btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.1)');
                btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
            });
            
            titleBarContainer.querySelector('#btn-back').onclick = () => ipcRenderer.send('navigate-back');
            titleBarContainer.querySelector('#btn-forward').onclick = () => ipcRenderer.send('navigate-forward');
            titleBarContainer.querySelector('#btn-reload').onclick = () => ipcRenderer.send('navigate-reload');
            titleBarContainer.querySelector('#btn-downloads').onclick = () => showNotification('📥 Downloads em desenvolvimento');
            titleBarContainer.querySelector('#btn-minimize').onclick = () => ipcRenderer.send('minimize-secure-window');
            titleBarContainer.querySelector('#btn-maximize').onclick = () => ipcRenderer.send('maximize-secure-window');
            titleBarContainer.querySelector('#btn-close').onclick = () => ipcRenderer.send('close-secure-window');
            
            document.documentElement.insertBefore(titleBarContainer, document.documentElement.firstChild);
            
            applyLayoutAdjustment();
            
            setTimeout(() => {
                document.documentElement.style.transform = 'translateZ(0)';
                setTimeout(() => {
                    document.documentElement.style.transform = '';
                }, 10);
            }, 100);
            
            isCreated = true;
            console.log('[TITLE BAR] ✅ Barra criada com sucesso!');
            
        } catch (error) {
            console.error('[TITLE BAR] ❌ Erro ao criar barra:', error);
        }
    }
    
    // FUNÇÃO HÍBRIDA: Aplica lógicas diferentes para ChatGPT e outros sites.
    function applyLayoutAdjustment() {
        let styleEl = document.getElementById('secure-layout-adjustment');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'secure-layout-adjustment';
            document.head.appendChild(styleEl);
        }
        
        const isChatGPT = window.location.hostname.includes('chatgpt.com') || 
                         window.location.hostname.includes('chat.openai.com');
        
        if (isChatGPT) {
            // Método suave para ChatGPT para não quebrar botões
            styleEl.textContent = `
                body {
                    margin-top: ${TITLE_BAR_HEIGHT}px !important;
                    height: auto !important;
                }
            `;
            console.log(`[LAYOUT] ✅ Aplicado: Método suave para ChatGPT.`);
        } else {
            // Método robusto para todos os outros sites
            styleEl.textContent = `
                :root { --secure-browser-titlebar-height: ${TITLE_BAR_HEIGHT}px; }
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
            console.log(`[LAYOUT] ✅ Aplicado: Método robusto para outros sites.`);
        }
    }

    // FUNÇÃO HÍBRIDA: Ajusta elementos sobrepostos de forma diferente
    function adjustOverlappingElements() {
        const isChatGPT = window.location.hostname.includes('chatgpt.com') || 
                         window.location.hostname.includes('chat.openai.com');
        
        if (isChatGPT) {
            // Para ChatGPT: Apenas ajusta elementos fixos no topo para descerem
            const elements = document.querySelectorAll('*');
            for (const el of elements) {
                if (el.id === CONTAINER_ID || el.closest(`#${CONTAINER_ID}`)) continue;
                try {
                    const style = window.getComputedStyle(el);
                    if (style.position === 'fixed' && style.top === '0px' && !el.dataset.adjusted) {
                        el.style.setProperty('top', `${TITLE_BAR_HEIGHT}px`, 'important');
                        el.dataset.adjusted = 'true';
                    }
                } catch (e) { /* Ignora */ }
            }
        } else {
            // Para outros sites: usa a lógica mais completa e segura
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
        
        // Proteção de Z-index para todos os sites
        const highZIndexElements = document.querySelectorAll('*');
        highZIndexElements.forEach(el => {
            const computed = window.getComputedStyle(el);
            const zIndex = parseInt(computed.zIndex);
            
            if (zIndex >= 2147483647 && el.id !== CONTAINER_ID) {
                el.style.zIndex = '2147483646';
            }
        });
    }

    // Proteção anti-tooltip
    function setupAntiTooltip() {
        const allowedSites = ['canva.com', 'leonardo.ai', 'placeit.net', 'hailuoai.video', 'vectorizer.ai'];
        const currentSite = window.location.hostname;
        
        if (!allowedSites.some(site => currentSite.includes(site))) {
            const antiTooltipStyle = document.createElement('style');
            antiTooltipStyle.id = 'anti-tooltip-protection';
            antiTooltipStyle.textContent = `
                [role="tooltip"], .tooltip, .ui-tooltip, [data-tooltip] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `;
            document.head.appendChild(antiTooltipStyle);
        }
    }
    
    // Monitor robusto
    function setupRobustMonitoring() {
        const observer = new MutationObserver(() => {
            if (!document.getElementById(CONTAINER_ID)) {
                console.log('[TITLE BAR] 🔄 Barra removida, recriando...');
                isCreated = false;
                createTitleBar();
            }
            
            if (!document.getElementById('secure-layout-adjustment')) {
                console.log('[LAYOUT] 🔄 Replicando ajuste de layout...');
                applyLayoutAdjustment();
            }
            
            adjustOverlappingElements();
        });
        
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true
        });
        
        setInterval(() => {
            if (!document.getElementById(CONTAINER_ID)) {
                console.log('[TITLE BAR] 🔄 Verificação: barra ausente, recriando...');
                isCreated = false;
                createTitleBar();
            }
            
            adjustOverlappingElements();
        }, 3000);
    }
    
    // Inicialização
    function initialize() {
        console.log('[TITLE BAR] 🚀 Inicializando sistema...');
        
        createTitleBar();
        setupAntiTooltip();
        setupRobustMonitoring();
        
        ipcRenderer.on('url-updated', (event, url) => {
            const urlInput = document.getElementById('url-display');
            if (urlInput) urlInput.value = url || window.location.href;
        });
        
        ipcRenderer.on('download-started', (event, { id, filename }) => {
            downloads.set(id, { filename, progress: 0, state: 'active' });
            showNotification(`📥 Download iniciado: ${filename}`);
        });
        
        ipcRenderer.on('download-progress', (event, { id, progress }) => {
            const download = downloads.get(id);
            if (download?.state === 'active') {
                download.progress = progress;
                if (progress % 25 === 0) {
                    showNotification(`📊 Download ${progress}%: ${download.filename}`);
                }
            }
        });
        
        ipcRenderer.on('download-complete', (event, { id, state, path }) => {
            const download = downloads.get(id);
            if (download) {
                download.state = state;
                download.path = path;
                showNotification(`✅ Download concluído: ${download.filename}`);
            }
        });
        
        ipcRenderer.send('request-initial-url');
        
        setTimeout(() => {
            applyLayoutAdjustment();
            adjustOverlappingElements();
            
            // =================================================================================
            // >>>>>>>>>>>>>>>>> BLOCO DE AJUSTE FINO PARA O CHATGPT CORRIGIDO <<<<<<<<<<<<<<<<<<<<
            // =================================================================================
            if (window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('chat.openai.com')) {
                setTimeout(() => {
                    // Seletores mais seguros e específicos para a barra lateral
                    const possibleSidebars = [
                        'nav[aria-label]',
                        '[role="navigation"]',
                        'div[style*="width: 260px"]',
                        'div[class*="sidebar"]'
                    ];
                    
                    possibleSidebars.forEach(selector => {
                        const sidebars = document.querySelectorAll(selector);
                        sidebars.forEach(sidebar => {
                            // Lógica mais inteligente: só aplica se o elemento precisar rolar
                            if (sidebar && sidebar.scrollHeight > sidebar.clientHeight) {
                                sidebar.style.setProperty('height', 'auto', 'important');
                                sidebar.style.setProperty('max-height', `calc(100vh - ${TITLE_BAR_HEIGHT}px)`, 'important');
                                sidebar.style.setProperty('overflow-y', 'auto', 'important');
                                console.log('[LAYOUT] 📜 Sidebar do ChatGPT ajustada para scroll completo:', selector);
                            }
                        });
                    });
                }, 1500);
            }
        }, 1000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    window.addEventListener('load', () => {
        if (!document.getElementById(CONTAINER_ID)) {
            console.log('[TITLE BAR] 🔄 Load: criando barra...');
            initialize();
        }
    });
})();

console.log('%c[PRELOAD] Sistema completo carregado!', 'color: #00FF00; font-size: 16px; font-weight: bold;');