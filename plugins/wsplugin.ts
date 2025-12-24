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

export class wsplugin implements IPlugin {
  name = "websocket";
  version = "1.0.0";

  constructor() {
  }

  onLoad(context: PluginContext): void {
    //const registryPlugin = context.manager.getPlugin("action-registry");
    //context.emit('ws',{message:"hola"})
/*     if (registryPlugin?.getSharedApi) {
      const api = registryPlugin.getSharedApi() as ActionRegistryApi;
      
      // Registrar acción
      api.registry.register("ws", (action, ctx) => {
        console.log("[ws 123123123412]", action, ctx);
        return "ws";
      });

    } */
    const testerPlugin = context.manager.getPlugin("rule-tester");
    const tester = testerPlugin?.getSharedApi ? (testerPlugin.getSharedApi() as any) : null;
    // Access the exposed engine from the manager
    const engine = (context.manager as any).engine;
    
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
                    if (Array.isArray(data.data) && tester?.testEvent && engine) {
                        console.log("data.data",data.data[0])
                        tester.testEvent(engine, data.data[0], data.data[1]);
                    
                    }
                }
            },
        },
    });
    console.log("server",server.url)
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