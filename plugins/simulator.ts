import type { IPlugin, PluginContext } from "bun_plugins";
import { PLUGIN_NAMES, ACTIONS, PLATFORMS } from "../src/constants";
import { getRegistryPlugin } from "./Interface/ActionRegistryApi";
import * as path from "path";

/**
 * Simulator Plugin
 * Allows injecting events into the system using saved JSON data.
 * Useful for testing rules without needing real platform events.
 */
export class simulatorPlugin implements IPlugin {
  name = "simulator";
  version = "1.0.0";
  private context?: PluginContext;
  private enabled: boolean = true;

  async onLoad(context: PluginContext) {
    this.context = context;
    const registryPlugin = await getRegistryPlugin(context);
    if (!registryPlugin) {
      console.error("[Simulator] Could not find ActionRegistry plugin");
      return;
    }

    /**
     * Action: emitEvent
     * Params:
     * - eventName: The name of the event to simulate (e.g., "chat", "gift")
     * - filePath: Path to the JSON file containing the event data
     * - platform: (Optional) The platform to emit on (defaults to tiktok)
     */
    registryPlugin.registry.register(ACTIONS.EMIT_EVENT, async (action) => {
      if (!this.enabled) {
        console.log("[Simulator] Simulator is disabled");
        return false;
      }

      const eventName = String(action?.params?.eventName || "");
      const filePath = String(action?.params?.filePath || "");
      const platform = String(action?.params?.platform || PLATFORMS.TIKTOK) as any;

      if (!eventName || !filePath) {
        console.error("[Simulator] Missing required params: eventName and filePath");
        return false;
      }

      try {
        // Resolve path relative to current working directory if not absolute
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
          
        const file = Bun.file(absolutePath);
        if (!(await file.exists())) {
          console.error(`[Simulator] Data file not found at: ${absolutePath}`);
          return false;
        }

        const data = await file.json();
        console.log(`[Simulator] 🚀 Simulating event "${eventName}" on platform "${platform}"`);
        console.log(`[Simulator] Using data from: ${absolutePath}`);

        // Emit the event to the PluginManager/System
        // This will be picked up by the main event loop and processed by the RuleEngine
        this.context?.emit(platform, { eventName, data });

        return true;
      } catch (error) {
        console.error(`[Simulator] ❌ Error during event simulation:`, error);
        return false;
      }
    });

    /**
     * Action: toggle_simulator
     * Params:
     * - enabled: boolean (optional, toggles if not provided)
     */
    registryPlugin.registry.register("toggle_simulator", (action) => {
      const value = action?.params?.enabled;
      if (typeof value === "boolean") {
        this.enabled = value;
      } else {
        this.enabled = !this.enabled;
      }
      console.log(`[Simulator] Simulator is now ${this.enabled ? "ENABLED" : "DISABLED"}`);
      return this.enabled;
    });

    console.log(`[Simulator] Plugin loaded. Action "${ACTIONS.SEVENT}" registered.`);
  }

  onUnload() {
    console.log("[Simulator] Plugin unloaded");
  }
}
