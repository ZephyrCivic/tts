import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PlayerQueue, PlayerState } from "@/player/queue";
import { approxCharsPerSecond } from "@/segmentation/japanese";

export interface PlaybackOptions {
  rate: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export interface PlaybackMetrics {
  state: PlayerState;
  currentIndex: number;
  totalChunks: number;
  charOffset: number;
  totalChars: number;
  playedChars: number;
  progressPercent: number;
  remainingSeconds: number | null;
  boundarySupported: boolean;
}

export interface PlaybackCommands {
  togglePlayPause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  seekChunk: (index: number) => void;
  seekCharPosition: (position: number) => void;
}

export interface PlaybackController {
  metrics: PlaybackMetrics;
  lastError: string | null;
  clearError: () => void;
  commands: PlaybackCommands;
}

interface ChunkBoundary {
  start: number;
  end: number;
}

const toChunkBoundaries = (chunks: string[]): { boundaries: ChunkBoundary[]; total: number } => {
  const boundaries: ChunkBoundary[] = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const length = chunk.length;
    boundaries.push({ start: cursor, end: cursor + length });
    cursor += length;
  }
  return { boundaries, total: cursor };
};

export function usePlaybackController(chunks: string[], options: PlaybackOptions): PlaybackController {
  const queueRef = useRef<PlayerQueue | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState>("stopped");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [charOffset, setCharOffset] = useState(0);
  const [boundarySupported, setBoundarySupported] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

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
        setLastError(error instanceof Error ? error.message : String(error));
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
    queueRef.current.updateSettings({
      rate: options.rate,
      volume: options.volume,
      voice: options.voice ?? null
    });
  }, [options.rate, options.volume, options.voice]);

  useEffect(() => {
    const queue = queueRef.current;
    if (!queue) return;
    queue.refreshChunks(chunks);
  }, [chunks]);

  const { boundaries, total: totalChars } = useMemo(() => toChunkBoundaries(chunks), [chunks]);

  const playedChars = useMemo(() => {
    if (!boundaries.length || !chunks.length) return 0;
    const base = boundaries[currentIndex]?.start ?? 0;
    return Math.max(0, Math.min(base + charOffset, totalChars));
  }, [boundaries, currentIndex, charOffset, chunks.length, totalChars]);

  const progressPercent = useMemo(() => {
    if (!totalChars) return 0;
    return Math.min(100, Math.round((playedChars / totalChars) * 100));
  }, [playedChars, totalChars]);

  const remainingSeconds = useMemo(() => {
    if (!totalChars) return null;
    const remain = Math.max(totalChars - playedChars, 0);
    const seconds = Math.ceil(remain / approxCharsPerSecond(options.rate));
    return Number.isFinite(seconds) ? seconds : null;
  }, [options.rate, playedChars, totalChars]);

  const togglePlayPause = useCallback(() => {
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
  }, [chunks.length]);

  const stop = useCallback(() => queueRef.current?.stop(), []);

  const next = useCallback(() => queueRef.current?.next(), []);

  const prev = useCallback(() => queueRef.current?.prev(), []);

  const seekChunk = useCallback(
    (index: number) => {
      const queue = queueRef.current;
      if (!queue || !chunks.length) return;
      const shouldPlay = queue.getState() === "playing";
      queue.seek(index, { play: shouldPlay });
    },
    [chunks.length]
  );

  const seekCharPosition = useCallback(
    (position: number) => {
      const queue = queueRef.current;
      if (!queue || !chunks.length) return;
      const clamped = Math.max(0, Math.min(position, totalChars));
      let targetIndex = 0;
      let offset = 0;
      for (let idx = 0; idx < boundaries.length; idx += 1) {
        const { start, end } = boundaries[idx];
        if (clamped >= start && clamped <= end) {
          targetIndex = idx;
          offset = clamped - start;
          break;
        }
        if (clamped > end) {
          targetIndex = idx;
          offset = boundaries[idx].end - boundaries[idx].start;
        }
      }
      const shouldPlay = queue.getState() === "playing";
      queue.seek({ index: targetIndex, offset }, { play: shouldPlay });
    },
    [boundaries, chunks.length, totalChars]
  );

  return {
    metrics: {
      state: playerState,
      currentIndex,
      totalChunks,
      charOffset,
      totalChars,
      playedChars,
      progressPercent,
      remainingSeconds,
      boundarySupported
    },
    lastError,
    clearError: () => setLastError(null),
    commands: {
      togglePlayPause,
      stop,
      next,
      prev,
      seekChunk,
      seekCharPosition
    }
  };
}

