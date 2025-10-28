import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Square, Volume2, VolumeX } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PlaybackCommands } from "@/features/player/usePlaybackController";
import { PlayerState } from "@/player/queue";

const numberFormatter = new Intl.NumberFormat("ja-JP");

interface VoiceMeta {
  warningMessage: string | null;
  onlyGoogleVoices: boolean;
  fallbackUsed: boolean;
}

interface PlaybackProgressView {
  chunkLabel: string;
  percent: number;
  etaLabel: string;
  playedChars: number;
  totalChars: number;
}

interface PlaybackControlsCardProps {
  state: PlayerState;
  rate: number;
  onRateChange: (value: number) => void;
  boundarySupported: boolean;
  volume: number;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  isMuted: boolean;
  skipUrls: boolean;
  onSkipUrlsChange: (value: boolean) => void;
  commands: PlaybackCommands;
  voices: SpeechSynthesisVoice[];
  selectedVoiceId: string;
  onSelectVoice: (id: string) => void;
  voiceMeta: VoiceMeta;
  progressView: PlaybackProgressView;
}

export function PlaybackControlsCard({
  state,
  rate,
  onRateChange,
  boundarySupported,
  volume,
  onVolumeChange,
  onToggleMute,
  isMuted,
  skipUrls,
  onSkipUrlsChange,
  commands,
  voices,
  selectedVoiceId,
  onSelectVoice,
  voiceMeta,
  progressView
}: PlaybackControlsCardProps) {
  const [pendingChar, setPendingChar] = useState<number | null>(null);

  const volumeLabel = useMemo(() => `${Math.round(volume * 100)}%`, [volume]);
  const rateLabel = useMemo(() => `${rate.toFixed(2)}x`, [rate]);
  const playedCharsLabel = useMemo(
    () => `${numberFormatter.format(progressView.playedChars)} / ${numberFormatter.format(progressView.totalChars)}`,
    [progressView.playedChars, progressView.totalChars]
  );

  const sliderValue = pendingChar ?? progressView.playedChars;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          音声コントロール
        </CardTitle>
        <CardDescription>Google 日本語 voice の速度・音量・読み上げ対象をリアルタイムで調整します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2">
          <Label htmlFor="voice-select">音声</Label>
          {voices.length > 1 ? (
            <Select value={selectedVoiceId || undefined} onValueChange={onSelectVoice} disabled={!voices.length}>
              <SelectTrigger id="voice-select" aria-label="音声の選択">
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
          ) : (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Google 日本語 voice のみ利用可能です。
            </div>
          )}
        </div>

        {voiceMeta.warningMessage && (
          <Alert>
            {voiceMeta.warningMessage}
          </Alert>
        )}
        {!voiceMeta.warningMessage && voiceMeta.fallbackUsed && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-100">
            {voiceMeta.onlyGoogleVoices ? "Google 日本語 voice のみ検出されました。" : "日本語 voice が少ないため、利用可能な候補から選択しています。"}
          </Alert>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            id="skip-urls"
            type="checkbox"
            checked={skipUrls}
            onChange={(event) => onSkipUrlsChange(event.target.checked)}
            className="h-4 w-4 rounded border border-input"
          />
          <Label htmlFor="skip-urls" className="cursor-pointer">URL を読み上げない</Label>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="rate-slider">速度 {rateLabel}</Label>
            <Slider
              id="rate-slider"
              min={0.5}
              max={1.5}
              step={0.05}
              value={[rate]}
              onValueChange={([value]) => onRateChange(typeof value === "number" ? value : rate)}
              aria-label="読み上げ速度"
            />
            {!boundarySupported && state === "playing" && (
              <p className="text-xs text-muted-foreground">
                一部のブラウザでは速度変更時に文頭へ戻る場合があります。
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="volume-slider">音量 {volumeLabel}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onToggleMute}
                aria-label={isMuted ? "ミュート解除" : "ミュート"}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                id="volume-slider"
                min={0}
                max={1}
                step={0.05}
                value={[volume]}
                onValueChange={([value]) => onVolumeChange(typeof value === "number" ? value : volume)}
                aria-label="音量"
                className="flex-1"
              />
              <span className="w-12 text-right text-xs text-muted-foreground">{volumeLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            onClick={commands.togglePlayPause}
            disabled={!progressView.totalChars}
            className="min-w-[120px] flex-1"
          >
            {state === "playing" ? (
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
          <Button variant="outline" onClick={commands.stop} disabled={!progressView.totalChars} className="min-w-[96px] flex-1">
            <Square className="mr-2 h-4 w-4" />
            停止
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={commands.prev} disabled={!progressView.totalChars} className="min-w-[96px] flex-1">
            <ChevronLeft className="mr-2 h-4 w-4" />
            前へ
          </Button>
          <Button variant="ghost" onClick={commands.next} disabled={!progressView.totalChars} className="min-w-[96px] flex-1">
            次へ
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-dashed px-3 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>読み上げ位置: {progressView.chunkLabel}</span>
            <span>{progressView.percent}%</span>
          </div>
          <Slider
            min={0}
            max={Math.max(progressView.totalChars, 1)}
            step={1}
            value={[sliderValue]}
            onValueChange={([value]) => {
              if (typeof value !== "number") return;
              setPendingChar(value);
            }}
            onValueCommit={([value]) => {
              if (typeof value !== "number") return;
              setPendingChar(null);
              commands.seekCharPosition(value);
            }}
            disabled={!progressView.totalChars}
            aria-label="再生位置"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>残り {progressView.etaLabel}</span>
            <span>{playedCharsLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

