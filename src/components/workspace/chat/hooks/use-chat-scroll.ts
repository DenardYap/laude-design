import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseChatScrollResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
  handleScroll: () => void;
}

// Manages chat scroll position: auto-follows the tail while the user is near
// the bottom, snaps to bottom on new submission, and exposes `isAtBottom` to
// show/hide a scroll-to-bottom button.
export function useChatScroll(
  messages: unknown[],
  status: string,
): UseChatScrollResult {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ref tracks the live value so effects can read it without re-running.
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevStatusRef = useRef(status);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    isAtBottomRef.current = true;
    setIsAtBottom(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // When the user just submitted a message, always snap to bottom regardless
    // of scroll position — it would feel broken if their own message scrolled
    // out of view. For streaming updates, only follow the tail if the user is
    // already near the bottom.
    const justSubmitted =
      prevStatusRef.current === "ready" && status === "submitted";
    prevStatusRef.current = status;

    if (isAtBottomRef.current || justSubmitted) {
      el.scrollTop = el.scrollHeight;
      if (justSubmitted) {
        isAtBottomRef.current = true;
        setIsAtBottom(true);
      }
    }
  }, [messages, status]);

  return { scrollRef, isAtBottom, scrollToBottom, handleScroll };
}
