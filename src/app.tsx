import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { canUseTTS } from "@/tts/engine";
import { scrollChunkIntoView } from "@/ui/highlight";
import { markdownToHtml, markdownToPlainText, hasBlockContent } from "@/ui/markdown";
import { segmentJapanese } from "@/segmentation/japanese";
import { stripUrls } from "@/segmentation/filters";
import { useSpeechVoices } from "@/voices/useSpeechVoices";
import { usePlaybackController } from "@/features/player/usePlaybackController";
import { PlaybackHeader } from "@/features/player/components/PlaybackHeader";
import { PlaybackControlsCard } from "@/features/player/components/PlaybackControlsCard";
import { TextInputCard } from "@/features/input/TextInputCard";
import { PreviewCard } from "@/features/preview/PreviewCard";
import { NoticeCard } from "@/features/system/NoticeCard";

type ViewMode = "text" | "markdown";

const formatSeconds = (sec: number): string => {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const App = () => {
  const [rawInput, setRawInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [skipUrls, setSkipUrls] = useState(true);

  const {
    voices,
    selectedId,
    setSelectedId,
    selectedVoice,
    warningMessage,
    onlyGoogleVoices,
    fallbackUsed
  } = useSpeechVoices();

  const speakingText = useMemo(
    () => (viewMode === "markdown" ? markdownToPlainText(rawInput) : rawInput),
    [rawInput, viewMode]
  );
  const filteredText = useMemo(
    () => (skipUrls ? stripUrls(speakingText) : speakingText),
    [speakingText, skipUrls]
  );
  const chunks = useMemo(() => segmentJapanese(filteredText), [filteredText]);

  const playback = usePlaybackController(chunks, {
    rate,
    volume,
    voice: selectedVoice
  });

  const { togglePlayPause, next, prev } = playback.commands;

  const handleVolumeChange = useCallback(
    (value: number) => {
      const clamped = Number(clamp(value, 0, 1).toFixed(2));
      if (clamped > 0) {
        setPrevVolume(clamped);
      }
      setVolume(clamped);
    },
    []
  );

  const toggleMute = useCallback(() => {
    if (volume === 0) {
      const restore = prevVolume > 0 ? prevVolume : 1;
      handleVolumeChange(restore);
    } else {
      setPrevVolume(volume || prevVolume || 1);
      handleVolumeChange(0);
    }
  }, [handleVolumeChange, prevVolume, volume]);

  const handleRateChange = useCallback((value: number) => {
    const clampedRate = Number(clamp(value, 0.5, 1.5).toFixed(2));
    setRate(clampedRate);
  }, []);

  const textViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode !== "text") return;
    scrollChunkIntoView(textViewerRef.current, playback.metrics.currentIndex);
  }, [playback.metrics.currentIndex, viewMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      switch (event.key) {
        case " ":
          event.preventDefault();
          togglePlayPause();
          break;
        case "]":
          next();
          break;
        case "[":
          prev();
          break;
        case "+":
          handleRateChange(rate + 0.05);
          break;
        case "-":
          handleRateChange(rate - 0.05);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRateChange, next, prev, rate, togglePlayPause]);

  const progressLabel = playback.metrics.totalChunks
    ? `${playback.metrics.currentIndex + 1} / ${playback.metrics.totalChunks}`
    : "0 / 0";

  const etaLabel =
    playback.metrics.remainingSeconds !== null
      ? formatSeconds(playback.metrics.remainingSeconds)
      : "--:--";

  const markdownHtml = useMemo(() => markdownToHtml(rawInput), [rawInput]);
  const markdownHasBlock = useMemo(() => hasBlockContent(markdownHtml), [markdownHtml]);

  const ttsSupported = canUseTTS();

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-3 py-6 sm:py-10">
      <PlaybackHeader
        etaLabel={etaLabel}
        charCount={playback.metrics.totalChars}
        progressPercent={playback.metrics.progressPercent}
        volumePercent={Math.round(volume * 100)}
        muted={volume === 0}
      />

      {(!ttsSupported || playback.lastError) && (
        <div className="space-y-3">
          {!ttsSupported && (
            <Alert className="border-amber-400/70 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200">
              このブラウザでは SpeechSynthesis が利用できません。対応ブラウザ（Chrome/Edge 最新、Safari 16+）をお使いください。
            </Alert>
          )}
          {playback.lastError && (
            <Alert className="flex items-start justify-between gap-4">
              <span>読み上げ中にエラーが発生しました: {playback.lastError}</span>
              <button
                type="button"
                className="text-sm font-medium underline-offset-4 hover:underline"
                onClick={playback.clearError}
              >
                閉じる
              </button>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PlaybackControlsCard
          state={playback.metrics.state}
          rate={rate}
          onRateChange={handleRateChange}
          boundarySupported={playback.metrics.boundarySupported}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          onToggleMute={toggleMute}
          isMuted={volume === 0}
          skipUrls={skipUrls}
          onSkipUrlsChange={setSkipUrls}
          commands={playback.commands}
          voices={voices}
          selectedVoiceId={selectedId}
          onSelectVoice={setSelectedId}
          voiceMeta={{
            warningMessage,
            onlyGoogleVoices,
            fallbackUsed
          }}
          progressView={{
            chunkLabel: progressLabel,
            percent: playback.metrics.progressPercent,
            etaLabel,
            playedChars: playback.metrics.playedChars,
            totalChars: playback.metrics.totalChars
          }}
        />

        <TextInputCard value={rawInput} onChange={setRawInput} />
      </div>

      <PreviewCard
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        chunks={chunks}
        currentIndex={playback.metrics.currentIndex}
        textViewerRef={textViewerRef}
        markdownHtml={markdownHtml}
        rawInput={rawInput}
        markdownHasBlock={markdownHasBlock}
      />

      <NoticeCard />
    </div>
  );
};

export default App;
