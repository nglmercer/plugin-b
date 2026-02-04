import type { IPlugin, PluginContext } from "bun_plugins";
import { ActionRegistry, type TriggerContext } from "trigger_system/node";
import {
  ACTIONS,
  TTS_DEFAULTS,
  STORAGE_KEYS,
  AUDIO,
} from "../src/constants";
import { TTScleaner } from "../src/services/cleaner";
import { TTSService } from "./tts/index";
import { PlaylistManager } from "../src/services/playlist";
import { responde } from "./ai/cloud";
import { VOICES } from "./tts/index";

// Valid voice keys from Supertonic
const VALID_VOICE_KEYS = Object.keys(VOICES);

/**
 * Decision types for the evaluator
 */
export type EvaluationDecision = 
  | { decision: "tts_direct"; reason: string }
  | { decision: "ai_respond"; reason: string; prompt?: string }
  | { decision: "ignore"; reason: string };

export class EvaluatorPlugin implements IPlugin {
  name = "evaluator-service";
  version = "1.0.0";
  private ttsService: TTSService;
  private playlist: PlaylistManager;
  private audioFiles: { savedPath: string; fileBuffer: Buffer }[] = [];

  constructor(outputDir: string = TTS_DEFAULTS.OUTPUT_DIR) {
    this.ttsService = new TTSService(outputDir);
    this.playlist = new PlaylistManager();
  }

  private async callAction<T = any>(actionName: string, params?: Record<string, any>): Promise<T> {
    const registry = ActionRegistry.getInstance();
    const handler = registry.get(actionName);
    if (!handler) {
      throw new Error(`Action '${actionName}' not found`);
    }
    // Create a mock action object
    const action = { type: actionName, params: params || {} };
    const ctx: TriggerContext = {
      event: "manual",
      timestamp: Date.now(),
      data: {},
    };
    return await handler(action, ctx) as T;
  }

  private async getOrCreateConfig<T extends { voice?: string }>(
    storage: any,
    key: string,
    defaultValue: T
  ): Promise<T> {
    const existing = await storage.get(key);
    if (existing !== undefined && existing !== null) {
      if (existing.voice && !VALID_VOICE_KEYS.includes(existing.voice)) {
        console.log(`[${this.name}] Invalid voice "${existing.voice}" detected, resetting to default: ${defaultValue.voice}`);
        existing.voice = defaultValue.voice;
        await storage.set(key, existing);
      }
      return existing as T;
    }
    await storage.set(key, defaultValue);
    return defaultValue;
  }

  async onLoad(context: PluginContext) {
    const { storage, log } = context;
    console.log(`${this.name} initialized`);

    const defaults = {
      volume: TTS_DEFAULTS.VOLUME,
      voice: TTS_DEFAULTS.VOICE,
      rate: TTS_DEFAULTS.RATE,
    };
    const config = await this.getOrCreateConfig(storage, STORAGE_KEYS.TTS_CONFIG, defaults);

    const registry = ActionRegistry.getInstance();

    // Tool: Get current datetime
    registry.register(ACTIONS.DATETIME, async (action, ctx) => {
      console.log(`[${ACTIONS.DATETIME}] Returning current datetime`);
      const now = new Date();
      return {
        iso: now.toISOString(),
        locale: now.toLocaleString(),
        timestamp: now.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        date: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
        },
        time: {
          hours: now.getHours(),
          minutes: now.getMinutes(),
          seconds: now.getSeconds(),
        },
      };
    });

    // Tool: Evaluate message and decide action (for AI model to call)
    registry.register(ACTIONS.EVALUATE, async (action, ctx) => {
      const message = action.params?.message;
      const messageContext = action.params?.context;
      if (!message) return { error: "No message provided" };

      console.log(`[${ACTIONS.EVALUATE}] Evaluating message: "${message}"`);

      const lowerMessage = String(message).toLowerCase();
      
      // Get context for better decision making
      const contextInfo = messageContext ? ` [Context: ${String(messageContext).substring(0, 100)}]` : "";
      
      // Keywords that indicate AI response needed
      const aiKeywords = ["ai", "responde", "answer", "explain", "what is", "how to", "por qué", "porque", "explain", "?"];
      const needsAI = aiKeywords.some(kw => lowerMessage.includes(kw));

      // Keywords that indicate direct TTS
      const directKeywords = ["di", "say", "reproduce"];
      const needsDirectTSS = directKeywords.some(kw => lowerMessage.startsWith(kw));

      // Keywords to ignore
      const ignoreKeywords = ["stop", "silencio", "quiet", "para", "detente"];
      const shouldIgnore = ignoreKeywords.some(kw => lowerMessage.includes(kw));

      if (shouldIgnore) {
        return {
          decision: "ignore",
          reason: "Message contains ignore keywords",
        } as EvaluationDecision;
      }

      if (needsAI) {
        return {
          decision: "ai_respond",
          reason: "Message appears to be a question or request for AI response" + contextInfo,
          prompt: messageContext 
            ? `${message}\n\nContext: ${messageContext}`
            : message,
        } as EvaluationDecision;
      }

      if (needsDirectTSS) {
        // Extract the text after the command
        const cleanMessage = lowerMessage.replace(/^(di|say|reproduce)\s+/, "").trim();
        return {
          decision: "tts_direct",
          reason: "Direct TTS command detected",
        } as EvaluationDecision;
      }

      // Default: direct TTS for short messages
      if (String(message).length < 50) {
        return {
          decision: "tts_direct",
          reason: "Short message, direct TTS",
        } as EvaluationDecision;
      }

      // Long messages get AI summary first
      return {
        decision: "ai_respond",
        reason: "Long message, AI summary recommended",
        prompt: `Summarize and respond to: ${message}`,
      } as EvaluationDecision;
    });

