import type { IPlugin, PluginContext } from "bun_plugins";
import type { ActionRegistry } from "trigger_system/node";
import { validate } from "./helpers";
export interface ActionRegistryApi {
  register: ActionRegistry["register"];
  get: ActionRegistry["get"];
  registry: ActionRegistry;
  registerHelper: (name: string, fn: Function) => void;
  getHelpers: () => Record<string, Function>;
}
const server = Bun.serve({
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: {
        socketId: Math.random(),
      },
    });
    if (success) return undefined;
  },
  websocket: {
    data: {} as { socketId: number },
    async message(ws, message) {
        if (!validate.isWithinSize(message, 10_000_000)) return;
        const data = validate.safeParse(message);
        if (validate.isRecord(data) && validate.hasProps(data, ["type", "data"])) {
            console.log("type",data.type,validate.safeLog(data.type,data.data))
        }
    },
  },
});

console.log("server",server.url)
export class wsplugin implements IPlugin {
  name = "websocket";
  version = "1.0.0";

  constructor() {
  }

  onLoad(context: PluginContext): void {
    //const registryPlugin = context.manager.getPlugin("action-registry");
    context.emit('ws',{message:"hola"})
/*     if (registryPlugin?.getSharedApi) {
      const api = registryPlugin.getSharedApi() as ActionRegistryApi;
      
      // Registrar acción
      api.registry.register("ws", (action, ctx) => {
        console.log("[ws 123123123412]", action, ctx);
        return "ws";
      });

    } */

    context.log.info("mcplugin inicializado");
  }

  onUnload(): void {
    console.log("mcplugin descargado");
  }
}
// tests ws send message
const ws = new WebSocket("ws://localhost:3000");
ws.onopen = () => {
  ws.send("Hello");
};