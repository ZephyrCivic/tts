import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils.js";

export function ChunkViewer({ chunks, currentIndex }) {
  const containerRef = useRef(null);

  const renderedChunks = useMemo(
    () =>
      chunks.map((chunk, idx) => ({
        idx,
        text: chunk,
        isActive: idx === currentIndex,
      })),
    [chunks, currentIndex]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-idx="${currentIndex}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, [currentIndex, chunks]);

  if (!chunks.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 p-6 text-sm text-muted-foreground">
        入力されたテキストがここに文単位で表示されます。
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-72 w-full space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-4"
    >
      {renderedChunks.map(({ idx, text, isActive }) => (
        <div
          key={idx}
          data-idx={idx}
          className={cn(
            "chunk rounded-md px-3 py-2 text-sm leading-relaxed transition-all md:text-base",
            isActive
              ? "bg-primary/15 text-foreground ring-1 ring-primary"
              : "bg-background text-muted-foreground"
          )}
        >
          {text}
        </div>
      ))}
    </div>
  );
}
