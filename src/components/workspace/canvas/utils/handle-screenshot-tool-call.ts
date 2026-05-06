import type { UIMessage, ChatAddToolOutputFunction } from "ai";
import { captureDesignScreenshot } from "@/components/workspace/canvas/utils/capture-design";

interface HandleScreenshotToolCallOptions {
  toolCall: { toolName: string; toolCallId: string; input: unknown };
  projectId: string;
  addToolResult: ChatAddToolOutputFunction<UIMessage>;
}

/**
 * Handles the `screenshotDesign` tool call emitted by the AI.
 * Captures the live canvas and uploads the result as a tool output.
 */
export async function handleScreenshotToolCall({
  toolCall,
  projectId,
  addToolResult,
}: HandleScreenshotToolCallOptions): Promise<void> {
  if (toolCall.toolName !== "screenshotDesign") return;

  const input = toolCall.input as { designId?: string };
  const { designId } = input ?? {};

  if (!designId) {
    addToolResult({
      tool: "screenshotDesign",
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: "Missing designId. Pass the id of the design you want to screenshot.",
    });
    return;
  }

  try {
    const uploaded = await captureDesignScreenshot({ projectId, designId });
    addToolResult({
      tool: "screenshotDesign",
      toolCallId: toolCall.toolCallId,
      output: { url: uploaded.url, mediaType: uploaded.mimeType },
    });
  } catch (err) {
    addToolResult({
      tool: "screenshotDesign",
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText:
        err instanceof Error
          ? err.message
          : "Couldn't capture the canvas — the live preview may still be compiling.",
    });
  }
}
