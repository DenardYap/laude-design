export interface ToolContext {
  projectId: string;
  userId: string;
  /** Pre-resolved active design id for this turn, if any. */
  activeDesignId: string | null;
  /** Session id for the current chat turn. */
  sessionId: string;
  /** Whether self-critique mode is on for this turn. Gates the
   * `screenshotDesign` tool — we don't want models calling it on a normal
   * turn since it costs a real iframe render + image upload. */
  selfCritique: boolean;
}
