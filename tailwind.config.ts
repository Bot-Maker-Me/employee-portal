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
        "rise-sm": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "draw-line": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        flow: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "rise-left": {
          from: { opacity: "0", transform: "translate3d(-12px, 6px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "rise-right": {
          from: { opacity: "0", transform: "translate3d(12px, 6px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "blur-in": {
          from: { opacity: "0", transform: "translateY(10px)", filter: "blur(6px)" },
          to: { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 var(--accent-tint)" },
          "50%": { opacity: "0.72", boxShadow: "0 0 0 6px var(--accent-tint)" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.45" },
          "40%": { transform: "translateY(-3px)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both",
        rise: "rise 520ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "rise-sm": "rise-sm 340ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "rise-left": "rise-left 460ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "rise-right": "rise-right 460ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "blur-in": "blur-in 640ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 280ms cubic-bezier(0.34, 1.4, 0.64, 1) both",
        "slide-down": "slide-down 300ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "draw-line": "draw-line 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 7s ease-in-out infinite",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        flow: "flow 7s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "bounce-dot": "bounce-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
