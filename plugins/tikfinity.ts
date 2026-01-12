import { definePlugin, PluginContext } from "bun_plugins";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { connect } from "./tiktok/websocket";
// Referencia global al proceso webview para poder controlarlo
let webviewProcess: ChildProcess | null = null;
const logsMap = {
    closed: 'closed webview process',
    error: 'error webview',
    onUnload: 'on unload plugin',
    started: 'started webview process',
    closing: 'closing webview process',
} as const;
const Tiktok = {
    logged: 'tikfinity_logged',
    msg: 'tikfinity_msg',
    Payload: 'TikFinity_PAYLOAD:'
} as const;
export default definePlugin({
    name: "tikfinity",
    version: "1.0.0",
    onLoad: async (context: PluginContext) => {
        console.log(logsMap.started);

        // Ruta al script del proceso webview
        const webviewScriptPath = path.join(__dirname, '../scripts/tikfinity-webview.ts');
        
        // Iniciamos el proceso hijo con Bun
        // Bun puede ejecutar TypeScript directamente sin necesidad de compilar
        webviewProcess = spawn('bun', ['run', webviewScriptPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
            detached: false
        });

        let webviewClosed = false;

        // Escuchar la salida del proceso hijo para recibir el payload
        if (webviewProcess.stdout) {
            webviewProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(Tiktok.msg, output);
                
                // Verificar si es el payload de TikFinity
                if (output.includes(Tiktok.Payload)) {
                    const payload = output.replace(Tiktok.Payload, '').trim();
                    console.log(Tiktok.logged);
                    console.log("PAYLOAD:", payload);
                    connect(payload, (message) => {
                        context.emit('tiktok', message);
                    });                
                    webviewClosed = true;
                }
            });
        }

        // Escuchar errores del proceso hijo
        if (webviewProcess.stderr) {
            webviewProcess.stderr.on('data', (data) => {
                console.error(logsMap.error, data.toString());
            });
        }

        // Manejar el cierre del proceso hijo
        webviewProcess.on('close', (code) => {
            console.log(logsMap.closed,code);
            webviewClosed = true;
            webviewProcess = null;
        });

        // Manejar errores de spawn
        webviewProcess.on('error', (error) => {
            console.error(logsMap.error, error);
            webviewProcess = null;
        });

        console.log(logsMap.started);
    },
    onUnload: () => {
        console.log(logsMap.onUnload);
        // Cerramos el proceso webview si aún está activo
        if (webviewProcess) {
            console.log(logsMap.closing);
            webviewProcess.kill();
            webviewProcess = null;
        }
    }
});