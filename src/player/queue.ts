import { cancel as ttsCancel, pause as ttsPause, resume as ttsResume, speak, SpeakSettings } from "@/tts/engine";

export type PlayerState = "playing" | "paused" | "stopped";

export interface PlayerListeners {
  onIndex?: (index: number, total: number) => void;
  onState?: (state: PlayerState) => void;
  onError?: (error: unknown) => void;
}

export class PlayerQueue {
  private chunks: string[];
  private settings: Required<Pick<SpeakSettings, "rate" | "pitch" | "volume">> & { voice: SpeechSynthesisVoice | null };
  private index = 0;
  private state: PlayerState = "stopped";
  private utterance: SpeechSynthesisUtterance | null = null;
  private listeners: PlayerListeners;
  private retries = 0;

  constructor(chunks: string[] = [], settings: SpeakSettings = {}, listeners: PlayerListeners = {}) {
    this.chunks = Array.isArray(chunks) ? chunks : [];
    this.settings = {
      rate: settings.rate ?? 1,
      pitch: settings.pitch ?? 1,
      volume: settings.volume ?? 1,
      voice: settings.voice ?? null
    };
    this.listeners = listeners;
  }

  setChunks(chunks: string[]): void {
    this.chunks = chunks ?? [];
    this.index = 0;
    this.emitIndex();
  }

  updateSettings(patch: SpeakSettings): void {
    const prevRate = this.settings.rate;
    const prevVoice = this.settings.voice;
    this.settings = {
      rate: patch.rate ?? this.settings.rate,
      pitch: patch.pitch ?? this.settings.pitch,
      volume: patch.volume ?? this.settings.volume,
      voice: patch.voice ?? this.settings.voice
    };
    const shouldRestart = (patch.rate !== undefined && patch.rate !== prevRate) ||
      (patch.voice !== undefined && patch.voice !== prevVoice);
    if (shouldRestart && this.state === "playing") {
      this.restartCurrent();
    }
  }

  play(startIndex: number | null = null): void {
    if (startIndex !== null) {
      this.index = Math.max(0, Math.min(startIndex, this.chunks.length - 1));
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
    this.utterance = null;
    this.retries = 0;
  }

  next(): void {
    if (!this.chunks.length) return;
    this.index = Math.min(this.index + 1, this.chunks.length - 1);
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
    if (this.state === "playing") {
      ttsCancel();
      this.speakCurrent();
    } else {
      this.emitIndex();
    }
  }

  getIndex(): number {
    return this.index;
  }

  getState(): PlayerState {
    return this.state;
  }

  private speakCurrent(): void {
    if (!this.chunks.length) {
      this.stop();
      return;
    }
    const text = this.chunks[this.index];
    this.emitIndex();
    this.utterance = speak(text, this.settings, {
      onend: () => {
        if (this.state !== "playing") return;
        if (this.index < this.chunks.length - 1) {
          this.index += 1;
          this.retries = 0;
          this.speakCurrent();
        } else {
          this.stop();
        }
      },
      onerror: (event) => {
        if (this.retries < 2) {
          this.retries += 1;
          this.speakCurrent();
        } else {
          this.emitError(event?.error || "tts error");
          if (this.index < this.chunks.length - 1) {
            this.index += 1;
            this.retries = 0;
            this.speakCurrent();
          } else {
            this.stop();
          }
        }
      }
    });
  }

  private restartCurrent(): void {
    if (!this.chunks.length) return;
    if (this.utterance) {
      this.utterance.onend = null;
      this.utterance.onerror = null;
    }
    ttsCancel();
    this.retries = 0;
    this.utterance = null;
    this.speakCurrent();
  }

  private emitIndex(): void {
    this.listeners.onIndex?.(this.index, this.chunks.length);
  }

  private emitState(): void {
    this.listeners.onState?.(this.state);
  }

  private emitError(error: unknown): void {
    this.listeners.onError?.(error);
  }
}
