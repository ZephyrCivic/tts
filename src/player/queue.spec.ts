import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerQueue } from "@/player/queue";
import type { SpeakCallbacks, SpeakSettings } from "@/tts/engine";

interface SpeakInvocation {
  text: string;
  settings: SpeakSettings;
  callbacks: SpeakCallbacks;
  utterance: SpeechSynthesisUtterance;
}

const hoisted = vi.hoisted(() => {
  const speakInvocations: SpeakInvocation[] = [];
  const cancelMock = vi.fn();
  const pauseMock = vi.fn();
  const resumeMock = vi.fn();
  const speakMock = vi.fn((text: string, settings: SpeakSettings = {}, callbacks: SpeakCallbacks = {}) => {
    const utterance = {
      text,
      rate: settings.rate ?? 1,
      volume: settings.volume ?? 1,
      pitch: settings.pitch ?? 1,
      voice: settings.voice ?? null,
      onend: callbacks.onend ?? null,
      onboundary: callbacks.onboundary ?? null,
      onerror: callbacks.onerror ?? null
    } as unknown as SpeechSynthesisUtterance;
    speakInvocations.push({
      text,
      settings,
      callbacks,
      utterance
    });
    return utterance;
  });
  return { speakInvocations, cancelMock, pauseMock, resumeMock, speakMock };
});

vi.mock("@/tts/engine", () => ({
  speak: hoisted.speakMock,
  cancel: hoisted.cancelMock,
  pause: hoisted.pauseMock,
  resume: hoisted.resumeMock
}));

const { speakInvocations, speakMock, cancelMock, pauseMock, resumeMock } = hoisted;

describe("PlayerQueue", () => {
  beforeEach(() => {
    speakInvocations.length = 0;
    speakMock.mockClear();
    cancelMock.mockClear();
    pauseMock.mockClear();
    resumeMock.mockClear();
  });

  it("seeks by character offset without forcing restart when paused", () => {
    const queue = new PlayerQueue();
    queue.setChunks(["あいうえお", "かきくけこ"]);

    queue.seek({ index: 1, offset: 2 }, { play: false });

    expect(queue.getIndex()).toBe(1);
    expect(queue.getCharOffset()).toBe(2);
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(speakMock).not.toHaveBeenCalled();

    queue.play();

    expect(speakInvocations).toHaveLength(1);
    expect(speakInvocations[0].text).toBe("くけこ");
  });

  it("preserves playback position when refreshing chunks during playback", () => {
    const queue = new PlayerQueue();
    queue.setChunks(["abcdef"]);

    queue.play();
    expect(speakInvocations).toHaveLength(1);

    speakInvocations[0].callbacks.onboundary?.({ charIndex: 3 } as unknown as SpeechSynthesisEvent);

    queue.refreshChunks(["abcXYZdef"]);

    expect(speakInvocations).toHaveLength(2);
    expect(speakInvocations[1].text).toBe("XYZdef");
  });

  it("updates volume in place without restarting playback", () => {
    const queue = new PlayerQueue();
    queue.setChunks(["abcdef"]);

    queue.play();
    expect(speakInvocations).toHaveLength(1);

    queue.updateSettings({ volume: 0.5 });

    expect(speakInvocations).toHaveLength(1);
    expect(speakInvocations[0].utterance.volume).toBe(0.5);
  });

  it("restarts from the last boundary when rate changes and boundaries are supported", () => {
    const queue = new PlayerQueue();
    queue.setChunks(["abcdefgh"]);

    queue.play();
    expect(speakInvocations).toHaveLength(1);

    speakInvocations[0].callbacks.onboundary?.({ charIndex: 4 } as unknown as SpeechSynthesisEvent);

    queue.updateSettings({ rate: 1.2 });

    expect(speakInvocations).toHaveLength(2);
    expect(speakInvocations[1].text).toBe("efgh");
    expect(speakInvocations[1].settings.rate).toBe(1.2);
  });
});
