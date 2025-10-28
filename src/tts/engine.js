// SpeechSynthesis の薄いラッパ

export function canUseTTS() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text, settings, callbacks = {}) {
  if (!canUseTTS()) throw new Error("speechSynthesis が利用できません");
  const { rate = 1, pitch = 1, volume = 1, voice = null } = settings || {};
  const u = new SpeechSynthesisUtterance(text);
  u.lang = (voice && voice.lang) || "ja-JP";
  u.rate = rate;
  u.pitch = pitch;
  u.volume = volume;
  if (voice) u.voice = voice;
  if (callbacks.onend) u.onend = callbacks.onend;
  if (callbacks.onerror) u.onerror = callbacks.onerror;
  if (callbacks.onboundary) u.onboundary = callbacks.onboundary;
  window.speechSynthesis.speak(u);
  return u;
}

export function cancel() {
  if (canUseTTS()) window.speechSynthesis.cancel();
}

export function pause() {
  if (canUseTTS()) window.speechSynthesis.pause();
}

export function resume() {
  if (canUseTTS()) window.speechSynthesis.resume();
}

export function speaking() {
  return canUseTTS() ? window.speechSynthesis.speaking : false;
}

export function paused() {
  return canUseTTS() ? window.speechSynthesis.paused : false;
}

