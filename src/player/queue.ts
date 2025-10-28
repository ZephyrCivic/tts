import { cancel as ttsCancel, pause as ttsPause, resume as ttsResume, speak, SpeakSettings } from "@/tts/engine";

export type PlayerState = "playing" | "paused" | "stopped";

export interface PlayerListeners {
  onIndex?: (index: number, total: number) => void;
  onState?: (state: PlayerState) => void;
  onError?: (error: unknown) => void;
  onProgress?: (payload: {
    index: number;
    total: number;
    chunkLength: number;
    charOffset: number;
    boundarySupported: boolean;
  }) => void;
}

interface InternalSettings {
  rate: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export class PlayerQueue {
  private chunks: string[];
  private settings: InternalSettings;
  private index = 0;
  private state: PlayerState = "stopped";
  private utterance: SpeechSynthesisUtterance | null = null;
  private listeners: PlayerListeners;
  private retries = 0;

  private resumeFromOffset = 0;
  private spokenOffsetBase = 0;
  private currentChunkLength = 0;
  private boundarySupported = false;
  private lastKnownCharOffset = 0;

  constructor(chunks: string[] = [], settings: SpeakSettings = {}, listeners: PlayerListeners = {}) {
    this.chunks = Array.isArray(chunks) ? chunks : [];
    this.settings = {
      rate: settings.rate ?? 1,
      volume: settings.volume ?? 1,
      voice: settings.voice ?? null
    };
    this.listeners = listeners;
  }

  setChunks(chunks: string[]): void {
    this.chunks = chunks ?? [];
    this.index = Math.min(this.index, Math.max(this.chunks.length - 1, 0));
    this.resetOffsets();
    this.emitIndex();
  }

  updateSettings(patch: SpeakSettings): void {
    const prevRate = this.settings.rate;
    const prevVoice = this.settings.voice;
    this.settings = {
      rate: patch.rate ?? this.settings.rate,
      volume: patch.volume ?? this.settings.volume,
      voice: patch.voice ?? this.settings.voice
    };
    const rateChanged = patch.rate !== undefined && patch.rate !== prevRate;
    const voiceChanged = patch.voice !== undefined && patch.voice !== prevVoice;

    if (voiceChanged && this.state === "playing") {
      this.restartCurrent(0);
      return;
    }

    if (rateChanged && this.state === "playing") {
      const restartOffset = this.boundarySupported ? this.lastKnownCharOffset : 0;
      this.restartCurrent(restartOffset);
    }
  }

  play(startIndex: number | null = null): void {
    if (startIndex !== null) {
      this.index = Math.max(0, Math.min(startIndex, this.chunks.length - 1));
      this.resetOffsets();
    }
    if (this.state === "paused") {
      this.resume();
      return;
    }
    if (this.state === "playing") return;
    this.state = "playing";
    this.emitState();
    this.speakCurrent();
  }

  pause(): void {
    if (this.state !== "playing") return;
    ttsPause();
    this.state = "paused";
    this.emitState();
  }

  resume(): void {
    if (this.state !== "paused") return;
    ttsResume();
    this.state = "playing";
    this.emitState();
  }

  stop(): void {
    ttsCancel();
    this.state = "stopped";
    this.emitState();
    this.resetOffsets();
    this.utterance = null;
    this.retries = 0;
  }

  next(): void {
    if (!this.chunks.length) return;
    this.index = Math.min(this.index + 1, this.chunks.length - 1);
    this.resetOffsets();
    if (this.state === "playing") {
      ttsCancel();
      this.speakCurrent();
    } else {
      this.emitIndex();
    }
  }

  prev(): void {
    if (!this.chunks.length) return;
    this.index = Math.max(this.index - 1, 0);
    this.resetOffsets();
    if (this.state === "playing") {
      ttsCancel();
      this.speakCurrent();
    } else {
      this.emitIndex();
    }
  }

  seek(index: number, options: { play: boolean }): void {
    if (!this.chunks.length) return;
    this.index = Math.max(0, Math.min(index, this.chunks.length - 1));
    ttsCancel();
    this.utterance = null;
    this.resetOffsets();
    if (options.play) {
      this.state = "playing";
      this.emitState();
      this.speakCurrent();
    } else {
      if (this.state === "playing") {
        this.pause();
      }
      this.emitIndex();
    }
  }

  getIndex(): number {
    return this.index;
  }

  getState(): PlayerState {
    return this.state;
  }

  getCharOffset(): number {
    return this.lastKnownCharOffset;
  }

  private speakCurrent(): void {
    if (!this.chunks.length) {
      this.stop();
      return;
    }
    const chunk = this.chunks[this.index] ?? "";
    const offset = Math.min(this.resumeFromOffset, chunk.length);
    this.spokenOffsetBase = offset;
    this.currentChunkLength = chunk.length;
    const remaining = chunk.slice(offset);
    this.lastKnownCharOffset = offset;
    this.resumeFromOffset = 0;

    if (!remaining) {
      this.autoAdvance();
      return;
    }

    this.emitIndex();
    this.emitProgress();

    this.utterance = speak(remaining, this.settings, {
      onboundary: (event) => {
        this.boundarySupported = true;
        const delta = typeof event.charIndex === "number" ? event.charIndex : 0;
        this.lastKnownCharOffset = Math.min(this.spokenOffsetBase + delta, this.currentChunkLength);
        this.emitProgress();
      },
      onend: () => {
        if (this.state !== "playing") return;
        this.resetOffsets();
        this.autoAdvance();
      },
      onerror: (event) => {
        if (this.retries < 2) {
          this.retries += 1;
          this.resumeFromOffset = this.lastKnownCharOffset;
          this.speakCurrent();
        } else {
          this.emitError(event?.error || "tts error");
          this.resetOffsets();
          this.autoAdvance();
        }
      }
    });
  }

  private autoAdvance(): void {
    if (this.index < this.chunks.length - 1) {
      this.index += 1;
      this.retries = 0;
      this.speakCurrent();
    } else {
      this.stop();
    }
  }

  private restartCurrent(offset: number): void {
    if (!this.chunks.length) return;
    if (this.utterance) {
      this.utterance.onend = null;
      this.utterance.onerror = null;
      this.utterance.onboundary = null;
    }
    ttsCancel();
    this.retries = 0;
    this.resumeFromOffset = Math.max(0, Math.min(offset, this.currentChunkLength));
    this.speakCurrent();
  }

  private resetOffsets(): void {
    this.resumeFromOffset = 0;
    this.spokenOffsetBase = 0;
    this.currentChunkLength = this.chunks[this.index]?.length ?? 0;
    this.lastKnownCharOffset = 0;
  }

  private emitIndex(): void {
    this.listeners.onIndex?.(this.index, this.chunks.length);
    this.emitProgress();
  }

  private emitState(): void {
    this.listeners.onState?.(this.state);
  }

  private emitError(error: unknown): void {
    this.listeners.onError?.(error);
  }

  private emitProgress(): void {
    this.listeners.onProgress?.({
      index: this.index,
      total: this.chunks.length,
      chunkLength: this.currentChunkLength,
      charOffset: this.lastKnownCharOffset,
      boundarySupported: this.boundarySupported
    });
  }
}
