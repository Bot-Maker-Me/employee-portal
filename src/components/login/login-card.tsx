"use client";

import {
  motion,
  useAnimationControls,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  useEffect,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useFinePointer, usePrefersReducedMotion } from "./use-media";

const EASE = [0.16, 1, 0.3, 1] as const;

/** 1px ring: the conic gradient shows only inside the padding box. */
const RING_MASK: CSSProperties = {
  padding: 1,
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  maskComposite: "exclude",
};

/**
 * Frosted glass card: rotating conic-gradient edge, subtle hover tilt, an inner
 * spotlight that follows the cursor, a shake on auth error and a fade on success.
 */
export function LoginCard({
  children,
  error,
  success = false,
}: {
  children: ReactNode;
  error?: string | null;
  success?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const finePointer = useFinePointer();
  const shake = useAnimationControls();

  const rotateX = useSpring(0, { stiffness: 150, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 150, damping: 18 });
  const spotX = useMotionValue(50);
  const spotY = useMotionValue(50);
  const spotlight = useMotionTemplate`radial-gradient(280px circle at ${spotX}% ${spotY}%, var(--accent-tint), transparent 70%)`;

  useEffect(() => {
    if (!error || reduced) return;
    shake.start(
      { x: [0, -12, 12, -9, 9, -5, 5, 0] },
      { duration: 0.5, ease: "easeInOut" },
    );
  }, [error, reduced, shake]);

  function handleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!finePointer || reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 6);
    rotateX.set(-py * 6);
    spotX.set(px * 100 + 50);
    spotY.set(py * 100 + 50);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
    spotX.set(50);
    spotY.set(50);
  }

  return (
    <motion.div
      className="relative"
      initial={reduced ? false : { opacity: 0, x: 60 }}
      animate={
        success
          ? { opacity: 0, y: -12, filter: "blur(8px)" }
          : { opacity: 1, x: 0, y: 0, filter: "blur(0px)" }
      }
      transition={
        success
          ? { duration: 0.6, ease: "easeInOut" }
          : { type: "spring", stiffness: 70, damping: 16, delay: reduced ? 0 : 1.15 }
      }
    >
      <motion.div
        animate={shake}
        className="relative"
        style={{ transformPerspective: 1000 }}
      >
        <motion.div
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
          style={{ rotateX, rotateY }}
          className="relative rounded-3xl border border-white/10 bg-white/5 p-7 shadow-glass backdrop-blur-xl sm:p-9"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ background: spotlight }}
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <motion.span
                className="h-px w-8 origin-left bg-accent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: reduced ? 0 : 1.3, ease: EASE }}
              />
              <span className="label-mono text-accent-soft">
                § 02 · Credentials
              </span>
            </div>

            <motion.h2
              className="mt-5 font-serif text-3xl leading-tight text-ink"
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: reduced ? 0 : 1.35, ease: EASE }}
            >
              Access the portal
            </motion.h2>

            <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
              Sign in with the username and password your administrator gave
              you. There is no email sign-up and no reset link — a password
              reset is issued by an administrator.
            </p>

            {children}
          </div>
        </motion.div>

        {/* Slow conic-gradient edge. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
          style={RING_MASK}
        >
          <motion.div
            className="absolute left-1/2 top-1/2 h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "conic-gradient(from 0deg, transparent, var(--accent), transparent 35%, var(--orb-indigo), transparent 70%)",
            }}
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
