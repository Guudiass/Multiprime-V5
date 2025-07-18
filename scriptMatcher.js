// Mapeia hostnames para os arquivos de SCRIPT .JS personalizados no FTP.
module.exports = {
    // A chave é o hostname do site.
    // O valor é o nome do arquivo .js que será baixado e executado.
    'chat.chatbotapp.ai': 'chatbot_autologin.js',
    'login.algumsite.com': 'outro_site_script.js',
    'app.diferente.com': 'ocultar_elementos.js'
};