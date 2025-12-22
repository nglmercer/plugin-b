import { RuleBuilder, RuleEngine, ActionRegistry, ExpressionEngine,TriggerLoader } from 'trigger_system/node';
import { TTSService } from "./services/audio";
import { PlaylistManager } from "./services/playlist";
import * as fs from "fs";
import * as path from "path";
function ensureDir(Path:string){
    if (!fs.existsSync(Path)) {
        fs.mkdirSync(Path, { recursive: true });
    }
    return fs.existsSync(Path);
}
const testdata = {
    comment:'¡Hola! 😊 ¿Cómo estás? 🤔  🌐 🌍🌎🌏',
    uniqueId:"1234567890",
    nickname:"test"
}
let lastMessage:string|unknown;
async function main() {
    const registry = ActionRegistry.getInstance();

    const engine = new RuleEngine({ rules: [], globalSettings: { debugMode: true } });
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
        await testEvent(engine,"chat",testdata);

    });
    watcher.on('error', (err) => {
        console.error('Error watching rules:', err);
    });
    registry.register("TTS",async (action, ctx) => {
        console.log("[TTS]",action, ctx)
        return action.params?.message
    })
    registry.register("lastcomment",async (action, ctx) => {
        console.log("[lastcomment]",action, ctx)
        lastMessage = action.params?.message
        return action.params?.message
    })
    return result;
}
async function testEvent(engine:RuleEngine,event:string,data:any){
    //console.log("\n\n,testEvent",event,data,"\n\n")
    return await engine.processEvent({
        event: event,
        timestamp: Date.now(),
        data: data,
        helpers: {
            lastMessage:()=>lastMessage
        }
    });
}
main().then(data=>console.log(data)).catch(err=>console.log(err));
process.on("SIGINT", () => {
    console.log("\n\nShutting down...");
    process.exit(0);
});