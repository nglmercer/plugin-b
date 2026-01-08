import { Application } from '@webviewjs/webview';
import { definePlugin, Plugin, PluginContext } from "bun_plugins";
/* import { getRoomId } from "./tiktok/utils.ts"

const baseUrl = "wss://tikfinity-cws-04.zerody.one/socket.io/";
const UniqueId = "anyelouwu"
const params = "?EIO=4&transport=websocket";
const payloadTest = `42["setUniqueId","${UniqueId}",{"processInitialData":false,"channelId":160258,"auth":"b82db0e687340af0cf0ea373ca792573","forceReconnect":true}]`;
async function connect(payload: string) {
    // test url : wss://tikfinity-cws-04.zerody.one/socket.io/?EIO=4&transport=websocket    
    // Definir los mensajes según el protocolo de Socket.io
    const engineIoGuiño = "40"; // Mensaje de conexión de Engine.io
    const socket = new WebSocket(`${baseUrl}${params}`);

    socket.onopen = () => {
        console.log("✅ WebSocket conectado");

        // 2. Enviar el mensaje de apertura de Socket.io (40)
        socket.send(engineIoGuiño);
        
        // 3. Enviar el evento específico (42 + JSON)
        // Nota: A veces el servidor espera unos milisegundos después del "40"
        setTimeout(() => {
            socket.send(payload);
            console.log("🚀 Evento enviado");
        }, 500);
    };

    socket.onmessage = (event) => {
        console.log("📩 Mensaje recibido:", event.data);

        // Manejo de PING/PONG (Socket.io lo requiere para no desconectarse)
        if (event.data === "2") {
            socket.send("3"); // Responder al ping del servidor
            console.log("💓 Heartbeat: PONG enviado");
        }
    };

    socket.onerror = (error) => {
        console.error("❌ Error en WS:", error);
    };

    socket.onclose = () => {
        console.log("🔌 Conexión cerrada");
    };
}
(async () => {
    const roomId = await getRoomId(UniqueId);
    console.log("Room ID:", roomId);
    
})(); */
export class webclass extends Plugin {
    name = "webview";
    version = "1.0.0";

    override onLoad(context: PluginContext) {
        console.log("webview plugin loaded");
        context.emit('load:webview',{});
    }

    open({url, debug = true}: {url:string, debug?:boolean}){
        const app = new Application();
        const window = app.createBrowserWindow();
        const webview = window.createWebview();
        if (!url) return undefined;
        const web = webview.loadUrl(url);
        console.log("Opening webview with URL:", url,webview);
        app.run();
        return web;
    }
};
/* const newclass = new webclass();
newclass.open({url: "https://tikfinity.zerody.one/"}); */