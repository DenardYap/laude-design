export interface SortOption<TValue extends string = string> {
  value: TValue;
  label: string;
  /** Optional short label rendered in the trigger when this option is active. */
  triggerLabel?: string;
}

export interface SortMenuProps<TValue extends string> {
  value: TValue;
  onChange: (value: TValue) => void;
  options: ReadonlyArray<SortOption<TValue>>;
  /** Header rendered above the option list. */
  label?: string;
  triggerVariant?: "outline" | "ghost";
}
