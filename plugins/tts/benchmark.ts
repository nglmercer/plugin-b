import * as fs from 'fs';
import * as path from 'path';
import { pipeline, TextToAudioPipelineOptions } from '@huggingface/transformers';
import { 
    SupertonicONNX, 
    loadSupertonicONNX, 
    loadVoiceStyleFromURL, 
    Style,
    Language,
    BenchmarkResult,
    benchmarkTTS,
    BufferWav
} from './supertonic-onnx.js';

// Extend the AudioOutput interface
interface AudioOutput {
    toWav(): Uint8Array;
    toBlob(): Blob;
    save(path: string): Promise<void>;
    wav: Float32Array;
}

// Test texts of varying lengths
const TEST_TEXTS = {
    short: "Hello, this is a short test.",
    medium: "Hello, this is a medium length test. I am testing the text to speech system. It should handle this amount of text without any issues.",
    long: "Hello, this is a longer test of the text to speech system. The quick brown fox jumps over the lazy dog. This sentence contains all the letters of the alphabet. We are testing how well the system handles longer text inputs with multiple sentences and proper pronunciation. The system should be able to synthesize this text into natural sounding speech."
};

/**
 * HuggingFace Transformers implementation wrapper
 */
class HuggingFaceTTS {
    private static instance: any = null;
    private readonly baseUrl = 'https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/';
    private defaultVoice: string;

    constructor(defaultVoice: string = 'F1') {
        this.defaultVoice = `${this.baseUrl}${defaultVoice}.bin`;
    }

    private async getPipeline() {
        if (!HuggingFaceTTS.instance) {
            HuggingFaceTTS.instance = await pipeline('text-to-speech', 'onnx-community/Supertonic-TTS-2-ONNX', {
                device: 'cpu',
            });
        }
        return HuggingFaceTTS.instance;
    }

    public async speak(text: string, voiceKey: string = 'F1', options: Partial<TextToAudioPipelineOptions> = {}): Promise<AudioOutput> {
        const tts = await this.getPipeline();
        const voiceUrl = `${this.baseUrl}${voiceKey}.bin`;

        const opts: TextToAudioPipelineOptions = {
            speaker_embeddings: voiceUrl,
            num_inference_steps: 5,
            speed: 1.0,
            ...options
        };

        const result = await tts(text, opts);
        return result as AudioOutput;
    }
}

/**
 * ONNX Runtime implementation wrapper
 */
class ONNXRuntimeTTS {
    private onnxDir: string;
    private tts: SupertonicONNX | null = null;
    private voiceStyle: Style | null = null;

    constructor(onnxDir: string) {
        this.onnxDir = onnxDir;
    }

    public async initialize(voiceUrl: string = 'https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/F1.bin') {
        console.log('Loading ONNX models...');
        this.tts = await loadSupertonicONNX(this.onnxDir);
        console.log('Loading voice style...');
        this.voiceStyle = await loadVoiceStyleFromURL(voiceUrl);
        console.log('ONNX Runtime TTS initialized');
    }

    public async speak(text: string, lang: Language = 'en', totalSteps: number = 5, speed: number = 1.0) {
        if (!this.tts || !this.voiceStyle) {
            throw new Error('ONNX TTS not initialized. Call initialize() first.');
        }

        return await this.tts.call(text, lang, this.voiceStyle, totalSteps, speed);
    }
}

/**
 * Run benchmark comparison
 */
