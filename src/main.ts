import { RuleBuilder, RuleEngine, ActionRegistry, ExpressionEngine,TriggerLoader } from 'trigger_system/node';
import { PlaylistManager } from "./services/playlist";
import { ttsSystem } from "./services/cleaner";
import { TTSService } from "./services/audio";
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
const audioFiles: {savedPath: string, fileBuffer: Buffer}[] = [];
const tts = new TTSService("./output");
const playlist = new PlaylistManager();
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
        if (!action.params?.message)return;
        const result = await ttsSystem.processMessage(String(action.params?.message))
        if (!result?.cleanedText)return;
        const ttsdata = await tts.synthesize(
        result?.cleanedText, 
        'en-US-AriaNeural', 
        result?.cleanedText
        );
        audioFiles.push(ttsdata);
        await playlist.loadTracks(audioFiles.map((file) => file.fileBuffer));

        await playlist.playCurrentTrack();

        return result?.cleanedText
    })
    registry.register("lastcomment",async (action, ctx) => {
        const history = ttsSystem.getMessageHistory();
        const lastItem = history[history.length - 1];
        console.log("[lastcomment]",action, ctx)
        if (!action.params?.message)return;
        const result = await ttsSystem.processMessage(String(action.params?.message))
        if (!result?.cleanedText)return;
        return result?.cleanedText
    })
    return result;
}
async function testEvent(engine:RuleEngine,event:string,data:any){
    return await engine.processEvent({
        event: event,
        timestamp: Date.now(),
        data: data,
        globals: {
            last: () => {
            const history = ttsSystem.getMessageHistory();
            const lastItem = history[history.length - 1];
            const returnItem = lastItem ? lastItem.cleanedText : "";
            return returnItem;
            },
            clean: (t: any) => {
                const result = ttsSystem.cleanOnly(String(t || ""))
                return result;
            }
        }
    });
}
main().then(data=>console.log(data)).catch(err=>console.log(err));
process.on("SIGINT", () => {
    console.log("\n\nShutting down...");
    process.exit(0);
});