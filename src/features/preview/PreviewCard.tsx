import { RefObject } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ViewMode = "text" | "markdown";

interface PreviewCardProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  chunks: string[];
  currentIndex: number;
  textViewerRef: RefObject<HTMLDivElement>;
  markdownHtml: string;
  rawInput: string;
  markdownHasBlock: boolean;
}

export function PreviewCard({
  viewMode,
  onChangeViewMode,
  chunks,
  currentIndex,
  textViewerRef,
  markdownHtml,
  rawInput,
  markdownHasBlock
}: PreviewCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle>プレビューとハイライト</CardTitle>
        <CardDescription>テキストまたは Markdown プレビューで読み上げ位置を確認できます。</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={viewMode} onValueChange={(value) => onChangeViewMode(value as ViewMode)} className="space-y-4">
          <TabsList className="grid grid-cols-2 gap-1 bg-muted/60">
            <TabsTrigger value="text">テキスト</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <div
              ref={textViewerRef}
              className="max-h-[50vh] overflow-auto rounded-lg border bg-background/60 p-4 text-sm leading-relaxed shadow-inner"
              aria-live="polite"
            >
              {chunks.length ? (
                <div className="space-y-2">
                  {chunks.map((chunk, idx) => (
                    <span
                      key={`${idx}-${chunk.slice(0, 8)}`}
                      data-chunk-index={idx}
                      data-player-highlight={idx === currentIndex}
                      className={cn(
                        "mr-1 inline-block rounded-md px-1 py-0.5 transition-colors",
                        idx === currentIndex
                          ? "bg-yellow-200 text-foreground dark:bg-yellow-900/50"
                          : "bg-muted/30 text-foreground"
                      )}
                    >
                      {chunk}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">読み上げ対象のチャンクがまだ生成されていません。</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="markdown">
            <div className="max-h-[50vh] overflow-auto rounded-lg border bg-background/60 p-4 text-sm leading-relaxed shadow-inner">
              {markdownHasBlock ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: markdownHtml }}
                />
              ) : rawInput.trim() ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{rawInput}</p>
              ) : (
                <p className="text-muted-foreground">Markdown プレビューは本文を入力すると表示されます。</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

