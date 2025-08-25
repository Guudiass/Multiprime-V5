// updater.js

const fs = require('fs');
const https = require('https');
const path = require('path');

// Função para adicionar timestamp às URLs e evitar cache
function addTimestamp(url) {
    const timestamp = new Date().getTime();
    return `${url}?t=${timestamp}`;
}

// Estrutura de arquivos com URLs de backup
const filesToUpdate = [
    { 
        url: addTimestamp('https://raw.githubusercontent.com/Guudiass/Multiprime-V5/main/main.js'), 
        dest: path.join(__dirname, 'main.js'), 
        critical: true,
        backupUrls: [
            addTimestamp('https://designerprime.com.br/wp-content/uploads/2025/cookies/V5/main.js')
        ] 
    },
    { 
        url: addTimestamp('https://raw.githubusercontent.com/Guudiass/Multiprime-V5/main/preload.js'), 
        dest: path.join(__dirname, 'preload.js'), 
        critical: true,
        backupUrls: [
            addTimestamp('https://designerprime.com.br/wp-content/uploads/2025/cookies/V5/preload.js')
        ]
    },
    { 
        url: addTimestamp('https://raw.githubusercontent.com/Guudiass/Multiprime-V5/main/preload-secure.js'), 
        dest: path.join(__dirname, 'preload-secure.js'), 
        critical: true,
        backupUrls: [
            addTimestamp('https://designerprime.com.br/wp-content/uploads/2025/cookies/V5/preload-secure.js')
        ]
    }
];

// Limpa arquivos temporários de atualizações anteriores que falharam
function cleanupTemporaryFiles() {
    console.log('Verificando arquivos temporários de atualizações anteriores...');
    for (const file of filesToUpdate) {
        const tempPath = `${file.dest}.new`;
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
                console.log(`Arquivo temporário removido: ${path.basename(tempPath)}`);
            } catch (err) {
                console.warn(`Aviso: Não foi possível remover o arquivo temporário ${path.basename(tempPath)}: ${err.message}`);
            }
        }
    }
}

// Função para baixar um único arquivo para um destino temporário
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const tempDest = `${dest}.new`; // Sempre baixa para um arquivo .new
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Falha ao baixar ${url}. Código de status: ${response.statusCode}`));
            }

            const fileStream = fs.createWriteStream(tempDest);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                // Verifica se o arquivo não está vazio ou corrompido (tamanho mínimo)
                const stats = fs.statSync(tempDest);
                if (stats.size < 100) { // Limite de 100 bytes, ajuste se necessário
                    fs.unlinkSync(tempDest); // Remove o arquivo corrompido
                    return reject(new Error(`Arquivo baixado de ${url} parece corrompido (tamanho: ${stats.size} bytes).`));
                }
                console.log(`Baixado com sucesso: ${path.basename(dest)} de ${url}`);
                resolve(tempDest);
            });

            fileStream.on('error', (err) => {
                fs.unlink(tempDest, () => {}); // Tenta apagar o arquivo temporário em caso de erro
                reject(new Error(`Erro de stream ao salvar ${path.basename(dest)}: ${err.message}`));
            });

        }).on('error', (err) => {
            reject(new Error(`Erro de requisição ao baixar ${url}: ${err.message}`));
        });
    });
}

// Tenta baixar um arquivo usando a URL principal e depois as de backup
async function tryDownloadFileWithBackups(file) {
    const urlsToTry = [file.url, ...(file.backupUrls || [])];
    for (const url of urlsToTry) {
        try {
            const downloadedPath = await downloadFile(url, file.dest);
            return downloadedPath; // Retorna o caminho do arquivo .new se o download for bem-sucedido
        } catch (error) {
            console.error(`Falha ao tentar baixar de ${url}: ${error.message}`);
        }
    }
    // Se todas as URLs falharem
    throw new Error(`Não foi possível baixar o arquivo ${path.basename(file.dest)} de nenhuma fonte.`);
}

/**
 * Função principal que executa a atualização em segundo plano.
 */
async function performBackgroundUpdate() {
    console.log('[Updater] Verificando atualizações em segundo plano...');
    
    // 1. Limpa lixo de tentativas anteriores
    cleanupTemporaryFiles();

    const criticalFiles = filesToUpdate.filter(f => f.critical);
    const downloadedFiles = [];
    let updateFailed = false;

    // 2. Tenta baixar todos os arquivos críticos
    for (const file of criticalFiles) {
        try {
            const tempPath = await tryDownloadFileWithBackups(file);
            downloadedFiles.push({ tempPath, finalDest: file.dest });
        } catch (error) {
            console.error(`[Updater] ERRO CRÍTICO: ${error.message}`);
            updateFailed = true;
            break; // Para o processo de download se um arquivo crítico falhar
        }
    }

    // 3. Se um download crítico falhou, aborta a atualização e limpa os arquivos baixados
    if (updateFailed) {
        console.error('[Updater] Atualização abortada devido à falha no download de um arquivo essencial.');
        for (const df of downloadedFiles) {
            try {
                fs.unlinkSync(df.tempPath); // Remove os .new que foram baixados
            } catch {}
        }
        return; // Termina a função
    }

    // 4. Se todos os downloads críticos foram bem-sucedidos, aplica a atualização
    console.log('[Updater] Todos os arquivos críticos foram baixados. Aplicando atualização...');
    try {
        // Opcional: Limpar a pasta 'inject' agora, antes de aplicar
        // cleanInjectFolder(); 

        for (const file of downloadedFiles) {
            // Substituição atômica: renomeia o arquivo .new para o nome final
            fs.renameSync(file.tempPath, file.finalDest);
            console.log(`[Updater] Arquivo atualizado: ${path.basename(file.finalDest)}`);
        }
        console.log('[Updater] Atualização concluída com sucesso! As alterações serão aplicadas na próxima inicialização.');
    } catch (error) {
        console.error(`[Updater] Erro crítico ao aplicar a atualização (renomear arquivos): ${error.message}`);
        // Aqui, a atualização pode ter ficado em estado inconsistente.
        // Uma estratégia de recuperação mais avançada poderia ser implementada se necessário.
    }
    
    // Note que não baixamos arquivos não críticos neste exemplo,
    // mas a lógica poderia ser estendida para incluí-los após os críticos.
}


/**
 * Função exportada para ser chamada pelo seu aplicativo principal.
 * Ela inicia o processo e não bloqueia a execução.
 */
function runUpdaterInBackground() {
    // Usamos um `setTimeout` com 0ms para garantir que esta função
    // seja executada no próximo ciclo do event loop,
    // permitindo que o código principal continue imediatamente.
    setTimeout(() => {
        performBackgroundUpdate().catch(err => {
            console.error('[Updater] Ocorreu um erro inesperado no processo de atualização:', err);
        });
    }, 0);
}

module.exports = { runUpdaterInBackground };

// Se este arquivo for executado diretamente (ex: node updater.js), ele roda a atualização.
if (require.main === module) {
    runUpdaterInBackground();
}