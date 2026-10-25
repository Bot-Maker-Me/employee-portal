"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  type TargetAndTransition,
} from "framer-motion";
import { useFinePointer, usePrefersReducedMotion } from "./use-media";

/** Deterministic PRNG so server and client render identical dust fields. */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dust = {
  left: number;
  bottom: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  peak: number;
};

const DUST: Dust[] = (() => {
  const rand = mulberry32(20260114);
  return Array.from({ length: 28 }, () => ({
    left: rand() * 100,
    bottom: rand() * 45,
    size: 2 + Math.round(rand() * 1.4),
    duration: 9 + rand() * 10,
    delay: rand() * 9,
    drift: (rand() - 0.5) * 70,
    peak: 0.2 + rand() * 0.2,
  }));
})();

const GRID_IMAGE =
  "repeating-linear-gradient(0deg, var(--grid-line) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, var(--grid-line) 0 1px, transparent 1px 48px)";

const GRID_MASK =
  "radial-gradient(120% 95% at 50% 42%, rgba(0,0,0,1) 28%, rgba(0,0,0,0) 78%)";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

type Orb = {
  color: string;
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  opacity: number;
  duration: number;
  drift: TargetAndTransition;
};

const ORBS: Orb[] = [
  {
    color: "var(--accent)",
    size: 520,
    top: "-12%",
    left: "-8%",
    opacity: 0.18,
    duration: 20,
    drift: { x: [0, 90, 0], y: [0, 60, 0], scale: [1, 1.14, 1] },
  },
  {
    color: "var(--orb-indigo)",
    size: 560,
    top: "8%",
    right: "-12%",
    opacity: 0.22,
    duration: 27,
    drift: { x: [0, -80, 0], y: [0, 70, 0], scale: [1, 1.18, 1] },
  },
  {
    color: "var(--orb-violet)",
    size: 460,
    bottom: "-16%",
    left: "16%",
    opacity: 0.16,
    duration: 24,
    drift: { x: [0, 70, 0], y: [0, -60, 0], scale: [1, 1.1, 1] },
  },
];

export function Background() {
  const reduced = usePrefersReducedMotion();
  const finePointer = useFinePointer();

  const pointerX = useMotionValue(-1000);
  const pointerY = useMotionValue(-1000);
  const spotX = useSpring(pointerX, { stiffness: 90, damping: 20, mass: 0.6 });
  const spotY = useSpring(pointerY, { stiffness: 90, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (!finePointer || reduced) return;
    const onMove = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [finePointer, reduced, pointerX, pointerY]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[linear-gradient(165deg,var(--auth-1),var(--auth-2))]"
    >
      {ORBS.map((orb, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            top: orb.top,
            left: "left" in orb ? orb.left : undefined,
            right: "right" in orb ? orb.right : undefined,
            bottom: "bottom" in orb ? orb.bottom : undefined,
            width: orb.size,
            height: orb.size,
            opacity: orb.opacity,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            filter: "blur(90px)",
          }}
          animate={reduced ? undefined : orb.drift}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Faint grid, faded toward the edges by a radial mask. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: GRID_IMAGE,
          maskImage: GRID_MASK,
          WebkitMaskImage: GRID_MASK,
        }}
      />

      {/* Film grain. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: GRAIN, backgroundRepeat: "repeat" }}
      />

      {/* Rising dust — 28 on desktop, fewer on phones (extra ones hidden). */}
      {!reduced &&
        DUST.map((dust, index) => (
          <motion.span
            key={index}
            className={
              index >= 10
                ? "absolute hidden rounded-full bg-white md:block"
                : "absolute rounded-full bg-white"
            }
            style={{
              left: `${dust.left}%`,
              bottom: `${dust.bottom}%`,
              width: dust.size,
              height: dust.size,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: [0, dust.peak, 0],
              y: [12, -180],
              x: [0, dust.drift],
            }}
            transition={{
              duration: dust.duration,
              delay: dust.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* Cursor spotlight. */}
      {finePointer && !reduced && (
        <motion.div
          className="absolute left-0 top-0 h-[320px] w-[320px] rounded-full"
          style={{
            x: spotX,
            y: spotY,
            marginLeft: -160,
            marginTop: -160,
            background: "radial-gradient(circle, var(--accent-tint), transparent 70%)",
          }}
        />
      )}
    </div>
  );
}
