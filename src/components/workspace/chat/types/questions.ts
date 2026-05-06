import type {
  AnswerValue,
  ClarifyingQuestionItem,
  ClarifyingQuestionSetDTO,
} from "@/app/api/sessions/[sessionId]/questions/route";

export interface QuestionCardProps {
  children: React.ReactNode;
}

export interface QuestionHeaderProps {
  rationale: string | null;
  status: ClarifyingQuestionSetDTO["status"];
}

export interface InlineClarifyingQuestionsProps {
  sessionId: string;
  /**
   * AI SDK tool-part state. `input-streaming` means the model is still
   * filling in the questions; anything else means the input is finalized.
   */
  state?: string;
  /** Question set id from the tool call's output. Undefined while the tool is still streaming. */
  questionSetId?: string;
  /** Pulled from the tool call's input so the questions render before output lands. */
  fallbackRationale?: string;
  fallbackItems?: ClarifyingQuestionItem[];
}

export interface QuestionBlockProps {
  question: ClarifyingQuestionItem;
  value: AnswerValue | undefined;
  disabled?: boolean;
  onChange: (v: AnswerValue) => void;
}

export interface QuestionSetBodyProps {
  sessionId: string;
  set: ClarifyingQuestionSetDTO;
}

export interface ReadOnlyBodyProps {
  items: ClarifyingQuestionItem[];
}
