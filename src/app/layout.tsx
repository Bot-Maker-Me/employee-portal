import type { Metadata, Viewport } from "next";
import "./globals.css";
import { jetbrainsMono, manrope, playfair } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Employee Portal",
  description:
    "Secure internal messaging and pharmacy topic channels for pharmacy teams.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1020",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
