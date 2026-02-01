import * as fs from 'fs';
import * as path from 'path';
import * as ort from 'onnxruntime-node';

// --- Types and Interfaces ---

export type Language = "en" | "ko" | "es" | "pt" | "fr";

interface Configs {
    ae: {
        sample_rate: number;
        base_chunk_size: number;
    };
    ttl: {
        chunk_compress_factor: number;
        latent_dim: number;
    };
}

interface InferenceResult {
    wav: number[];
    duration: number[];
}

// --- Logic Classes ---

/**
 * Handles text normalization, cleaning, and conversion to index IDs.
 */
class UnicodeProcessor {
    private indexer: Record<number, number>;
    public readonly availableLangs: Language[] = ["en", "ko", "es", "pt", "fr"];

    constructor(unicodeIndexerJsonPath: string) {
        this.indexer = JSON.parse(fs.readFileSync(unicodeIndexerJsonPath, 'utf8'));
    }

    private _preprocessText(text: string, lang: Language): string {
        text = text.normalize('NFKD');

        // Remove emojis
        const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
        text = text.replace(emojiPattern, '');

        const replacements: Record<string, string> = {
            '–': '-', '‑': '-', '—': '-', '_': ' ', '\u201C': '"', '\u201D': '"',
            '\u2018': "'", '\u2019': "'", '´': "'", '`': "'", '[': ' ', ']': ' ',
            '|': ' ', '/': ' ', '#': ' ', '→': ' ', '←': ' ', '\\': ''
        };

        for (const [k, v] of Object.entries(replacements)) {
            text = text.replaceAll(k, v);
        }

        const exprReplacements: Record<string, string> = {
            '@': ' at ', 'e.g.,': 'for example, ', 'i.e.,': 'that is, ',
        };

        for (const [k, v] of Object.entries(exprReplacements)) {
            text = text.replaceAll(k, v);
        }

        // Clean punctuation spacing
        text = text.replace(/\s+([,.!?;:'])/g, '$1');
        
        // Remove duplicate quotes
        text = text.replace(/""+/g, '"').replace(/''+/g, "'").replace(/``+/g, '`');
        
        // Final trim and spacing
        text = text.replace(/\s+/g, ' ').trim();

        if (!/[.!?;:,'\"')\]}…。」』】〉》›»]$/.test(text)) {
            text += '.';
        }

        return `<${lang}>${text}</${lang}>`;
    }

    public call(textList: string[], langList: Language[]): { textIds: number[][], textMask: number[][][] } {
        const processedTexts = textList.map((t, i) => this._preprocessText(t, langList[i]!));
        const textIdsLengths = processedTexts.map(t => t.length);
        const maxLen = Math.max(...textIdsLengths);
        
        const textIds: number[][] = processedTexts.map(text => {
            const row = new Array(maxLen).fill(0);
            const unicodeVals = Array.from(text).map(char => char.charCodeAt(0));
            unicodeVals.forEach((val, idx) => {
                row[idx] = this.indexer[val] ?? 0;
            });
            return row;
        });
        
        const textMask = lengthToMask(textIdsLengths);
        return { textIds, textMask };
    }
}

export class Style {
    constructor(public ttl: ort.Tensor, public dp: ort.Tensor) {}
}

export class TextToSpeech {
    private sampleRate: number;
    private baseChunkSize: number;
    private chunkCompressFactor: number;
    private ldim: number;

    constructor(
        public cfgs: Configs,
        private textProcessor: UnicodeProcessor,
        private dpOrt: ort.InferenceSession,
        private textEncOrt: ort.InferenceSession,
        private vectorEstOrt: ort.InferenceSession,
        private vocoderOrt: ort.InferenceSession
    ) {
        this.sampleRate = cfgs.ae.sample_rate;
        this.baseChunkSize = cfgs.ae.base_chunk_size;
        this.chunkCompressFactor = cfgs.ttl.chunk_compress_factor;
        this.ldim = cfgs.ttl.latent_dim;
    }

    private sampleNoisyLatent(duration: number[]): { noisyLatent: number[][][], latentMask: number[][][] } {
        const wavLenMax = Math.max(...duration) * this.sampleRate;
        const wavLengths = duration.map(d => Math.floor(d * this.sampleRate));
        const chunkSize = this.baseChunkSize * this.chunkCompressFactor;
        const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
        const latentDim = this.ldim * this.chunkCompressFactor;

        const noisyLatent: number[][][] = Array.from({ length: duration.length }, () => 
            Array.from({ length: latentDim }, () => 
                Array.from({ length: latentLen }, () => {
                    const u1 = Math.max(1e-10, Math.random());
                    const u2 = Math.random();
                    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                })
            )
        );

        const latentMask = getLatentMask(wavLengths, this.baseChunkSize, this.chunkCompressFactor);
        
        for (let b = 0; b < noisyLatent.length; b++) {
            for (let d = 0; d < latentDim; d++) {
                for (let t = 0; t < latentLen; t++) {
                    noisyLatent[b]![d]![t]! *= latentMask[b]![0]![t]!;
                }
            }
        }

        return { noisyLatent, latentMask };
    }

