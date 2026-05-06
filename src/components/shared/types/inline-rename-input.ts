export interface InlineRenameInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  size?: "sm" | "xs";
  variant?: "sunken" | "raised";
}
