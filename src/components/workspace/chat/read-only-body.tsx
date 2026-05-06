import { QuestionBlock } from "@/components/workspace/chat/questions-pane";
import type { ReadOnlyBodyProps } from "@/components/workspace/chat/types/questions";

export function ReadOnlyBody({ items }: ReadOnlyBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((q) => (
        <QuestionBlock
          key={q.id}
          question={q}
          value={undefined}
          disabled
          onChange={() => {}}
        />
      ))}
    </div>
  );
}
