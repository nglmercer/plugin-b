import type { IPlugin, PluginContext } from "bun_plugins";
import type { RuleEngine } from "trigger_system/node";

/**
 * Plugin encargado de facilitar las pruebas de eventos
 */
export class RuleTesterPlugin implements IPlugin {
  name = "rule-tester";
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
    if (!this.context) throw new Error("Plugin no cargado");

    const registryPlugin = this.context.manager.getPlugin("action-registry") as any;
    const pluginHelpers = registryPlugin?.getSharedApi?.()?.getHelpers?.() || {};

    console.log(`🧪 [RuleTesterPlugin] Probando evento: ${event}`);
    
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
