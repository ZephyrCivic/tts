import { useEffect, useMemo, useRef, useState } from "react";
import { segmentJapanese } from "./segmentation/japanese.js";
import { PlayerQueue } from "./player/queue.js";
import * as voiceHelpers from "./voices/detect.js";
import { canUseTTS } from "./tts/engine.js";
import { Button } from "./components/ui/button.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select.jsx";
import { Slider } from "./components/ui/slider.jsx";
import { Textarea } from "./components/ui/textarea.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card.jsx";
import { Label } from "./components/ui/label.jsx";
import { ChunkViewer } from "./components/chunk-viewer.jsx";

function approxRemainingSec(index, chunks, rate) {
  if (!chunks.length) return 0;
  const baseCps = 5; // 1秒あたりの仮の読み上げ文字数（1.0x）
  const remainChars = chunks.slice(Math.max(index, 0)).reduce((sum, chunk, idx) => {
    // 現在のチャンクは残り文字のみとするため idx===0 の場合は文字数を半分程度と仮定
    if (idx === 0) return sum + Math.ceil(chunk.length / 2);
    return sum + chunk.length;
  }, 0);
  return Math.ceil(remainChars / (baseCps * Math.max(rate, 0.1)));
}

function formatSec(value) {
  const sec = Math.max(0, value || 0);
  const minutes = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export default function App() {
  const [text, setText] = useState("");
  const [settings, setSettings] = useState({ rate: 1, pitch: 1, voice: null });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [queueState, setQueueState] = useState("stopped");
  const [voices, setVoices] = useState([]);
  const [voiceValue, setVoiceValue] = useState("");
  const [voiceWarning, setVoiceWarning] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const queueRef = useRef(null);

  const chunks = useMemo(() => segmentJapanese(text), [text]);

  useEffect(() => {
    const queue = new PlayerQueue([], settings, {
      onIndex: (index, total) => {
        setCurrentIndex(total === 0 ? 0 : index);
        setTotalChunks(total);
      },
      onState: (state) => setQueueState(state),
      onError: (err) => setErrorMessage(String(err || "TTS error")),
    });
    queueRef.current = queue;
    return () => {
      queue.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTotalChunks(chunks.length);
    if (!queueRef.current) {
      setCurrentIndex(0);
      return;
    }
    queueRef.current.setChunks(chunks);
    if (!chunks.length) {
      queueRef.current.stop();
      setErrorMessage("");
    }
  }, [chunks]);

  useEffect(() => {
    const queue = queueRef.current;
    if (queue) {
      queue.updateSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (!canUseTTS()) {
      setVoiceWarning("このブラウザは SpeechSynthesis をサポートしていません");
      return;
    }
    let cancelled = false;
    voiceHelpers.waitForVoices().then((all) => {
      if (cancelled) return;
      const jaVoices = voiceHelpers.japaneseVoices(all);
      setVoices(jaVoices);
      if (!jaVoices.length) {
        setVoiceWarning("日本語音声が見つかりません");
        setSettings((prev) => ({ ...prev, voice: null }));
        setVoiceValue("");
        return;
      }
      setVoiceWarning("");
      const def = voiceHelpers.chooseDefault(jaVoices);
      const idx = def ? jaVoices.indexOf(def) : -1;
      if (idx >= 0) {
        setVoiceValue(String(idx));
        setSettings((prev) => ({ ...prev, voice: def }));
      } else {
        setSettings((prev) => ({ ...prev, voice: jaVoices[0] }));
        setVoiceValue("0");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const handler = (event) => {
      const queue = queueRef.current;
      if (!queue) return;
      if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!chunks.length) return;
        if (queue.state === "playing") {
          queue.pause();
        } else if (queue.state === "paused") {
          queue.resume();
        } else {
          queue.setChunks(chunks);
          queue.play();
        }
      }
      if (event.key === "]") queue.next();
      if (event.key === "[") queue.prev();
      if (event.key === "+") {
        updateSetting("rate", Math.min(2, Number((settings.rate + 0.05).toFixed(2))));
      }
      if (event.key === "-") {
        updateSetting("rate", Math.max(0.5, Number((settings.rate - 0.05).toFixed(2))));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chunks, settings.rate]);

  const handlePlayPause = () => {
    const queue = queueRef.current;
    if (!queue) return;
    if (!chunks.length) return;
    if (queue.state === "playing") {
      queue.pause();
    } else if (queue.state === "paused") {
      queue.resume();
    } else {
      setErrorMessage("");
      queue.setChunks(chunks);
      queue.play();
    }
  };

  const handleStop = () => {
    setErrorMessage("");
    queueRef.current?.stop();
  };

  const handleNext = () => {
    queueRef.current?.next();
  };

  const handlePrev = () => {
    queueRef.current?.prev();
  };

  const etaLabel = useMemo(() => formatSec(approxRemainingSec(currentIndex, chunks, settings.rate)), [currentIndex, chunks, settings.rate]);
  const progressLabel = totalChunks ? `${Math.min(currentIndex + 1, totalChunks)} / ${totalChunks}` : "0 / 0";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-12 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Yomiage Web TTS（日本語）</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            貼り付けた長文を、デバイス内TTSだけでスムーズに読み上げます。
          </p>
        </header>

        <Card className="w-full">
          <CardHeader className="gap-1">
            <CardTitle>読み上げ設定</CardTitle>
            <CardDescription>モバイルでも操作しやすいコントロールで音声を調整できます。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="voice-select">音声</Label>
                <Select
                  value={voiceValue}
                  onValueChange={(value) => {
                    setVoiceValue(value);
                    const index = Number(value);
                    const selected = Number.isFinite(index) ? voices[index] : null;
                    updateSetting("voice", selected || null);
                  }}
                  disabled={!voices.length}
                >
                  <SelectTrigger id="voice-select" aria-label="日本語音声の選択">
                    <SelectValue placeholder={voices.length ? "音声を選択" : "日本語音声なし"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice, idx) => (
                      <SelectItem key={voice.name + voice.lang} value={String(idx)}>
                        {voice.name} ({voice.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {voiceWarning && (
                  <p className="text-sm text-destructive" role="status">
                    {voiceWarning}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rate">速度 <span className="font-mono text-xs">{settings.rate.toFixed(2)}x</span></Label>
                  <Slider
                    id="rate"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={[settings.rate]}
                    onValueChange={([val]) => updateSetting("rate", Number(val.toFixed(2)))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pitch">ピッチ <span className="font-mono text-xs">{settings.pitch.toFixed(2)}</span></Label>
                  <Slider
                    id="pitch"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={[settings.pitch]}
                    onValueChange={([val]) => updateSetting("pitch", Number(val.toFixed(2)))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handlePlayPause} className="flex-1 min-w-[140px] sm:flex-none">
                  {queueState === "playing" ? "⏸ 一時停止" : queueState === "paused" ? "▶ 再開" : "▶ 再生"}
                </Button>
                <Button onClick={handleStop} variant="outline" className="flex-1 min-w-[100px] sm:flex-none">
                  ■ 停止
                </Button>
                <div className="flex w-full flex-1 gap-2 sm:w-auto sm:flex-none">
                  <Button onClick={handlePrev} variant="ghost" className="w-full sm:w-auto">
                    ⟵ 前
                  </Button>
                  <Button onClick={handleNext} variant="ghost" className="w-full sm:w-auto">
                    次 ⟶
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 px-4 py-2 text-sm">
                <span className="font-medium">進捗: {progressLabel}</span>
                <span className="text-muted-foreground">残り {etaLabel}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>テキスト入力</CardTitle>
            <CardDescription>貼り付けても保存されません。モバイルのフルスクリーン入力にも対応しています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="ここにビジネス文書などの長文を貼り付けてください（保存はされません）"
              rows={10}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>プレビュー（文単位）</CardTitle>
            <CardDescription>再生中の文をハイライトし、自動スクロールします。</CardDescription>
          </CardHeader>
          <CardContent>
            <ChunkViewer chunks={chunks} currentIndex={currentIndex} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ヘルプ / 既知の制約</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>音声合成は端末内のみで行われ、入力テキストは保存されません。</li>
              <li>iOS / Safari では初回に必ずユーザー操作が必要です。</li>
              <li>速度は再生中でも即時に反映されます（ピッチ変更は次の文から反映）。</li>
              <li>キーボード: Space=再生/一時停止, [ / ]=前/次, +/-=速度。</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
