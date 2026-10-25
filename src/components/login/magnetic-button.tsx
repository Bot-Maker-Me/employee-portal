"use client";

import { AnimatePresence, motion, useSpring } from "framer-motion";
import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinePointer } from "./use-media";

type Ripple = { id: number; x: number; y: number };

type MagneticButtonProps = {
  children: ReactNode;
  loading?: boolean;
  success?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Coral submit button: magnetic drift toward the cursor, lift + glow + sweep on
 * hover, press scale with a click ripple, and a spinner → success morph.
 */
export function MagneticButton({
  children,
  loading = false,
  success = false,
  className,
  onClick,
  disabled,
  type = "button",
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const magnet = useFinePointer();
  const x = useSpring(0, { stiffness: 180, damping: 15, mass: 0.4 });
  const y = useSpring(0, { stiffness: 180, damping: 15, mass: 0.4 });
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const busy = loading || success;

  function handlePointerMove(event: ReactPointerEvent<HTMLSpanElement>) {
    if (!magnet || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 16);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * 10);
  }

  function resetMagnet() {
    x.set(0);
    y.set(0);
  }

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const id = Date.now() + Math.random();
      setRipples((prev) => [
        ...prev,
        { id, x: event.clientX - rect.left, y: event.clientY - rect.top },
      ]);
      window.setTimeout(
        () => setRipples((prev) => prev.filter((ripple) => ripple.id !== id)),
        650,
      );
    }
    onClick?.(event);
  }

  return (
    <motion.span
      className="relative block w-full"
      style={{ x, y }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetMagnet}
    >
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled || busy}
        onClick={handleClick}
        whileHover={busy ? undefined : { y: -2 }}
        whileTap={busy ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className={cn(
          "sheen group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3.5",
          "label-mono tracking-[0.18em] text-white",
          "shadow-[0_12px_30px_-14px_var(--accent)] transition-shadow duration-300 hover:shadow-[0_20px_44px_-14px_var(--accent)]",
          "disabled:cursor-not-allowed",
          success
            ? "bg-[var(--ok)]"
            : "bg-[linear-gradient(135deg,var(--accent-grad-a),var(--accent-grad-b))]",
          className,
        )}
        {...rest}
      >
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full bg-white/40"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
            }}
            initial={{ scale: 0, opacity: 0.55 }}
            animate={{ scale: 22, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        ))}

        <AnimatePresence mode="wait" initial={false}>
          {success ? (
            <motion.span
              key="success"
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.25 }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <motion.path
                  d="M4 12.5l5 5L20 6.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </svg>
              <span>Signed in</span>
            </motion.span>
          ) : loading ? (
            <motion.span
              key="loading"
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Authenticating…</span>
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.span>
  );
}
