import type { IPlugin, PluginContext } from "bun_plugins";
import { PLUGIN_NAMES, ACTIONS, HELPERS,PLATFORMS } from "../src/constants";
import { getRegistryPlugin } from "./Interface/ActionRegistryApi";

export class saveDataPlugin implements IPlugin {
  name = PLUGIN_NAMES.RULE_TESTER;
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
      Object.values(PLATFORMS).forEach((platform) => {
        console.log("events", platform);
        this.context?.on(platform, ({ eventName, data }) => {
          //console.log({ eventName, data });
          if (!this.save)return;
          if (!eventName || !data) {
            return;
          }
          this.context?.storage.set(`${platform}:${eventName}`,data)
        });
      });
  }
  
  onUnload() {
    
  }


}
