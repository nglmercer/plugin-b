import { definePlugin, PluginContext } from "bun_plugins";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { connect, TikTokWebSocket } from "./tiktok/websocket";
import { parseSocketIo42Message, SocketIoMessage } from "../utils/parsejson";
import { getBaseDir } from "../utils/filepath";
import {
  LOG_MESSAGES,
  TIKTOK_CONSTANTS,
  PATHS,
  PLATFORMS,
} from "../src/constants";

// Referencia global al proceso webview para poder controlarlo
let webviewProcess: ChildProcess | null = null;
// Referencia a la conexión WebSocket para poder cerrarla limpiamente
let wsConnection: TikTokWebSocket | null = null;

export default definePlugin({
  name: "tikfinity",
  version: "1.0.0",
  onLoad: async (context: PluginContext) => {
    console.log(LOG_MESSAGES.WEBVIEW.STARTED);

    // Ruta al script del proceso webview
    // En desarrollo: scripts/tikfinity-webview.ts
    // En producción (compilado): dist/scripts/tikfinity-webview.ts (relativo al ejecutable)
    const baseScript = path.join(getBaseDir(), PATHS.TIKFINITY_WEBVIEW_TS);
    const webviewScriptPath = await Bun.file(baseScript).exists()
      ? baseScript
      : path.join(getBaseDir(), PATHS.TIKFINITY_WEBVIEW_JS);

    // Iniciamos el proceso hijo con Bun
    // Bun puede ejecutar TypeScript directamente sin necesidad de compilar
    webviewProcess = spawn("bun", ["run", webviewScriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      detached: false,
    });

    let webviewClosed = false;

    // Escuchar la salida del proceso hijo para recibir el payload
    if (webviewProcess.stdout) {
      webviewProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(TIKTOK_CONSTANTS.EVENT_MESSAGE, output);

        // Verificar si es el payload de TikFinity
        if (output.includes(TIKTOK_CONSTANTS.PAYLOAD_PREFIX)) {
          const payload = output.replace(TIKTOK_CONSTANTS.PAYLOAD_PREFIX, "").trim();

          // Si ya existe una conexión activa, actualizar el payload (cambiar de canal)
          if (wsConnection?.isConnected()) {
            console.log(LOG_MESSAGES.TIKFINITY.CONNECTION_EXISTS);
            wsConnection.updatePayload(payload);
            return;
          }

          // Cerrar conexión anterior si existe pero no está conectada
          if (wsConnection) {
            wsConnection.disconnect();
          }

          connect(payload, (message) => {
            // Por defecto: procesar mensaje raw y emitir como { eventName, data }
            const info = SocketIoMessage(message);
            if (!message || !info) return;
            //temporal, not definitive for better filter
            if (info.engineType?.length !== 1) {
              console.log({ invalidtype: info.engineType });
            }
            const data = parseSocketIo42Message(message);
            if (!data || !data.eventName) {
              console.log(info);
              return;
            }
            const eventName = data.eventName;
            const eventData = data?.data || message;
            context.emit(PLATFORMS.TIKTOK, {
              eventName,
              data: eventData,
            });
          }).then((ws) => {
            wsConnection = ws;
          });

          webviewClosed = true;
        }
      });
    }

    // Escuchar errores del proceso hijo
    if (webviewProcess.stderr) {
      webviewProcess.stderr.on("data", (data) => {
        console.error(LOG_MESSAGES.WEBVIEW.ERROR, data.toString());
      });
    }

    // Manejar el cierre del proceso hijo
    webviewProcess.on("close", (code) => {
      console.log(LOG_MESSAGES.WEBVIEW.CLOSED, code);
      webviewClosed = true;
      webviewProcess = null;
    });

    // Manejar errores de spawn
    webviewProcess.on("error", (error) => {
      console.error(LOG_MESSAGES.WEBVIEW.ERROR, error);
      webviewProcess = null;
    });

    console.log(LOG_MESSAGES.WEBVIEW.STARTED);
  },
  onUnload: () => {
    console.log(LOG_MESSAGES.WEBVIEW.ON_UNLOAD);

    // Cerrar la conexión WebSocket si existe
    if (wsConnection) {
      console.log(LOG_MESSAGES.TIKFINITY.CLOSING_WS);
      wsConnection.disconnect();
      wsConnection = null;
    }

    // Cerramos el proceso webview si aún está activo
    if (webviewProcess) {
      console.log(LOG_MESSAGES.WEBVIEW.CLOSING);
      webviewProcess.kill();
      webviewProcess = null;
    }
  },
});
