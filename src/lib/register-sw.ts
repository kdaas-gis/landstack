const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function registerServiceWorker() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register(
                `${basePath}/sw.js`,
                { scope: `${basePath}/` }
            );
            console.log('[SW] Registered:', registration.scope);
        } catch (error) {
            console.error('[SW] Registration failed:', error);
        }
    });
}
