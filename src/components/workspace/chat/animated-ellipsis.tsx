"use client";

import { useEffect, useState } from 'react';
// Cycles "." → ".." → "..." → "." … Three dots are always rendered so the
// trailing label width stays fixed — opacity toggles on the non-visible dots
// prevent layout jitter as the count changes.
export function AnimatedEllipsis() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((c) => (c % 3) + 1);
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span aria-hidden className="inline-flex">
      <span className={count >= 1 ? "opacity-100" : "opacity-0"}>.</span>
      <span className={count >= 2 ? "opacity-100" : "opacity-0"}>.</span>
      <span className={count >= 3 ? "opacity-100" : "opacity-0"}>.</span>
    </span>
  );
}