    // Tool: Execute TTS directly
    registry.register(ACTIONS.TTS_DIRECT, async (action, ctx) => {
      const message = action.params?.message;
      if (!message) return { error: "No message provided" };

      console.log(`[${ACTIONS.TTS_DIRECT}] Direct TTS for: "${message}"`);
      
      const result = await TTScleaner.processMessage(String(message));
      if (!result?.cleanedText) return { error: "Failed to process message" };

      await storage.set(STORAGE_KEYS.LAST_MESSAGE, result.cleanedText);
      const currentConfig = (await storage.get(STORAGE_KEYS.TTS_CONFIG, defaults)) || defaults;

      const ttsdata = await this.ttsService.synthesize(
        result.cleanedText,
        currentConfig.voice,
        result.cleanedText,
        {
          rate: currentConfig.rate,
          volume: `${currentConfig.volume}%`,
          pitch: AUDIO.DEFAULT_PITCH,
        }
      );

      this.audioFiles.push(ttsdata);
      await this.playlist.loadTracks(this.audioFiles.map((file) => file.fileBuffer));
      
      const playlistStatus = this.playlist.getStatus();
      if (!playlistStatus.isPlaying) {
        await this.playlist.playCurrentTrack();
      }

      return { 
        success: true, 
        message: result.cleanedText,
        audioFile: ttsdata.savedPath,
      };
    });

    // Tool: AI respond and speak
    registry.register(ACTIONS.AI_RESPOND, async (action, ctx) => {
      const prompt = String(action.params?.prompt);
      const messageContext = String(action.params?.context);
      if (!prompt) return { error: "No prompt provided" };

      console.log(`[${ACTIONS.AI_RESPOND}] AI response for: "${prompt}"`);

      // Get AI response
      const aiResponse = await responde(
        messageContext 
          ? `${prompt}\n\nContext: ${messageContext}`
          : prompt
      );

      console.log(`[${ACTIONS.AI_RESPOND}] AI responded: "${aiResponse}"`);

      // Now convert to speech
      const result = await TTScleaner.processMessage(aiResponse);
      if (!result?.cleanedText) {
        return { 
          success: true, 
          response: aiResponse,
          ttsSkipped: true,
        };
      }

      await storage.set(STORAGE_KEYS.LAST_MESSAGE, result.cleanedText);
      const currentConfig = (await storage.get(STORAGE_KEYS.TTS_CONFIG, defaults)) || defaults;

      const ttsdata = await this.ttsService.synthesize(
        result.cleanedText,
        currentConfig.voice,
        result.cleanedText,
        {
          rate: currentConfig.rate,
          volume: `${currentConfig.volume}%`,
          pitch: AUDIO.DEFAULT_PITCH,
        }
      );

      this.audioFiles.push(ttsdata);
      await this.playlist.loadTracks(this.audioFiles.map((file) => file.fileBuffer));
      
      const playlistStatus = this.playlist.getStatus();
      if (!playlistStatus.isPlaying) {
        await this.playlist.playCurrentTrack();
      }

      return { 
        success: true, 
        response: aiResponse,
        message: result.cleanedText,
        audioFile: ttsdata.savedPath,
      };
    });

    // Combined tool: Evaluate AND execute (one-shot)
    registry.register(ACTIONS.EVALUATE_AND_SPEAK, async (action, ctx) => {
      const message = action.params?.message;
      const messageContext = action.params?.context;
      if (!message) return { error: "No message provided" };

      console.log(`[${ACTIONS.EVALUATE_AND_SPEAK}] Evaluating and executing: "${message}"`);

      // Get evaluation
      const evaluationResult = await this.callAction<EvaluationDecision>(ACTIONS.EVALUATE, {
        message,
        context: messageContext as string,
      });

      console.log(`[${ACTIONS.EVALUATE_AND_SPEAK}] Decision: ${evaluationResult.decision}`);

      // Execute based on decision
      switch (evaluationResult.decision) {
        case "tts_direct":
          return await this.callAction(ACTIONS.TTS_DIRECT, { message });
        
        case "ai_respond":
          return await this.callAction(ACTIONS.AI_RESPOND, { 
            prompt: evaluationResult.prompt || message,
            context: messageContext,
          });
        
        case "ignore":
          console.log(`[${ACTIONS.EVALUATE_AND_SPEAK}] Ignoring message: ${evaluationResult.reason}`);
          return { 
            ignored: true, 
            reason: evaluationResult.reason,
          };
        
        default:
          return { error: "Unknown decision" };
      }
    });
  }

  onUnload() {}
}
