const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const { Writable, Readable } = require('stream');


// ===================================================================
// PARTE 2: LÓGICA DO ATUALIZADOR DE ARQUIVOS DA APLICAÇÃO
// (Cuida de preload.js e preload-secure.js)
// ===================================================================

function addTimestamp(url) {
    return `${url}?t=${new Date().getTime()}`;
}

const filesToUpdate = [
    // O ARQUIVO main.js NÃO ESTÁ AQUI porque ele não pode atualizar a si mesmo.
    { 
        url: addTimestamp('https://raw.githubusercontent.com/Guudiass/Multiprime-V5/main/preload.js'), 
        dest: path.join(__dirname, 'preload.js'), 
        critical: true,
        backupUrls: [addTimestamp('https://designerprime.com.br/wp-content/uploads/2025/cookies/V5/preload.js')]
    },
	{ 
        url: addTimestamp('https://raw.githubusercontent.com/Guudiass/Multiprime-V5/main/main.js'), 
        dest: path.join(__dirname, 'main.js'), 
        critical: true,
        backupUrls: [addTimestamp('https://designerprime.com.br/wp-content/uploads/2025/cookies/V5/main.js')]
    },
    { 
        url: addTimestamp('https://raw.githubusercontent.com/Guudiass/Multiprime-V5/main/preload-secure.js'), 
        dest: path.join(__dirname, 'preload-secure.js'), 
        critical: true,
        backupUrls: [addTimestamp('https://designerprime.com.br/wp-content/uploads/2025/cookies/V5/preload-secure.js')]
    }
];

const criticalFilePaths = filesToUpdate.filter(f => f.critical).map(f => f.dest);

