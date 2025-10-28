/**
 * 日本語向けの軽量分割器。形態素解析なしで句読点や最大長を基準にチャンクへ分割する。
 */
const MAX_LEN = 260; // 150–300 の中間。ブラウザ差異を考慮して控えめ。
const MIN_LEN = 120;

export function preprocess(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\t\f\v\r]/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2501\u2500\u2010\u2011\u2013\u2014\u2015]+/g, "-")
    .replace(/[%％]/g, " パーセント ")
    .replace(/No\./g, "ナンバー ")
    .replace(/\(株\)/g, " かぶしきがいしゃ ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(block: string): string[] {
  const re = /([^\u3002!\uff01?\uff1f]+[\u3002!\uff01?\uff1f]?[\u300d\u300f\u3011)]?)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const s = m[1].trim();
    if (s) out.push(s);
  }
  return out.length ? out : [block.trim()];
}

function splitBullets(text: string): string[] {
  const lines = text.split(/\n/);
  const blocks: string[] = [];
  let buf: string[] = [];
  const bulletRe = /^(?:\s*[-*\u30fb]|\s*\d+[\).]|\s*\([0-9]+\)\s*)/;
  for (const line of lines) {
    if (bulletRe.test(line)) {
      if (buf.length) {
        blocks.push(buf.join(" ").trim());
        buf = [];
      }
      blocks.push(line.trim());
    } else if (line.trim() === "") {
      if (buf.length) {
        blocks.push(buf.join(" ").trim());
        buf = [];
      }
    } else {
      buf.push(line.trim());
    }
  }
  if (buf.length) {
    blocks.push(buf.join(" ").trim());
  }
  return blocks;
}

function chunkByLength(sentences: string[]): string[] {
  if (!sentences.length) return [];
  const chunks: string[] = [];
  let current = "";

  sentences.forEach((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    if (!current) {
      current = trimmed;
    } else if ((current + " " + trimmed).length <= MAX_LEN) {
      current = `${current} ${trimmed}`.trim();
    } else {
      chunks.push(current);
      current = trimmed;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

function mergeShortChunks(chunks: string[]): string[] {
  if (!chunks.length) return [];
  const merged: string[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (!merged.length) {
      merged.push(trimmed);
      continue;
    }
    const prev = merged[merged.length - 1];
    if (prev.length < MIN_LEN && (prev + " " + trimmed).length <= MAX_LEN) {
      merged[merged.length - 1] = `${prev} ${trimmed}`.trim();
    } else {
      merged.push(trimmed);
    }
  }
  return merged;
}

export function segmentJapanese(raw: string): string[] {
  if (!raw) return [];
  const normalized = preprocess(raw);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const result: string[] = [];

  paragraphs.forEach((para) => {
    const blocks = splitBullets(para);
    blocks.forEach((block) => {
      const sentences = splitSentences(block);
      const chunked = mergeShortChunks(chunkByLength(sentences));
      result.push(...chunked);
    });
  });

  return result;
}

export function approxCharsPerSecond(rate: number): number {
  const base = 5;
  return base * Math.max(rate, 0.1);
}
