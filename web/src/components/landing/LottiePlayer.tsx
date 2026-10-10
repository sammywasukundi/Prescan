"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

interface Props {
  data: object;
  className?: string;
  loop?: boolean;
  /** Vitesse de lecture (1 = normale). */
  speed?: number;
}

/** Joue une animation Lottie (rendu SVG, chargé à la demande). Figée si l'utilisateur réduit les animations. */
export function LottiePlayer({ data, className = "", loop = true, speed = 1 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: AnimationItem | undefined;
    let cancelled = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("lottie-web/build/player/lottie_light").then((mod) => {
      if (cancelled || !ref.current) return;
      anim = mod.default.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop,
        autoplay: !reduce,
        animationData: JSON.parse(JSON.stringify(data)),
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      anim.setSpeed(speed);
      if (reduce) anim.goToAndStop(anim.totalFrames - 1, true);
    });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [data, loop, speed]);

  return <div ref={ref} className={`lottie-tint ${className}`} aria-hidden />;
}
