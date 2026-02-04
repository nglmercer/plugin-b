import type { IPlugin, PluginContext } from "bun_plugins";
import { definePlugin } from "bun_plugins";
import { RconManager } from "./rconmanager";

export default definePlugin({
    name: "minecraft-rcon",
    version: "1.0.0",
    onLoad(context: PluginContext) {
        console.log("Minecraft RCON plugin initialized");
        const manager = RconManager.getInstance({ host: "localhost", port: 27015, password: "password" });
        manager.connect();
        context.on('minecraft:command', (command: string | string[]) => {
            if (Array.isArray(command)) {
                manager.sendMultiple(command);
            } else {
                manager.send(command);
            }
        });
    },
    onUnload() {
        RconManager.resetInstance();
    }
})