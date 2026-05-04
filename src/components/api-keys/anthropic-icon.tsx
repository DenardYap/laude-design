import type { IconProps } from "@/components/api-keys/types/api-keys";

export function AnthropicIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path
        fill="#D97757"
        d="M13.827 3.52h3.603L24 20.481h-3.603l-6.57-16.96Zm-7.258 0h3.767l6.57 16.96H13.24l-1.343-3.461H5.017l-1.344 3.46H.067L6.57 3.522Zm4.085 10.466L8.452 8.06l-2.2 5.927h4.404Z"
      />
    </svg>
  );
}
