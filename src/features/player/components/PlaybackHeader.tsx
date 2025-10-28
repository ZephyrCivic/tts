import { Clock, Type, Volume2, VolumeX } from "lucide-react";

interface PlaybackHeaderProps {
  etaLabel: string;
  charCount: number;
  progressPercent: number;
  volumePercent: number;
  muted: boolean;
}

export function PlaybackHeader({ etaLabel, charCount, progressPercent, volumePercent, muted }: PlaybackHeaderProps) {
  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Yomiage Web TTS</h1>
          <p className="text-sm text-muted-foreground">
            ペーストした文章をローカルの日本語音声だけで読み上げます。通信や保存は行いません。
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground sm:text-sm">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>残り {etaLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Type className="h-4 w-4" />
            <span>{charCount} 文字</span>
          </div>
          <div className="flex items-center gap-1">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span>{volumePercent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span>進捗 {progressPercent}%</span>
          </div>
        </div>
      </div>
    </header>
  );
}