async function runBenchmark() {
    console.log('='.repeat(60));
    console.log('Supertonic TTS Performance Benchmark');
    console.log('='.repeat(60));
    console.log();

    // Check if ONNX models exist
    const onnxDir = path.join(process.cwd(), 'models', 'supertonic');
    const hasOnnxModels = fs.existsSync(path.join(onnxDir, 'duration_predictor.onnx'));

    if (!hasOnnxModels) {
        console.log('ONNX models not found at:', onnxDir);
        console.log('Please download the models first.');
        console.log('Expected files:');
        console.log('  - duration_predictor.onnx');
        console.log('  - text_encoder.onnx');
        console.log('  - vector_estimator.onnx');
        console.log('  - vocoder.onnx');
        console.log('  - tts.json');
        console.log('  - unicode_indexer.json');
        console.log();
        console.log('Running HuggingFace-only benchmark...');
        console.log();
    }

    const results: BenchmarkResult[] = [];

    // Initialize implementations
    console.log('Initializing HuggingFace Transformers...');
    const hfTTS = new HuggingFaceTTS();
    
    let onnxTTS: ONNXRuntimeTTS | null = null;
    if (hasOnnxModels) {
        console.log('Initializing ONNX Runtime...');
        onnxTTS = new ONNXRuntimeTTS(onnxDir);
        await onnxTTS.initialize();
    }

    console.log();
    console.log('-'.repeat(60));
    console.log('Starting benchmarks...');
    console.log('-'.repeat(60));
    console.log();

    // Warmup
    console.log('Warming up...');
    await hfTTS.speak(TEST_TEXTS.short, 'F1', { num_inference_steps: 5 });
    if (onnxTTS) {
        await onnxTTS.speak(TEST_TEXTS.short, 'en', 5, 1.0);
    }
    console.log('Warmup complete.');
    console.log();

    // Run benchmarks for each text length
    for (const [length, text] of Object.entries(TEST_TEXTS)) {
        console.log(`\nBenchmarking ${length} text (${text.length} chars):`);
        console.log(`  "${text.substring(0, 60)}..."`);
        console.log();

        // HuggingFace benchmark
        const hfResult = await benchmarkTTS(
            'HuggingFace Transformers',
            async () => {
                const audio = await hfTTS.speak(text, 'F1', { num_inference_steps: 5 });
                return {
                    wav: Array.from(audio.wav),
                    duration: [audio.wav.length / 24000] // Assuming 24kHz
                };
            },
            24000
        );
        hfResult.text = length;
        results.push(hfResult);

        console.log(`  HuggingFace Transformers:`);
        console.log(`    Time: ${hfResult.duration.toFixed(2)}s`);
        console.log(`    RTF: ${hfResult.rtf.toFixed(3)}`);
        console.log(`    Audio length: ${(hfResult.wavLength / hfResult.sampleRate).toFixed(2)}s`);

        // ONNX Runtime benchmark
        if (onnxTTS) {
            const onnxResult = await benchmarkTTS(
                'ONNX Runtime',
                async () => await onnxTTS!.speak(text, 'en', 5, 1.0),
                24000
            );
            onnxResult.text = length;
            results.push(onnxResult);

            console.log(`  ONNX Runtime:`);
            console.log(`    Time: ${onnxResult.duration.toFixed(2)}s`);
            console.log(`    RTF: ${onnxResult.rtf.toFixed(3)}`);
            console.log(`    Audio length: ${(onnxResult.wavLength / onnxResult.sampleRate).toFixed(2)}s`);
            console.log(`    Speedup: ${(hfResult.duration / onnxResult.duration).toFixed(2)}x`);
        }
    }

    // Summary
    console.log();
    console.log('='.repeat(60));
    console.log('Benchmark Summary');
    console.log('='.repeat(60));
    console.log();
    
    console.log('Implementation          | Text   | Time (s) | RTF   | Speedup');
    console.log('-'.repeat(60));
    
    for (const result of results) {
        const impl = result.implementation.padEnd(21);
        const text = result.text.padEnd(6);
        const time = result.duration.toFixed(2).padStart(8);
        const rtf = result.rtf.toFixed(3).padStart(6);
        
        // Calculate speedup relative to HuggingFace for same text
        const hfTime = results.find(r => r.text === result.text && r.implementation === 'HuggingFace Transformers')?.duration;
        const speedup = hfTime && result.implementation !== 'HuggingFace Transformers' 
            ? (hfTime / result.duration).toFixed(2).padStart(7)
            : '  1.00';
        
        console.log(`${impl}| ${text} | ${time} | ${rtf} | ${speedup}`);
    }

    console.log();
    console.log('RTF (Real-Time Factor) < 1.0 means faster than real-time');
    console.log('RTF > 1.0 means slower than real-time');
    console.log();

    // Save results to file
    const outputPath = path.join(process.cwd(), 'benchmark-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${outputPath}`);
}

/**
 * Quick test function to verify ONNX implementation works
 */
async function quickTest() {
    const onnxDir = path.join(process.cwd(), 'models', 'supertonic');
    
    if (!fs.existsSync(path.join(onnxDir, 'duration_predictor.onnx'))) {
        console.log('ONNX models not found. Please download them first.');
        return;
    }

    console.log('Running quick test...');
    
    const onnxTTS = new ONNXRuntimeTTS(onnxDir);
    await onnxTTS.initialize();
    
    const text = "Hello, this is a test of the ONNX runtime implementation.";
    console.log(`Synthesizing: "${text}"`);
    
    const startTime = performance.now();
    const result = await onnxTTS.speak(text, 'en', 5, 1.0);
    const endTime = performance.now();
    
    const inferenceTime = (endTime - startTime) / 1000;
    const audioDuration = result.wav.length / 24000;
    
    console.log(`\nResults:`);
    console.log(`  Inference time: ${inferenceTime.toFixed(2)}s`);
    console.log(`  Audio duration: ${audioDuration.toFixed(2)}s`);
    console.log(`  RTF: ${(inferenceTime / audioDuration).toFixed(3)}`);
    
    // Save the audio
    const outputPath = path.join(process.cwd(), 'test-output.wav');
    const wavBuffer = BufferWav(result.wav, 24000);
    fs.writeFileSync(outputPath, wavBuffer);
    console.log(`\nAudio saved to: ${outputPath}`);
}

// Main execution
const command = process.argv[2];

if (command === 'quick') {
    quickTest().catch(console.error);
} else {
    runBenchmark().catch(console.error);
}
