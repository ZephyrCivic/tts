import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, ChevronLeft, ChevronRight, Volume2, Clock, Type, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";

import { PlayerQueue, PlayerState } from "@/player/queue";
import { segmentJapanese, approxCharsPerSecond } from "@/segmentation/japanese";
import { markdownToHtml, markdownToPlainText, hasBlockContent } from "@/ui/markdown";
import { scrollChunkIntoView } from "@/ui/highlight";
import { canUseTTS } from "@/tts/engine";
import { chooseDefault, japaneseVoices, waitForVoices } from "@/voices/detect";
import { cn } from "@/lib/utils";

type ViewMode = "text" | "markdown";

const formatSeconds = (sec: number): string => {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function useSpeechVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [googleOnly, setGoogleOnly] = useState<boolean>(false);
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(false);

  useEffect(() => {
    if (!canUseTTS()) {
      setWarningMessage("このブラウザでは SpeechSynthesis が利用できません。対応ブラウザ（Chrome/Edge 最新、Safari 16+）をご利用ください。");
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
      setGoogleOnly(googleCandidates.length > 0);
      setFallbackUsed(googleCandidates.length === 0 && finalVoices.length > 0);
      if (!finalVoices.length) {
        setWarningMessage("日本語音声が検出できませんでした。ブラウザやOSの言語設定を確認してください。");
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
    googleOnly,
    fallbackUsed
  };
}

function usePlayer(chunks: string[], options: { rate: number; voice: SpeechSynthesisVoice | null }) {
  const queueRef = useRef<PlayerQueue | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>("stopped");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [charOffset, setCharOffset] = useState(0);
  const [boundarySupported, setBoundarySupported] = useState(false);

  useEffect(() => {
    const queue = new PlayerQueue([], {}, {
      onIndex: (index, total) => {
        setCurrentIndex(total ? Math.min(index, total - 1) : 0);
        setTotalChunks(total);
        setCharOffset(0);
      },
      onState: (state) => setPlayerState(state),
      onError: (error) => {
        console.warn("TTS error", error);
        const message = error instanceof Error ? error.message : String(error);
        setLastError(message);
      },
      onProgress: ({ charOffset: offset, boundarySupported: supported }) => {
        setCharOffset(offset);
        setBoundarySupported(supported);
      }
    });
    queueRef.current = queue;
    return () => {
      queue.stop();
      queueRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!queueRef.current) return;
    queueRef.current.updateSettings({ rate: options.rate, voice: options.voice ?? null });
  }, [options.rate, options.voice]);

  useEffect(() => {
    const queue = queueRef.current;
    if (!queue) return;
    queue.stop();
    queue.setChunks(chunks);
    setTotalChunks(chunks.length);
    setCurrentIndex(chunks.length ? Math.min(queue.getIndex(), chunks.length - 1) : 0);
    setCharOffset(0);
  }, [chunks]);

  const commands = useMemo(() => ({
    playOrPause: () => {
      const queue = queueRef.current;
      if (!queue || !chunks.length) return;
      const state = queue.getState();
      if (state === "playing") {
        queue.pause();
      } else if (state === "paused") {
        queue.resume();
      } else {
        queue.play();
      }
    },
    stop: () => queueRef.current?.stop(),
    next: () => queueRef.current?.next(),
    prev: () => queueRef.current?.prev(),
    seekTo: (index: number) => {
      const queue = queueRef.current;
      if (!queue || !chunks.length) return;
      const shouldPlay = queue.getState() === "playing";
      queue.seek(index, { play: shouldPlay });
    }
  }), [chunks.length]);

  return {
    playerState,
    currentIndex,
    totalChunks,
    lastError,
    clearError: () => setLastError(null),
    commands,
    charOffset,
    boundarySupported
  };
}

const App = () => {
  const [rawInput, setRawInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const [rate, setRate] = useState(1);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const {
    voices,
    selectedId,
    setSelectedId,
    selectedVoice,
    warningMessage,
    googleOnly,
    fallbackUsed
  } = useSpeechVoices();

  const speakingText = useMemo(() => (viewMode === "markdown" ? markdownToPlainText(rawInput) : rawInput), [rawInput, viewMode]);
  const chunks = useMemo(() => segmentJapanese(speakingText), [speakingText]);

  const {
    playerState,
    currentIndex,
    totalChunks,
    lastError,
    clearError,
    commands,
    charOffset,
    boundarySupported
  } = usePlayer(chunks, {
    rate,
    voice: selectedVoice
  });

  const textViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode !== "text") return;
    scrollChunkIntoView(textViewerRef.current, currentIndex);
  }, [currentIndex, viewMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      switch (event.key) {
        case " ":
          event.preventDefault();
          commands.playOrPause();
          break;
        case "]":
          commands.next();
          break;
        case "[":
          commands.prev();
          break;
        case "+":
          setRate((prev) => Math.min(2, Number((prev + 0.05).toFixed(2))));
          break;
        case "-":
          setRate((prev) => Math.max(0.5, Number((prev - 0.05).toFixed(2))));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commands]);

  const progressLabel = totalChunks > 0 ? `${currentIndex + 1} / ${totalChunks}` : "0 / 0";

  const totalChars = useMemo(() => chunks.reduce((sum, chunk) => sum + chunk.length, 0), [chunks]);
  const playedChars = useMemo(() => {
    if (!chunks.length) return 0;
    const before = chunks.slice(0, currentIndex).reduce((sum, chunk) => sum + chunk.length, 0);
    return before + charOffset;
  }, [chunks, currentIndex, charOffset]);

  const remainingSec = useMemo(() => {
    if (!chunks.length) return null;
    const remainChars = Math.max(totalChars - playedChars, 0);
    const sec = Math.ceil(remainChars / approxCharsPerSecond(rate));
    return Number.isFinite(sec) ? sec : null;
  }, [totalChars, playedChars, rate, chunks.length]);

  const progressPercent = useMemo(() => {
    if (!totalChars) return 0;
    return Math.min(100, Math.round((playedChars / totalChars) * 100));
  }, [playedChars, totalChars]);

  const etaLabel = remainingSec !== null ? formatSeconds(remainingSec) : "--:--";

  const markdownHtml = useMemo(() => markdownToHtml(rawInput), [rawInput]);
  const markdownHasBlock = useMemo(() => hasBlockContent(markdownHtml), [markdownHtml]);

  const ttsSupported = canUseTTS();

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-3 py-6 sm:py-10">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Yomiage Web TTS</h1>
            <p className="text-sm text-muted-foreground">
              貼り付けた長文をブラウザ内の日本語TTSだけで読み上げます。データは端末外へ送信されません。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>残り {etaLabel}</span>
            <Type className="h-4 w-4" />
            <span>{chunks.reduce((sum, chunk) => sum + chunk.length, 0)} 文字</span>
          </div>
        </div>
        {!ttsSupported && (
          <Alert className="border-amber-400/70 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200">
            このブラウザでは SpeechSynthesis が利用できません。対応ブラウザ（Chrome/Edge 最新、Safari 16+）でお試しください。
          </Alert>
        )}
        {warningMessage && (
          <Alert>
            {warningMessage}
          </Alert>
        )}
        {!warningMessage && fallbackUsed && (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-600/50 dark:bg-blue-900/30 dark:text-blue-100">
            Google 日本語 voice が見つからなかったため、この環境で利用できる日本語 voice で読み上げます。
          </Alert>
        )}
        {!warningMessage && googleOnly && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-100">
            Google 日本語 voice を使用しています。速度変更時も聞き取りやすさを自動調整します。
          </Alert>
        )}
        {lastError && (
          <Alert className="flex items-start justify-between gap-4">
            <span>読み上げ中にエラーが発生しました: {lastError}</span>
            <Button size="sm" variant="ghost" onClick={clearError}>
              了解
            </Button>
          </Alert>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Volume2 className="h-5 w-5" />
              再生コントロール
            </CardTitle>
            <CardDescription>速度と音声の調整、再生操作をまとめています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="voice-select">音声（日本語）</Label>
              <Select value={selectedId || undefined} onValueChange={setSelectedId}>
                <SelectTrigger id="voice-select" aria-label="日本語音声の選択" disabled={!voices.length || voices.length === 1}>
                  <SelectValue placeholder="音声を選択" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice, idx) => (
                    <SelectItem key={voice.voiceURI} value={String(idx)}>
                      {voice.name} ({voice.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {googleOnly && voices.length === 1 && (
                <p className="text-xs text-muted-foreground">Google 日本語 voice のみ利用可能です。</p>
              )}
              {fallbackUsed && (
                <p className="text-xs text-muted-foreground">利用可能な日本語 voice を使用しています。</p>
              )}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rate-slider">速度 {rate.toFixed(2)}x</Label>
                <Slider
                  id="rate-slider"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={[rate]}
                  onValueChange={([val]) => {
                    const next = typeof val === "number" ? val : rate;
                    setRate(Number(next.toFixed(2)));
                  }}
                  aria-label="速度"
                />
                {!boundarySupported && playerState === "playing" && (
                  <p className="text-xs text-muted-foreground">
                    一部ブラウザでは速度変更が次の文から反映されます。
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                onClick={commands.playOrPause}
                disabled={!chunks.length}
                className="flex-1 min-w-[120px]"
              >
                {playerState === "playing" ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    一時停止
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    再生
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={commands.stop} disabled={!chunks.length} className="flex-1 min-w-[96px]">
                <Square className="mr-2 h-4 w-4" />
                停止
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={commands.prev} disabled={!chunks.length} className="flex-1 min-w-[96px]">
                <ChevronLeft className="mr-2 h-4 w-4" />
                前へ
              </Button>
              <Button variant="ghost" onClick={commands.next} disabled={!chunks.length} className="flex-1 min-w-[96px]">
                次へ
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-dashed px-3 py-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>進行状況: {progressLabel}</span>
                <span>{progressPercent}%</span>
              </div>
              <Slider
                min={0}
                max={Math.max(totalChunks - 1, 0)}
                step={1}
                value={[scrubIndex ?? currentIndex]}
                onValueChange={([val]) => {
                  const next = Number.isFinite(val) ? Math.round(Number(val)) : currentIndex;
                  setScrubIndex(next);
                }}
                onValueCommit={([val]) => {
                  const next = Number.isFinite(val) ? Math.round(Number(val)) : currentIndex;
                  setScrubIndex(null);
                  commands.seekTo(next);
                }}
                disabled={!totalChunks}
                aria-label="シークバー"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>残り {etaLabel}</span>
                <span>位置 {scrubIndex !== null ? scrubIndex + 1 : currentIndex + 1} / {Math.max(totalChunks, 1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              入力テキスト
            </CardTitle>
            <CardDescription>貼り付けまたは入力したテキストのみを使用し、保存や送信は行いません。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="ここにビジネス文書などの長文を貼り付けてください（保存は行われません）"
              rows={14}
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
            />
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p>ショートカット: Space=再生/一時停止, [ / ]=前/次, +/-=速度調整</p>
              <p>Safari/iOSでは初回に再生ボタンをタップする必要があります。</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>プレビューとハイライト</CardTitle>
          <CardDescription>テキストまたはMarkdownプレビューを切り替えて確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="space-y-4">
            <TabsList className="grid grid-cols-2 gap-1 bg-muted/60">
              <TabsTrigger value="text">テキスト</TabsTrigger>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <div
                ref={textViewerRef}
                className="max-h-[50vh] overflow-auto rounded-lg border bg-background/60 p-4 text-sm leading-relaxed shadow-inner"
                aria-live="polite"
              >
                {chunks.length ? (
                  <div className="space-y-2">
                    {chunks.map((chunk, idx) => (
                      <span
                        key={`${idx}-${chunk.slice(0, 8)}`}
                        data-chunk-index={idx}
                        data-player-highlight={idx === currentIndex}
                        className={cn(
                          "mr-1 inline-block rounded-md px-1 py-0.5 transition-colors",
                          idx === currentIndex
                            ? "bg-yellow-200 text-foreground dark:bg-yellow-900/50"
                            : "bg-muted/30 text-foreground"
                        )}
                      >
                        {chunk}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">ここに読み上げ対象のチャンクが表示されます。</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="markdown">
              <div className="max-h-[50vh] overflow-auto rounded-lg border bg-background/60 p-4 text-sm leading-relaxed shadow-inner">
                {markdownHasBlock ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: markdownHtml }}
                  />
                ) : rawInput.trim() ? (
                  <p className="whitespace-pre-wrap text-muted-foreground">{rawInput}</p>
                ) : (
                  <p className="text-muted-foreground">Markdownプレビューはここに表示されます。</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>既知の制約とヒント</CardTitle>
          <CardDescription>
            主要ブラウザでの挙動差異や、長文読み上げ時の安定化ポイントを記載しています。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>読み上げはデバイス内の SpeechSynthesis API のみを利用し、外部送信は行いません。</li>
            <li>日本語 voice が無い環境では警告を表示し、再生は行われないことがあります。</li>
            <li>長文は自動的に150〜260文字程度でチャンク化し、失敗時は自動で次のチャンクへリトライします。</li>
            <li>バックグラウンド遷移時にはブラウザ仕様で一時停止される場合があります。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
