/**
 * Global constants for the application
 * This file contains all magic strings, error messages, and configuration values
 * to improve maintainability and avoid duplication.
 */

// ============================================================================
// Platform Constants
// ============================================================================

export const PLATFORMS = {
  YOUTUBE: "youtube",
  TWITCH: "twitch",
  TIKTOK: "tiktok",
  KICK: "kick",
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

// ============================================================================
// Plugin Names
// ============================================================================

export const PLUGIN_NAMES = {
  ACTION_REGISTRY: "action-registry",
  RULE_TESTER: "rule-tester",
  TTS_SERVICE: "tts-service",
  TIKFINITY: "tikfinity",
  MCPLUGIN: "mcplugin",
} as const;

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  VOICES: "voices",
  TTS_CONFIG: "ttsConfig",
  LAST_MESSAGE: "lastMessage",
} as const;

// ============================================================================
// TTS Configuration Defaults
// ============================================================================

export const TTS_DEFAULTS = {
  VOLUME: 100,
  VOICE: "F1",
  RATE: "0%",
  PITCH: "0Hz",
  OUTPUT_DIR: "./output",
} as const;

// ============================================================================
// TikTok/Tikfinity Constants
// ============================================================================

export const TIKTOK_CONSTANTS = {
  WEBSOCKET_URL: "wss://tikfinity-cws-04.zerody.one/socket.io/",
  WEBSOCKET_PARAMS: "?EIO=4&transport=websocket",
  PAYLOAD_PREFIX: "TikFinity_PAYLOAD:",
  EVENT_LOGGED: "tikfinity_logged",
  EVENT_MESSAGE: "tikfinity_msg",
  ENGINE_IO_MESSAGE: "40",
  PING_MESSAGE: "2",
  PONG_MESSAGE: "3",
  SOCKET_IO_DATA_PREFIX: "42",
} as const;

// ============================================================================
// Log Messages
// ============================================================================

export const LOG_MESSAGES = {
  WEBVIEW: {
    CLOSED: "closed webview process",
    ERROR: "error webview",
    ON_UNLOAD: "on unload plugin",
    STARTED: "started webview process",
    CLOSING: "closing webview process",
  },
  WEBSOCKET: {
    ALREADY_OPEN: "ws already open",
    OPEN: "ws open",
    PAYLOAD_SENT: "socket.send(this.payload)",
    MAX_RECONNECT: "❌ Máximo de intentos de reconexión alcanzado",
    MANUAL_CLOSE: "Cierre manual",
    DISCONNECTED: "👋 WebSocket desconectado manualmente",
    UPDATING_PAYLOAD: "🔄 Actualizando payload (cambiando de canal)...",
    NEW_PAYLOAD_SENT: "📤 Nuevo payload enviado",
    NOT_CONNECTED: "⚠️ WebSocket no conectado, iniciando nueva conexión...",
    CONNECTING: (attempt: number) => `🔄 Intentando conectar... (intento ${attempt})`,
    RECONNECTING: (delay: number, attempt: number, maxAttempts: number) =>
      `⏳ Reconectando en ${Math.round(delay)}ms... (intento ${attempt}/${maxAttempts})`,
  },
  TIKFINITY: {
    CONNECTION_EXISTS: "🔄 Conexión existente detectada, actualizando canal...",
    CLOSING_WS: "Cerrando conexión WebSocket...",
  },
  PLAYLIST: {
    OPERATION_IN_PROGRESS: "⏭️  Operation in progress, skipping duplicate call",
    NO_TRACKS: "No tracks loaded",
    LOADING_TRACKS: (count: number) => `📚 Loading ${count} tracks into playlist...`,
    LOADED_TRACKS: (count: number) => `✅ Loaded ${count} valid tracks`,
    ADDED_TRACK: (total: number) => `✅ Added track. Total: ${total}`,
    PLAYING_TRACK: (current: number, total: number, label: string) =>
      `🎵 Playing track ${current}/${total}: ${label}`,
    EMPTY_TRACK_PATH: "❌ Empty string track path",
    EMPTY_BUFFER: "❌ Buffer track is empty",
    INVALID_FORMAT: "❌ Invalid track format",
    PLAYBACK_ERROR: "❌ Failed to play track:",
    LOOPING: "🔄 Looping playlist",
    END_OF_PLAYLIST: "✅ End of playlist reached",
    PAUSED: "⏸️  Paused",
    RESUMED: "▶️  Resumed",
    STOPPED: "⏹️  Stopped",
    STOP_ERROR: "Error stopping player:",
    LOOP_MODE: (enabled: boolean) => `🔄 Loop mode: ${enabled ? "ON" : "OFF"}`,
    DISPOSED: "🗑️  Playlist resources disposed",
    MONITOR_ERROR: "[Monitor] Error checking player state:",
    TIMEOUT_WAITING: "Timeout waiting for idle",
    INVALID_INDEX: (index: number) => `Invalid track index: ${index}`,
  },
  TTS: {
    INITIALIZING_STORAGE: (pluginName: string, key: string) =>
      `[${pluginName}] Initializing storage for key: ${key}`,
    CONFIG_LOADED: "[TTSPlugin] Config loaded:",
    LAST_MESSAGE: (msg: string) => `[TTSPlugin] Last processed message: ${msg}`,
  },
  SHUTDOWN: "\n\nShutting down...",
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  PARSE: {
    EMPTY_INPUT: "Input must be a non-empty string",
    UNKNOWN_ERROR: "Unknown parsing error",
    NOT_AN_ARRAY: "Parsed JSON is not an array",
    NOT_AN_OBJECT: "Parsed JSON is not an object",
    NOT_PRIMITIVE: "Parsed JSON is not a primitive value",
    INVALID_SOCKET_IO: "Invalid Socket.io message format",
    FORMATTING_ERROR: "Formatting error",
    DEPTH_EXCEEDED: (maxDepth: number) =>
      `JSON depth exceeds maximum allowed depth of ${maxDepth}`,
    ARRAY_ITEM: (index: number, summary: string) =>
      `Error at index ${index}: ${summary}`,
  },
  PLAYLIST: {
    UNSUPPORTED_FORMAT: (track: string) =>
      `Unsupported format or invalid extension: ${track}`,
    FILE_NOT_FOUND: (track: string) => `File not found: ${track}`,
  },
  RAG: {
    NOT_INITIALIZED: "RAG no inicializado",
    TABLE_NOT_INITIALIZED: "Table not initialized",
  },
  PLUGIN: {
    NOT_LOADED: "Plugin no cargado",
  },
} as const;