function downloadAppFile(url, dest, temp = true) {
    return new Promise((resolve, reject) => {
        const finalDest = temp ? `${dest}.new` : dest;
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Falha no download (Status ${response.statusCode}) de ${url}`));
            }
            const fileStream = fs.createWriteStream(finalDest);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                if (fs.statSync(finalDest).size < 100) { // Verificação de arquivo corrompido
                    fs.unlinkSync(finalDest);
                    return reject(new Error(`Arquivo baixado de ${url} parece corrompido.`));
                }
                resolve(finalDest);
            });
            fileStream.on('error', (err) => { fs.unlink(finalDest, () => {}); reject(err); });
        }).on('error', (err) => reject(err));
    });
}

async function tryDownloadAppFileWithBackups(file, isTemp = true) {
    const urls = [file.url, ...(file.backupUrls || [])];
    for (const url of urls) {
        try {
            console.log(`[Updater] Tentando baixar de ${url}...`);
            return await downloadAppFile(url, file.dest, isTemp);
        } catch (error) {
            console.error(`[Updater] Falha: ${error.message}`);
        }
    }
    throw new Error(`Não foi possível baixar o arquivo ${path.basename(file.dest)} de nenhuma fonte.`);
}

async function performAppUpdate(isBlocking = false) {
    const logPrefix = isBlocking ? '[Instalador]' : '[Updater BG]';
    console.log(`${logPrefix} Verificando arquivos da aplicação...`);
    
    let allSucceeded = true;
    const downloadedTempFiles = [];

    for (const file of filesToUpdate) {
        try {
            const finalPath = await tryDownloadAppFileWithBackups(file, !isBlocking);
            if (!isBlocking) downloadedTempFiles.push({ temp: finalPath, final: file.dest });
        } catch (error) {
            allSucceeded = false;
            console.error(`${logPrefix} ERRO CRÍTICO: ${error.message}`);
            break;
        }
    }

    if (!allSucceeded) {
        if (isBlocking) throw new Error("Falha ao baixar arquivos essenciais para o funcionamento do aplicativo.");
        downloadedTempFiles.forEach(f => { try { fs.unlinkSync(f.temp); } catch {} }); // Limpa arquivos temporários
        return;
    }

    if (!isBlocking) {
        console.log(`${logPrefix} Aplicando atualizações para a próxima inicialização...`);
        downloadedTempFiles.forEach(f => fs.renameSync(f.temp, f.final));
        console.log(`${logPrefix} Atualização silenciosa concluída.`);
    } else {
        console.log(`${logPrefix} Instalação dos arquivos concluída com sucesso.`);
    }
}


// ===================================================================
// PARTE 3: LÓGICA PRINCIPAL DA SUA APLICAÇÃO (SEU CÓDIGO ORIGINAL)
// ===================================================================
function startApp() {
    //
    // TODO O SEU CÓDIGO ORIGINAL VEM AQUI DENTRO
    //
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
    
    const CONFIG = {
        WINDOW_DEFAULTS: { width: 1280, height: 720, minWidth: 800, minHeight: 600 },
        COOKIE_TIMEOUT: 90_000,
        SESSION_CLEANUP_DELAY: 1_000
    };
    
    const GITHUB_CONFIG = {
        owner: 'Guudiass',
        repo: 'MULTIPRIMECOOKIES',
        baseUrl: 'https://api.github.com'
    };
    
    const CRYPTO_CONFIG = {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
        salt: 'multiprime-cookies-salt-2025'
    };
    
    const proxyCredentials = new Map();
    const windowProfiles = new Map();

    // [FIX] Helper para evitar "Object has been destroyed"
    function withAlive(win, fn) {
        try { if (win && !win.isDestroyed()) fn(win); } catch (_) {}
    }

    // [FIX] Helper para identificar abortos não-fatais de navegação
    function isAbortError(errOrCode) {
        if (typeof errOrCode === 'number') return errOrCode === -3;
        if (!errOrCode) return false;
        // Electron geralmente fornece .code ('ERR_ABORTED') e .errno (-3)
        return errOrCode.code === 'ERR_ABORTED' || errOrCode.errno === -3 || errOrCode.errorCode === -3;
    }
    
    const nossoManipuladorDeLogin = (event, webContents, request, authInfo, callback) => {
        if (!authInfo.isProxy) { 
            callback(); 
            return; 
        }
        
        event.preventDefault();
        const webContentsId = webContents?.id ?? 'N/A';
        const credentials = proxyCredentials.get(webContentsId);
        
        if (credentials) {
            console.log(`[PROXY AUTH] Autenticando proxy ${authInfo.scheme} para ${authInfo.host}:${authInfo.port}`);
            callback(credentials.username, credentials.password);
        } else {
            console.log(`[PROXY AUTH] Nenhuma credencial encontrada para ${authInfo.host}:${authInfo.port}`);
            callback();
        }
    };
    
    // ===== FUNÇÕES DE CRIPTOGRAFIA (sem alterações) =====
    function encryptData(data, password = 'MultiPrime-Default-Key-2025') {
        try {
            const key = crypto.scryptSync(password, CRYPTO_CONFIG.salt, CRYPTO_CONFIG.keyLength);
            const iv = crypto.randomBytes(CRYPTO_CONFIG.ivLength);
            const cipher = crypto.createCipheriv(CRYPTO_CONFIG.algorithm, key, iv);
            cipher.setAAD(Buffer.from('multiprime-session-data'));
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();
            const encryptedPackage = {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                algorithm: CRYPTO_CONFIG.algorithm,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            return JSON.stringify(encryptedPackage, null, 2);
        } catch (error) {
            throw new Error(`Erro na criptografia: ${error.message}`);
        }
    }
    
    function decryptData(encryptedData, password = 'MultiPrime-Default-Key-2025') {
        try {
            const encryptedPackage = JSON.parse(encryptedData);
            if (!encryptedPackage.encrypted || !encryptedPackage.iv || !encryptedPackage.authTag) {
                throw new Error('Dados criptografados inválidos');
            }
            const version = encryptedPackage.version || '1.0';
            let key;
            if (version === '1.0') {
                key = crypto.scryptSync(password, CRYPTO_CONFIG.salt, CRYPTO_CONFIG.keyLength);
            } else if (version === '2.0') {
                key = crypto.pbkdf2Sync(password, CRYPTO_CONFIG.salt, 100000, CRYPTO_CONFIG.keyLength, 'sha256');
            } else {
                throw new Error(`Versão de criptografia não suportada: ${version}`);
            }
            const iv = Buffer.from(encryptedPackage.iv, 'hex');
            const authTag = Buffer.from(encryptedPackage.authTag, 'hex');
            const decipher = crypto.createDecipheriv(encryptedPackage.algorithm || CRYPTO_CONFIG.algorithm, key, iv);
            decipher.setAAD(Buffer.from('multiprime-session-data'));
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedPackage.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            throw new Error(`Erro na descriptografia: ${error.message}`);
        }
    }
    
    function isEncryptedData(data) {
        try {
            const parsed = JSON.parse(data);
            const hasRequiredFields = !!(parsed.encrypted && parsed.iv && parsed.authTag && parsed.algorithm);
            const hasValidVersion = !parsed.version || ['1.0', '2.0'].includes(parsed.version);
            return hasRequiredFields && hasValidVersion;
        } catch {
            return false;
        }
    }
    
    
    // ===== FUNÇÕES DO GITHUB (sem alterações) =====
    async function downloadFromGitHub(filePath, token) {
        return new Promise((resolve, reject) => {
            const url = `${GITHUB_CONFIG.baseUrl}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
            const options = {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'MultiPrime-Cookies-App',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(data);
                            let content = '';
                            if (response.content) {
                                content = Buffer.from(response.content, 'base64').toString('utf-8');
                            } else if (response.download_url) {
                                downloadDirectly(response.download_url, token, resolve, reject);
                                return;
                            } else {
                                throw new Error('Nenhum conteúdo encontrado na resposta');
                            }
                            if (isEncryptedData(content)) {
                                console.log('[DOWNLOAD] Arquivo criptografado detectado, descriptografando...');
                                try {
                                    const decryptedContent = decryptData(content);
                                    resolve(decryptedContent);
                                } catch (decryptError) {
                                    console.error('[DOWNLOAD] Erro na descriptografia:', decryptError.message);
                                    reject(new Error(`Falha na descriptografia: ${decryptError.message}`));
                                }
                            } else {
                                console.log('[DOWNLOAD] Arquivo não criptografado detectado');
                                resolve(content);
                            }
                        } else {
                            reject(new Error(`GitHub API retornou status ${res.statusCode}: ${data}`));
                        }
                    } catch (error) {
                        reject(new Error(`Erro ao processar resposta do GitHub: ${error.message}`));
                    }
                });
            });
            req.on('error', (error) => reject(new Error(`Erro de conexão com GitHub: ${error.message}`)));
            req.setTimeout(30000, () => {
                req.abort();
                reject(new Error('Timeout na conexão com GitHub'));
            });
            req.end();
        });
    }
    
    function downloadDirectly(downloadUrl, token, resolve, reject) {
        const options = {
            method: 'GET',
            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'MultiPrime-Cookies-App' }
        };
        https.get(downloadUrl, options, (res) => {
            let content = '';
            res.on('data', chunk => { content += chunk; });
            res.on('end', () => {
                if (isEncryptedData(content)) {
                    console.log('[DOWNLOAD] Arquivo criptografado detectado, descriptografando...');
                    try {
                        const decryptedContent = decryptData(content);
                        resolve(decryptedContent);
                    } catch (decryptError) {
                        console.error('[DOWNLOAD] Erro na descriptografia:', decryptError.message);
                        reject(new Error(`Falha na descriptografia: ${decryptError.message}`));
                    }
                } else {
                    console.log('[DOWNLOAD] Arquivo não criptografado detectado');
                    resolve(content);
                }
            });
        }).on('error', (error) => reject(new Error(`Erro no download direto: ${error.message}`)));
    }
    
    async function uploadToGitHub(filePath, content, token, commitMessage = 'Atualizar sessão') {
        return new Promise((resolve, reject) => {
            console.log('[UPLOAD] Criptografando dados antes do upload...');
            let encryptedContent;
            try {
                encryptedContent = encryptData(content);
                console.log('[UPLOAD] Dados criptografados com sucesso');
            } catch (encryptError) {
                reject(new Error(`Falha na criptografia: ${encryptError.message}`));
                return;
            }
            const getUrl = `${GITHUB_CONFIG.baseUrl}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
            const getOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'MultiPrime-Cookies-App',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };
            const getReq = https.request(getUrl, getOptions, (getRes) => {
                let getData = '';
                getRes.on('data', chunk => { getData += chunk; });
                getRes.on('end', () => {
                    let sha = null;
                    if (getRes.statusCode === 200) {
                        try { sha = JSON.parse(getData).sha; } catch (e) { /* Ignora */ }
                    }
                    const putUrl = `${GITHUB_CONFIG.baseUrl}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
                    const putData = JSON.stringify({
                        message: commitMessage,
                        content: Buffer.from(encryptedContent).toString('base64'),
                        ...(sha && { sha })
                    });
                    const putOptions = {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${token}`,
                            'User-Agent': 'MultiPrime-Cookies-App',
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(putData)
                        }
                    };
                    const putReq = https.request(putUrl, putOptions, (putRes) => {
                        let putResponseData = '';
                        putRes.on('data', chunk => { putResponseData += chunk; });
                        putRes.on('end', () => {
                            if (putRes.statusCode === 200 || putRes.statusCode === 201) {
                                console.log('[UPLOAD] Dados criptografados enviados com sucesso');
                                resolve(JSON.parse(putResponseData));
                            } else {
                                reject(new Error(`Erro ao fazer upload: ${putRes.statusCode} - ${putResponseData}`));
                            }
                        });
                    });
                    putReq.on('error', (error) => reject(new Error(`Erro de conexão no upload: ${error.message}`)));
                    putReq.setTimeout(30000, () => {
                        putReq.abort();
                        reject(new Error('Timeout no upload para GitHub'));
                    });
                    putReq.write(putData);
                    putReq.end();
                });
            });
            getReq.on('error', (error) => reject(new Error(`Erro ao verificar arquivo existente: ${error.message}`)));
            getReq.setTimeout(30000, () => {
                getReq.abort();
                reject(new Error('Timeout ao verificar arquivo existente'));
            });
            getReq.end();
        });
    }
    
    
    // ===== FUNÇÕES PRINCIPAIS =====
    async function limparParticoesAntigas() {
        const userDataPath = app.getPath('userData');
        const partitionsPath = path.join(userDataPath, 'Partitions');
        try {
            if (!fs.existsSync(partitionsPath)) return;
            const items = await fsPromises.readdir(partitionsPath);
            const deletePromises = items
                .filter(item => item.startsWith('profile_'))
                .map(item => fsPromises.rm(path.join(partitionsPath, item), { recursive: true, force: true }));
            if (deletePromises.length > 0) {
                await Promise.allSettled(deletePromises);
                console.log(`[LIMPEZA] ${deletePromises.length} partição(ões) removida(s).`);
            }
        } catch (err) { console.error('[LIMPEZA] Erro:', err); }
    }
    
    function validateProxyConfig(proxy) {
        if (!proxy || !proxy.host || !proxy.port) {
            return { valid: false, error: 'Host e porta do proxy são obrigatórios' };
        }
        const validTypes = ['http', 'https', 'socks', 'socks4', 'socks5'];
        const proxyType = proxy.tipo?.toLowerCase() || 'http';
        if (!validTypes.includes(proxyType)) {
            return { valid: false, error: `Tipo de proxy inválido: ${proxy.tipo}` };
        }
        const port = parseInt(proxy.port);
        if (isNaN(port) || port < 1 || port > 65535) {
            return { valid: false, error: 'Porta do proxy deve ser um número entre 1 e 65535' };
        }
        return { valid: true, type: proxyType, port: port };
    }
    
    app.whenReady().then(async () => {
        await limparParticoesAntigas();
        for (const listener of app.listeners('login')) app.removeListener('login', listener);
        app.on('login', nossoManipuladorDeLogin);
        console.log('[SISTEMA] Aplicação pronta.');
    });
    
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) console.log('Aplicação ativada.');
    });
    
    function sanitizeCookieForInjection(cookie, defaultUrl) {
        const cookieDetails = { ...cookie };
        if (!cookieDetails.url) {
            const host = cookie.domain ? (cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain) : new URL(defaultUrl).hostname;
            cookieDetails.url = `https://${host}${cookieDetails.path || '/'}`;
        }
        if (cookieDetails.secure && cookieDetails.url.startsWith('http://')) {
            cookieDetails.url = cookieDetails.url.replace('http://', 'https://');
        }
        if (cookieDetails.sameSite) {
            const sameSiteLower = cookieDetails.sameSite.toLowerCase();
            if (['strict', 'lax', 'none'].includes(sameSiteLower)) {
                cookieDetails.sameSite = sameSiteLower === 'none' ? 'no_restriction' : sameSiteLower;
            } else {
                delete cookieDetails.sameSite;
            }
        }
        if (cookieDetails.name.startsWith('__Host-')) {
            cookieDetails.secure = true;
            cookieDetails.path = '/';
            delete cookieDetails.domain;
        } else if (cookieDetails.name.startsWith('__Secure-')) {
            cookieDetails.secure = true;
        }
        if (cookieDetails.expirationDate && (isNaN(cookieDetails.expirationDate) || cookieDetails.expirationDate * 1000 < Date.now())) {
            delete cookieDetails.expirationDate;
        }
        return cookieDetails;
    }
    
    ipcMain.on('abrir-navegador', async (event, perfil) => {
        const windowId = `profile_${Date.now()}`;
        const partition = `persist:${windowId}`;
        const isolatedSession = session.fromPartition(partition);
        let secureWindow = null;
        
        try {
            if (!perfil || !perfil.link) throw new Error('Perfil ou link inválido.');
    
            console.log(`[SESSÃO ${windowId}] Limpando armazenamento prévio da sessão...`);
            await isolatedSession.clearStorageData();
    
            if (perfil.userAgent) {
                await isolatedSession.setUserAgent(perfil.userAgent);
            }
    
            let sessionData = null;
            if (perfil.ftp && perfil.senha) {
                try {
                    console.log(`[SESSÃO ${windowId}] Baixando cookies do GitHub: ${perfil.ftp}`);
                    const fileContent = await downloadFromGitHub(perfil.ftp, perfil.senha);
                    if (fileContent) {
                        sessionData = JSON.parse(fileContent);
                        console.log(`[SESSÃO ${windowId}] Cookies carregados com sucesso do GitHub`);
                    }
                } catch (err) {
                    console.error(`[SESSÃO ${windowId}] Falha ao buscar dados do GitHub:`, err.message);
                }
            }
    
            let cookiesToInject = [];
            if (sessionData) {
                if (Array.isArray(sessionData)) cookiesToInject = sessionData;
                else if (sessionData.cookies && Array.isArray(sessionData.cookies)) cookiesToInject = sessionData.cookies;
            }
    
            if (cookiesToInject.length > 0) {
                console.log(`[SESSÃO ${windowId}] Preparando para injetar ${cookiesToInject.length} cookie(s)...`);
                let successCount = 0, failureCount = 0;
                for (const [index, cookie] of cookiesToInject.entries()) {
                    try {
                        const sanitizedCookie = sanitizeCookieForInjection(cookie, perfil.link);
                        await isolatedSession.cookies.set(sanitizedCookie);
                        successCount++;
                    } catch (err) {
                        console.error(`[COOKIE ${index}] Falha ao definir "${cookie.name}":`, err.message);
                        failureCount++;
                    }
                }
                console.log(`[SESSÃO ${windowId}] Injeção concluída. Sucesso: ${successCount}, Falhas: ${failureCount}`);
                await isolatedSession.cookies.flushStore();
            }
    
            const storageData = { localStorage: sessionData?.localStorage, sessionStorage: sessionData?.sessionStorage, indexedDB: sessionData?.indexedDB };
			
			// ★ NOVO: fornece dados de sessão de forma síncrona para o preload
ipcMain.once('get-initial-session-data', (e) => {
  if (secureWindow && !secureWindow.isDestroyed() && e.sender === secureWindow.webContents) {
    e.returnValue = storageData || null;
  } else {
    e.returnValue = null;
  }
});
    
            ipcMain.once('request-session-data', (e) => {
                if (secureWindow && !secureWindow.isDestroyed() && e.sender === secureWindow.webContents) {
                    e.sender.send('inject-session-data', storageData);
                }
            });
    
            secureWindow = new BrowserWindow({
                ...CONFIG.WINDOW_DEFAULTS,
                frame: false, show: false,
                webPreferences: {
                    session: isolatedSession,
                    // Garante que o preload-secure.js seja encontrado
                    preload: path.join(__dirname, 'preload-secure.js'), 
                    contextIsolation: true, nodeIntegration: false, devTools: true
                }
            });
    
            windowProfiles.set(secureWindow.webContents.id, perfil);

            // [FIX] Ignorar naveg. abortadas (ex.: usuário digita e dá Enter)
            secureWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
                if (isAbortError(errorCode)) {
                    // Navegação interrompida por outra navegação -> normal; não fechar/derrubar UI
                    return;
                }
                console.error('[NAV] did-fail-load:', errorCode, errorDescription, validatedURL);
            });
    
            secureWindow.webContents.on('did-navigate', (e, url) => { 
                withAlive(secureWindow, (w) => w.webContents.send('url-updated', url));
            });
    
            // ===== NOVO SISTEMA DE LOGIN AUTOMÁTICO =====
            if (perfil.usuariodaferramenta && perfil.senhadaferramenta) {
                console.log(`[AUTO-LOGIN] Configurando login automático para: ${perfil.usuariodaferramenta}`);
                
                const sendCredentials = () => {
                    withAlive(secureWindow, (w) => {
                        console.log(`[AUTO-LOGIN] Enviando credenciais para preload script...`);
                        w.webContents.send('set-auto-login-credentials', {
                            usuariodaferramenta: perfil.usuariodaferramenta,
                            senhadaferramenta: perfil.senhadaferramenta
                        });
                    });
                };

                secureWindow.webContents.once('did-finish-load', sendCredentials);
                secureWindow.webContents.on('did-navigate', sendCredentials);
            }
    
            // Configuração do proxy (com correção para Envato)
            if (perfil.proxy?.host && perfil.proxy?.port) {
                const proxyValidation = validateProxyConfig(perfil.proxy);
                if (!proxyValidation.valid) {
                    console.error(`[SESSÃO ${windowId}] Configuração de proxy inválida:`, proxyValidation.error);
                    await isolatedSession.setProxy({ proxyRules: 'direct://' });
                } else {
                    const proxyType = proxyValidation.type;
                    let proxyRules = '';
                    switch (proxyType) {
                        case 'socks5': case 'socks': proxyRules = `socks5://${perfil.proxy.host}:${proxyValidation.port}`; break;
                        case 'socks4': proxyRules = `socks4://${perfil.proxy.host}:${proxyValidation.port}`; break;
                        case 'http': case 'https': default: proxyRules = `http://${perfil.proxy.host}:${proxyValidation.port}`; break;
                    }
                    
                    const bypassRules = [
                        perfil.proxy.bypass || '',
                        '*.envatousercontent.com'
                    ].filter(Boolean).join(',');
    
                    console.log(`[SESSÃO ${windowId}] Configurando proxy ${proxyType}: ${proxyRules}`);
                    console.log(`[SESSÃO ${windowId}] Aplicando regras de bypass: ${bypassRules}`);
    
                    await isolatedSession.setProxy({ 
                        proxyRules: proxyRules, 
                        proxyBypassRules: bypassRules
                    });
    
                    if (perfil.proxy.username) {
                        proxyCredentials.set(secureWindow.webContents.id, { username: perfil.proxy.username, password: perfil.proxy.password ?? '' });
                    }
                }
            } else {
                await isolatedSession.setProxy({ proxyRules: 'direct://' });
            }
                                        
    
            await setupDownloadManager(secureWindow, isolatedSession);
            secureWindow.once('ready-to-show', () => secureWindow.show());
            secureWindow.on('closed', () => {
                console.log(`[SISTEMA] Janela ${secureWindow.webContents.id} fechada.`);
                proxyCredentials.delete(secureWindow.webContents.id);
                windowProfiles.delete(secureWindow.webContents.id);
                secureWindow = null;
            });
    
            console.log(`[SISTEMA ${windowId}] Preparação concluída. Carregando URL...`);
            // [FIX] Ignorar rejeição de loadURL quando for ERR_ABORTED (-3)
            try {
                await secureWindow.loadURL(perfil.link);
            } catch (err) {
                if (isAbortError(err)) {
                    // navegação inicial foi abortada por outra navegação rápida -> ok
                    console.warn('[NAV] loadURL abortado por navegação subsequente (ok).');
                } else {
                    throw err;
                }
            }
    
        } catch (err) {
            console.error('--- [ERRO FATAL] Falha ao criar janela:', err);
            if (secureWindow && !secureWindow.isDestroyed()) secureWindow.destroy();
        }
    });
    
    function findUniquePath(proposedPath) {
        if (!fs.existsSync(proposedPath)) return proposedPath;
        const { dir, name, ext } = path.parse(proposedPath);
        let counter = 1, newPath;
        do { newPath = path.join(dir, `${name} (${counter})${ext}`); counter++; } while (fs.existsSync(newPath));
        return newPath;
    }
    
                                                                                        
    async function setupDownloadManager(win, isolatedSession) {
        isolatedSession.on('will-download', (event, item) => {
            if (win.isDestroyed()) {
                return item.cancel();
            }
    
            let filename = item.getFilename();
            if (!filename) {
                const mimeType = item.getMimeType();
                let extension = '.tmp';
                if (mimeType === 'audio/mpeg') extension = '.mp3';
                else if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') extension = '.wav';
                else if (mimeType === 'audio/aac') extension = '.aac';
                else if (mimeType === 'application/zip') extension = '.zip';
                filename = `download-${Date.now()}${extension}`;
                console.log(`[DOWNLOAD] Nome de arquivo ausente. Gerado nome fallback: ${filename} (MIME: ${mimeType})`);
            }
            
            const uniquePath = findUniquePath(path.join(app.getPath('downloads'), filename));
            item.setSavePath(uniquePath);
            
            const downloadId = `download-${crypto.randomUUID()}`;
            win.webContents.send('download-started', { id: downloadId, filename: path.basename(uniquePath) });
            
            let lastProgress = 0, lastUpdateTime = 0;
            const THROTTLE_INTERVAL = 250;
            
            item.on('updated', (e, state) => {
                if (win.isDestroyed() || state !== 'progressing' || item.getTotalBytes() <= 0) return;
                const progress = Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100);
                const now = Date.now();
                if (progress > lastProgress && (now - lastUpdateTime > THROTTLE_INTERVAL)) {
                    win.webContents.send('download-progress', { id: downloadId, progress });
                    lastProgress = progress; lastUpdateTime = now;
                }
            });
            
            item.on('done', (e, state) => {
                if (win.isDestroyed()) return;
                const finalProgress = state === 'completed' ? 100 : (item.getTotalBytes() > 0 ? Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100) : lastProgress);
                win.webContents.send('download-complete', { id: downloadId, state, path: item.getSavePath(), progress: finalProgress });
            });
        });
    }
    
    function getWindowFromEvent(event) {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || window.isDestroyed()) return null;
        return window;
    }
    
    ipcMain.on('request-initial-url', e => { const w = getWindowFromEvent(e); if (w) e.sender.send('url-updated', w.webContents.getURL()); });
    ipcMain.on('open-download', (e, p) => { if (p) shell.openPath(p).catch(err => console.error(`Falha ao abrir: ${p}`, err)); });
    ipcMain.on('show-download-in-folder', (e, p) => { if (p) shell.showItemInFolder(path.resolve(p)); });
    ipcMain.on('minimize-secure-window', e => getWindowFromEvent(e)?.minimize());
    ipcMain.on('maximize-secure-window', e => { const w = getWindowFromEvent(e); if (w) w.isMaximized() ? w.unmaximize() : w.maximize(); });
    ipcMain.on('close-secure-window', e => getWindowFromEvent(e)?.close());
    ipcMain.on('navigate-back', e => { const wc = getWindowFromEvent(e)?.webContents; if (wc?.canGoBack()) wc.goBack(); });
    ipcMain.on('navigate-forward', e => { const wc = getWindowFromEvent(e)?.webContents; if (wc?.canGoForward()) wc.goForward(); });
    ipcMain.on('navigate-reload', e => getWindowFromEvent(e)?.webContents.reload());
    ipcMain.on('navigate-to-url', (event, url) => { const wc = getWindowFromEvent(event)?.webContents; if (wc && url) wc.loadURL(url); });
    
    ipcMain.on('initiate-full-session-export', async (event, storageData) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || window.isDestroyed()) return;
        const perfil = windowProfiles.get(window.webContents.id);
        
        try {
            const currentSession = window.webContents.session;
            const cookies = await currentSession.cookies.get({});
            const fullSessionData = {
                exported_at: new Date().toISOString(),
                source_url: window.webContents.getURL(),
                cookies: cookies,
                localStorage: storageData.localStorageData,
                sessionStorage: storageData.sessionStorageData,
                indexedDB: storageData.indexedDBData
            };
            const jsonContent = JSON.stringify(fullSessionData, null, 4);
            
            if (perfil && perfil.ftp && perfil.senha) {
                console.log(`[EXPORTAÇÃO] Iniciando upload da sessão para GitHub: ${perfil.ftp}`);
                try {
                    const commitMessage = `Atualizar sessão - ${new Date().toISOString()}`;
                    await uploadToGitHub(perfil.ftp, jsonContent, perfil.senha, commitMessage);
                    console.log(`[EXPORTAÇÃO] Sessão salva com sucesso no GitHub.`);
                    await dialog.showMessageBox(window, {
                        type: 'info',
                        title: 'Exportação Concluída',
                        message: 'A sessão completa foi salva com sucesso no GitHub (criptografada)!',
                        detail: `Arquivo: ${perfil.ftp}`
                    });
                } catch (err) {
                    console.error('[EXPORTAÇÃO GITHUB] Falha:', err);
                    const { response } = await dialog.showMessageBox(window, {
                        type: 'warning',
                        title: 'Erro na Exportação para GitHub',
                        message: 'Não foi possível salvar no GitHub. Deseja salvar localmente?',
                        detail: err.message,
                        buttons: ['Salvar Localmente', 'Cancelar'],
                        defaultId: 0
                    });
                    if (response === 0) {
                        const { canceled, filePath } = await dialog.showSaveDialog(window, {
                            title: 'Salvar Sessão Completa Localmente',
                            defaultPath: `session-${Date.now()}.json`,
                            filters: [{ name: 'JSON Files', extensions: ['json'] }]
                        });
                        if (!canceled && filePath) {
                            await fsPromises.writeFile(filePath, jsonContent);
                            console.log(`[EXPORTAÇÃO] Sessão salva localmente: ${filePath}`);
                            await dialog.showMessageBox(window, {
                                type: 'info',
                                title: 'Sessão Salva Localmente',
                                message: 'A sessão completa foi salva no computador!',
                                detail: `Arquivo: ${filePath}`
                            });
                        }
                    }
                }
            } else {
                console.log('[EXPORTAÇÃO] Nenhum perfil GitHub encontrado. Salvando localmente.');
                const { canceled, filePath } = await dialog.showSaveDialog(window, {
                    title: 'Salvar Sessão Completa Localmente',
                    defaultPath: `session-${Date.now()}.json`,
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                });
                if (canceled || !filePath) return console.log('[EXPORTAÇÃO] Salvamento local cancelado.');
                await fsPromises.writeFile(filePath, jsonContent);
                console.log(`[EXPORTAÇÃO] Sessão salva com sucesso em: ${filePath}`);
                await dialog.showMessageBox(window, {
                    type: 'info',
                    title: 'Exportação Concluída',
                    message: 'A sessão completa foi salva localmente com sucesso!',
                    detail: `O arquivo foi salvo em: ${filePath}`
                });
            }
        } catch (err) {
            console.error('[EXPORTAÇÃO] Falha geral:', err);
            await dialog.showMessageBox(window, {
                type: 'error',
                title: 'Erro na Exportação',
                message: 'Ocorreu um erro inesperado ao preparar a sessão para exportação.',
                detail: err.message
            });
        }
    });
    
    process.on('uncaughtException', err => console.error('--- ERRO NÃO CAPTURADO ---', err));
    process.on('unhandledRejection', reason => console.error('--- PROMISE REJEITADA NÃO TRATADA ---', reason));

} // FIM DA FUNÇÃO startApp()


