"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient, scroll-linked parallax glow layer that sits behind all content.
 * Three blurred orbs drift at different speeds to add cheap, GPU-friendly depth.
 */
export function ParallaxBg() {
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  const c = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      const y = window.scrollY;
      if (a.current)
        a.current.style.transform = `translate3d(${px * 18}px, ${y * 0.12 + py * 14}px, 0)`;
      if (b.current)
        b.current.style.transform = `translate3d(${px * -22}px, ${y * -0.08 - py * 10}px, 0)`;
      if (c.current)
        c.current.style.transform = `translate3d(${px * 12}px, ${y * 0.05}px, 0)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        ref={a}
        className="absolute -top-40 left-[6%] h-[30rem] w-[30rem] rounded-full bg-coral/10 blur-[140px] will-change-transform"
      />
      <div
        ref={b}
        className="absolute top-[42%] right-[0%] h-[28rem] w-[28rem] rounded-full bg-ember/8 blur-[140px] will-change-transform"
      />
      <div
        ref={c}
        className="absolute bottom-[4%] left-[28%] h-[26rem] w-[26rem] rounded-full bg-sunset/8 blur-[150px] will-change-transform"
      />
    </div>
  );
}
