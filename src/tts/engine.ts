export interface SpeakCallbacks {
  onend?: (event: SpeechSynthesisEvent) => void;
  onerror?: (event: SpeechSynthesisErrorEvent) => void;
  onboundary?: (event: SpeechSynthesisEvent) => void;
}

export interface SpeakSettings {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

export function canUseTTS(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, settings: SpeakSettings = {}, callbacks: SpeakCallbacks = {}): SpeechSynthesisUtterance {
  if (!canUseTTS()) throw new Error("speechSynthesis が利用できません");
  const { rate = 1, pitch = 1, volume = 1, voice = null } = settings;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = (voice && voice.lang) || "ja-JP";
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  if (voice) utterance.voice = voice;
  if (callbacks.onend) utterance.onend = callbacks.onend;
  if (callbacks.onerror) utterance.onerror = callbacks.onerror;
  if (callbacks.onboundary) utterance.onboundary = callbacks.onboundary;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function cancel(): void {
  if (canUseTTS()) window.speechSynthesis.cancel();
}

export function pause(): void {
  if (canUseTTS()) window.speechSynthesis.pause();
}

export function resume(): void {
  if (canUseTTS()) window.speechSynthesis.resume();
}

export function speaking(): boolean {
  return canUseTTS() ? window.speechSynthesis.speaking : false;
}

export function paused(): boolean {
  return canUseTTS() ? window.speechSynthesis.paused : false;
}
