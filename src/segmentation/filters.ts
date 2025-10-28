/**
 * URL や Markdown のリンク記法を読み上げから除外する簡易フィルタ。
 */
export function stripUrls(input: string): string {
  if (!input) return "";
  return input
    .replace(/\[[^\]]*?\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\bwww\.[^\s]+/g, "")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

