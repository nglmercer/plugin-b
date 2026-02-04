import {
  TIKTOK_CONSTANTS,
  LOG_MESSAGES,
  TIMING,
  WS_CONSTANTS,
} from "../../src/constants";

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
  public socket: WebSocket | null = null;
  private payload: string;
  private emitter?: Emitter;
  private options: Required<ConnectionOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: Timer | null = null;
  private isManuallyClosed = false;
  private iomsg = TIKTOK_CONSTANTS.ENGINE_IO_MESSAGE;
  private heartbeatTimer: Timer | null = null;
  private isEngineIoOpen = false;

  constructor(payload: string, emitter?: Emitter, options: ConnectionOptions = {}) {
    this.payload = payload;
    this.emitter = emitter;
    this.options = {
      reconnect: options.reconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? WS_CONSTANTS.MAX_RECONNECT_ATTEMPTS,
      reconnectDelay: options.reconnectDelay ?? TIMING.RECONNECT_DELAY,
      maxReconnectDelay: options.maxReconnectDelay ?? TIMING.MAX_RECONNECT_DELAY,
    };
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log(LOG_MESSAGES.WEBSOCKET.ALREADY_OPEN);
      return;
    }

    this.isManuallyClosed = false;
    console.log(LOG_MESSAGES.WEBSOCKET.CONNECTING(this.reconnectAttempts + 1));

    this.socket = new WebSocket(
      `${TIKTOK_CONSTANTS.WEBSOCKET_URL}${TIKTOK_CONSTANTS.WEBSOCKET_PARAMS}`
    );

    this.socket.onopen = () => {
      console.log(LOG_MESSAGES.WEBSOCKET.OPEN);
      this.reconnectAttempts = 0;
      this.isEngineIoOpen = false;

      // Iniciar Heartbeat automático
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      this.emitter?.(event.data);

      // Manejo de Heartbeat Socket.io (paquete tipo 2)
      const data = event.data;
      if (data === '2' || data === '2"probe"' || data.startsWith('2')) {
        this.socket?.send('3'); // Pong response
        return;
      }

      // Detectar cuando el servidor confirmó la conexión (paquete 40)
      if (data === '40' || data.startsWith('40')) {
        this.isEngineIoOpen = true;
        // Enviar el payload después de que el servidor confirmó
        setTimeout(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket?.send(this.payload);
            console.log(LOG_MESSAGES.WEBSOCKET.PAYLOAD_SENT);
          }
        }, TIMING.PAYLOAD_SEND_DELAY);
      }
    };

    this.socket.onerror = (error) => {
      console.error({ wsError: error });
    };

    this.socket.onclose = (event) => {
      console.log(event.reason,event.code);

      this.socket = null;

      // Intentar reconectar si no fue cierre manual
      if (!this.isManuallyClosed && this.options.reconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error(LOG_MESSAGES.WEBSOCKET.MAX_RECONNECT);
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

    console.log(
      LOG_MESSAGES.WEBSOCKET.RECONNECTING(finalDelay, this.reconnectAttempts, this.options.maxReconnectAttempts)
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, finalDelay);
  }

  private startHeartbeat(): void {
    // Detener heartbeat anterior si existe
    this.stopHeartbeat();

    // Enviar heartbeat cada 20 segundos (intervalo recomendado para Socket.io)
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN && this.isEngineIoOpen) {
        this.socket?.send('2');
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    this.isManuallyClosed = true;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close(WS_CONSTANTS.CLOSE_CODE_NORMAL, LOG_MESSAGES.WEBSOCKET.MANUAL_CLOSE);
      this.socket = null;
    }

    console.log(LOG_MESSAGES.WEBSOCKET.DISCONNECTED);
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  updatePayload(newPayload: string): void {
    this.payload = newPayload;
    console.log(LOG_MESSAGES.WEBSOCKET.UPDATING_PAYLOAD);
    this.socket?.send(newPayload);
    console.log(LOG_MESSAGES.WEBSOCKET.NEW_PAYLOAD_SENT);
  }
}

export async function connect(
  payload: string,
  emitter?: Emitter,
  options?: ConnectionOptions
): Promise<TikTokWebSocket> {
  const ws = new TikTokWebSocket(payload, emitter, options);
  ws.connect();
  return ws;
}

export { TikTokWebSocket };
