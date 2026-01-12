import type { IPlugin, PluginContext } from "bun_plugins";
import type { ActionRegistry } from "trigger_system/node";

interface ActionRegistryApi extends IPlugin {
  register: ActionRegistry["register"];
  get: ActionRegistry["get"];
  registry: ActionRegistry;
  registerHelper: (name: string, fn: Function) => void;
  getHelpers: () => Record<string, Function>;
}

export class mcplugin implements IPlugin {
  name = "mcplugin";
  version = "1.0.0";

  constructor() {
  }

  async onLoad(context: PluginContext): Promise<void> {
    const registryPlugin = await context.getPlugin("action-registry") as ActionRegistryApi;
    
    if (!registryPlugin) return;
    
      
      // Registrar acción
      registryPlugin.registry.register("mc", (action, ctx) => {
        console.log("[mc 123123123412]", action, ctx);
        return "mc";
      });

      // Registrar helper global
      if (registryPlugin.registerHelper) {
        registryPlugin.registerHelper("mcHelper", (text: string) => {
          return `MC-PREFIX: ${text}`;
        });
        context.log.info("mcHelper registrado");
      }


  }

  onUnload(): void {
    console.log("mcplugin descargado");
  }
}
