// Always visible while a turn is in flight, including the gaps between
// streamed text, tool calls, and reasoning. Without a continuous "still
// working" signal users assume the agent has stalled the moment it pauses
// — even if more output is on the way (Norman: feedback must be continuous).
export function WorkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 px-1 py-1.5" aria-hidden>
      <span className="size-2 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s] [animation-duration:0.8s]" />
      <span className="size-2 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s] [animation-duration:0.8s]" />
      <span className="size-2 animate-bounce rounded-full bg-ink-muted [animation-duration:0.8s]" />
    </span>
  );
}
