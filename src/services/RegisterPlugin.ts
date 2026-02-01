import type { IPlugin, PluginContext } from "bun_plugins";
import { ActionRegistry } from "trigger_system/node";
import { TTScleaner } from "./cleaner";
import { PLUGIN_NAMES, HELPERS } from "../constants";

/**
 * Registro simple para funciones auxiliares (helpers/globals)
 */
class HelperRegistry {
  private static instance: HelperRegistry;
  private helpers: Record<string, Function> = {};

  private constructor() {}

  static getInstance(): HelperRegistry {
    if (!HelperRegistry.instance) {
      HelperRegistry.instance = new HelperRegistry();
    }
    return HelperRegistry.instance;
  }

  register(name: string, fn: Function) {
    this.helpers[name] = fn;
    console.log(`[HelperRegistry] Helper registrado: ${name}`);
  }

  getHelpers() {
    return { ...this.helpers };
  }
}

export class ActionRegistryPlugin implements IPlugin {
  name = PLUGIN_NAMES.ACTION_REGISTRY;
  version = "1.0.0";

  private get registry() {
    return ActionRegistry.getInstance();
  }

  private get helperRegistry() {
    return HelperRegistry.getInstance();
  }

  constructor() {
    console.log(`${this.name} v${this.version}`);
    this.getSharedApi = this.getSharedApi.bind(this);
  }

  onLoad(context: PluginContext) {
    console.log(`${this.name} v${this.version} onLoad`);

    // Registrar helpers básicos por defecto
    this.helperRegistry.register(HELPERS.LAST, () => {
      const history = TTScleaner.getMessageHistory();
      const lastItem = history[history.length - 1];
      return lastItem ? lastItem.cleanedText : "";
    });

    this.helperRegistry.register(HELPERS.CLEAN, (t: any) => {
      return TTScleaner.cleanOnly(String(t || ""));
    });
  }

  onUnload() {
    console.log(`${this.name} v${this.version} onUnload`);
  }

  getSharedApi() {
    const registry = this.registry;
    const helperRegistry = this.helperRegistry;
    return {
      register: registry.register.bind(registry),
      get: registry.get.bind(registry),
      registry: registry,
      registerHelper: helperRegistry.register.bind(helperRegistry),
      getHelpers: helperRegistry.getHelpers.bind(helperRegistry),
    };
  }
  get Helpers() {
    return this.helperRegistry.getHelpers();
  }
}
