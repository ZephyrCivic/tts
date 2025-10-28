export async function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === "undefined") return [];
  const existing = speechSynthesis.getVoices();
  if (existing && existing.length) return existing;
  return new Promise((resolve) => {
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      resolve(speechSynthesis.getVoices());
      speechSynthesis.removeEventListener("voiceschanged", finalize);
    };
    speechSynthesis.addEventListener("voiceschanged", finalize);
    setTimeout(finalize, timeoutMs);
  });
}

export function japaneseVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return (all || []).filter((voice) => /\bja(-JP)?\b/i.test(voice.lang || "") || /Japanese/i.test(voice.name || ""));
}

export function chooseDefault(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || !voices.length) return null;
  const prioritized = voices.find((v) => /日本語|ja-JP/i.test(`${v.name} ${v.lang}`));
  return prioritized || voices[0];
}
