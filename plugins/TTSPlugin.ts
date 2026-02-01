import type { IPlugin, PluginContext } from "bun_plugins";
import { TTSService } from "./tts/index";
import { ActionRegistry } from "trigger_system/node";
import { TTScleaner } from "../src/services/cleaner";
import { PlaylistManager } from "../src/services/playlist";
import {
  TTS_DEFAULTS,
  STORAGE_KEYS,
  ACTIONS,
  LOG_MESSAGES,
  AUDIO,
} from "../src/constants";

export class TTSPlugin implements IPlugin {
  name = "tts-service";
  version = "1.0.0";
  private ttsService: TTSService;
  private playlist: PlaylistManager;
  private audioFiles: { savedPath: string; fileBuffer: Buffer }[] = [];

  constructor(outputDir: string = TTS_DEFAULTS.OUTPUT_DIR) {
    this.ttsService = new TTSService(outputDir);
    this.playlist = new PlaylistManager();
  }

  /**
   * Helper to get a config value, creating it with default if it doesn't exist.
   * This ensures the storage file is actually populated with the default structure.
   */
  private async getOrCreateConfig<T>(
    storage: any,
    key: string,
    defaultValue: T
  ): Promise<T> {
    const existing = await storage.get(key);
    if (existing !== undefined && existing !== null) {
      return existing as T;
    }
    console.log(LOG_MESSAGES.TTS.INITIALIZING_STORAGE(this.name, key));
    await storage.set(key, defaultValue);
    return defaultValue;
  }

  async getOrCreateVoices(
    storage: any,
    key: string,
    defaultValue: string[]
  ): Promise<string[]> {
    const existing = await storage.get(key);
    if (existing !== undefined && existing !== null) {
      return existing as string[];
    }
    console.log(LOG_MESSAGES.TTS.INITIALIZING_STORAGE(this.name, key));
    await storage.set(key, defaultValue);
    return defaultValue;
  }

  async onLoad(context: PluginContext) {
    const { storage, log, getPlugin } = context;
    console.log(`${this.name} initialized`);
    const allVoices = await this.getOrCreateVoices(storage, STORAGE_KEYS.VOICES, []);
    if (!allVoices || allVoices.length === 0) {
      await storage.set(STORAGE_KEYS.VOICES, await this.ttsService.getVoices());
    }
    // Load configuration with defaults
    const defaults = {
      volume: TTS_DEFAULTS.VOLUME,
      voice: TTS_DEFAULTS.VOICE,
      rate: TTS_DEFAULTS.RATE,
    };
    const config = await this.getOrCreateConfig(storage, STORAGE_KEYS.TTS_CONFIG, defaults);
    log.info(LOG_MESSAGES.TTS.CONFIG_LOADED, config);

    // Check last processed message
    const lastMessage = await storage.get<string>(STORAGE_KEYS.LAST_MESSAGE);
    if (lastMessage) {
      log.info(LOG_MESSAGES.TTS.LAST_MESSAGE(lastMessage));
    }

    const registry = ActionRegistry.getInstance();

    registry.register(ACTIONS.TTS, async (action, ctx) => {
      console.log(`[${ACTIONS.TTS}]`, action, Object.keys(ctx));
      if (!action.params?.message) return;
      const result = await TTScleaner.processMessage(String(action.params?.message));
      if (!result?.cleanedText) return;

      // Save last message
      await storage.set(STORAGE_KEYS.LAST_MESSAGE, result.cleanedText);

      const currentConfig = (await storage.get(STORAGE_KEYS.TTS_CONFIG, defaults)) || defaults;

      const ttsdata = await this.ttsService.synthesize(
        result?.cleanedText,
        currentConfig.voice, // Use configured voice
        result?.cleanedText,
        {
          rate: currentConfig.rate,
          volume: `${currentConfig.volume}%`,
          pitch: AUDIO.DEFAULT_PITCH,
        }
      );
      this.audioFiles.push(ttsdata);
      await this.playlist.loadTracks(this.audioFiles.map((file) => file.fileBuffer));
      const playlistStatus = this.playlist.getStatus();
      if (playlistStatus.isPlaying) {
        // Already playing, just add to queue
        //    context.log.info("[TTS] Adding to existing playback queue");
      } else {
        await this.playlist.playCurrentTrack();
        //   context.log.info("[TTS] Starting new playback");
      }

      return result?.cleanedText;
    });

    registry.register(ACTIONS.LAST_COMMENT, async (action, ctx) => {
      const history = TTScleaner.getMessageHistory();
      const lastItem = history[history.length - 1]; // Fallback to history

      // Try getting from storage first for consistency
      const storedLastMessage = await storage.get<string>(STORAGE_KEYS.LAST_MESSAGE);

      console.log(`[${ACTIONS.LAST_COMMENT}]`, action, ctx);
      if (!action.params?.message) return;
      const result = await TTScleaner.processMessage(String(action.params?.message));
      if (!result?.cleanedText) return;

      // Update storage here too? Or is lastcomment just reading?
      // Based on code: "processMessage(action.params.message)" -> it processes NEW message provided in params?
      // Logic seems: Input message -> Clean -> Return.
      // It's acting like a cleaner/processor.

      return result?.cleanedText;
    });
  }

  onUnload() {}
}
