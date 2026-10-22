import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        raised: "var(--bg-raised)",
        sunken: "var(--bg-sunken)",
        line: "var(--line)",
        paper: {
          DEFAULT: "var(--paper)",
          ink: "var(--paper-ink)",
        },
        ink: "var(--text)",
        muted: "var(--text-muted)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          tint: "var(--accent-tint)",
        },
        ok: "var(--ok)",
        warn: "var(--warn)",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "Inter", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono-jetbrains)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      borderRadius: {
        btn: "3px",
        ledger: "16px",
      },
      boxShadow: {
        ledger: "0 24px 48px -24px rgba(3, 6, 15, 0.75)",
        raised: "0 18px 36px -28px rgba(3, 6, 15, 0.85)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 var(--accent-tint)" },
          "50%": { opacity: "0.72", boxShadow: "0 0 0 6px var(--accent-tint)" },
        },
      },
      animation: {
        "fade-in": "fade-in 320ms ease-out both",
        rise: "rise 360ms ease-out both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
