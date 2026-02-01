import type { IPlugin, PluginContext } from "bun_plugins";
import type { ActionRegistry } from "trigger_system/node";
import { PLUGIN_NAMES, ACTIONS, HELPERS } from "../src/constants";

interface ActionRegistryApi extends IPlugin {
  register: ActionRegistry["register"];
  get: ActionRegistry["get"];
  registry: ActionRegistry;
  registerHelper: (name: string, fn: Function) => void;
  getHelpers: () => Record<string, Function>;
}

export class mcplugin implements IPlugin {
  name = PLUGIN_NAMES.MCPLUGIN;
  version = "1.0.0";

  constructor() {}

  async onLoad(context: PluginContext): Promise<void> {
    const registryPlugin = (await context.getPlugin(
      PLUGIN_NAMES.ACTION_REGISTRY
    )) as ActionRegistryApi;

    if (!registryPlugin) return;

    // Registrar acción
    registryPlugin.registry.register(ACTIONS.MC, (action, ctx) => {
      console.log("[mc 123123123412]", action, ctx);
      return ACTIONS.MC;
    });

    // Registrar helper global
    if (registryPlugin.registerHelper) {
      registryPlugin.registerHelper(HELPERS.MC_HELPER, (text: string) => {
        return `MC-PREFIX: ${text}`;
      });
      context.log.info(`${HELPERS.MC_HELPER} registrado`);
    }
  }

  onUnload(): void {
    console.log("mcplugin descargado");
  }
}
