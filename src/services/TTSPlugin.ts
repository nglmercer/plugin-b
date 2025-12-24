import type { IPlugin, PluginContext } from "bun_plugins";
import { TTSService } from "./audio";
import { ActionRegistry } from "trigger_system/node";
import { ttsSystem } from "./cleaner";
import { PlaylistManager } from "./playlist";

export class TTSPlugin implements IPlugin {
  name = "tts-service";
  version = "1.0.0";
  private ttsService: TTSService;
  private playlist: PlaylistManager;
  private audioFiles: {savedPath: string, fileBuffer: Buffer}[] = [];

  constructor(outputDir: string = './output') {
    this.ttsService = new TTSService(outputDir);
    this.playlist = new PlaylistManager();
  }

  /**
   * Helper to get a config value, creating it with default if it doesn't exist.
   * This ensures the storage file is actually populated with the default structure.
   */
  private async getOrCreateConfig<T>(storage: any, key: string, defaultValue: T): Promise<T> {
    const existing = await storage.get(key);
    if (existing !== undefined && existing !== null) {
      return existing as T;
    }
    console.log(`[${this.name}] Initializing storage for key: ${key}`);
    await storage.set(key, defaultValue);
    return defaultValue;
  }

  async getOrCreateVoices(storage: any, key: string, defaultValue: string[]): Promise<string[]> {
    const existing = await storage.get(key);
    if (existing !== undefined && existing !== null) {
      return existing as string[];
    }
    console.log(`[${this.name}] Initializing storage for key: ${key}`);
    await storage.set(key, defaultValue);
    return defaultValue;
  }
  
  async onLoad(context: PluginContext) {
    const { storage, log } = context;
    console.log(`${this.name} initialized`);
    const allVoices = await this.getOrCreateVoices(storage, "voices", []);
    if (!allVoices || allVoices.length === 0) {
        await storage.set("voices", await this.ttsService.getVoices());
    }
    // Load configuration with defaults
    const defaults = { volume: 100, voice: 'es-AR-ElenaNeural', rate: '0%' };
    const config = await this.getOrCreateConfig(storage, "ttsConfig", defaults);
    log.info(`[TTSPlugin] Config loaded:`, config);

    // Check last processed message
    const lastMessage = await storage.get<string>("lastMessage");
    if (lastMessage) {
        log.info(`[TTSPlugin] Last processed message: ${lastMessage}`);
    }

    const registry = ActionRegistry.getInstance();

    registry.register("TTS", async (action, ctx) => {
        console.log("[TTS]", action, Object.keys(ctx));
        if (!action.params?.message) return;
        const result = await ttsSystem.processMessage(String(action.params?.message));
        if (!result?.cleanedText) return;

        // Save last message
        await storage.set("lastMessage", result.cleanedText);
        
        const currentConfig = await storage.get("ttsConfig", defaults) || defaults;
        
        const ttsdata = await this.ttsService.synthesize(
            result?.cleanedText, 
            currentConfig.voice, // Use configured voice
            result?.cleanedText,
            {
                rate: currentConfig.rate,
                volume: `${currentConfig.volume}%`,
                pitch: '0Hz'
            }
        );
        this.audioFiles.push(ttsdata);
        await this.playlist.loadTracks(this.audioFiles.map((file) => file.fileBuffer));
 
        await this.playlist.playCurrentTrack(); 
       
 
        return result?.cleanedText;
    });

    registry.register("lastcomment", async (action, ctx) => {
        const history = ttsSystem.getMessageHistory();
        const lastItem = history[history.length - 1]; // Fallback to history
        
        // Try getting from storage first for consistency
        const storedLastMessage = await storage.get<string>("lastMessage");

        console.log("[lastcomment]", action, ctx);
        if (!action.params?.message) return;
        const result = await ttsSystem.processMessage(String(action.params?.message));
        if (!result?.cleanedText) return;
        
        // Update storage here too? Or is lastcomment just reading? 
        // Based on code: "processMessage(action.params.message)" -> it processes NEW message provided in params?
        // Logic seems: Input message -> Clean -> Return.
        // It's acting like a cleaner/processor.
        
        return result?.cleanedText;
    });
  }

  onUnload() {}

  getSharedApi() {
    return this.ttsService;
  }
}
