import { pipeline, TextToAudioOutput, TextToAudioPipelineOptions, env } from '@huggingface/transformers';
import { detectLanguage,type DetectionResult } from 'plugins/ai/llmstudio';
import * as fs from 'fs';
import * as path from 'path';

// Set local cache directory to avoid conflicts and fix corruption issues
env.cacheDir = path.resolve(process.cwd(), ".cache");
env.allowLocalModels = false; // Force checking remote/cache


// Tipado extendido para los métodos útiles
interface AudioOutput extends TextToAudioOutput {
    toWav(): Uint8Array;
    toBlob(): Blob;
    save(path: string): Promise<void>;
}

/**
 * Idiomas soportados por el modelo Supertonic
 */
export type Language = 'en' | 'ko' | 'es' | 'pt' | 'fr';
const SUPPORTED_LANGUAGES: Language[] = ["en", "ko", "es", "pt", "fr"];
/**
 * Interfaz para opciones de síntesis de voz
 */
interface SynthesisOptions {
    rate?: string;
    volume?: string;
    pitch?: string;
}



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
 * Clase interna que implementa el TTS usando Supertonic
 */
class SupertonicTTS {
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
        if (!SupertonicTTS.instance) {
            SupertonicTTS.instance = await pipeline('text-to-speech', 'onnx-community/Supertonic-TTS-2-ONNX', {
                device: 'cpu',
            });
        }
        return SupertonicTTS.instance;
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
 * TTSService - Servicio principal de Text-to-Speech
 * Implementa la generación de audio usando Supertonic-TTS
 */
export class TTSService {
    private supertonic: SupertonicTTS;
    private outputDir: string;

    constructor(outputDir: string = './output') {
        this.outputDir = outputDir;
        this.supertonic = new SupertonicTTS('F1'); // Default voice: F1
        
        // Asegurar que el directorio de salida existe
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Synthesize text to speech with automatic language detection
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
    ): Promise<{ savedPath: string; fileBuffer: Buffer; detectedLanguage: Language }> {
        try {
            // Detect language using LFM inference
            const _raw = await this.processmsg(text)
            const detectedLang = await this.detectLanguage(_raw?.language);
            console.log(`[TTSService] Detected language: ${detectedLang}`,text);
            
            // Usar directamente las voces de Supertonic (F1-F5, M1-M5)
            const voiceKey = this.validateVoice(voice);
            
            // Parse rate option to speed multiplier
            const speed = this.parseRateToSpeed(options.rate);
            
            // Generate audio
            const audio = await this.supertonic.speak(this._preprocessText(_raw?.summary || text,detectedLang), voiceKey, { 
                speed: speed,
                num_inference_steps: 5
            });

            // Convert to WAV buffer
            const wavBuffer = audio.toWav();
            const fileBuffer = Buffer.from(wavBuffer);

            // Save to file
            const safeFilename = this.sanitizeFilename(filename);
            const timestamp = Date.now();
            const outputPath = path.join(this.outputDir, `${safeFilename}_${timestamp}.wav`);
            
            await fs.promises.writeFile(outputPath, fileBuffer);

            return {
                savedPath: outputPath,
                fileBuffer: fileBuffer,
                detectedLanguage: detectedLang
            };
        } catch (error) {
            console.error('[TTSService] Error synthesizing speech:', error);
            throw error;
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
    private isSupportedLanguage(lang: string): lang is Language {
        return (SUPPORTED_LANGUAGES as string[]).includes(lang);
    }
    /**
     * Detect language using LFM inference
     * @param text Text to analyze
     * @returns Detected language code (en, ko, es, pt, fr)
     */
    private async detectLanguage(lang: string='es'): Promise<Language> {
        return this.isSupportedLanguage(lang) ? lang : "es"
    }
    private async processmsg(text:string){
        let result;
        try {
             result = await detectLanguage(text) 
            return result;
        } catch (error) {
            console.log({error})
            result
        }
    }
    public _preprocessText(text:string, lang:string) {
        // TODO: Need advanced normalizer for better performance
        text = text.normalize('NFKD');

        // Remove emojis (wide Unicode range)
        const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
        text = text.replace(emojiPattern, '');

        // Replace various dashes and symbols
        const replacements = {
            '–': '-',
            '‑': '-',
            '—': '-',
            '_': ' ',
            '\u201C': '"',  // left double quote "
            '\u201D': '"',  // right double quote "
            '\u2018': "'",  // left single quote '
            '\u2019': "'",  // right single quote '
            '´': "'",
            '`': "'",
            '[': ' ',
            ']': ' ',
            '|': ' ',
            '/': ' ',
            '#': ' ',
            '→': ' ',
            '←': ' ',
        };
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replaceAll(k, v);
        }

        // Remove special symbols
        text = text.replace(/[♥☆♡©\\]/g, '');

        // Fix spacing around punctuation
        text = text.replace(/ ,/g, ',');
        text = text.replace(/ \./g, '.');
        text = text.replace(/ !/g, '!');
        text = text.replace(/ \?/g, '?');
        text = text.replace(/ ;/g, ';');
        text = text.replace(/ :/g, ':');
        text = text.replace(/ '/g, "'");

        // Remove duplicate quotes
        while (text.includes('""')) {
            text = text.replace('""', '"');
        }
        while (text.includes("''")) {
            text = text.replace("''", "'");
        }
        while (text.includes('``')) {
            text = text.replace('``', '`');
        }

        // Remove extra spaces
        text = text.replace(/\s+/g, ' ').trim();

        // If text doesn't end with punctuation, quotes, or closing brackets, add a period
        if (!/[.!?;:,'\"')\]}…。」』】〉》›»]$/.test(text)) {
            text += '.';
        }


        
        // Wrap text with language tags
        text = `<${lang}>` + text + `</${lang}>`;

        return text;
    }

}

// Export individual items for flexibility
export { SupertonicTTS };
