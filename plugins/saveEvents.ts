import type { IPlugin, PluginContext } from "bun_plugins";
import type { RuleEngine,ActionRegistry,ActionHandler } from "trigger_system/node";
import { PLUGIN_NAMES, ERROR_MESSAGES } from "../src/constants";

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


}
