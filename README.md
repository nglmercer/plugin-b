# plugin-b

A Bun-based plugin system with AI integration, TTS, and TikTok connectivity.

## Quick Start

```bash
bun install
bun run dev      # Development mode with watch
bun run build    # Build core and plugins
bun run start    # Run production build
```

## Features

- **Plugin Architecture**: Modular system with hot-reloading support
- **AI Integration**: DeepSeek, OpenAI, LMStudio, and local embeddings via LanceDB
- **TTS Support**: Supertonic ONNX-based text-to-speech
- **TikTok Live**: WebSocket integration for TikTok interactions
- **System Tray**: Native tray icon for desktop control

## Project Structure

```
src/           # Core application
plugins/       # Plugin implementations
scripts/       # Build scripts
```
