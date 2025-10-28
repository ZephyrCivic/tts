import { segmentJapanese } from "./segmentation/japanese.js";
import { PlayerQueue } from "./player/queue.js";
import * as voices from "./voices/detect.js";
import * as highlight from "./ui/highlight.js";
import { canUseTTS } from "./tts/engine.js";

const els = {
  paste: document.getElementById('paste'),
  voiceSelect: document.getElementById('voiceSelect'),
  voiceWarning: document.getElementById('voiceWarning'),
  rate: document.getElementById('rate'), rateVal: document.getElementById('rateVal'),
  pitch: document.getElementById('pitch'), pitchVal: document.getElementById('pitchVal'),
  volume: document.getElementById('volume'), volumeVal: document.getElementById('volumeVal'),
  playPause: document.getElementById('playPause'), stop: document.getElementById('stop'),
  prev: document.getElementById('prev'), next: document.getElementById('next'),
  progress: document.getElementById('progress'), eta: document.getElementById('eta'),
  viewer: document.getElementById('viewer'),
};

const state = {
  text: '',
  chunks: [],
  settings: { rate: 1, pitch: 1, volume: 1, voice: null },
  queue: null,
};

function approxRemainingSec(index, total, chunks, rate) {
  const baseCps = 5; // 仮の平均（1.0倍時の1秒あたり文字数）
  const remainChars = chunks.slice(index).reduce((a, c) => a + c.length, 0);
  return Math.ceil(remainChars / (baseCps * Math.max(rate, 0.1)));
}

function formatSec(s) {
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

function updateProgress(i, total) {
  els.progress.textContent = `${i + 1} / ${Math.max(total, 0)}`;
  const sec = approxRemainingSec(i, total, state.chunks, state.settings.rate);
  els.eta.textContent = `残り ${isFinite(sec) ? formatSec(sec) : '--:--'}`;
  highlight.setPlaying(els.viewer, i);
}

function fillVoices(vs, selected) {
  els.voiceSelect.innerHTML = '';
  vs.forEach((v, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `${v.name} (${v.lang})`;
    if (selected && v === selected) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  });
}

function syncSliders() {
  els.rateVal.textContent = Number(els.rate.value).toFixed(2);
  els.pitchVal.textContent = Number(els.pitch.value).toFixed(2);
  els.volumeVal.textContent = Number(els.volume.value).toFixed(2);
}

//

async function init() {
  // 可用性
  if (!canUseTTS()) {
    els.voiceWarning.hidden = false;
    els.voiceWarning.textContent = 'このブラウザは SpeechSynthesis をサポートしていません';
  }

  // Voices
  const all = await voices.waitForVoices();
  const ja = voices.japaneseVoices(all);
  const def = voices.chooseDefault(ja);
  state.settings.voice = def || null;
  fillVoices(ja, def);
  els.voiceWarning.hidden = ja.length > 0;

  els.voiceSelect.addEventListener('change', () => {
    const idx = Number(els.voiceSelect.value);
    const selected = ja[idx];
    state.settings.voice = selected || null;
  });

  // Sliders
  [els.rate, els.pitch, els.volume].forEach((input) => {
    input.addEventListener('input', () => {
      state.settings.rate = Number(els.rate.value);
      state.settings.pitch = Number(els.pitch.value);
      state.settings.volume = Number(els.volume.value);
      syncSliders();
      state.queue?.updateSettings(state.settings); // 変更は次チャンクから反映
    });
  });
  syncSliders();

  // 入力
  const onInput = () => {
    state.text = String(els.paste.value || '');
    state.chunks = segmentJapanese(state.text);
    highlight.renderChunks(els.viewer, state.chunks);
    updateProgress(0, state.chunks.length);
    if (state.queue) state.queue.setChunks(state.chunks);
  };
  els.paste.addEventListener('input', onInput);

  // 再生系
  state.queue = new PlayerQueue([], state.settings, {
    onIndex: (i, total) => updateProgress(i, total),
    onState: (st) => {
      els.playPause.textContent = (st === 'playing') ? '⏸ 一時停止' : '▶ 再生';
    },
    onError: (err) => {
      console.warn('TTS error', err);
    },
  });

  els.playPause.addEventListener('click', () => {
    if (!state.chunks.length) onInput();
    if (!state.chunks.length) return; // それでも空
    if (state.queue.state === 'playing') {
      state.queue.pause();
    } else if (state.queue.state === 'paused') {
      state.queue.resume();
    } else {
      state.queue.setChunks(state.chunks);
      state.queue.play();
    }
  });

  els.stop.addEventListener('click', () => state.queue.stop());
  els.next.addEventListener('click', () => state.queue.next());
  els.prev.addEventListener('click', () => state.queue.prev());

  // キーボード
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); els.playPause.click(); }
    if (e.key === ']') state.queue.next();
    if (e.key === '[') state.queue.prev();
    if (e.key === '+') { els.rate.value = String(Math.min(2, Number(els.rate.value) + 0.05)); els.rate.dispatchEvent(new Event('input')); }
    if (e.key === '-') { els.rate.value = String(Math.max(0.5, Number(els.rate.value) - 0.05)); els.rate.dispatchEvent(new Event('input')); }
  });
}

init();
