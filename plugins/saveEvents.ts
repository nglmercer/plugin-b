import type { IPlugin, PluginContext } from "bun_plugins";
import { PLUGIN_NAMES, ACTIONS, HELPERS,PLATFORMS } from "../src/constants";
import { getRegistryPlugin } from "./Interface/ActionRegistryApi";

export class saveDataPlugin implements IPlugin {
  name = PLUGIN_NAMES.SAVE_EVENTS;
  version = "1.0.0";
  private context?: PluginContext;
  private save?: boolean = true;

  async onLoad(context: PluginContext) {
    this.context = context;
    const registryPlugin = await getRegistryPlugin(context);
    if (!registryPlugin) return;

    registryPlugin.registry.register(ACTIONS.AUTOSAVE, (action, ctx) => {
      const msg = String(action?.params?.message);
      if (!msg)return;
      if (msg === 'true' || msg === '1'){
        this.save = true
      }else {this.save = false}
      return this.save;
    });
      console.log(this.name, Object.values(PLATFORMS));
      Object.values(PLATFORMS).forEach((platform) => {
        this.context?.on(platform, async ({ eventName, data }) => {
          if (!this.save) return;
          if (!eventName || data == null) return;

          try {
            let parsedData = data;
            if (typeof data === 'string') {
              parsedData = JSON.parse(data);
            } 
            const filePath = `./data/${eventName}.json`;
            await Bun.write(filePath, JSON.stringify(parsedData, null, 2), { createPath: true });

          } catch (error) {
            console.error(`[Parser] Error guardando snapshot de ${eventName}:`, error);
          }
        });
      });
  }
  
  onUnload() {
    
  }


}
