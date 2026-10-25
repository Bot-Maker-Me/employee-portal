"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "./use-media";

const EASE = [0.16, 1, 0.3, 1] as const;
const WORDS = ["Every", "conversation,", "LOGGED", "and", "secure."];

const listVariants = {
  hidden: {},
  show: (stagger: number) => ({
    transition: { staggerChildren: stagger, delayChildren: 0.5 },
  }),
};

const wordVariants = {
  hidden: { y: "115%" },
  show: (duration: number) => ({
    y: "0%",
    transition: { duration, ease: EASE },
  }),
};

/** The accented word: gradient fill, breathing glow, one-time shimmer. */
function LoggedWord() {
  return (
    <span className="relative inline-block">
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 text-accent blur-[10px]"
        animate={{ opacity: [0.35, 0.8, 0.35] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        LOGGED
      </motion.span>
      <span className="relative bg-gradient-to-r from-accent to-accent-warm bg-clip-text text-transparent">
        LOGGED
      </span>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-2 -right-2"
        style={{
          background:
            "linear-gradient(100deg, transparent 25%, var(--gloss) 50%, transparent 75%)",
        }}
        initial={{ x: "-130%", opacity: 0 }}
        animate={{ x: "130%", opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.1, delay: 1.9, ease: "easeInOut" }}
      />
    </span>
  );
}

function Word({ word, reduced }: { word: string; reduced: boolean }) {
  const isLogged = word === "LOGGED";
  return (
    <span className="mr-[0.24em] inline-block overflow-hidden pb-[0.14em] align-bottom last:mr-0">
      <motion.span
        className="inline-block"
        variants={wordVariants}
        custom={reduced ? 0 : 0.8}
      >
        {isLogged ? <LoggedWord /> : word}
      </motion.span>
    </span>
  );
}

export function Hero() {
  const reduced = usePrefersReducedMotion();
  const at = (seconds: number) => (reduced ? 0 : seconds);

  return (
    <div>
      <motion.p
        className="label-mono text-accent"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: at(0.05), ease: EASE }}
      >
        Employee Portal
      </motion.p>

      <div className="mt-6 flex items-center gap-3">
        <motion.span
          className="h-px w-10 origin-left bg-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, delay: at(0.2), ease: EASE }}
        />
        <motion.span
          className="label-mono text-accent-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: at(0.38) }}
        >
          § 01 · Sign in
        </motion.span>
      </div>

      <motion.h1
        className="mt-6 font-serif text-[2.6rem] leading-[1.05] tracking-[-0.012em] text-ink sm:text-[3.05rem] lg:text-[3.35rem]"
        variants={listVariants}
        initial="hidden"
        animate="show"
        custom={reduced ? 0 : 0.08}
      >
        {WORDS.map((word) => (
          <Word key={word} word={word} reduced={reduced} />
        ))}
      </motion.h1>

      <motion.p
        className="mt-6 max-w-md text-[15px] leading-relaxed text-muted"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: at(1.0), ease: EASE }}
      >
        A calm, auditable space for pharmacy teams — internal chat and pharmacy
        chat channels, kept in a single register.
      </motion.p>
    </div>
  );
}
