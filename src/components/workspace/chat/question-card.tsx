import type { QuestionCardProps } from "@/components/workspace/chat/types/questions";

export function QuestionCard({ children }: QuestionCardProps) {
  return (
    <div className="my-2 rounded-2xl border border-border bg-surface p-3.5">
      {children}
    </div>
  );
}
