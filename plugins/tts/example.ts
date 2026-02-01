import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadTextToSpeech, loadVoiceStyle, timer, writeWavFile, sanitizeFilename } from './utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
    const args = {
        useGpu: false,
        onnxDir: 'assets/onnx',
        totalStep: 5,
        speed: 1.05,
        nTest: 4,
        voiceStyle: ['assets/voice_styles/M1.json'],
        text: ['This morning, I took a walk in the park, and the sound of the birds and the breeze was so pleasant that I stopped for a long time just to listen.'],
        lang: ['en'],
        saveDir: 'results',
        batch: false
    };