import { RuleEngine, ActionRegistry, TriggerLoader } from "trigger_system/node";
import { BasePluginManager } from "./services/plugin";
import { ensureDir, getBaseDir } from "../utils/filepath";
import { ActionRegistryPlugin } from "./services/RegisterPlugin";
import * as path from "path";
import { PLATFORMS, PLUGIN_NAMES, PATHS, LOG_MESSAGES } from "./constants";

const manager = new BasePluginManager();

async function main() {
  const registry = ActionRegistry.getInstance();
  await manager.loadDefaultPlugins();
  const engine = manager.engine;

  const registryPlugin = (await manager.getPlugin(
    PLUGIN_NAMES.ACTION_REGISTRY
  )) as ActionRegistryPlugin;
  const pluginHelpers = registryPlugin.Helpers || {};

  console.log("[MAIN]", Object.values(PLATFORMS));
  Object.values(PLATFORMS).forEach((platform) => {
    manager.on(platform, ({ eventName, data }) => {
      //console.log({ eventName, data });
      if (!eventName || !data) {
        return;
      }
      engine.processEventSimple(eventName, data, pluginHelpers);
    });
  });

  // El plugin siempre emite { eventName, data } (datos raw por defecto)
  /* manager.on('tiktok', ({ eventName, data }) => {
        if (!eventName || !data) {
            return;
        }
        engine.processEventSimple(eventName, data);
    }); */

  const rulesDir = path.resolve(getBaseDir(), PATHS.RULES_DIR);
  const result = ensureDir(rulesDir);

  //watcher se ejecuta despues o demora al inicializar que los demas eventos
  const watcher = TriggerLoader.watchRules(rulesDir, async (newRules) => {
    engine.updateRules(newRules);
    const ruleIds = engine.getRules().map((r) => r.id);
    const loadedPlugins = manager.listPlugins();
    console.log({
      loadedPlugins,
      ruleIds,
      length: newRules.length,
    });

  });
  watcher.on("error", (err) => {
    console.error("Error watching rules:", err);
  });

  return result;
}

main()
  .then((data) => console.log(data))
  .catch((err) => console.log(err));

process.on("SIGINT", () => {
  console.log(LOG_MESSAGES.SHUTDOWN);
  process.exit(0);
});
