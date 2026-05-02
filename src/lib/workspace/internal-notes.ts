/**
 * Markers for "internal" text parts that the LLM sees but the UI hides.
 *
 * We embed these as plain text parts in user messages so they ride along with
 * the conversation history (and the LLM keeps the context across turns), while
 * being stripped from the rendered chat. Use a distinctive prefix that's
 * vanishingly unlikely to appear in normal user text.
 */
export const INTERNAL_NOTE_PREFIX = "[laude:internal]";

export function isInternalNote(text: string): boolean {
  return text.startsWith(INTERNAL_NOTE_PREFIX);
}

export function buildScreenshotContextNote(count: number): string {
  if (count <= 0) return "";
  const noun = count === 1 ? "screenshot" : "screenshots";
  return (
    `${INTERNAL_NOTE_PREFIX} The user attached ${count} ${noun} of the live design canvas using the canvas screenshot tool. ` +
    `The image attachment(s) on this message are screenshots of what is currently rendered in the user's preview. ` +
    `Treat them as visual feedback on your current design.`
  );
}

export function buildSketchContextNote(count: number): string {
  if (count <= 0) return "";
  const noun = count === 1 ? "sketch" : "sketches";
  return (
    `${INTERNAL_NOTE_PREFIX} The user attached ${count} ${noun} of the live design canvas using the canvas draw tool. ` +
    `These images are the user's current preview with hand-drawn annotations (rectangles, circles, arrows, freehand strokes, etc.) layered on top. ` +
    `Treat the drawn marks as the user pointing at or commenting on specific regions — interpret them together with the message text.`
  );
}
