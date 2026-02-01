import { pipeline, TextToAudioOutput, TextToAudioPipelineOptions } from '@huggingface/transformers';
import * as fs from 'fs';
import * as path from 'path';
import { 
    SupertonicONNX, 
    loadSupertonicONNX, 
    loadVoiceStyleFromURL, 
    Style,
    Language,
    BufferWav
} from './supertonic-onnx.js';

// Tipado extendido para los métodos útiles
interface AudioOutput extends TextToAudioOutput {
    toWav(): Uint8Array;
    toBlob(): Blob;
    save(path: string): Promise<void>;
}

/**
 * Interfaz para opciones de síntesis de voz
 */
interface SynthesisOptions {
    rate?: string;
    volume?: string;
    pitch?: string;
}

/**
 * Backend type for TTS implementation
 */
export type TTSBackend = 'huggingface' | 'onnx';

/**
 * Voces disponibles en Supertonic
 */
export const VOICES = {
    F1: 'F1.bin',
    F2: 'F2.bin',
    F3: 'F3.bin',
    F4: 'F4.bin',
    F5: 'F5.bin',
    M1: 'M1.bin',
    M2: 'M2.bin',
    M3: 'M3.bin',
    M4: 'M4.bin',
    M5: 'M5.bin',
} as const;

export type VoiceKey = keyof typeof VOICES;

/**
 * Configuration for ONNX backend
 */
export interface ONNXConfig {
    onnxDir: string;
    voiceUrl?: string;
    language?: Language;
    totalSteps?: number;
}

/**
 * Clase interna que implementa el TTS usando HuggingFace Transformers
 */
class HuggingFaceTTS {
    private static instance: any = null;
    private readonly baseUrl = 'https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/';
    
    private defaultVoice: string;

    constructor(defaultVoice: VoiceKey = 'F1') {
        this.defaultVoice = `${this.baseUrl}${VOICES[defaultVoice]}`;
    }

    /**
     * Initialize the TTS pipeline
     */
    private async getPipeline() {
        if (!HuggingFaceTTS.instance) {
            HuggingFaceTTS.instance = await pipeline('text-to-speech', 'onnx-community/Supertonic-TTS-2-ONNX', {
                device: 'cpu',
            });
        }
        return HuggingFaceTTS.instance;
    }

    /**
     * Generate audio from text
     */
    public async speak(text: string, voiceKey?: VoiceKey, customOptions: Partial<TextToAudioPipelineOptions> = {}): Promise<AudioOutput> {
        const tts = await this.getPipeline();
        
        const voiceUrl = voiceKey ? `${this.baseUrl}${VOICES[voiceKey]}` : this.defaultVoice;

        const options: TextToAudioPipelineOptions = {
            speaker_embeddings: voiceUrl,
            num_inference_steps: 5,
            speed: 1.0,
            ...customOptions
        };

        const result = await tts(text, options);
        return result as AudioOutput;
    }

    /**
     * Get available voices
     */
    public getAvailableVoices(): VoiceKey[] {
        return Object.keys(VOICES) as VoiceKey[];
    }
}

/**
 * Clase interna que implementa el TTS usando ONNX Runtime directamente
 */
class ONNXTTS {
    private tts: SupertonicONNX | null = null;
    private voiceStyle: Style | null = null;
    private config: ONNXConfig;
    private isInitialized: boolean = false;

    constructor(config: ONNXConfig) {
        this.config = {
            voiceUrl: 'https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/F1.bin',
            language: 'en',
            totalSteps: 5,
            ...config
        };
    }

    /**
     * Initialize the ONNX TTS models
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Check if ONNX models exist
        const requiredFiles = [
            'duration_predictor.onnx',
            'text_encoder.onnx',
            'vector_estimator.onnx',
            'vocoder.onnx',
            'tts.json',
            'unicode_indexer.json'
        ];

        for (const file of requiredFiles) {
            const filePath = path.join(this.config.onnxDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Missing required ONNX model file: ${filePath}`);
            }
        }

        this.tts = await loadSupertonicONNX(this.config.onnxDir);
        this.voiceStyle = await loadVoiceStyleFromURL(this.config.voiceUrl!);
        this.isInitialized = true;
    }

    /**
     * Generate audio from text
     */
    public async speak(text: string, speed: number = 1.0): Promise<{ wav: number[]; duration: number[] }> {
        if (!this.isInitialized || !this.tts || !this.voiceStyle) {
            throw new Error('ONNX TTS not initialized. Call initialize() first.');
        }

        return await this.tts.call(
            text, 
            this.config.language!, 
            this.voiceStyle, 
            this.config.totalSteps!, 
            speed
        );
    }

    /**
     * Check if ONNX models are available
     */
    public static isAvailable(onnxDir: string): boolean {
        return fs.existsSync(path.join(onnxDir, 'duration_predictor.onnx'));
    }
}

/**
 * TTSService - Servicio principal de Text-to-Speech
 * Implementa la generación de audio usando Supertonic-TTS con soporte para múltiples backends
 */
export class TTSService {
    private huggingfaceTTS: HuggingFaceTTS;
    private onnxTTS: ONNXTTS | null = null;
    private outputDir: string;
    private backend: TTSBackend;
    private sampleRate: number = 24000; // Supertonic uses 24kHz

