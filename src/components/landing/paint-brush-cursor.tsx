/**
 * The brush itself. Its tip sits at (TIP_X, TIP_Y) in this SVG's coordinate
 * space, which is what the wrapper translates to the pointer position.
 */
export function PaintBrushCursor({
  color,
  className,
  style,
}: {
  color: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={60}
      height={60}
      viewBox="0 0 60 60"
      className={className}
      style={{ overflow: "visible", ...style }}
    >
      <defs>
        <linearGradient id="brush-handle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(28 42% 42%)" />
          <stop offset="50%" stopColor="hsl(26 38% 30%)" />
          <stop offset="100%" stopColor="hsl(24 35% 22%)" />
        </linearGradient>
        <linearGradient id="brush-ferrule" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(30 6% 58%)" />
          <stop offset="50%" stopColor="hsl(30 6% 82%)" />
          <stop offset="100%" stopColor="hsl(30 6% 60%)" />
        </linearGradient>
      </defs>

      <ellipse cx="14" cy="56" rx="9" ry="1.6" fill="rgba(0,0,0,0.18)" />

      <path
        d={`M ${8} ${52} L 16 38 L 26 44 L 18 56 Z`}
        fill={color}
        stroke="rgba(0,0,0,0.28)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <g
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      >
        <line x1="8" y1="52" x2="5" y2="55" />
        <line x1="10" y1="50" x2="6" y2="51" />
        <line x1="12" y1="48" x2="7" y2="48" />
        <line x1="15" y1="55" x2="11" y2="56" />
      </g>

      <path
        d="M 18 38 L 28 28 L 36 36 L 26 46 Z"
        fill="url(#brush-ferrule)"
        stroke="hsl(30 8% 38%)"
        strokeWidth="0.6"
      />
      <line
        x1="22"
        y1="34"
        x2="32"
        y2="42"
        stroke="hsl(30 8% 30%)"
        strokeWidth="0.6"
        opacity="0.5"
      />

      <path
        d="M 28 28 L 50 6 L 56 12 L 34 34 Z"
        fill="url(#brush-handle)"
        stroke="hsl(24 40% 14%)"
        strokeWidth="0.6"
      />
      <line
        x1="32"
        y1="26"
        x2="52"
        y2="6"
        stroke="hsl(28 28% 60%)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
