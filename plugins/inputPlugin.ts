import type { IPlugin, PluginContext } from "bun_plugins";
import { PLUGIN_NAMES, ACTIONS, HELPERS,PLATFORMS } from "../src/constants";
import { getRegistryPlugin } from "./Interface/ActionRegistryApi";
import { startListener,simulateEvent,EventTypeValue,stringKeyToKeycode,type KeyCode } from "rdev-node";
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
    const spaceKey = stringKeyToKeycode("space");
    const alt = stringKeyToKeycode("alt");
    let pressed: KeyCode[] = [];
    startListener((input)=>{
      const {eventType,keyPress,keyRelease} = input;
        if (eventType === EventTypeValue.KeyPress){
          if (!keyPress) return input;
          pressed.push(keyPress.key);
          if (pressed.includes(spaceKey!) && pressed.includes(alt!)){
            console.log("[InputPlugin] Space pressed! Triggering test_trigger...");
            // Emit the event to the system platform
            // This will be caught by the main.ts loop and processed by the engine
            this.context?.emit(PLATFORMS.SYSTEM, { eventName: 'test_trigger', data: {} });
            pressed = [];
          }
        } else if (eventType === EventTypeValue.KeyRelease){
          if (!keyRelease) return input;
          pressed = pressed.filter((key) => key !== keyRelease.key);
        }
        return input
    });
  }
  
  onUnload() {
    
  }


}