    constructor(
        outputDir: string = './output',
        backend: TTSBackend = 'huggingface',
        onnxConfig?: ONNXConfig
    ) {
        this.outputDir = outputDir;
        this.backend = backend;
        this.huggingfaceTTS = new HuggingFaceTTS('F1'); // Default voice: F1
        
        // Initialize ONNX backend if requested and config provided
        if (backend === 'onnx' && onnxConfig) {
            this.onnxTTS = new ONNXTTS(onnxConfig);
        }
        
        // Asegurar que el directorio de salida existe
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Initialize the service (required for ONNX backend)
     */
    public async initialize(): Promise<void> {
        if (this.backend === 'onnx' && this.onnxTTS) {
            await this.onnxTTS.initialize();
            console.log('[TTSService] ONNX backend initialized');
        } else {
            console.log('[TTSService] Using HuggingFace backend');
        }
    }

    /**
     * Switch between backends
     */
    public async setBackend(backend: TTSBackend, onnxConfig?: ONNXConfig): Promise<void> {
        if (backend === this.backend) return;

        this.backend = backend;
        
        if (backend === 'onnx') {
            if (!onnxConfig) {
                throw new Error('ONNX config required when switching to ONNX backend');
            }
            this.onnxTTS = new ONNXTTS(onnxConfig);
            await this.onnxTTS.initialize();
        } else {
            this.onnxTTS = null;
        }
    }

    /**
     * Get current backend
     */
    public getBackend(): TTSBackend {
        return this.backend;
    }

    /**
     * Synthesize text to speech
     * @param text Text to synthesize
     * @param voice Voice identifier (F1-F5, M1-M5)
     * @param filename Base filename for the output
     * @param options Synthesis options (rate, volume, pitch)
     * @returns Object with savedPath and fileBuffer
     */
    async synthesize(
        text: string,
        voice: string = 'F1',
        filename: string,
        options: SynthesisOptions = {}
    ): Promise<{ savedPath: string; fileBuffer: Buffer }> {
        try {
            // Parse rate option to speed multiplier
            const speed = this.parseRateToSpeed(options.rate);
            
            let fileBuffer: Buffer;

            if (this.backend === 'onnx' && this.onnxTTS) {
                // Use ONNX backend
                const result = await this.onnxTTS.speak(text, speed);
                fileBuffer = BufferWav(result.wav, this.sampleRate);
            } else {
                // Use HuggingFace backend
                const voiceKey = this.validateVoice(voice);
                const audio = await this.huggingfaceTTS.speak(text, voiceKey, { 
                    speed: speed,
                    num_inference_steps: 5
                });
                fileBuffer = Buffer.from(audio.toWav());
            }

            // Save to file
            const safeFilename = this.sanitizeFilename(filename);
            const timestamp = Date.now();
            const outputPath = path.join(this.outputDir, `${safeFilename}_${timestamp}.wav`);
            
            await fs.promises.writeFile(outputPath, fileBuffer);

            return {
                savedPath: outputPath,
                fileBuffer: fileBuffer
            };
        } catch (error) {
            console.error('[TTSService] Error synthesizing speech:', error);
            throw error;
        }
    }

    /**
     * Synthesize without saving to file (for streaming or direct use)
     */
    async synthesizeBuffer(
        text: string,
        voice: string = 'F1',
        options: SynthesisOptions = {}
    ): Promise<Buffer> {
        const speed = this.parseRateToSpeed(options.rate);

        if (this.backend === 'onnx' && this.onnxTTS) {
            const result = await this.onnxTTS.speak(text, speed);
            return BufferWav(result.wav, this.sampleRate);
        } else {
            const voiceKey = this.validateVoice(voice);
            const audio = await this.huggingfaceTTS.speak(text, voiceKey, { 
                speed: speed,
                num_inference_steps: 5
            });
            return Buffer.from(audio.toWav());
        }
    }

    /**
     * Get available voices
     * @returns Array of voice identifiers (F1-F5, M1-M5)
     */
    async getVoices(): Promise<string[]> {
        return Object.keys(VOICES);
    }

    /**
     * Validate voice key, return default if invalid
     */
    private validateVoice(voice: string): VoiceKey {
        if (voice in VOICES) {
            return voice as VoiceKey;
        }
        return 'F1'; // Default voice
    }

    /**
     * Parse rate string (e.g., '0%', '-10%', '+20%') to speed multiplier
     */
    private parseRateToSpeed(rate?: string): number {
        if (!rate) return 1.0;
        
        const match = rate.match(/([+-]?)(\d+)%/);
        if (!match) return 1.0;
        
        const sign = match[1] === '-' ? -1 : 1;
        const value = parseInt(match[2]!, 10);
        
        // Convert percentage to speed multiplier
        return 1.0 + (sign * value / 100);
    }

    /**
     * Sanitize filename for filesystem
     */
    private sanitizeFilename(filename: string): string {
        return filename
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);
    }
}

// Export individual items for flexibility
export { HuggingFaceTTS, ONNXTTS, SupertonicONNX, loadSupertonicONNX, loadVoiceStyleFromURL };
