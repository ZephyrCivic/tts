import { useEffect, useMemo, useState } from "react";

import { canUseTTS } from "@/tts/engine";
import { chooseDefault, japaneseVoices, waitForVoices } from "@/voices/detect";

export interface VoiceState {
  voices: SpeechSynthesisVoice[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  selectedVoice: SpeechSynthesisVoice | null;
  warningMessage: string | null;
  onlyGoogleVoices: boolean;
  fallbackUsed: boolean;
}

export function useSpeechVoices(): VoiceState {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [onlyGoogleVoices, setOnlyGoogleVoices] = useState<boolean>(false);
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(false);

  useEffect(() => {
    if (!canUseTTS()) {
      setWarningMessage("このブラウザでは SpeechSynthesis が利用できません。対応ブラウザ（Chrome/Edge 最新、Safari 16+）でお試しください。");
      return;
    }
    let cancelled = false;
    (async () => {
      const all = await waitForVoices();
      if (cancelled) return;
      const ja = japaneseVoices(all);
      const googleCandidates = ja.filter((voice) =>
        /google/i.test(voice.name || "") && /日本語|ja-JP/i.test(`${voice.name} ${voice.lang}`)
      );
      const finalVoices = googleCandidates.length ? googleCandidates : ja;
      setVoices(finalVoices);
      setOnlyGoogleVoices(googleCandidates.length > 0);
      setFallbackUsed(googleCandidates.length === 0 && finalVoices.length > 0);
      if (!finalVoices.length) {
        setWarningMessage("日本語 voice が見つかりませんでした。ブラウザやOSの音声設定をご確認ください。");
        return;
      }
      const def = chooseDefault(finalVoices);
      const index = def ? finalVoices.findIndex((voice) => voice === def) : 0;
      setSelectedId(String(Math.max(index, 0)));
      setWarningMessage(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedVoice = useMemo(() => {
    if (!selectedId) return null;
    const idx = Number(selectedId);
    if (!Number.isFinite(idx)) return null;
    return voices[idx] ?? null;
  }, [selectedId, voices]);

  return {
    voices,
    selectedId,
    setSelectedId,
    selectedVoice,
    warningMessage,
    onlyGoogleVoices,
    fallbackUsed
  };
}

