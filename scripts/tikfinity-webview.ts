import { Application } from "webview-napi";

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
    // Convertimos el Buffer del cuerpo del mensaje a texto
    const payload = message.toString();

    console.log("🚀 Payload recibido desde el navegador:", payload);

    if (payload.includes("setUniqueId")) {
      console.log("✅ Credenciales capturadas con éxito");
      console.log("PAYLOAD:", payload);

      // Enviamos el payload al proceso padre a través de stdout
      process.stdout.write(`TikFinity_PAYLOAD:${payload}\n`);

      // Esperamos un momento para asegurar que el mensaje se envíe
      setTimeout(() => {
        //    app.exit();
      }, 100);
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
