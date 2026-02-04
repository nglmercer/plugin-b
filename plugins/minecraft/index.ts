import type { IPlugin, PluginContext } from "bun_plugins";
import { definePlugin } from "bun_plugins";
import { RconManager } from "./rconmanager";
import { PLUGIN_NAMES, ACTIONS, HELPERS } from "../../src/constants";
import { getRegistryPlugin } from "../Interface/ActionRegistryApi";
function getArray(value:string|string[]){
    if (Array.isArray(value)){
        return value;
    }else{
        return [value]
    }
}
export default definePlugin({
    name: "minecraft-rcon",
    version: "1.0.0",
    async onLoad(context: PluginContext) {
        const registryPlugin = await getRegistryPlugin(context);
    
        if (!registryPlugin) return;
        console.log("Minecraft RCON plugin initialized");
        const manager = RconManager.getInstance({ host: "localhost", port: 27015, password: "password" });
        manager.connect();
        context.on('minecraft:command', (command: string | string[]) => {
            manager.sendMultiple(getArray(command));
        });
        registryPlugin.registry.register(ACTIONS.MC_COMMAND,(action,_ctx)=> {
            const msg = String(action?.params?.message);
            manager.sendMultiple(getArray(msg));
        })
    },
    onUnload() {
        RconManager.resetInstance();
    }
})