export function waitForVoices(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices && voices.length) return resolve(voices);
    let done = false;
    const on = () => { if (!done) { done = true; resolve(speechSynthesis.getVoices()); speechSynthesis.removeEventListener('voiceschanged', on); } };
    speechSynthesis.addEventListener('voiceschanged', on);
    setTimeout(() => on(), timeoutMs);
  });
}

export function japaneseVoices(all) {
  return (all || []).filter(v => /\bja(-JP)?\b/i.test(v.lang || "") || /Japanese/i.test(v.name || ""));
}

export function chooseDefault(ja) {
  if (!ja || !ja.length) return null;
  // 名前に "日本語" や "ja-JP" を含むものを優先
  const prioritized = ja.find(v => /日本語|ja-JP/i.test(`${v.name} ${v.lang}`));
  return prioritized || ja[0];
}

