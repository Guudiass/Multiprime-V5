//pormanobahiadev
//V.1.0
(() => {
    const palavrasChave = [
        'conta', 'perfil', 'assinatura', 'faturamento', 'segurança', 'pagamento', 'planos', 'preço', 'api', 'cancelar',
        'account', 'profile', 'subscription', 'subscriptions', 'billing', 'security', 'payment', 'plans', 'price', 'cancel', 'checkout', 'upgrade', 'change to plan', 'upgrade to plan', 'stripe', 'credit carton'
    ];

    let ultimaURL = location.href.toLowerCase();

    function bloquear(contexto) {
        alert('Acesso a área sensível bloqueado:\n' + contexto);
        window.location.replace('/');
    }

    // Verificação de URL diretamente
    function verificarURL() {
        const atual = location.href.toLowerCase();
        if (atual !== ultimaURL) {
            ultimaURL = atual;
            if (palavrasChave.some(p => atual.includes(p))) {
                bloquear(atual);
            }
        }
    }

    // Intercepta cliques em links e botões com href/data-url
    document.addEventListener('click', (e) => {
        const el = e.target.closest('a, button');
        if (!el) return;

        let url = (el.href || el.getAttribute('data-url') || '').toLowerCase().trim();
        if (!url || url.startsWith('javascript:')) return;

        if (palavrasChave.some(p => url.includes(p))) {
            e.preventDefault();
            e.stopImmediatePropagation();
            bloquear(url);
        }
    }, true);

    // Intercepta abertura de iframes sensíveis
    const observer = new MutationObserver(mutations => {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (!(node instanceof HTMLIFrameElement)) continue;
                const src = (node.src || '').toLowerCase();
                if (palavrasChave.some(p => src.includes(p))) {
                    console.warn('[manobahiadev] iframe sensível bloqueado:', src);
                    node.remove();
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(verificarURL, 500);
})();
