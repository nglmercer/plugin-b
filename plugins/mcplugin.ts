import type { IPlugin, PluginContext } from "bun_plugins";
import type { ActionRegistry } from "trigger_system/node";

interface ActionRegistryApi {
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

  onLoad(context: PluginContext): void {
    const registryPlugin = context.manager.getPlugin("action-registry");
    
    if (registryPlugin?.getSharedApi) {
      const api = registryPlugin.getSharedApi() as ActionRegistryApi;
      
      // Registrar acción
      api.registry.register("mc", (action, ctx) => {
        console.log("[mc 123123123412]", action, ctx);
        return "mc";
      });

      // Registrar helper global
      if (api.registerHelper) {
        api.registerHelper("mcHelper", (text: string) => {
          return `MC-PREFIX: ${text}`;
        });
        context.log.info("mcplugin: Helper 'mcHelper' registrado exitosamente");
      }
      
      context.log.info("mcplugin: Acción 'mc' registrada exitosamente");
    } else {
      context.log.warn("mcplugin: No se pudo encontrar ActionRegistryPlugin o su API");
    }

    context.log.info("mcplugin inicializado");
  }

  onUnload(): void {
    console.log("mcplugin descargado");
  }
}
