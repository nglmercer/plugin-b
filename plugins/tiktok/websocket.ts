const baseUrl = "wss://tikfinity-cws-04.zerody.one/socket.io/";
const UniqueId = "anyelouwu"
const params = "?EIO=4&transport=websocket";
const payloadTest = `42["setUniqueId","${UniqueId}",{"processInitialData":false,"channelId":160258,"auth":"b82db0e687340af0cf0ea373ca792573","forceReconnect":true}]`;

interface Emitter {
    (message: string): void;
}

interface ConnectionOptions {
    reconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    maxReconnectDelay?: number;
}

class TikTokWebSocket {
    private socket: WebSocket | null = null;
    private payload: string;
    private emitter?: Emitter;
    private options: Required<ConnectionOptions>;
    private reconnectAttempts = 0;
    private reconnectTimer: Timer | null = null;
    private isManuallyClosed = false;
    private iomsg = "40";

    constructor(payload: string, emitter?: Emitter, options: ConnectionOptions = {}) {
        this.payload = payload;
        this.emitter = emitter;
        this.options = {
            reconnect: options.reconnect ?? true,
            maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
            reconnectDelay: options.reconnectDelay ?? 1000,
            maxReconnectDelay: options.maxReconnectDelay ?? 30000,
        };
    }

    connect(): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log("⚠️ WebSocket ya está conectado");
            return;
        }

        this.isManuallyClosed = false;
        console.log(`🔄 Intentando conectar... (intento ${this.reconnectAttempts + 1})`);

        this.socket = new WebSocket(`${baseUrl}${params}`);

        this.socket.onopen = () => {
            console.log("✅ WebSocket conectado");
            this.reconnectAttempts = 0;

            // Enviar mensaje de conexión de Engine.io
            this.socket?.send(this.iomsg);

            // Enviar el evento específico después de un delay
            setTimeout(() => {
                this.socket?.send(this.payload);
                console.log("📤 Evento enviado");
            }, 500);
        };

        this.socket.onmessage = (event) => {
            this.emitter?.(event.data);

            // Manejo de PING/PONG (Socket.io lo requiere para no desconectarse)
            if (event.data === "2") {
                this.socket?.send("3");
            }
        };

        this.socket.onerror = (error) => {
            console.error("❌ Error en WS:", error);
        };

        this.socket.onclose = (event) => {
            console.log("🔌 Conexión cerrada");
            console.log("  Código:", event.code);
            console.log("  Razón:", event.reason || "(sin razón)");
            console.log("  ¿Fue limpio?:", event.wasClean);

            this.socket = null;

            // Intentar reconectar si no fue cierre manual
            if (!this.isManuallyClosed && this.options.reconnect) {
                this.scheduleReconnect();
            }
        };
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.error("❌ Máximo de intentos de reconexión alcanzado");
            return;
        }

        this.reconnectAttempts++;

        // Backoff exponencial con jitter
        const delay = Math.min(
            this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.options.maxReconnectDelay
        );
        const jitter = Math.random() * 1000;
        const finalDelay = delay + jitter;

        console.log(`⏳ Reconectando en ${Math.round(finalDelay)}ms... (intento ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, finalDelay);
    }

    disconnect(): void {
        this.isManuallyClosed = true;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.close(1000, "Cierre manual");
            this.socket = null;
        }

        console.log("👋 WebSocket desconectado manualmente");
    }

    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}

export async function connect(payload: string, emitter?: Emitter, options?: ConnectionOptions): Promise<TikTokWebSocket> {
    const ws = new TikTokWebSocket(payload, emitter, options);
    ws.connect();
    return ws;
}

export { TikTokWebSocket };
export type { ConnectionOptions };

// Example usage:
// const ws = await connect(payloadTest, (msg) => console.log(msg));
// ws.disconnect(); // Para cerrar manualmente
