import type { IPlugin, PluginContext } from "bun_plugins";
import { initializeAI, runWithTools } from "./ai/index";
import { ActionRegistry } from "trigger_system/node";
import { ACTIONS, LOG_MESSAGES } from "../src/constants";

export class AIPlugin implements IPlugin {
  name = "ai-service";
  version = "1.0.0";

  async onLoad(context: PluginContext) {
    const { storage, log } = context;
    console.log(`${this.name} initialized`);

    // Initialize AI module
    const { lmStudio, database } = await initializeAI();
    if (!lmStudio || !database) {
      log.warn("AI module not fully available. LM Studio:", lmStudio, "Database:", database);
    } else {
      log.info("AI module initialized successfully");
    }

    const registry = ActionRegistry.getInstance();

    // Register AI_RESPOND action
    registry.register(ACTIONS.AI_RESPOND, async (action, ctx) => {
      console.log(`[${ACTIONS.AI_RESPOND}]`, action, Object.keys(ctx));
      if (!action.params?.prompt) {
        log.warn("No prompt provided for AI_RESPOND");
        return null;
      }

      const prompt = String(action.params.prompt);
      try {
        const response = await runWithTools(prompt);
        return response;
      } catch (error) {
        log.error("AI_RESPOND error:", error);
        return null;
      }
    });
  }

  onUnload() {}
}
