import { definePlugin, PluginContext } from "bun_plugins";
import { Application } from '@webviewjs/webview';

export default definePlugin({
    name: "tikfinity",
    version: "1.0.0",
    onLoad: async (context: PluginContext) => {
        console.log("🔌 Iniciando captura de credenciales TikFinity...");

            const app = new Application();
            const window = app.createBrowserWindow({
                title: "TikTok Login - Sincronizando TikFinity",
                width: 500,
                height: 700
            });
            const injectionScript = `
                (function () {
                    window.TiktokPayload = "";
                    window.getPayload = function () {
                        return window.TiktokPayload;
                    };
                    const originalSend = WebSocket.prototype.send;
                    WebSocket.prototype.send = function (data) {
                        if (typeof data === 'string' && data.includes("setUniqueId")) {
                            console.log("injectionScript data", data)
                            window.TiktokPayload = data;
                            window.ipc.postMessage(data);
                        }
                        return originalSend.apply(this, arguments);
                    };
                    console.log("💉 Interceptor de WebSocket inyectado");
                })();   
            `;
            const webview = window.createWebview({
                preload: injectionScript,
                url: "https://tikfinity.zerody.one/",
                enableDevtools: true
            });
            webview.onIpcMessage((message) => {
            // Convertimos el Buffer del cuerpo del mensaje a texto
                const payload = message.body.toString();
                
                console.log("🚀 Payload recibido desde el navegador:", payload);

                if (payload.includes("setUniqueId")) {
                    console.log("✅ Credenciales capturadas con éxito");
                    
                    
                }
            });
            /*
                    const app = new Application();
                    const window = app.createBrowserWindow();
                    const webview = window.createWebview();
            */

            app.run();
    },
    onUnload: () => {
        console.log("tikfinity unloaded");
    }
});