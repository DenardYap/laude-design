export interface InlineRenameInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  /**
   * Text + padding scale of the chip.
   * - "sm" (default): matches a file-tree row.
   * - "xs": matches the subtab strips (session + canvas tabs).
   */
  size?: "sm" | "xs";
  /**
   * Surface treatment of the chip.
   * - "sunken" (default): pressed _into_ the row — used inside lighter rows
   *   (e.g. the file tree sitting on the page background).
   * - "raised": pops _above_ the row — used inside an already-sunken
   *   container (e.g. an active tab) where a sunken chip would blend in.
   */
  variant?: "sunken" | "raised";
}