// ============================================================================
// File Paths
// ============================================================================

export const PATHS = {
  RULES_DIR: "rules",
  PLUGINS_DIR: "plugins",
  SCRIPTS_DIR: "scripts",
  OUTPUT_DIR: "./output",
  TIKFINITY_WEBVIEW_TS: "scripts/tikfinity-webview.ts",
  TIKFINITY_WEBVIEW_JS: "scripts/tikfinity-webview.js",
} as const;

// ============================================================================
// Action Names
// ============================================================================

export const ACTIONS = {
  TTS: "TTS",
  LAST_COMMENT: "lastcomment",
  MC_COMMAND: "minecraft:command",
  // New evaluation actions
  EVALUATE: "evaluate",
  EVALUATE_AND_SPEAK: "evaluate_and_speak",
  DATETIME: "datetime",
  TTS_DIRECT: "tts_direct",
  AI_RESPOND: "ai_respond",
  // toggles
  AUTOSAVE: "autosave"
} as const;

// ============================================================================
// Helper Names
// ============================================================================

export const HELPERS = {
  LAST: "last",
  CLEAN: "clean",
} as const;

// ============================================================================
// Event Names
// ============================================================================

export const EVENTS = {
  TRACK_START: "trackStart",
  TRACK_END: "trackEnd",
  PLAYLIST_END: "playlistEnd",
} as const;

// ============================================================================
// Track End Reasons
// ============================================================================

export const TRACK_END_REASONS = {
  COMPLETED: "completed",
  MANUAL: "manual",
} as const;

export type TrackEndReason =
  (typeof TRACK_END_REASONS)[keyof typeof TRACK_END_REASONS];

// ============================================================================
// Time Constants (in milliseconds)
// ============================================================================

export const TIMING = {
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000,
  PAYLOAD_SEND_DELAY: 500,
  TRANSITION_DELAY: 100,
  NEXT_TRACK_DELAY: 50,
  IDLE_TIMEOUT: 1000,
  MONITOR_INTERVAL: 500,
  WAIT_FOR_IDLE_TIMEOUT: 5000,
} as const;

// ============================================================================
// WebSocket Constants
// ============================================================================

export const WS_CONSTANTS = {
  MAX_RECONNECT_ATTEMPTS: 10,
  CLOSE_CODE_NORMAL: 1000,
  READY_STATE_OPEN: 1, // WebSocket.OPEN
} as const;

// ============================================================================
// Audio Constants
// ============================================================================

export const AUDIO = {
  DEFAULT_VOLUME: "100%",
  DEFAULT_RATE: "0%",
  DEFAULT_PITCH: "0Hz",
  BUFFER_TRACK_LABEL: (index: number) => `Buffer Track #${index}`,
} as const;
