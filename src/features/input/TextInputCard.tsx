import { ChangeEvent } from "react";
import { FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface TextInputCardProps {
  value: string;
  onChange: (next: string) => void;
}

export function TextInputCard({ value, onChange }: TextInputCardProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          読み上げテキスト
        </CardTitle>
        <CardDescription>貼り付けたテキストだけを利用し、保存や送信は行いません。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="ここにビジネス文書などの本文を貼り付けてください（保存は行いません）"
          rows={14}
          value={value}
          onChange={handleChange}
        />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p>ショートカット: Space=再生/一時停止, [ / ]=前/次, +/-=速度変更</p>
          <p>Safari / iOS の場合は初回に再生ボタンをタップしてください。</p>
        </div>
      </CardContent>
    </Card>
  );
}

