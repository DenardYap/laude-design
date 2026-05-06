export function WorkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 px-1 py-1.5" aria-hidden>
      <span className="size-2 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s] [animation-duration:0.8s]" />
      <span className="size-2 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s] [animation-duration:0.8s]" />
      <span className="size-2 animate-bounce rounded-full bg-ink-muted [animation-duration:0.8s]" />
    </span>
  );
}

export function WorkingIndicatorWorkInProgress() {
  return (
    <span
      className="inline-flex items-center px-1 py-1"
      aria-hidden
      role="status"
    >
      <svg
        width={80}
        height={30}
        viewBox="0 0 80 30"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="wi-handle" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(28 42% 42%)" />
            <stop offset="50%" stopColor="hsl(26 38% 30%)" />
            <stop offset="100%" stopColor="hsl(24 35% 22%)" />
          </linearGradient>
          <linearGradient id="wi-ferrule" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(30 6% 78%)" />
            <stop offset="50%" stopColor="hsl(30 6% 92%)" />
            <stop offset="100%" stopColor="hsl(30 6% 60%)" />
          </linearGradient>
        </defs>

        <line
          className="wi-paint-line"
          x1="20"
          y1="26"
          x2="60"
          y2="26"
          stroke="hsl(28 80% 60%)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <g className="wi-brush-sweep">
          <path
            d="M 0 -7.5 L 8 -23 L 13 -22.5 L 5 -7 Z"
            fill="url(#wi-handle)"
            stroke="hsl(24 40% 14%)"
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
          <line
            x1="2"
            y1="-9"
            x2="10"
            y2="-22"
            stroke="hsl(28 28% 62%)"
            strokeWidth="0.6"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path
            d="M -2 -4.5 L 3.5 -4 L 5 -7 L 0 -7.5 Z"
            fill="url(#wi-ferrule)"
            stroke="hsl(30 8% 36%)"
            strokeWidth="0.35"
            strokeLinejoin="round"
          />
          <line
            x1="-0.7"
            y1="-5.1"
            x2="4.2"
            y2="-4.6"
            stroke="hsl(30 8% 38%)"
            strokeWidth="0.25"
            opacity="0.55"
          />
          <g className="wi-brush-bristles">
            <path
              d="M -3.5 0 L 3 0 L 3.5 -4 L -2 -4.5 Z"
              fill="hsl(var(--ink-muted))"
              stroke="rgba(0,0,0,0.22)"
              strokeWidth="0.25"
              strokeLinejoin="round"
            />
            <line
              x1="-2.8"
              y1="-0.2"
              x2="-3.2"
              y2="0.7"
              stroke="hsl(var(--ink))"
              strokeWidth="0.25"
              strokeLinecap="round"
              opacity="0.55"
            />
            <line
              x1="-1.6"
              y1="-0.4"
              x2="-1.7"
              y2="0.9"
              stroke="hsl(var(--ink))"
              strokeWidth="0.25"
              strokeLinecap="round"
              opacity="0.55"
            />
            <line
              x1="-0.3"
              y1="-0.5"
              x2="-0.2"
              y2="0.95"
              stroke="hsl(var(--ink))"
              strokeWidth="0.25"
              strokeLinecap="round"
              opacity="0.55"
            />
            <line
              x1="1.0"
              y1="-0.4"
              x2="1.2"
              y2="0.85"
              stroke="hsl(var(--ink))"
              strokeWidth="0.25"
              strokeLinecap="round"
              opacity="0.55"
            />
            <line
              x1="2.3"
              y1="-0.2"
              x2="2.6"
              y2="0.7"
              stroke="hsl(var(--ink))"
              strokeWidth="0.25"
              strokeLinecap="round"
              opacity="0.55"
            />
          </g>
        </g>
      </svg>
    </span>
  );
}