    private async _infer(textList: string[], langList: Language[], style: Style, totalStep: number, speed: number): Promise<InferenceResult> {
        const bsz = textList.length;
        const { textIds, textMask } = this.textProcessor.call(textList, langList);
        
        const textIdsShape = [bsz, textIds[0]!.length];
        const textMaskShape = [bsz, 1, textMask[0]![0]!.length];
        const textMaskTensor = arrayToTensor(textMask, textMaskShape);

        const dpResult = await this.dpOrt.run({
            text_ids: intArrayToTensor(textIds, textIdsShape),
            style_dp: style.dp,
            text_mask: textMaskTensor
        });
        
        const durOnnx = Array.from(dpResult.duration!.data as Float32Array).map(d => d / speed);
        
        const textEncResult = await this.textEncOrt.run({
            text_ids: intArrayToTensor(textIds, textIdsShape),
            style_ttl: style.ttl,
            text_mask: textMaskTensor
        });
        
        const { noisyLatent, latentMask } = this.sampleNoisyLatent(durOnnx);
        const latentShape = [bsz, noisyLatent[0]!.length, noisyLatent[0]![0]!.length];
        const latentMaskTensor = arrayToTensor(latentMask, [bsz, 1, latentMask[0]![0]!.length]);
        const totalStepTensor = arrayToTensor(new Array(bsz).fill(totalStep), [bsz]);

        // Iterative Denoising Loop
        for (let step = 0; step < totalStep; step++) {
            const currentStepTensor = arrayToTensor(new Array(bsz).fill(step), [bsz]);

            const vectorEstResult = await this.vectorEstOrt.run({
                noisy_latent: arrayToTensor(noisyLatent, latentShape),
                text_emb: textEncResult.text_emb!,
                style_ttl: style.ttl,
                text_mask: textMaskTensor,
                latent_mask: latentMaskTensor,
                total_step: totalStepTensor,
                current_step: currentStepTensor
            });

            const denoisedData = vectorEstResult.denoised_latent!.data as Float32Array;
            let idx = 0;
            for (let b = 0; b < bsz; b++) {
                for (let d = 0; d < latentShape[1]!; d++) {
                    for (let t = 0; t < latentShape[2]!; t++) {
                        noisyLatent[b]![d]![t] = denoisedData[idx++]!;
                    }
                }
            }
        }

        const vocoderResult = await this.vocoderOrt.run({
            latent: arrayToTensor(noisyLatent, latentShape)
        });

        return {
            wav: Array.from(vocoderResult.wav_tts!.data as Float32Array),
            duration: durOnnx
        };
    }

    public async call(text: string, lang: Language, style: Style, totalStep: number, speed = 1.05, silenceDuration = 0.3): Promise<InferenceResult> {
        const maxLen = lang === 'ko' ? 120 : 300;
        const textList = chunkText(text, maxLen);
        let wavCat: number[] = [];
        let totalDur = 0;
        
        for (let i = 0; i < textList.length; i++) {
            const { wav, duration } = await this._infer([textList[i]!], [lang], style, totalStep, speed);
            
            if (i > 0) {
                const silence = new Array(Math.floor(silenceDuration * this.sampleRate)).fill(0);
                wavCat.push(...silence);
                totalDur += silenceDuration;
            }
            
            wavCat.push(...wav);
            totalDur += duration[0]!;
        }
        
        return { wav: wavCat, duration: [totalDur] };
    }
}

// --- Utilities ---

function lengthToMask(lengths: number[], maxLen?: number): number[][][] {
    const actualMax = maxLen ?? Math.max(...lengths);
    return lengths.map(len => [
        Array.from({ length: actualMax }, (_, j) => (j < len ? 1.0 : 0.0))
    ]);
}

function getLatentMask(wavLengths: number[], baseSize: number, factor: number): number[][][] {
    const latentSize = baseSize * factor;
    const latentLengths = wavLengths.map(len => Math.floor((len + latentSize - 1) / latentSize));
    return lengthToMask(latentLengths);
}

function arrayToTensor(array: any[], dims: number[]): ort.Tensor {
    return new ort.Tensor('float32', Float32Array.from(array.flat(Infinity)), dims);
}

function intArrayToTensor(array: number[][], dims: number[]): ort.Tensor {
    return new ort.Tensor('int64', BigInt64Array.from(array.flat(Infinity).map((x: unknown) => BigInt(x as number))), dims);
}

export function chunkText(text: string, maxLen = 300): string[] {
    const paragraphs = text.trim().split(/\n\s*\n+/).filter(p => p.trim());
    const chunks: string[] = [];
    
    for (const paragraph of paragraphs) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let current = "";
        for (const sentence of sentences) {
            if ((current + sentence).length <= maxLen) {
                current += (current ? " " : "") + sentence;
            } else {
                if (current) chunks.push(current);
                current = sentence;
            }
        }
        if (current) chunks.push(current);
    }
    return chunks;
}

// --- IO Helpers ---

export async function loadTextToSpeech(onnxDir: string): Promise<TextToSpeech> {
    const cfgs: Configs = JSON.parse(fs.readFileSync(path.join(onnxDir, 'tts.json'), 'utf8'));
    
    const [dp, textEnc, vector, vocoder] = await Promise.all([
        ort.InferenceSession.create(path.join(onnxDir, 'duration_predictor.onnx')),
        ort.InferenceSession.create(path.join(onnxDir, 'text_encoder.onnx')),
        ort.InferenceSession.create(path.join(onnxDir, 'vector_estimator.onnx')),
        ort.InferenceSession.create(path.join(onnxDir, 'vocoder.onnx'))
    ]);

    const processor = new UnicodeProcessor(path.join(onnxDir, 'unicode_indexer.json'));
    return new TextToSpeech(cfgs, processor, dp, textEnc, vector, vocoder);
}

export function BufferWav(audioData: number[], sampleRate: number) {
    const dataSize = audioData.length * 2;
    const buffer = Buffer.alloc(44 + dataSize);
    
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // Mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    
    audioData.forEach((sample, i) => {
        const s = Math.max(-1, Math.min(1, sample));
        buffer.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
    });
    
    return buffer
}