// ===================================================================
// PARTE 4: INICIALIZADOR (O "Maestro" que decide quando e como iniciar)
// ===================================================================
async function initialize() {
    const filesAreMissing = criticalFilePaths.some(p => !fs.existsSync(p));

    if (filesAreMissing) {
        // PRIMEIRA EXECUÇÃO: Baixa tudo antes de continuar.
        console.log("Arquivos essenciais não encontrados. Iniciando instalação...");
        try {
            await performAppUpdate(true); // Modo bloqueante
            startApp(); // Inicia o app somente após o sucesso
        } catch (error) {
            console.error("FALHA CRÍTICA NA INSTALAÇÃO:", error.message);
            // app.isReady() é necessário antes de usar 'dialog'
            app.whenReady().then(() => {
                dialog.showErrorBox("Erro de Instalação", "Não foi possível baixar os arquivos necessários para iniciar. Verifique sua conexão com a internet e tente novamente.");
                app.quit();
            });
        }
    } else {
        // EXECUÇÃO NORMAL: Inicia o app e atualiza em segundo plano.
        startApp(); // Inicia o app IMEDIATAMENTE
        setTimeout(() => { // Inicia a atualização silenciosa após um curto intervalo
            performAppUpdate(false).catch(err => console.error('[Updater BG] Erro inesperado:', err));
        }, 5000); // 5 segundos de espera para não impactar a inicialização.
    }
}

// PONTO DE ENTRADA: AQUI TUDO COMEÇA!
initialize();
;
//# sourceMappingURL=main.js.map