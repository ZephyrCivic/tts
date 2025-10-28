// 日本語向けの軽量分割器。形態素解析は使わず、句読点/箇条書き/最大長で区切る。

const MAX_LEN = 260; // 150–300 の中間。ブラウザ差異を考慮して控えめ

export function preprocess(text) {
  if (!text) return "";
  // 制御文字等を除去・正規化
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // ゼロ幅
    .replace(/[\t\f\v\r]/g, " ")
    .replace(/\u00A0/g, " ") // NBSP
    .replace(/[━─‐‑–—―]+/g, "-")
    .replace(/[％%]/g, " パーセント ")
    .replace(/No\./g, "ナンバー ")
    .replace(/\(株\)/g, " かぶしきがいしゃ ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(block) {
  // 「。！？？」（全角/半角）で文単位に。末尾の引用符などは含める。
  const re = /([^。\!！\?？]+[。\!！\?？]?[」』】\)]?)/g;
  const out = [];
  let m;
  while ((m = re.exec(block)) !== null) {
    const s = m[1].trim();
    if (s) out.push(s);
  }
  return out.length ? out : [block.trim()];
}

function splitBullets(text) {
  const lines = text.split(/\n/);
  const blocks = [];
  let buf = [];
  const bulletRe = /^(?:\s*[-*・]|\s*\d+[\).]|\s*\([0-9]+\)\s*)/;
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
  if (buf.length) blocks.push(buf.join(" ").trim());
  return blocks.filter(Boolean);
}

function enforceMaxLen(sentences) {
  const chunks = [];
  for (const s of sentences) {
    if (s.length <= MAX_LEN) {
      chunks.push(s);
      continue;
    }
    // 読点や空白を優先して分割
    let remain = s;
    while (remain.length > MAX_LEN) {
      const piece = remain.slice(0, MAX_LEN + 1);
      let cut = Math.max(
        piece.lastIndexOf("、"),
        piece.lastIndexOf(" "),
        piece.lastIndexOf("・")
      );
      if (cut < MAX_LEN * 0.5) cut = MAX_LEN; // どうしても無ければ強制カット
      chunks.push(remain.slice(0, cut).trim());
      remain = remain.slice(cut).trim();
    }
    if (remain) chunks.push(remain);
  }
  return chunks;
}

export function segmentJapanese(raw) {
  const text = preprocess(raw);
  if (!text) return [];
  const blocks = splitBullets(text);
  const sentences = blocks.flatMap(splitSentences);
  return enforceMaxLen(sentences);
}

