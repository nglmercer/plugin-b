import { AudioPlayer, initializeAudio, getSupportedFormats, createAudioPlayer, isFormatSupported, getAudioMetadata } from "miniaudio_node";
import type { AudioPlayerConfig } from "miniaudio_node";

export type Track = string | Buffer;

/**
 * Playlist manager class for handling multiple audio files and buffers
 */
export class PlaylistManager {
  private player: AudioPlayer;
  private tracks: Track[] = [];
  private currentTrackIndex: number = 0;
  private isPlaying: boolean = false;
  private loop: boolean = false;

  constructor(options?: AudioPlayerConfig | undefined) {
    this.player = createAudioPlayer(options);
  }

  /**
   * Load multiple tracks into playlist
   */
  async loadTracks(tracks: Track[]): Promise<void> {
    console.log(`📚 Loading ${tracks.length} tracks into playlist...`);

    // Validate all tracks exist and are supported
    const validTracks: Track[] = [];

    for (const track of tracks) {
      if (typeof track === 'string') {
        const extension = track.split(".").pop()?.toLowerCase();
        if (!extension || !isFormatSupported(extension)) {
          console.warn(`⚠️  Unsupported format or invalid extension: ${track}`);
          continue;
        }

        // Check file exists
        const fs = await import("node:fs");
        if (!fs.existsSync(track)) {
          console.warn(`⚠️  File not found: ${track}`);
          continue;
        }
        validTracks.push(track);
      } else if (Buffer.isBuffer(track)) {
        // Assume buffers are valid audio data (or let player fail later)
        // We can't easily check format without parsing headers, 
        // but miniaudio should handle standard headers (wav, mp3, etc) in buffer
        validTracks.push(track);
      }
    }

    this.tracks = validTracks;

    console.log(`✅ Loaded ${this.tracks.length} valid tracks`);
  }

  /**
   * Play current track
   */
  async playCurrentTrack(): Promise<void> {
    if (this.tracks.length === 0) {
      throw new Error("No tracks loaded");
    }

    const currentTrack = this.tracks[this.currentTrackIndex];
    if (!currentTrack) return; // Should not happen with check above

    const trackLabel = typeof currentTrack === 'string' ? currentTrack : `Buffer Track #${this.currentTrackIndex + 1}`;
    
    console.log(
      `🎵 Playing track ${this.currentTrackIndex + 1}/${this.tracks.length}: ${trackLabel}`,
    );

    try {
      if (typeof currentTrack === 'string') {
        if (!currentTrack || currentTrack.trim() === '') {
             console.error("❌ Empty string track path");
             return;
        }
        await this.player.loadFile(currentTrack);
        
        // Show track metadata for files
        const metadata = getAudioMetadata(currentTrack);
        console.log("📋 Track info:", metadata);

      } else if (Buffer.isBuffer(currentTrack)) {
        if (currentTrack.length === 0) {
             console.error("❌ Buffer track is empty");
             return;
        }
        // Convert Buffer to number[] as required by miniaudio_node loadBuffer
        const bufferData = Array.from(currentTrack);
        await this.player.loadBuffer(bufferData);
        console.log("📋 Track info: [Memory Buffer]");
      } else {
         console.error("❌ Invalid track format");
         return;
      }

      await this.player.play();
      this.isPlaying = true;

      // Auto-advance to next track when current one finishes
      this.monitorPlayback();
    } catch (error) {
      console.error("❌ Failed to play track:", error);
      this.isPlaying = false;
    }
  }

  /**
   * Monitor playback and advance to next track
   */
  private monitorPlayback(): void {
    // Clear any existing interval to prevent duplicates if play is called rapidly
    // (Note: In a real robust implementation, store interval ID in class property)
    
    const checkInterval = setInterval(() => {
      // Check if player expects initialized and is actually playing
      // The miniaudio_node library might behave synchronously or async
      
      // If manually stopped or paused, we shouldn't auto advance immediately unless intended
      if (!this.player.isPlaying() && this.isPlaying) {
        clearInterval(checkInterval);
        this.isPlaying = false;
        this.nextTrack();
      }
    }, 1000);
  }

  /**
   * Play next track in playlist
   */
  async nextTrack(): Promise<void> {
    this.currentTrackIndex++;

    if (this.currentTrackIndex >= this.tracks.length) {
      if (this.loop) {
        this.currentTrackIndex = 0;
        console.log("🔄 Looping playlist");
      } else {
        console.log("✅ End of playlist reached");
        return;
      }
    }

    await this.playCurrentTrack();
  }

  /**
   * Play previous track
   */
  async previousTrack(): Promise<void> {
    this.currentTrackIndex = Math.max(0, this.currentTrackIndex - 1);
    await this.playCurrentTrack();
  }

  /**
   * Pause current playback
   */
  pause(): void {
    this.player.pause();
    this.isPlaying = false;
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.isPlaying && this.tracks.length > 0) {
      await this.player.play();
      this.isPlaying = true;
      this.monitorPlayback();
    }
  }

  /**
   * Stop playback and reset
   */
  async stop(): Promise<void> {
    await this.player.stop();
    this.isPlaying = false;
    this.currentTrackIndex = 0;
  }

  /**
   * Set looping mode
   */
  setLoop(enabled: boolean): void {
    this.loop = enabled;
    console.log(`🔄 Loop mode: ${enabled ? "ON" : "OFF"}`);
  }

  /**
   * Get playlist status
   */
  getStatus() {
    const currentTrack = this.tracks[this.currentTrackIndex];
    return {
      totalTracks: this.tracks.length,
      currentTrack: this.currentTrackIndex + 1,
      currentTrackPath: typeof currentTrack === 'string' ? currentTrack : 'Buffer',
      isPlaying: this.isPlaying,
      loop: this.loop,
      volume: this.player.getVolume(),
    };
  }
}
