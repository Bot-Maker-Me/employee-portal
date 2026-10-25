import type { CSSProperties } from "react";

/**
 * Light particles drifting up through the silk backdrop.
 *
 * Decorative only. Positions, sizes and timings come from a fixed table —
 * never random — so the server and client render exactly the same markup.
 * Colours and blur live in `globals.css` (`.particle`, `.particle-orb`);
 * `--sway` / `--drift` give each one its own path.
 */
type Particle = {
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  sway?: number;
  drift?: number;
  accent?: boolean;
};

/** Small, fairly crisp points. Kept towards the edges of the content column. */
const DOTS: Particle[] = [
  { top: "8%", left: "22%", size: 3, duration: 13, delay: 0, sway: 10, drift: -34 },
  { top: "14%", left: "68%", size: 2, duration: 16, delay: 2, sway: -12, drift: -44 },
  { top: "22%", left: "9%", size: 3, duration: 12, delay: 5, sway: 14, drift: -30 },
  { top: "30%", left: "88%", size: 2, duration: 18, delay: 1, sway: -10, drift: -50 },
  { top: "38%", left: "34%", size: 3, duration: 15, delay: 7, sway: 8, drift: -36 },
  { top: "47%", left: "72%", size: 2, duration: 11, delay: 3, sway: -14, drift: -28 },
  { top: "55%", left: "15%", size: 3, duration: 17, delay: 9, sway: 12, drift: -46 },
  { top: "62%", left: "58%", size: 2, duration: 14, delay: 4, sway: -8, drift: -38 },
  { top: "70%", left: "26%", size: 3, duration: 19, delay: 6, sway: 10, drift: -52 },
  { top: "78%", left: "80%", size: 2, duration: 13, delay: 8, sway: -12, drift: -32 },
  { top: "86%", left: "44%", size: 3, duration: 16, delay: 10, sway: 9, drift: -42 },
  { top: "92%", left: "66%", size: 2, duration: 12, delay: 11, sway: -10, drift: -26 },
  // Two in the brand crimson, so the palette stays tied together.
  { top: "20%", left: "47%", size: 2, duration: 15, delay: 5.5, sway: 10, drift: -34, accent: true },
  { top: "64%", left: "91%", size: 2, duration: 17, delay: 7.5, sway: -12, drift: -40, accent: true },
];

/** Larger, softer motes for depth — hidden on phones. */
const ORBS: Particle[] = [
  { top: "18%", left: "30%", size: 14, duration: 21, delay: 0 },
  { top: "44%", left: "82%", size: 12, duration: 26, delay: 4 },
  { top: "58%", left: "12%", size: 16, duration: 23, delay: 8 },
  { top: "82%", left: "56%", size: 12, duration: 28, delay: 2 },
  { top: "34%", left: "92%", size: 10, duration: 24, delay: 6, accent: true },
];

export function LightParticles() {
  return (
    <>
      {ORBS.map((orb, index) => (
        <span
          key={`orb-${index}`}
          className={
            orb.accent ? "particle-orb particle-accent" : "particle-orb"
          }
          style={{
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            animationDuration: `${orb.duration}s`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}
      {DOTS.map((dot, index) => (
        <span
          key={`dot-${index}`}
          className={dot.accent ? "particle particle-accent" : "particle"}
          style={
            {
              top: dot.top,
              left: dot.left,
              width: dot.size,
              height: dot.size,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
              "--sway": `${dot.sway ?? 10}px`,
              "--drift": `${dot.drift ?? -38}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}
