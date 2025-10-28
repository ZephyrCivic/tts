export function scrollChunkIntoView(container: HTMLElement | null, index: number): void {
  if (!container) return;
  const current = container.querySelector<HTMLElement>(`[data-chunk-index="${index}"]`);
  if (current) {
    current.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }
}
