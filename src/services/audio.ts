import { EdgeTTS, Constants } from '@andresaya/edge-tts';
import path from 'path';
import fs from 'fs';

// Define types locally if not exported from package, or rely on inference.
// README mentions SynthesisOptions is exportable.
import type { SynthesisOptions } from '@andresaya/edge-tts';

export class TTSService {
  private tts: EdgeTTS;
  private outputDir: string;

  constructor(outputDir: string = './output') {
    this.tts = new EdgeTTS();
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async getVoices(language?: string) {
    if (language) {
      return await this.tts.getVoicesByLanguage(language);
    }
    return await this.tts.getVoices();
  }

  async synthesize(
    text: string,
    voice: string = 'es-AR-ElenaNeural',
    filename: string, // Base filename without extension
    options?: SynthesisOptions
  ): Promise<{savedPath: string, fileBuffer: Buffer}> {
    
    // Default options if not provided
    const synthesisOptions: SynthesisOptions = options || {
        rate: '0%',
        volume: '100%',
        pitch: '0Hz'
    };

    await this.tts.synthesize(text, voice, synthesisOptions);
    
    // Construct full path for output
    // We strip extension if provided because the library appends it
    const baseName = path.parse(filename).name;
    const outputPath = path.join(this.outputDir, baseName);
    const fileData = await this.tts.toBase64();
    const fileBuffer = Buffer.from(fileData, 'base64');
    const savedPath = await this.tts.toFile(outputPath);
    return {savedPath, fileBuffer};
  }
}
