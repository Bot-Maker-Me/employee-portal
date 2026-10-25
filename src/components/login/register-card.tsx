"use client";

import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useFinePointer, usePrefersReducedMotion } from "./use-media";

const EASE = [0.16, 1, 0.3, 1] as const;
const ROTATE_MS = 5000;

type Row = { tag: string; topic: string; status: "OPEN" | "CLOSED"; time: string };

const INITIAL: Row[] = [
  { tag: "#4211", topic: "Order query", status: "OPEN", time: "09:14" },
  { tag: "#4210", topic: "Delivery", status: "CLOSED", time: "08:52" },
  { tag: "#4209", topic: "Clinical question", status: "OPEN", time: "09:02" },
];

const INCOMING: Row[] = [
  { tag: "#4212", topic: "Stock check", status: "OPEN", time: "09:26" },
  { tag: "#4213", topic: "Patient callback", status: "OPEN", time: "09:31" },
  { tag: "#4214", topic: "Supplier query", status: "OPEN", time: "09:38" },
];

/** Nudge a HH:MM stamp forward a minute — the register quietly ticking. */
function tick(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const total = (Number(match[1]) * 60 + Number(match[2]) + 1) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function RegisterCard() {
  const reduced = usePrefersReducedMotion();
  const finePointer = useFinePointer();

  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [rotated, setRotated] = useState(false);
  const [hovered, setHovered] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef(0);

  const rotateX = useSpring(0, { stiffness: 140, damping: 14 });
  const rotateY = useSpring(0, { stiffness: 140, damping: 14 });
  const glossX = useMotionValue(50);
  const glossY = useMotionValue(50);
  const gloss = useMotionTemplate`radial-gradient(220px circle at ${glossX}% ${glossY}%, var(--gloss), transparent 60%)`;

  // A new row arrives every 5s; the oldest slips out and times tick on.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      const incoming = INCOMING[nextRef.current % INCOMING.length];
      nextRef.current += 1;
      setRows((prev) => {
        const kept = prev
          .slice(0, prev.length - 1)
          .map((row) => ({ ...row, time: tick(row.time) }));
        const top = tick(prev[0]?.time ?? incoming.time);
        return [{ ...incoming, time: top }, ...kept];
      });
      setRotated(true);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  function handleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!finePointer || reduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 16);
    rotateX.set(-py * 16);
    glossX.set(px * 100 + 50);
    glossY.set(py * 100 + 50);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glossX.set(50);
    glossY.set(50);
    setHovered(false);
  }

  const showGloss = hovered && finePointer && !reduced;

  return (
    <div className="relative w-full max-w-[24rem]" style={{ perspective: 1000 }}>
      <motion.div
        animate={reduced ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          ref={cardRef}
          onPointerMove={handleMove}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={handleLeave}
          style={{ rotateX, rotateY, rotate: -2, transformStyle: "preserve-3d" }}
          className="paper-texture relative rounded-ledger border border-paper-line bg-paper px-6 py-5 text-paper-ink shadow-float"
        >
          <div className="flex items-baseline justify-between border-b border-paper-line pb-3.5">
            <span className="label-mono text-paper-muted">Register · Live</span>
            <span className="label-mono text-paper-muted">FY 26</span>
          </div>

          <ul className="mt-1">
            <AnimatePresence mode="popLayout">
              {rows.map((row, index) => (
                <motion.li
                  key={row.tag}
                  layout
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{
                    duration: 0.5,
                    delay: rotated ? 0 : index * 0.12,
                    ease: EASE,
                    layout: { duration: 0.5, ease: EASE, delay: 0 },
                  }}
                  className="border-b border-paper-line last:border-b-0"
                >
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="flex items-center justify-between gap-4 rounded-lg py-3.5 pr-1 transition-colors duration-300 hover:bg-paper-hover"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-[15px] leading-tight text-paper-ink">
                        {row.topic}
                      </span>
                      <span className="label-mono text-paper-muted">
                        {row.tag}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="flex items-center justify-end gap-1.5">
                        {row.status === "OPEN" ? (
                          <>
                            <motion.span
                              className="h-1.5 w-1.5 rounded-full bg-accent"
                              animate={{ opacity: [1, 0.35, 1], scale: [1, 1.4, 1] }}
                              transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                            <span className="label-mono text-accent">Open</span>
                          </>
                        ) : (
                          <span className="label-mono text-paper-muted">
                            Closed
                          </span>
                        )}
                      </span>
                      <span className="label-mono text-paper-muted">
                        {row.time}
                      </span>
                    </span>
                  </motion.div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {/* Glossy reflection that follows the cursor. */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-ledger"
            style={{ background: gloss }}
            animate={{ opacity: showGloss ? 0.4 : 0 }}
            transition={{ duration: 0.4 }}
          />

          {/* SECURE stamp — slams in, then sits still on the card. */}
          <motion.div
            className="absolute -right-6 -top-7 h-[5.4rem] w-[5.4rem] text-accent"
            initial={{ scale: 2.5, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: -12, opacity: 1 }}
            transition={{
              delay: reduced ? 0 : 1.5,
              type: "spring",
              stiffness: 190,
              damping: 12,
              mass: 0.9,
            }}
          >
            <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
              <defs>
                <path
                  id="stamp-ring"
                  d="M60,60 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"
                  fill="none"
                />
              </defs>
              <circle
                cx="60"
                cy="60"
                r="57"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.9"
              />
              <circle
                cx="60"
                cy="60"
                r="51"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.5"
              />
              <text
                className="fill-current font-mono"
                style={{ fontSize: 12, letterSpacing: "0.14em" }}
              >
                <textPath href="#stamp-ring" startOffset="0">
                  SECURE · AUDIT · SECURE · AUDIT ·
                </textPath>
              </text>
            </svg>
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-accent"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
              transition={{
                delay: reduced ? 0 : 1.6,
                duration: 0.9,
                ease: "easeOut",
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Floating glass chips, drifting at their own speeds. */}
      <motion.div
        className="absolute -left-10 top-12 hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md md:flex"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0, y: [0, -8, 0] }}
        transition={{
          opacity: { delay: reduced ? 0 : 1.9, duration: 0.5 },
          x: { delay: reduced ? 0 : 1.9, duration: 0.5 },
          y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <span aria-hidden="true">🔒</span>
        <span className="label-mono text-ink">End-to-end encrypted</span>
      </motion.div>

      <motion.div
        className="absolute -right-8 bottom-14 hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md md:flex"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0, y: [0, 10, 0] }}
        transition={{
          opacity: { delay: reduced ? 0 : 2.05, duration: 0.5 },
          x: { delay: reduced ? 0 : 2.05, duration: 0.5 },
          y: { duration: 6.5, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <span aria-hidden="true" className="text-ok">
          ✓
        </span>
        <span className="label-mono text-ink">Audit trail on</span>
      </motion.div>
    </div>
  );
}
