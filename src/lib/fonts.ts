import { Inter, JetBrains_Mono, Manrope, Playfair_Display } from "next/font/google";

export const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
});

export const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-jetbrains",
});

/** Inter — the body face on the sign-in scene (opted in per page). */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
