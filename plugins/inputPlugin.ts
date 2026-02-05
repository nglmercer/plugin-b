import type { IPlugin, PluginContext } from "bun_plugins";
import { PLUGIN_NAMES, ACTIONS, HELPERS,PLATFORMS } from "../src/constants";
import { getRegistryPlugin } from "./Interface/ActionRegistryApi";
import { startListener,simulateEvent,EventTypeValue,stringKeyToKeycode } from "rdev-node";
export class inputPlugin implements IPlugin {
  name = "input-plugin";
  version = "1.0.0";
  private context?: PluginContext;
  private save?: boolean = true;

  async onLoad(context: PluginContext) {
    this.context = context;
    const registryPlugin = await getRegistryPlugin(context);
    if (!registryPlugin) return;
    registryPlugin.registry.register(ACTIONS.SEVENT, (action, ctx) => {
        const keysParam = action?.params?.keys || action?.params?.key;
        const type = String(action?.params?.type || "Tap"); 
        
        if (!keysParam) {
            console.warn("[InputPlugin] No keys provided for simulation");
            return false;
        }

        const keys = Array.isArray(keysParam) ? keysParam : [String(keysParam)];

        for (const keyItem of keys) {
            const keyName = String(keyItem || "");
            const key = stringKeyToKeycode(keyName);
            if (!key) {
                console.error(`[InputPlugin] Invalid key name: ${keyName}`);
                continue;
            }

            if (type === "KeyPress" || type === "Tap") {
                simulateEvent({
                    eventType: EventTypeValue.KeyPress,
                    time: 0,
                    keyPress: { key }
                });
            }

            if (type === "KeyRelease" || type === "Tap") {
                simulateEvent({
                    eventType: EventTypeValue.KeyRelease,
                    time: 0,
                    keyRelease: { key }
                });
            }
        }
        return true;
    });
    startListener((input)=>{
      const {eventType,keyPress} = input;
        if (eventType === EventTypeValue.KeyPress){
          if (!keyPress) return input;
          if (keyPress.key === stringKeyToKeycode("space")){
            
            // TODO: implement event emition
            /*
            - id: trigger-test-chat
                on: test_trigger
                do:
                  actions:
                    - type: emitEvent
                      params:
                        eventName: chat
                        filePath: data/chat.json
                        platform: tiktok
            */
           //engine.emulate engine.processEventSimple('test_trigger', {}, {});
          }
        }
        return input
    })
  }
  
  onUnload() {
    
  }


}
