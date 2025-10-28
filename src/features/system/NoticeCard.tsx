import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoticeCard() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>注意事項とヒント</CardTitle>
        <CardDescription>ブラウザの制約と読み上げの安定化 tips をまとめています。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <ul className="list-disc space-y-1 pl-5">
          <li>読み上げはブラウザの SpeechSynthesis API のみを利用し、外部送信は行いません。</li>
          <li>日本語 voice が見つからない場合はブラウザや OS の言語設定をご確認ください。</li>
          <li>長文は 150〜260 文字程度のチャンクに分割し、失敗時には自動で再キューします。</li>
          <li>バックグラウンド遷移時はブラウザの仕様で一時停止する場合があります。</li>
        </ul>
      </CardContent>
    </Card>
  );
}

