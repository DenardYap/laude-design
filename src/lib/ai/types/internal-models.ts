import type { LanguageModel } from "ai";
import type { AiProvider } from "@/lib/validators";

export interface InternalModel {
  provider: AiProvider;
  modelId: string;
  model: LanguageModel;
}
