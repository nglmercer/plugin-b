import type { IPlugin, PluginContext } from "bun_plugins";
import type { RuleEngine,ActionRegistry,ActionHandler } from "trigger_system/node";
import { PLUGIN_NAMES, ERROR_MESSAGES } from "../src/constants";

/**
 * Plugin encargado de facilitar las pruebas de eventos
 */
/*
  getSharedApi() {
    const registry = this.registry;
    const helperRegistry = this.helperRegistry;
    return {
      register: registry.register.bind(registry),
      get: registry.get.bind(registry),
      registry: registry,
      registerHelper: helperRegistry.register.bind(helperRegistry),
      getHelpers: helperRegistry.getHelpers.bind(helperRegistry)
    };
  }
  export declare class ActionRegistry {
      private static instance;
      private handlers;
      private constructor();
      static getInstance(): ActionRegistry;
      register(type: string, handler: ActionHandler): void;
      get(type: string): ActionHandler | undefined;
      private registerDefaults;
  }
*/
interface ActionRegistryPlugin extends IPlugin {
  getSharedApi(): ActionRegistryApi;
}
interface ActionRegistryApi {
  register: (name: string, action: ActionHandler) => void;
  get: (name: string) => ActionHandler | undefined;
  registry: ActionRegistry;
  registerHelper: (name: string, helper: any) => void;
  getHelpers: () => Record<string, any>;
}

export class RuleTesterPlugin implements IPlugin {
  name = PLUGIN_NAMES.RULE_TESTER;
  version = "1.0.0";
  private context?: PluginContext;

  onLoad(context: PluginContext) {
    this.context = context;
    console.log(`✅ [RuleTesterPlugin] v${this.version} cargado`);
  }

  onUnload() {
    console.log("Shutting down RuleTesterPlugin");
  }

  /**
   * Procesa un evento utilizando el motor de reglas y los helpers registrados
   */
  async testEvent(engine: RuleEngine, event: string, data: any) {
    if (!this.context) throw new Error(ERROR_MESSAGES.PLUGIN.NOT_LOADED);

    const registryPlugin = await this.context.getPlugin(PLUGIN_NAMES.ACTION_REGISTRY) as ActionRegistryPlugin;
    const pluginHelpers = registryPlugin?.getSharedApi?.()?.getHelpers?.() || {};

    console.log(`TESTER: ${event}`);
    
    return await engine.processEvent({
      event: event,
      timestamp: Date.now(),
      data: data,
      globals: {
        ...pluginHelpers
      }
    });
  }

  getSharedApi() {
    return {
      testEvent: this.testEvent.bind(this)
    };
  }
}
