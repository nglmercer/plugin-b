import { Application } from "webview-napi";
import {
  LOG_MESSAGES,
  TIKTOK_CONSTANTS,
  PATHS,
  PLATFORMS,
} from "../src/constants";
const injectionScript = `
    (function () {
        // Almacenamiento global de datos capturados
        window.capturedWSData = {
            connections: [],
            messages: []
        };
        
        // Guardar referencia original del WebSocket
        const OriginalWebSocket = window.WebSocket;
        
        // Sobrescribir el constructor de WebSocket
        window.WebSocket = function(url, protocols) {
            console.log('[WS Interceptor] Nueva conexión a:', url);
            
            // Guardar información de la conexión
            const connectionInfo = {
                url: url,
                connectedAt: new Date().toISOString()
            };
            window.capturedWSData.connections.push(connectionInfo);
            
            // Crear instancia real del WebSocket
            const wsInstance = new OriginalWebSocket(url, protocols);
            
            // Interceptar mensajes ENVIADOS
            const originalSend = wsInstance.send;
            wsInstance.send = function(data) {
                const messageData = {
                    url: url,
                    direction: 'SENT',
                    content: data,
                    timestamp: new Date().toISOString(),
                    type: typeof data
                };
                
                // Guardar en memoria
                window.capturedWSData.messages.push(messageData);
                
                // Log en consola
                console.log('[WS Interceptor] Mensaje enviado:', messageData);
                
                // Enviar al proceso principal (si existe)
                if (window.ipc && typeof window.ipc.postMessage === 'function') {
                    window.ipc.postMessage(JSON.stringify(messageData));
                }
                
                // Ejecutar el send original
                return originalSend.apply(this, arguments);
            };
            
            // Interceptar mensajes RECIBIDOS
            wsInstance.addEventListener('message', function(event) {
                const messageData = {
                    url: url,
                    direction: 'RECEIVED',
                    content: event.data,
                    timestamp: new Date().toISOString(),
                    type: typeof event.data
                };
                
                // Guardar en memoria
                window.capturedWSData.messages.push(messageData);
                
                // Log en consola
                console.log('[WS Interceptor] Mensaje recibido:', messageData);
                
                // Enviar al proceso principal (si existe)
                if (window.ipc && typeof window.ipc.postMessage === 'function') {
                    window.ipc.postMessage(JSON.stringify(messageData));
                }
            });
            
            // Interceptar eventos de conexión
            wsInstance.addEventListener('open', function(event) {
                console.log('[WS Interceptor] Conexión abierta:', url);
            });
            
            wsInstance.addEventListener('close', function(event) {
                console.log('[WS Interceptor] Conexión cerrada:', url, 'Código:', event.code);
            });
            
            wsInstance.addEventListener('error', function(event) {
                console.error('[WS Interceptor] Error en conexión:', url);
            });
            
            return wsInstance;
        };
        
        // Mantener las propiedades estáticas del WebSocket original
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
        window.WebSocket.OPEN = OriginalWebSocket.OPEN;
        window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
        window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
        
        // Función auxiliar para obtener datos capturados
        window.getWSData = function() {
            return window.capturedWSData;
        };
        
        // Función auxiliar para filtrar por URL
        window.getWSDataByURL = function(urlPattern) {
            return window.capturedWSData.messages.filter(msg => 
                msg.url.includes(urlPattern)
            );
        };
        
        // Función auxiliar para limpiar datos
        window.clearWSData = function() {
            window.capturedWSData = {
                connections: [],
                messages: []
            };
            console.log('[WS Interceptor] Datos limpiados');
        };
        
        console.log('[WS Interceptor] Inicializado correctamente');
    })();
`;

async function startWebview() {
  console.log("🔌 Iniciando proceso webview TikFinity...");

  const app = new Application();
  const window = app.createBrowserWindow({
    title: "TikTok Login - Sincronizando TikFinity",
    width: 500,
    height: 700,
  });

  const webview = window.createWebview({
    preload: injectionScript,
    url: "https://tikfinity.zerody.one/",
    enableDevtools: true,
  });

webview.onIpcMessage((_e, message) => {
    try {
        // Convertir el Buffer a texto
        const rawMessage = message.toString();
        
        // Parsear el JSON que viene del script
        const messageData = JSON.parse(rawMessage);
        
        // Extraer información del mensaje
        const { url, direction, content, timestamp } = messageData;
        
        console.log(`[${direction}] ${url} - ${timestamp}`);
        
        // Procesar según el contenido o la URL
        if (content.includes("setUniqueId")) {            
            // Enviar a stdout con el formato que necesites
            process.stdout.write(`${TIKTOK_CONSTANTS.PAYLOAD_PREFIX}${content}\n`);
        }
        
        // También puedes filtrar por URL específica
        if (url.includes("zerody.one/socket.io/?EIO=4&transport=websocket")) {
          if (direction !== 'SENT')return;
            process.stdout.write(content)
        }
        
    } catch (error) {
        const payload = message.toString();
        console.log({error,payload})
    }
});

  app.onEvent((_e, event) => {
    console.log("event", event);
  });

  const poll = () => {
    if (app.runIteration()) {
      window.id;
      webview.id;
      setTimeout(poll, 10);
    } else {
      process.exit(0);
    }
  };
  poll();
}

startWebview();
