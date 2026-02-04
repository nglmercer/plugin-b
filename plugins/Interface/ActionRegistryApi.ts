import type { IPlugin,PluginContext } from "bun_plugins";
import type { ActionRegistry } from "trigger_system/node";
import { PLUGIN_NAMES } from "src/constants";
export interface ActionRegistryApi extends IPlugin {
  register: ActionRegistry["register"];
  get: ActionRegistry["get"];
  registry: ActionRegistry;
  registerHelper: (name: string, fn: Function) => void;
  getHelpers: () => Record<string, Function>;
}
export async function getRegistryPlugin(context: PluginContext){
    const registryPlugin = (await context.getPlugin(
      PLUGIN_NAMES.ACTION_REGISTRY
    )) as ActionRegistryApi;
    return registryPlugin
}