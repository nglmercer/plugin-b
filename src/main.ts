import { RuleBuilder, RuleEngine, ActionRegistry, ExpressionEngine,TriggerLoader } from 'trigger_system/node';
import { TTSService } from "./services/audio"; 
import { BasePluginManager } from "./services/plugin";
import * as path from "path";
import { ensureDir } from "./utils/filepath";
const testdata = {
    comment:'¡Hola! 😊 ¿Cómo estás? 🤔  🌐 🌍🌎🌏',
    uniqueId:"1234567890",
    nickname:"test"
}
// const tts = new TTSService("./output"); // Moved to plugin
const manager = new BasePluginManager();

async function main() {
    const registry = ActionRegistry.getInstance();
    await manager.loadDefaultPlugins();
    const ttsPlugin = manager.getPlugin("tts-service");
    const tts = ttsPlugin?.getSharedApi ? (ttsPlugin.getSharedApi() as TTSService) : null;
    const engine = manager.engine;
    
    const rulesDir = path.resolve(process.cwd(),"rules");
    const result = ensureDir(rulesDir);
    //watcher se ejecuta despues o demora al inicializar que los demas eventos
    const watcher = TriggerLoader.watchRules(rulesDir, async (newRules) => {
        console.log(`\nRules Updated! Count: ${newRules.length}`);
        
        // Update the engine with new rules
        engine.updateRules(newRules);
        // Log current rules
        const ruleIds = engine.getRules().map(r => r.id);
        console.log(`   Current Rule IDs: ${ruleIds.join(", ")}`);
        const loadedPlugins = manager.listPlugins();
        console.log("Loaded plugins:", loadedPlugins);
        
        // Ejecutar prueba mediante el plugin RuleTester
        const testerPlugin = manager.getPlugin("rule-tester");
        const tester = testerPlugin?.getSharedApi ? (testerPlugin.getSharedApi() as any) : null;
        if (tester?.testEvent) {
        //    await tester.testEvent(engine, "chat", testdata);
        }
    });
    watcher.on('error', (err) => {
        console.error('Error watching rules:', err);
    });

    return result;
}
main().then(data=>console.log(data)).catch(err=>console.log(err));
process.on("SIGINT", () => {
    console.log("\n\nShutting down...");
    process.exit(0);
});