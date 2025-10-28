import { speak, cancel as ttsCancel, pause as ttsPause, resume as ttsResume } from "../tts/engine.js";

export class PlayerQueue {
  constructor(chunks, settings = {}, listeners = {}) {
    this.chunks = Array.isArray(chunks) ? chunks : [];
    this.settings = { rate: 1, pitch: 1, volume: 1, voice: null, ...settings };
    this.i = 0;
    this.state = "stopped"; // playing | paused | stopped
    this.utt = null;
    this.listeners = listeners; // { onIndex, onState, onError }
    this.retries = 0;
  }

  setChunks(chunks) {
    this.chunks = chunks || [];
    this.i = 0;
    this._emitIndex();
  }

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
  }

  play(startIndex = null) {
    if (startIndex !== null) this.i = Math.max(0, Math.min(startIndex, this.chunks.length - 1));
    if (this.state === "paused") return this.resume();
    if (this.state === "playing") return;
    this.state = "playing"; this._emitState();
    this._speakCurrent();
  }

  pause() {
    if (this.state !== "playing") return;
    ttsPause();
    this.state = "paused"; this._emitState();
  }

  resume() {
    if (this.state !== "paused") return;
    ttsResume();
    this.state = "playing"; this._emitState();
  }

  stop() {
    ttsCancel();
    this.state = "stopped"; this._emitState();
    this.utt = null; this.retries = 0;
  }

  next() {
    if (!this.chunks.length) return;
    this.i = Math.min(this.i + 1, this.chunks.length - 1);
    if (this.state === "playing") {
      ttsCancel();
      this._speakCurrent();
    } else {
      this._emitIndex();
    }
  }

  prev() {
    if (!this.chunks.length) return;
    this.i = Math.max(this.i - 1, 0);
    if (this.state === "playing") {
      ttsCancel();
      this._speakCurrent();
    } else {
      this._emitIndex();
    }
  }

  _speakCurrent() {
    if (!this.chunks.length) return this.stop();
    const text = this.chunks[this.i];
    this._emitIndex();
    this.utt = speak(text, this.settings, {
      onend: () => {
        if (this.state !== "playing") return; // 停止/一時停止なら進めない
        if (this.i < this.chunks.length - 1) {
          this.i++; this.retries = 0; this._speakCurrent();
        } else {
          this.stop();
        }
      },
      onerror: (ev) => {
        // 最大2回までリトライ
        if (this.retries < 2) {
          this.retries++;
          this._speakCurrent();
        } else {
          this._emitError(ev?.error || "tts error");
          // スキップして次へ
          if (this.i < this.chunks.length - 1) {
            this.i++; this.retries = 0; this._speakCurrent();
          } else {
            this.stop();
          }
        }
      }
    });
  }

  _emitIndex() { this.listeners.onIndex && this.listeners.onIndex(this.i, this.chunks.length); }
  _emitState() { this.listeners.onState && this.listeners.onState(this.state); }
  _emitError(err) { this.listeners.onError && this.listeners.onError(err); }
}

